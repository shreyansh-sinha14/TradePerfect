"""
Scoring engine: Rules (70%) + Random Forest (30%) -> FinalScore -> status -> explanation.
Used by the FastAPI /score endpoint.
"""
import os
from datetime import date
import joblib
import numpy as np
import pandas as pd

from app.engine.features import features, rules_fired

MODEL_PATH = os.getenv("MODEL_PATH", "artifacts/models/rf-v1/model.joblib")

# Load once at startup. If missing -> RULES_ONLY mode (never a silent PASS).
try:
    BUNDLE = joblib.load(MODEL_PATH)
    MODEL, FEATURES, CP_FAIL_COUNT = BUNDLE["model"], BUNDLE["features"], BUNDLE["cp_fail_count"]
    MODEL_VERSION = BUNDLE.get("version", "rf-v1")
except Exception:
    BUNDLE, MODEL, FEATURES, CP_FAIL_COUNT, MODEL_VERSION = None, None, None, {}, "none"

try:
    import shap
    EXPLAINER = shap.TreeExplainer(MODEL) if MODEL is not None else None
except Exception:
    EXPLAINER = None

RULE_VERSION = "rules-v1 (Decision Logic 3.2)"

FIXES = {
    "SSI not matched": "Re-confirm SSI with the counterparty before settlement.",
    "Currency not matched": "Align settlement currency with the counterparty's SSI currency.",
    "Settlement date in the past": "Amend the settlement date to the next business day.",
    "Weekend settlement": "Move settlement to the next business day.",
    "Settlement more than 15 days away": "Verify the settlement date with the trader.",
    "High-failure counterparty tier": "Do a pre-matching confirmation with the counterparty.",
    "Quantity above 5000": "Confirm quantity with the trader / get limit approval.",
    "Quantity below 100": "Confirm the intended quantity with the trader.",
}
READABLE = {"ssi": "SSI mismatch pattern", "currency": "Currency mismatch pattern",
            "qtyOutOfRange": "Quantity outside normal range", "quantity": "Unusual quantity",
            "days": "Long settlement period", "weekend": "Weekend settlement pattern",
            "settleDay": "Settlement weekday pattern", "buy": "Trade direction pattern",
            "price": "Unusual price", "tierPoints": "Counterparty pattern",
            "ruleScore": "Combination of rule breaches"}


# Rule IDs from the team plan (section 4.2). Labels only - points/weights are unchanged.
RULE_IDS = {
    "SSI not matched": "RS-01",
    "Currency not matched": "RS-02",
    "Settlement date in the past": "RS-03",
    "Weekend settlement": "RS-04",
    "Settlement more than 15 days away": "RS-05",
    "Quantity above 5000": "RS-09",
    "Quantity below 100": "RS-10",
}
TIER_RULE_IDS = {0.25: "RS-06", 0.20: "RS-07", 0.10: "RS-08"}


def _rule_id(name, points):
    if name == "High-failure counterparty tier":
        return TIER_RULE_IDS.get(round(float(points), 2), "RS-06")
    return RULE_IDS.get(name, "RULE")


def _to_frame(trades):
    d = pd.DataFrame(trades)
    d["ssiMatched"] = d["ssiMatched"].astype(bool).astype(int)
    d["currencyMatched"] = d["currencyMatched"].astype(bool).astype(int)
    d["tradeDate"] = pd.to_datetime(d["tradeDate"])
    d["settlementDate"] = pd.to_datetime(d["settlementDate"])
    d["counterparty"] = d["counterparty"].str.strip().str.upper()
    d["tradeType"] = d["tradeType"].str.strip().str.upper()
    return d


def _shap_fail(x):
    sv = EXPLAINER.shap_values(x)
    return sv[1] if isinstance(sv, list) else sv[:, :, 1]


def score_trades(trades, as_of_mode="TODAY"):
    """trades: list of dicts (API field names). Returns list of result dicts."""
    d = _to_frame(trades)
    as_of = date.today() if as_of_mode == "TODAY" else None   # None = compare with tradeDate
    f = features(d, CP_FAIL_COUNT, as_of)

    rule = f["ruleScore"].values
    if MODEL is not None:
        X = f[FEATURES]
        ml = MODEL.predict_proba(X)[:, 1]
        shap_vals = _shap_fail(X) if EXPLAINER is not None else np.zeros((len(X), len(FEATURES)))
        mode = "HYBRID"
        final = 0.3 * ml + 0.7 * rule                      # spec 3.1
    else:
        ml, shap_vals, mode = np.full(len(f), np.nan), None, "RULES_ONLY"
        final = rule                                        # fail-safe: rules only

    results = []
    for i in range(len(f)):
        row = f.iloc[i]
        fired = rules_fired(row)
        status = "EXCEPTION" if final[i] >= 0.7 else "MONITOR" if final[i] >= 0.5 else "PASS"
        priority = {"EXCEPTION": "HIGH", "MONITOR": "MEDIUM", "PASS": "LOW"}[status]

        # Risk factors: rules = 0.7 x points, model = 0.3 x ML split by top-3 positive SHAP
        w_rule = 0.7 if mode == "HYBRID" else 1.0
        parts = {name: w_rule * pts for name, pts in fired.items()}
        if mode == "HYBRID":
            s = pd.Series(shap_vals[i], index=FEATURES)
            pos = s[s > 0].sort_values(ascending=False).head(3)
            for feat, v in pos.items():
                key = f"Model: {READABLE.get(feat, feat)}"
                parts[key] = parts.get(key, 0) + 0.3 * ml[i] * v / pos.sum()
        total = sum(parts.values()) or 1
        factors = sorted(({"factor": k, "pct": round(100 * v / total, 1)} for k, v in parts.items()),
                         key=lambda x: -x["pct"])

        top_rule = max(fired, key=fired.get) if fired else None
        reason = top_rule or (factors[0]["factor"] if factors else "No risk factors")
        action = FIXES.get(top_rule, "Review trade details before settlement." if status != "PASS"
                           else "No action needed.")
        text = f"{status} ({final[i]:.2f}): " + (", ".join(f"{x['factor']} {x['pct']}%" for x in factors[:3])
                                                  or "no risk factors found")
        if mode == "RULES_ONLY":
            text += " [model unavailable - rules only]"

        results.append({
            "tradeId": d["tradeId"].iloc[i],
            "riskStatus": status, "priority": priority,
            "finalScore": round(float(final[i]), 4),
            "ruleScore": round(float(rule[i]), 4),
            "mlScore": None if mode == "RULES_ONLY" else round(float(ml[i]), 4),
            "scoringMode": mode,
            "rulesTriggered": [{"ruleId": _rule_id(k, v), "name": k, "points": v} for k, v in fired.items()],
            "riskFactors": factors,
            "likelyReason": reason,
            "suggestedAction": action,
            "explanation": text,
            "modelVersion": MODEL_VERSION, "ruleConfigVersion": RULE_VERSION,
        })
    return results