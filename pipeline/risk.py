"""The risk-level rule: turns an expected daily move (% a day) into Low / Medium / High.

The cut-offs live in models/risk_bands.json (made by notebook 08) and should be re-checked about once a year.
"""
import json

from common import ROOT

BANDS_FILE = ROOT / "models" / "risk_bands.json"


def load_bands():
    return json.loads(BANDS_FILE.read_text())


def level(expected_move, bands):
    """Low if below the low cut-off, High if at or above the high cut-off, otherwise Medium."""
    if expected_move < bands["low_below"]:
        return "Low"
    if expected_move >= bands["high_from"]:
        return "High"
    return "Medium"


def vs_usual(expected_move, usual_move):
    """Compare the forecast with the stock's own usual wiggle over the past year."""
    if usual_move is None or usual_move <= 0:
        return "About usual"
    ratio = expected_move / usual_move
    if ratio < 0.85:
        return "Calmer than usual"
    if ratio > 1.15:
        return "Wigglier than usual"
    return "About usual"
