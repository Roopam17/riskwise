"""Build the "clues table" (features) for every stock that passes the universe rule.

Universe rule (Option B, chosen by RB): at least 3 years of history AND trades on at least 95% of days.
Output: data/universe.csv and data/features.parquet (one row per stock per day).

Run from the project folder:
    .venv/bin/python pipeline/features.py
"""
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, load_prices, simple_wiggle, yang_zhang   # noqa: E402

FEATURE_COLS = ["yz5", "yz10", "yz20", "yz60", "yz120", "sw5", "absret1", "range5", "vol_ratio", "gap_5_60"]
FLOOR = 0.05          # a wiggle below 0.05% a day is treated as 0.05%, so logs never hit minus infinity


def log_floor(series):
    return np.log(np.maximum(series, FLOOR))


def make_features(df):
    """Clues for one stock. Every clue on a row uses only that day and earlier days."""
    r = np.log(df["Close"]).diff() * 100
    day_range = (np.log(df["High"]) - np.log(df["Low"])) * 100
    yz = {n: yang_zhang(df, n) for n in (5, 10, 20, 60, 120)}

    f = pd.DataFrame(index=df.index)
    for n in (5, 10, 20, 60, 120):
        f[f"yz{n}"] = log_floor(yz[n])
    f["sw5"] = log_floor(simple_wiggle(df, 5))
    f["absret1"] = log_floor(r.abs())
    f["range5"] = log_floor(day_range.rolling(5).mean())
    f["vol_ratio"] = np.log((df["Volume"].rolling(5).mean() + 1) / (df["Volume"].rolling(60).mean() + 1))
    f["gap_5_60"] = f["yz5"] - f["yz60"]            # is last week wigglier than the stock's usual?

    # "how unusual is TODAY?" measures for the unusual-activity flag: today compared with the previous 60 days
    typical_move = np.maximum(yz[60].shift(1), FLOOR)                 # the stock's normal wiggle BEFORE today
    typical_range = np.maximum(day_range.rolling(60).mean().shift(1), FLOOR)
    f["a_move"] = (r.abs() / typical_move).clip(upper=50)             # today's move as a multiple of normal
    f["a_range"] = (day_range.clip(lower=0) / typical_range).clip(upper=50)         # today's high-low range as a multiple of normal
    f["a_vol"] = (df["Volume"] / (df["Volume"].rolling(60).mean().shift(1) + 1)).clip(upper=50)   # volume as a multiple of normal
    f["a_gap"] = ((np.log(df["Open"]) - np.log(df["Close"]).shift(1)).abs() * 100 / typical_move).clip(upper=50)  # opening gap

    # the answer (the future): used only for training answers and scoring, never as a clue
    f["actual_next5"] = yz[5].shift(-5)
    f["target"] = log_floor(f["actual_next5"])
    # the lazy opponents, as plain wiggle numbers
    f["naive5"] = yz[5]
    f["naive20"] = yz[20]
    return f.replace([np.inf, -np.inf], np.nan)


def pick_universe():
    summary = pd.read_csv(ROOT / "data" / "prices_summary.csv")
    keep = (summary["years"] >= 3) & (summary["zero_vol"] < 0.05)
    return summary.loc[keep, "sym"].tolist()


def main():
    symbols = pick_universe()
    pd.DataFrame({"sym": symbols}).to_csv(ROOT / "data" / "universe.csv", index=False)
    print(f"{len(symbols)} stocks pass the universe rule")

    pieces, started = [], time.time()
    for i, sym in enumerate(symbols, 1):
        try:
            f = make_features(load_prices(sym))
        except Exception as problem:               # a broken file should not stop the whole run
            print("skipped", sym, type(problem).__name__, str(problem)[:80])
            continue
        f = f.dropna(subset=FEATURE_COLS)
        f.insert(0, "sym", sym)
        pieces.append(f.astype({c: "float32" for c in f.columns if c != "sym"}))
        if i % 300 == 0:
            print(f"  {i}/{len(symbols)} done, {(time.time() - started) / 60:.1f} min")

    table = pd.concat(pieces)
    table.index.name = "date"
    out = ROOT / "data" / "features.parquet"
    table.reset_index().to_parquet(out, index=False)
    print(f"saved {out.name}: {len(table):,} rows, {table['sym'].nunique()} stocks, "
          f"{table.index.min().date()} to {table.index.max().date()}, {out.stat().st_size / 1e6:.0f} MB")


if __name__ == "__main__":
    main()
