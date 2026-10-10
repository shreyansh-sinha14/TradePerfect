"""
Train the XGBoost settlement-failure model.
Run from risk-service folder:   python training/train_xgb.py
Saves to: artifacts/models/xgb-v1/
"""
import sys, json, os
sys.path.append(".")
import numpy as np
import pandas as pd
from sklearn.model_selection import KFold
from sklearn.metrics import roc_auc_score, confusion_matrix
from xgboost import XGBClassifier
from training.load_data import load

VERSION = "xgb-v1"
OUT = f"artifacts/models/{VERSION}"
os.makedirs(OUT, exist_ok=True)

# ---------------- 1. LOAD ----------------
df = load("data/raw/Historical_Trade_Dataset_50K.csv").dropna(subset=["label"])
df["label"] = df["label"].astype(int)

# ---------------- 2. TIME SPLIT ----------------
# Jan-Jun = train, Jul = validation (early stopping + threshold), Aug-Sep = test (touched once)
train = df[df["tradeDate"] < "2026-07-01"].copy()
val = df[(df["tradeDate"] >= "2026-07-01") & (df["tradeDate"] < "2026-08-01")].copy()
test = df[df["tradeDate"] >= "2026-08-01"].copy()

# ---------------- 3. HISTORY STATS (from TRAIN only = no leakage) ----------------
GLOBAL_RATE = train["label"].mean()
SMOOTH = 20  # pulls small groups toward the global rate
train["pair"] = train["counterparty"] + "|" + train["symbol"]
val["pair"] = val["counterparty"] + "|" + val["symbol"]
test["pair"] = test["counterparty"] + "|" + test["symbol"]
ENC_COLS = ["counterparty", "symbol", "accountId", "traderName", "pair"]


def rate_table(frame, col):
    g = frame.groupby(col)["label"].agg(["sum", "count"])
    return (g["sum"] + SMOOTH * GLOBAL_RATE) / (g["count"] + SMOOTH)


def add_fail_rates(frame, source, oof=False):
    """Smoothed failure rate per group. For train rows use out-of-fold so a row never sees its own label."""
    for col in ENC_COLS:
        name = f"{col}_failRate"
        if oof:
            frame[name] = GLOBAL_RATE
            for tr_idx, te_idx in KFold(5, shuffle=True, random_state=42).split(frame):
                rates = rate_table(frame.iloc[tr_idx], col)
                frame.iloc[te_idx, frame.columns.get_loc(name)] = (
                    frame.iloc[te_idx][col].map(rates).fillna(GLOBAL_RATE).values)
        else:
            frame[name] = frame[col].map(rate_table(source, col)).fillna(GLOBAL_RATE)
    return frame


# counterparty failure COUNT -> spec tier (Decision Logic 3.2.5)
CP_FAIL_COUNT = train.groupby("counterparty")["label"].sum()


def tier_points(counterparty):
    c = counterparty.map(CP_FAIL_COUNT).fillna(0)
    return np.select([c > 1500, c >= 1000, c >= 500], [0.25, 0.20, 0.10], 0.0)


# ---------------- 4. FEATURES ----------------
def build(frame):
    f = pd.DataFrame(index=frame.index)
    days = (frame["settlementDate"] - frame["tradeDate"]).dt.days
    f["SSI_Matched_Flag"] = frame["ssiMatched"]
    f["Currency_Matched_Flag"] = frame["currencyMatched"]
    f["Quantity"] = frame["quantity"]
    f["Qty_Out_Of_Range"] = ((frame["quantity"] < 100) | (frame["quantity"] > 5000)).astype(int)
    f["Days_To_Settlement"] = days
    f["Is_Weekend_Settlement"] = (frame["settlementDate"].dt.weekday >= 5).astype(int)
    f["Settle_DayOfWeek"] = frame["settlementDate"].dt.weekday
    f["Trade_DayOfWeek"] = frame["tradeDate"].dt.weekday
    f["Is_Month_End"] = frame["settlementDate"].dt.is_month_end.astype(int)
    f["TradeType_Buy"] = (frame["tradeType"] == "BUY").astype(int)
    f["Price"] = frame["price"]
    f["Counterparty_Tier_Points"] = tier_points(frame["counterparty"])
    # Rule_Engine_Output (spec rules RS-01..RS-10, as-of = trade date)
    settle_pts = np.maximum.reduce([np.where(days < 0, 0.15, 0),
                                    np.where(f["Is_Weekend_Settlement"] == 1, 0.10, 0),
                                    np.where(days > 15, 0.05, 0)])
    qty_pts = np.select([frame["quantity"] > 5000, frame["quantity"] < 100], [0.10, 0.05], 0)
    f["Rule_Engine_Output"] = np.clip(
        np.where(frame["ssiMatched"] == 0, 0.35, 0) + np.where(frame["currencyMatched"] == 0, 0.15, 0)
        + settle_pts + f["Counterparty_Tier_Points"] + qty_pts, 0, 1)
    for col in ENC_COLS:
        f[f"{col}_failRate"] = frame[f"{col}_failRate"]
    return f.astype(float)


