"""Unusual-activity flag helpers (Isolation Forest). Shared by notebook 07 and the nightly job."""
import numpy as np
import pandas as pd

ANOMALY_COLS = ["a_move", "a_range", "a_vol", "a_gap"]
LABELS = {
    "a_move": "Price move",
    "a_range": "Day range",
    "a_vol": "Volume",
    "a_gap": "Opening gap",
}


def to_model_input(df):
    """Log of each 'multiple of normal' measure (floored), so 2x and 0.5x are equally far from normal."""
    return np.log(np.maximum(df[ANOMALY_COLS].astype(float), 0.05)).values


def main_reason(row, q99):
    """The measure that is most extreme compared with its own 99th percentile, as plain English."""
    scores = {c: row[c] / q99[c] for c in ANOMALY_COLS}
    best = max(scores, key=scores.get)
    return f"{LABELS[best]} {row[best]:.1f}× normal"
