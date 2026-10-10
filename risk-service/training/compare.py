import sys
sys.path.append(".")
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, brier_score_loss, confusion_matrix
from xgboost import XGBClassifier
from training.load_data import load

# 1. Same data, same time split for both models
df = load("data/raw/Historical_Trade_Dataset_50K.csv")
train = df[df["tradeDate"] < "2026-07-01"]
val = df[(df["tradeDate"] >= "2026-07-01") & (df["tradeDate"] < "2026-08-01")]
test = df[df["tradeDate"] >= "2026-08-01"]
cp_fail_count = train.groupby("counterparty")["label"].sum()  # for spec tier points


# 2. Same features for both models
def features(d):
    days = (d["settlementDate"] - d["tradeDate"]).dt.days
    f = pd.DataFrame()
    f["ssi"] = d["ssiMatched"]
    f["currency"] = d["currencyMatched"]
    f["quantity"] = d["quantity"]
    f["qtyOutOfRange"] = ((d["quantity"] < 100) | (d["quantity"] > 5000)).astype(int)
    f["days"] = days
    f["weekend"] = (d["settlementDate"].dt.weekday >= 5).astype(int)
    f["settleDay"] = d["settlementDate"].dt.weekday
    f["buy"] = (d["tradeType"] == "BUY").astype(int)
    f["price"] = d["price"]
    cnt = d["counterparty"].map(cp_fail_count).fillna(0)
    f["tierPoints"] = np.select([cnt > 1500, cnt >= 1000, cnt >= 500], [0.25, 0.20, 0.10], 0.0)
    f["ruleScore"] = np.clip((f["ssi"] == 0) * 0.35 + (f["currency"] == 0) * 0.15
                             + np.where(f["weekend"] == 1, 0.10, np.where(days > 15, 0.05, 0))
                             + f["tierPoints"]
                             + np.where(d["quantity"] > 5000, 0.10, np.where(d["quantity"] < 100, 0.05, 0)), 0, 1)
    return f


X_tr, y_tr = features(train), train["label"]
X_va, y_va = features(val), val["label"]
X_te, y_te = features(test), test["label"]

# 3. The two models
models = {
    "RandomForest": RandomForestClassifier(n_estimators=300, max_depth=10, min_samples_leaf=20,
                                           random_state=42, n_jobs=-1),
    "XGBoost": XGBClassifier(n_estimators=2000, learning_rate=0.03, max_depth=4, min_child_weight=5,
                             subsample=0.8, colsample_bytree=0.8, eval_metric=["auc", "logloss"],
                             early_stopping_rounds=100, random_state=42, n_jobs=-1),
}


def rates(y, p, thr):
    tn, fp, fn, tp = confusion_matrix(y, (p >= thr).astype(int)).ravel()
    rec, prec = tp / (tp + fn), (tp / (tp + fp) if tp + fp else 0)
    return {"acc": (tp + tn) / len(y), "recall": rec, "precision": prec,
            "f1": 2 * prec * rec / (prec + rec) if prec + rec else 0, "fpr": fp / (fp + tn)}


rows = {}
for name, m in models.items():
    if name == "XGBoost":
        m.fit(X_tr, y_tr, eval_set=[(X_va, y_va)], verbose=False)
    else:
        m.fit(X_tr, y_tr)
    p_va, p_te = m.predict_proba(X_va)[:, 1], m.predict_proba(X_te)[:, 1]

    # threshold on VALIDATION: most targets met, then best F1 (same rule for both)
    best = max(np.arange(0.05, 0.96, 0.01), key=lambda t: (
        sum([rates(y_va, p_va, t)["acc"] > 0.90, rates(y_va, p_va, t)["recall"] >= 0.85,
             rates(y_va, p_va, t)["precision"] >= 0.70, rates(y_va, p_va, t)["f1"] >= 0.77,
             rates(y_va, p_va, t)["fpr"] < 0.05]), rates(y_va, p_va, t)["f1"]))
    r = rates(y_te, p_te, best)
    auc = roc_auc_score(y_te, p_te)
    met = sum([r["acc"] > 0.90, auc >= 0.90, r["recall"] >= 0.85, r["precision"] >= 0.70,
               r["f1"] >= 0.77, r["fpr"] < 0.05])

    # Criterion 2: FPR at the SAME recall (90%) -> fair false-alarm comparison
    thr90 = max(t for t in np.arange(0.01, 0.99, 0.005) if rates(y_te, p_te, t)["recall"] >= 0.90)
    fpr_at_90 = rates(y_te, p_te, thr90)["fpr"]

    # Criterion 4: stability = AUC per test month
    months = test["tradeDate"].dt.month.values
    auc_by_month = [roc_auc_score(y_te[months == mo], p_te[months == mo]) for mo in np.unique(months)]

    # Criterion 5: hybrid formula outcome (0.3 ML + 0.7 rules)
    final = 0.3 * p_te + 0.7 * X_te["ruleScore"].values
    fails_in_pass = int(((final < 0.5) & (y_te.values == 1)).sum())

    rows[name] = {"1. targets met (of 6)": met, "threshold": round(best, 2),
                  "accuracy": r["acc"], "AUC": auc, "recall": r["recall"], "precision": r["precision"],
                  "F1": r["f1"], "FPR": r["fpr"],
                  "2. FPR at 90% recall (lower=better)": fpr_at_90,
                  "3. Brier score (lower=better)": brier_score_loss(y_te, p_te),
                  "4. AUC spread across months (lower=better)": max(auc_by_month) - min(auc_by_month),
                  "5. real failures marked PASS (lower=better)": fails_in_pass}

table = pd.DataFrame(rows)
print("\n=== FAIR COMPARISON (same features, same split, same threshold rule) ===")
print(table.round(4).to_string())

# Decision: XGBoost only if clearly better on criteria 2-5, else Random Forest (spec)
rf, xg = rows["RandomForest"], rows["XGBoost"]
wins = sum([xg["2. FPR at 90% recall (lower=better)"] < rf["2. FPR at 90% recall (lower=better)"] - 0.01,
            xg["3. Brier score (lower=better)"] < rf["3. Brier score (lower=better)"] - 0.005,
            xg["4. AUC spread across months (lower=better)"] < rf["4. AUC spread across months (lower=better)"] - 0.005,
            xg["5. real failures marked PASS (lower=better)"] < rf["5. real failures marked PASS (lower=better)"] * 0.95])
print(f"\nXGBoost clearly better on {wins} of 4 business criteria")
print("DECISION:", "XGBoost (clearly better)" if xg["1. targets met (of 6)"] >= rf["1. targets met (of 6)"] and wins >= 2
      else "Random Forest (spec model; difference not significant)")