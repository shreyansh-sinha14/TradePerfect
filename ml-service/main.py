

import os
import uuid
from pathlib import Path

import joblib
import pandas as pd
import numpy as np
from catboost import CatBoostClassifier
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "trade_settlement_failure_model.cbm"
METADATA_PATH = BASE_DIR / "model_metadata.joblib"

app = FastAPI(title="TradePerfect ML Service", version="1.0.0")

# Load the trained model and its feature schema
model = CatBoostClassifier()
model.load_model(str(MODEL_PATH))

metadata = joblib.load(METADATA_PATH)
FEATURE_COLUMNS = metadata["feature_columns"]
CAT_FEATURES = metadata["categorical_features"]
THRESHOLD = float(metadata["threshold"])


class TradeFeatures(BaseModel):
    trade: dict = Field(
        ...,
        description="Trade fields using the original notebook column names"
    )
    requestId: str | None = None


def prepare_trade(raw_trade: dict) -> pd.DataFrame:
    """Apply the same feature engineering as the training notebook."""
    x = pd.DataFrame([raw_trade])

    required = ["Trade Date", "Settlement Date", "Quantity", "Price"]
    missing = [c for c in required if c not in x.columns]
    if missing:
        raise ValueError(f"Missing required fields: {missing}")

    trade_date = pd.to_datetime(x["Trade Date"], errors="coerce")
    settlement_date = pd.to_datetime(
        x["Settlement Date"], errors="coerce"
    )

    if trade_date.isna().any() or settlement_date.isna().any():
        raise ValueError("Trade Date and Settlement Date must be valid dates")

    x["Settlement_Lag_Days"] = (
        settlement_date - trade_date
    ).dt.days
    x["Trade_Weekday"] = trade_date.dt.dayofweek.astype(str)
    x["Settlement_Weekday"] = settlement_date.dt.dayofweek.astype(str)
    x["Trade_Month"] = trade_date.dt.month.astype(str)
    x["Settlement_Month"] = settlement_date.dt.month.astype(str)
    x["Trade_Is_Weekend"] = (
        trade_date.dt.dayofweek >= 5
    ).astype(int)
    x["Settlement_Is_Weekend"] = (
        settlement_date.dt.dayofweek >= 5
    ).astype(int)

    x["Quantity"] = pd.to_numeric(x["Quantity"], errors="coerce")
    x["Price"] = pd.to_numeric(x["Price"], errors="coerce")
    x["Quantity_Log"] = np.log1p(x["Quantity"].clip(lower=0))
    x["Price_Log"] = np.log1p(x["Price"].clip(lower=0))

    x = x.drop(
        columns=[
            c for c in [
                "Trade ID", "Trade Date", "Settlement Date",
                "Settlement Failed"
            ] if c in x.columns
        ]
    )

    # Match the exact columns used when training
    x = x.reindex(columns=FEATURE_COLUMNS)

    for col in CAT_FEATURES:
        x[col] = x[col].fillna("UNKNOWN").astype(str)

    for col in x.columns:
        if col not in CAT_FEATURES:
            x[col] = pd.to_numeric(x[col], errors="coerce")

    return x


@app.get("/health")
def health():
    return {
        "status": "ok",
        "modelVersion": "catboost-v1"
    }


@app.post("/predict")
def predict(payload: TradeFeatures):
    request_id = payload.requestId or str(uuid.uuid4())

    try:
        features = prepare_trade(payload.trade)

        # Do not return a fabricated prediction if input is invalid
        if features.isna().any().any():
            raise ValueError("One or more numeric model features are invalid")

        probability = float(model.predict_proba(features)[0, 1])
        prediction = int(probability >= THRESHOLD)

        return {
            "requestId": request_id,
            "modelVersion": "catboost-v1",
            "prediction": prediction,
            "predictionLabel": "YES" if prediction == 1 else "NO",
            "mlScore": probability
        }

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Model prediction failed"
        )
