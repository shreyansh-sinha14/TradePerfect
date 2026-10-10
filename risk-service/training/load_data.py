import sys
import pandas as pd
import yaml

# 1. Read the column name map from column_map.yaml
with open("training/column_map.yaml", encoding="utf-8") as f:
    config = yaml.safe_load(f)

COLUMN_MAP = config["columns"]


def load(path):
    # 2. Read the CSV (all columns as text first)
    df = pd.read_csv(path, dtype=str, encoding="utf-8-sig")

    # 3. Rename columns to our names (Trade ID -> tradeId, ...)
    df.columns = df.columns.str.strip()
    df = df.rename(columns=COLUMN_MAP)

    # 4. Clean text columns
    for col in ["tradeId", "tradeType", "symbol", "counterparty", "accountId"]:
        df[col] = df[col].str.strip().str.upper()
    df["traderName"] = df["traderName"].str.strip()

    # 5. Numbers
    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce")
    df["price"] = pd.to_numeric(df["price"], errors="coerce")

    # 6. Dates (format from the screenshot: 9/19/2026 = month/day/year)
    df["tradeDate"] = pd.to_datetime(df["tradeDate"], format="%m/%d/%Y", errors="coerce")
    df["settlementDate"] = pd.to_datetime(df["settlementDate"], format="%m/%d/%Y", errors="coerce")

    # 7. YES/NO -> 1/0
    yes_no = {"YES": 1, "NO": 0}
    for col in ["ssiMatched", "currencyMatched", "label"]:
        if col in df.columns:
            df[col] = df[col].str.strip().str.upper().map(yes_no)

    return df


if __name__ == "__main__":
    df = load(sys.argv[1])
    print("Rows:", len(df))
    print("Columns:", list(df.columns))
    print("\nEmpty / unreadable values per column:")
    print(df.isna().sum())
    print("\nFirst 5 rows:")
    print(df.head())