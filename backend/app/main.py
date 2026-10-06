"""RiskWise backend. Serves the files the nightly job wrote, plus a delayed live price.

Run locally from the backend folder:
    ../.venv/bin/uvicorn app.main:app --reload --port 8000
"""
import os
import time
from datetime import datetime, timezone

from cachetools import TTLCache
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .data import clean_symbol, load_json
from .search import search

app = FastAPI(title="RiskWise API", version="1.0")

origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET"], allow_headers=["*"])

POPULAR = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "SBIN", "ICICIBANK", "ITC", "BHARTIARTL"]
RISK_ORDER = {"Low": 0, "Medium": 1, "High": 2}
_quotes = TTLCache(maxsize=2000, ttl=60)


def _meta():
    return load_json("meta.json") or {}


def _facts(sym):
    return (load_json("fundamentals.json") or {}).get(sym) or {}


def _stock(sym):
    """One stock's full record (with company facts), a 'no forecast' record, or None if unknown."""
    record = load_json(f"stocks/{sym}.json")
    if record:
        return {**record, "facts": _facts(sym)}
    entry = next((e for e in (load_json("index.json") or []) if e["sym"] == sym), None)
    if entry:
        why = (_meta().get("skipped") or {}).get(sym, "")
        message = ("The price history for this stock has a sudden jump that may be a stock split or a data error, so we are not "
                   "showing a risk level until it checks out." if why.startswith("price jump")
                   else "We do not have enough price history to give a risk level for this stock yet.")
        return {"sym": sym, "name": entry["name"], "exchange": entry["ex"], "modelled": False, "message": message,
                "facts": _facts(sym)}
    return None


@app.get("/api/health")
def health():
    meta = _meta()
    return {"ok": True, "data_as_of": meta.get("asof"), "stocks_with_forecast": meta.get("stocks_with_forecast")}


@app.get("/api/meta")
def meta():
    data = _meta()
    if not data:
        raise HTTPException(503, "Data files are not available yet.")
    return {k: v for k, v in data.items() if k != "skipped"}


@app.get("/api/index")
def index():
    return load_json("index.json") or []


@app.get("/api/search")
def search_stocks(q: str = Query("", max_length=60), limit: int = Query(8, ge=1, le=25)):
    return search(load_json("index.json") or [], q, limit)


@app.get("/api/stock/{sym}")
def stock(sym: str):
    clean = clean_symbol(sym)
    record = _stock(clean) if clean else None
    if not record:
        raise HTTPException(404, "We could not find that stock.")
    return record


@app.get("/api/quote/{sym}")
def quote(sym: str):
    """Delayed price. Tries Yahoo; falls back to the last close from the nightly data."""
    clean = clean_symbol(sym)
    if not clean:
        raise HTTPException(404, "We could not find that stock.")
    if clean in _quotes:
        return _quotes[clean]
    result = None
    try:
        import yfinance as yf
        info = yf.Ticker(f"{clean}.NS").fast_info
        last, prev = float(info["last_price"]), float(info["previous_close"])
        if last > 0 and prev > 0:
            result = {"sym": clean, "price": round(last, 2), "prev_close": round(prev, 2),
                      "change": round(last - prev, 2), "change_pct": round((last / prev - 1) * 100, 2),
                      "source": "live", "delayed": True}
    except Exception:
        result = None
    if result is None:
        record = load_json(f"stocks/{clean}.json")
        if not record:
            raise HTTPException(404, "No price available for that stock.")
        p = record["price"]
        result = {"sym": clean, "price": p["close"], "prev_close": p["prev_close"], "change": p["change"],
                  "change_pct": p["change_pct"], "source": "last close", "delayed": True}
    result["as_of"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    _quotes[clean] = result
    return result


@app.get("/api/compare")
def compare(s: str = Query(..., max_length=200)):
    syms = []
    for raw in s.split(","):
        clean = clean_symbol(raw)
        if clean and clean not in syms:
            syms.append(clean)
    if not syms:
        raise HTTPException(400, "Choose at least one stock.")
    if len(syms) > 3:
        raise HTTPException(400, "You can compare up to 3 stocks.")
    found = [r for r in (_stock(x) for x in syms) if r]
    if not found:
        raise HTTPException(404, "We could not find those stocks.")
    return found


@app.get("/api/explorer")
def explorer(level: str | None = None, unusual: bool = False, size: str | None = None, sector: str | None = None,
             q: str = Query("", max_length=60), sort: str = "risk", limit: int = Query(100, ge=1, le=500),
             offset: int = Query(0, ge=0)):
    rows = [dict(r) for r in (load_json("explorer.json") or [])]
    facts = load_json("fundamentals.json") or {}
    for r in rows:
        f = facts.get(r["sym"]) or {}
        r["size"], r["sector"] = f.get("size"), f.get("sector")
    sectors = sorted({r["sector"] for r in rows if r["sector"]})
    if level:
        if level not in RISK_ORDER:
            raise HTTPException(400, "level must be Low, Medium or High.")
        rows = [r for r in rows if r["level"] == level]
    if unusual:
        rows = [r for r in rows if r["unusual"]]
    if size:
        rows = [r for r in rows if r["size"] == size]
    if sector:
        rows = [r for r in rows if (r["sector"] or "").lower() == sector.lower()]
    if q.strip():
        needle = q.strip().lower()
        rows = [r for r in rows if needle in r["sym"].lower() or needle in r["name"].lower()]
    keys = {"risk": lambda r: -r["expected_move"], "calm": lambda r: r["expected_move"], "change": lambda r: -r["change_pct"]}
    if sort not in keys:
        raise HTTPException(400, "sort must be risk, calm or change.")
    rows.sort(key=keys[sort])
    return {"total": len(rows), "sectors": sectors, "items": rows[offset:offset + limit]}


@app.get("/api/watchlist")
def watchlist(s: str = Query(..., max_length=1500)):
    """A compact row per saved stock (up to 50): price, risk, unusual flag and a 1-month mini trend line."""
    syms = []
    for raw in s.split(","):
        clean = clean_symbol(raw)
        if clean and clean not in syms:
            syms.append(clean)
    if len(syms) > 50:
        raise HTTPException(400, "A watchlist holds up to 50 stocks.")
    index = {e["sym"]: e for e in (load_json("index.json") or [])}
    rows = []
    for sym in syms:
        record = load_json(f"stocks/{sym}.json")
        if record:
            f = record["forecast"]
            rows.append({"sym": sym, "name": record["name"], "modelled": True, "price": record["price"]["close"],
                         "change_pct": record["price"]["change_pct"], "expected_move": f["expected_move"],
                         "level": f["level"], "level_week_ago": f["level_week_ago"], "vs_usual": f["vs_usual"],
                         "unusual": record["unusual"]["flag"], "reason": record["unusual"]["reason"],
                         "spark": [p[1] for p in record["history"][-22:]]})
        elif sym in index:
            rows.append({"sym": sym, "name": index[sym]["name"], "modelled": False})
    return rows


@app.get("/api/popular")
def popular():
    wanted = set(POPULAR)
    rows = {r["sym"]: r for r in (load_json("explorer.json") or []) if r["sym"] in wanted}
    return [rows[s] for s in POPULAR if s in rows]


@app.get("/api/scoreboard")
def scoreboard():
    data = load_json("scoreboard.json")
    if not data:
        raise HTTPException(503, "The scoreboard is not available yet.")
    return data
