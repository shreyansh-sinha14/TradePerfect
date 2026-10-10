"""
FINAL MODEL: Random Forest
Run from risk-service folder:   python training/train_final_rf.py
Saves to: artifacts/models/rf-v1/
"""
import sys, os, json, joblib
sys.path.append(".")
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, confusion_matrix
from training.load_data import load
from app.engine.features import features

OUT = "artifacts/models/rf-v1"
os.makedirs(OUT, exist_ok=True)

# 1. Load + time split: Jan-Jun train, Jul validation, Aug-Sep test
df = load("data/raw/Historical_Trade_Dataset_50K.csv")
train = df[df["tradeDate"] < "2026-07-01"]
val = df[(df["tradeDate"] >= "2026-07-01") & (df["tradeDate"] < "2026-08-01")]
test = df[df["tradeDate"] >= "2026-08-01"]

# 2. Spec 3.2.5: counterparty failure counts from the historical file
CP_FAIL_COUNT = df.groupby("counterparty")["label"].sum().to_dict()

# 3. Features (same function as live scoring)
def X(d):
    return features(d, CP_FAIL_COUNT).drop(columns=["_past"])

X_tr, y_tr = X(train), train["label"]
X_va, y_va = X(val), val["label"]
X_te, y_te = X(test), test["label"]

# 4. Train
model = RandomForestClassifier(n_estimators=300, max_depth=10, min_samples_leaf=20,
                               random_state=42, n_jobs=-1)
model.fit(X_tr, y_tr)


def metrics(y, p, thr):
    tn, fp, fn, tp = confusion_matrix(y, (p >= thr).astype(int), labels=[0, 1]).ravel()
    prec = tp / (tp + fp) if tp + fp else 0
    rec = tp / (tp + fn)
    return {"accuracy": (tp + tn) / len(y), "auc": roc_auc_score(y, p), "recall": rec, "precision": prec,
            "f1": 2 * prec * rec / (prec + rec) if prec + rec else 0, "fpr": fp / (fp + tn)}


def passed(m):
    return {"accuracy": m["accuracy"] > 0.90, "auc": m["auc"] >= 0.90, "recall": m["recall"] >= 0.85,
            "precision": m["precision"] >= 0.70, "f1": m["f1"] >= 0.77, "fpr": m["fpr"] < 0.05}


# 5. Threshold on VALIDATION: FPR <= 4.5% (margin under 5%), recall >= 0.85, accuracy > 90%, highest recall
p_va = model.predict_proba(X_va)[:, 1]
cands = [(metrics(y_va, p_va, t)["recall"], t) for t in np.arange(0.30, 0.96, 0.01).round(2)
         if metrics(y_va, p_va, t)["fpr"] <= 0.045 and metrics(y_va, p_va, t)["recall"] >= 0.85
         and metrics(y_va, p_va, t)["accuracy"] > 0.90]
if cands:
    THRESHOLD = max(cands)[1]
else:
    THRESHOLD = max(np.arange(0.30, 0.91, 0.01).round(2),
                    key=lambda t: (sum(passed(metrics(y_va, p_va, t)).values()), metrics(y_va, p_va, t)["f1"]))

# 6. Test once -> 6 spec metrics
p_te = model.predict_proba(X_te)[:, 1]
m = metrics(y_te, p_te, THRESHOLD)
ok = passed(m)
print(f"=== FINAL MODEL: RANDOM FOREST (spec 3.3.3) === threshold {THRESHOLD}")
print(f"{'Metric':22s}{'Value':>8s}   {'Target':10s}Result")
for name, k, tgt in [("Accuracy", "accuracy", "> 90%"), ("AUC-ROC", "auc", ">= 0.90"), ("Recall", "recall", ">= 0.85"),
                     ("Precision", "precision", ">= 0.70"), ("F1 Score", "f1", ">= 0.77"),
                     ("False Positive Rate", "fpr", "< 5%")]:
    v = f"{m[k] * 100:.2f}%" if k in ("accuracy", "fpr") else f"{m[k]:.4f}"
    print(f"{name:22s}{v:>8s}   {tgt:10s}{'PASS' if ok[k] else 'FAIL'}")

# 7. Save bundle (the API loads this)
joblib.dump({"model": model, "features": list(X_tr.columns), "threshold": float(THRESHOLD),
             "cp_fail_count": CP_FAIL_COUNT, "version": "rf-v1"}, f"{OUT}/model.joblib")
json.dump({"version": "rf-v1", "threshold": float(THRESHOLD), "test": m, "passed": ok},
          open(f"{OUT}/metrics.json", "w"), indent=2, default=float)
X_te.assign(tradeId=test["tradeId"].values, label=y_te.values).to_csv(f"{OUT}/test_features.csv", index=False)
open("artifacts/models/ACTIVE", "w").write("rf-v1")
print(f"\nSaved {OUT}/model.joblib")