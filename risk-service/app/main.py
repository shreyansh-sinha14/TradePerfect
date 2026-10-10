"""
TradePerfect Risk Service (FastAPI)
Run from risk-service folder:   uvicorn app.main:app --port 8000 --reload
Docs: http://localhost:8000/docs
"""
import os
from typing import List, Optional
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from app.engine import scoring

INTERNAL_KEY = os.getenv("INTERNAL_KEY", "change-me-too")
app = FastAPI(title="TradePerfect Risk Service")


class TradeIn(BaseModel):
    tradeId: str
    tradeType: str
    symbol: str
    quantity: int
    price: float
    counterparty: str
    tradeDate: str          # YYYY-MM-DD
    settlementDate: str     # YYYY-MM-DD
    accountId: str
    traderName: Optional[str] = ""
    ssiMatched: bool
    currencyMatched: bool


class ScoreRequest(BaseModel):
    asOfMode: str = "TODAY"     # TODAY (live) or TRADE_DATE (historical replay)
    trades: List[TradeIn]


@app.get("/internal/v1/health")
def health():
    return {"status": "ok", "modelLoaded": scoring.MODEL is not None,
            "modelVersion": scoring.MODEL_VERSION, "ruleConfigVersion": scoring.RULE_VERSION}


@app.post("/internal/v1/score")
def score(req: ScoreRequest, x_internal_key: str = Header(None)):
    if x_internal_key != INTERNAL_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal key")
    if not req.trades:
        return {"modelVersion": scoring.MODEL_VERSION, "ruleConfigVersion": scoring.RULE_VERSION, "results": []}
    if len(req.trades) > 10000:
        raise HTTPException(status_code=413, detail="Max 10,000 trades per call")
    results = scoring.score_trades([t.model_dump() for t in req.trades], req.asOfMode)
    return {"modelVersion": scoring.MODEL_VERSION, "ruleConfigVersion": scoring.RULE_VERSION, "results": results}