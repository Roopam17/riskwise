"""Shared helpers used by the notebooks (same functions as in notebook 02)."""
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
PRICES_DIR = ROOT / "data" / "prices"


def load_prices(symbol):
    """Read one stock's saved history. Drops zero-volume rows (market holidays that Yahoo filled in)."""
    df = pd.read_csv(PRICES_DIR / f"{symbol}.csv", index_col="date", parse_dates=True)
    return df[df["Volume"] > 0]


def simple_wiggle(df, n=5):
    """Square the daily closing moves, average over n days, square root. In % per day."""
    r = np.log(df["Close"]).diff() * 100
    return np.sqrt((r ** 2).rolling(n).mean())


def yang_zhang(df, n=5):
    """Yang-Zhang wiggle over the last n days (uses overnight gap, open-to-close drift, high-low range)."""
    o, h, l, c = (np.log(df[col]) for col in ["Open", "High", "Low", "Close"])
    overnight = o - c.shift(1)
    open_to_close = c - o
    range_clue = (h - c) * (h - o) + (l - c) * (l - o)
    var_overnight = overnight.rolling(n).var()
    var_open_close = open_to_close.rolling(n).var()
    var_range = range_clue.rolling(n).mean()
    k = 0.34 / (1.34 + (n + 1) / (n - 1))
    return np.sqrt(var_overnight + k * var_open_close + (1 - k) * var_range) * 100


def build_table(df):
    """One row per day: the Naive guess (past 5 days) next to the real answer (next 5 days)."""
    wiggle = yang_zhang(df, 5)
    table = pd.DataFrame({
        "naive_guess": wiggle,
        "actual_next5": wiggle.shift(-5),   # the future; only ever used for scoring
    })
    return table.dropna()


def exam_start(index, years=3):
    """The first date of the exam: the most recent `years` years of the table."""
    return index[-1] - pd.DateOffset(years=years)