train = add_fail_rates(train, train, oof=True)
val = add_fail_rates(val, train)
test = add_fail_rates(test, train)
X_tr, y_tr = build(train), train["label"]
X_va, y_va = build(val), val["label"]
X_te, y_te = build(test), test["label"]
FEATURES = list(X_tr.columns)

# ---------------- 5. TRAIN (boosting rounds = "epochs", stopped early on validation) ----------------
model = XGBClassifier(
    n_estimators=2000,          # max rounds; early stopping picks the real number
    learning_rate=0.03,
    max_depth=4,
    min_child_weight=5,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_lambda=1.0,
    eval_metric=["auc", "logloss"],
    early_stopping_rounds=100,  # stop if validation logloss doesn't improve for 100 rounds
    tree_method="hist",
    random_state=42,
    n_jobs=-1,
)
model.fit(X_tr, y_tr, eval_set=[(X_tr, y_tr), (X_va, y_va)], verbose=False)


# ---------------- 6. THRESHOLD on VALIDATION ----------------
TARGETS = {"accuracy": (">", 0.90), "auc": (">=", 0.90), "recall": (">=", 0.85),
           "precision": (">=", 0.70), "f1": (">=", 0.77), "fpr": ("<", 0.05)}


def metrics_at(y, p, thr):
    pred = (p >= thr).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    return {"threshold": round(float(thr), 3), "accuracy": (tp + tn) / len(y), "auc": roc_auc_score(y, p),
            "recall": rec, "precision": prec, "f1": 2 * prec * rec / (prec + rec) if prec + rec else 0.0,
            "fpr": fp / (fp + tn) if fp + tn else 0.0, "tp": int(tp), "fp": int(fp), "fn": int(fn), "tn": int(tn)}


def passes(m):
    ok = lambda v, op, t: v > t if op == ">" else (v >= t if op == ">=" else v < t)
    return {k: bool(ok(m[k], op, t)) for k, (op, t) in TARGETS.items()}


p_va = model.predict_proba(X_va)[:, 1]
best, fallback = None, None
for thr in np.linspace(0.05, 0.95, 181):
    m = metrics_at(y_va, p_va, thr)
    if all(passes(m).values()) and (best is None or m["f1"] > best["f1"]):
        best = m
    score = (sum(passes(m).values()), m["f1"])  # most targets met, then best F1
    if fallback is None or score > fallback["_score"]:
        fallback = {**m, "_score": score}
chosen = best or fallback
chosen.pop("_score", None)
THR = chosen["threshold"]

# ---------------- 7. TEST (once) ----------------
p_te = model.predict_proba(X_te)[:, 1]
test_m = metrics_at(y_te, p_te, THR)
test_pass = passes(test_m)
NAMES = {"accuracy": "Accuracy", "auc": "AUC-ROC", "recall": "Recall", "precision": "Precision",
         "f1": "F1 Score", "fpr": "False Positive Rate"}
print("=== ML MODEL PERFORMANCE (spec 3.3.3) ===")
print(f"{'Metric':22s}{'Value':>8s}   {'Target':10s}Result")
for k, (op, t) in TARGETS.items():
    val_str = f"{test_m[k] * 100:.2f}%" if k in ("accuracy", "fpr") else f"{test_m[k]:.4f}"
    tgt_str = f"{op} {t * 100:.0f}%" if k in ("accuracy", "fpr") else f"{op} {t:.2f}"
    print(f"{NAMES[k]:22s}{val_str:>8s}   {tgt_str:10s}{'PASS' if test_pass[k] else 'FAIL'}")

# ---------------- 10. SAVE ----------------
model.save_model(f"{OUT}/model.json")
stats = {
    "global_rate": GLOBAL_RATE, "smooth": SMOOTH,
    "fail_rates": {c: rate_table(train, c).to_dict() for c in ENC_COLS},
    "cp_fail_count": CP_FAIL_COUNT.to_dict(),
}
json.dump(stats, open(f"{OUT}/train_stats.json", "w"))
json.dump({"version": VERSION, "algorithm": "XGBoost", "features": FEATURES, "threshold": THR,
           "best_iteration": int(model.best_iteration), "params": model.get_params(),
           "split": "train Jan-Jun, val Jul, test Aug-Sep 2026"},
          open(f"{OUT}/meta.json", "w"), indent=2, default=str)
json.dump({"validation": chosen, "test": test_m, "test_pass": test_pass,
           "passedGate": all(test_pass.values())}, open(f"{OUT}/metrics.json", "w"), indent=2)
