"""
Spec rules (Decision Logic 3.2) + model features.
ONE copy, used by BOTH training (train_final_rf.py) and live scoring (scoring.py).
"""
import numpy as np
import pandas as pd


def tier_points(counterparty, cp_fail_count):
    """Spec 3.2.5: tier from historical failure COUNT per counterparty."""
    cnt = counterparty.map(cp_fail_count).fillna(0)
    return np.select([cnt > 1500, cnt >= 1000, cnt >= 500], [0.25, 0.20, 0.10], 0.0)


def features(d, cp_fail_count, as_of=None):
    """
    d: DataFrame with ssiMatched(0/1), currencyMatched(0/1), quantity, price, tradeType,
       counterparty, tradeDate, settlementDate (datetime)
    as_of: date used for 'settlement in the past' (None = tradeDate)
    """
    days = (d["settlementDate"] - d["tradeDate"]).dt.days
    ref = d["tradeDate"] if as_of is None else pd.Series(pd.Timestamp(as_of), index=d.index)
    past = (d["settlementDate"] < ref).astype(int)

    f = pd.DataFrame(index=d.index)
    f["ssi"] = d["ssiMatched"].astype(int)
    f["currency"] = d["currencyMatched"].astype(int)
    f["quantity"] = d["quantity"]
    f["qtyOutOfRange"] = ((d["quantity"] < 100) | (d["quantity"] > 5000)).astype(int)
    f["days"] = days
    f["weekend"] = (d["settlementDate"].dt.weekday >= 5).astype(int)
    f["settleDay"] = d["settlementDate"].dt.weekday
    f["buy"] = (d["tradeType"] == "BUY").astype(int)
    f["price"] = d["price"]
    f["tierPoints"] = tier_points(d["counterparty"], cp_fail_count)

    # Spec 3.2.2-3.2.6 -> Rule_Score
    settle_pts = np.maximum.reduce([past * 0.15,                                   # 3.2.4 past
                                    f["weekend"] * 0.10,                           # 3.2.4 weekend
                                    np.where(days > 15, 0.05, 0)])                 # 3.2.4 >15 days
    qty_pts = np.where(d["quantity"] > 5000, 0.10, np.where(d["quantity"] < 100, 0.05, 0))  # 3.2.6
    f["ruleScore"] = np.clip((f["ssi"] == 0) * 0.35                                # 3.2.2 SSI
                             + (f["currency"] == 0) * 0.15                         # 3.2.3 currency
                             + settle_pts + f["tierPoints"] + qty_pts, 0, 1)       # 3.2.4-3.2.6
    f["_past"] = past  # used only for explanations, removed before the model
    return f


def rules_fired(row):
    """Which spec rules fired for one trade (name -> points)."""
    out = {}
    if row["ssi"] == 0: out["SSI not matched"] = 0.35
    if row["currency"] == 0: out["Currency not matched"] = 0.15
    settle = [("Settlement date in the past", 0.15 if row["_past"] else 0),
              ("Weekend settlement", 0.10 if row["weekend"] else 0),
              ("Settlement more than 15 days away", 0.05 if row["days"] > 15 else 0)]
    name, pts = max(settle, key=lambda x: x[1])
    if pts > 0: out[name] = pts
    if row["tierPoints"] > 0: out["High-failure counterparty tier"] = row["tierPoints"]
    if row["quantity"] > 5000: out["Quantity above 5000"] = 0.10
    elif row["quantity"] < 100: out["Quantity below 100"] = 0.05
    return out