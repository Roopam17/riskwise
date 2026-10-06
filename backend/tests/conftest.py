"""Builds a tiny fake data folder BEFORE the app is imported, so tests never touch the real files."""
import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

DATA = Path(tempfile.mkdtemp(prefix="riskwise_test_"))
(DATA / "stocks").mkdir()


def stock(sym, name, level, move, unusual=False):
    return {"sym": sym, "name": name, "exchange": "NSE", "modelled": True, "asof": "2026-10-06",
            "price": {"close": 100.0, "prev_close": 98.0, "change": 2.0, "change_pct": 2.04, "high52": 120.0,
                      "low52": 80.0, "avg_volume": 1000},
            "returns": {"1m": 1.0, "3m": 2.0, "6m": 3.0, "1y": 4.0},
            "forecast": {"expected_move": move, "level": level, "level_week_ago": level, "vs_usual": "About usual", "models": {}},
            "unusual": {"flag": unusual, "reason": "Volume 3.0× normal" if unusual else None, "detail": {}},
            "risk_history": [["2026-10-06", move]], "history": [["2026-10-05", 98.0], ["2026-10-06", 100.0]]}


STOCKS = [stock("RELIANCE", "Reliance Industries Limited", "Medium", 1.4),
          stock("SBIN", "State Bank of India", "High", 3.2, unusual=True),
          stock("ADANIENT", "Adani Enterprises Limited", "High", 3.5),
          stock("ADANIPORTS", "Adani Ports and Special Economic Zone Limited", "Medium", 2.5),
          stock("ADANIPOWER", "Adani Power Limited", "High", 3.3),
          stock("TCS", "Tata Consultancy Services Limited", "Low", 1.0)]
INDEX = [{"sym": s["sym"], "name": s["name"], "ex": "NSE", "modelled": True} for s in STOCKS]
INDEX.append({"sym": "TINYCO", "name": "Tiny Company Limited", "ex": "NSE", "modelled": False})

for s in STOCKS:
    (DATA / "stocks" / f"{s['sym']}.json").write_text(json.dumps(s))
(DATA / "index.json").write_text(json.dumps(INDEX))
(DATA / "explorer.json").write_text(json.dumps([
    {"sym": s["sym"], "name": s["name"], "price": 100.0, "change_pct": s["price"]["change_pct"],
     "expected_move": s["forecast"]["expected_move"], "level": s["forecast"]["level"],
     "level_week_ago": s["forecast"]["level"], "vs_usual": "About usual",
     "unusual": s["unusual"]["flag"], "reason": s["unusual"]["reason"]} for s in STOCKS]))
(DATA / "fundamentals.json").write_text(json.dumps({"RELIANCE": {"market_cap": 1e13, "pe": 25.0, "size": "Large", "sector": "Energy"},
                                                    "SBIN": {"size": "Large", "sector": "Financial Services"}}))
(DATA / "meta.json").write_text(json.dumps({"asof": "2026-10-06", "stocks_with_forecast": 6, "skipped": {"X": "y"}}))
(DATA / "scoreboard.json").write_text(json.dumps({"board": [], "blocks": [], "breakdown": []}))

os.environ["DATA_DIR"] = str(DATA)
