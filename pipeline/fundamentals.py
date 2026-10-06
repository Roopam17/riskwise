"""Company facts (market cap, P/E, ROE, dividend yield, sector) for the Compare and Explorer pages.

Slow and sometimes patchy, so it is a separate job (run weekly, not nightly). Resumable.
    .venv/bin/python pipeline/fundamentals.py
Writes data/fundamentals_cache.json (progress) and app_data/fundamentals.json (what the website reads).
Missing facts stay null: the website shows "Not available".
"""
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pandas as pd
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "fundamentals_cache.json"
OUT = ROOT / "app_data" / "fundamentals.json"

# approximate size buckets by market cap in rupees (1 crore = 10 million)
LARGE, MID = 20_000e7, 5_000e7
RETRY = "--retry-missing" in sys.argv          # slower second pass for stocks whose facts are missing or incomplete
SLOW_PAUSE = 0.4 if RETRY else 0.0


def size_bucket(cap):
    if cap is None:
        return None
    return "Large" if cap >= LARGE else "Mid" if cap >= MID else "Small"


def get_one(sym):
    time.sleep(SLOW_PAUSE)
    for attempt in range(3):
        try:
            info = yf.Ticker(f"{sym}.NS").info or {}
            price = info.get("currentPrice") or info.get("regularMarketPrice")
            div_rate = info.get("dividendRate")
            cap = info.get("marketCap")
            roe = info.get("returnOnEquity")
            pe = info.get("trailingPE")
            return sym, {
                "market_cap": cap,
                "pe": round(float(pe), 1) if isinstance(pe, (int, float)) and pe > 0 else None,
                "roe": round(float(roe) * 100, 1) if isinstance(roe, (int, float)) else None,
                "div_yield": round(float(div_rate) / float(price) * 100, 2) if div_rate and price else None,
                "sector": info.get("sector"), "industry": info.get("industry"),
                "size": size_bucket(cap),
            }
        except Exception:
            time.sleep(2 * (attempt + 1))
    return sym, None


def main():
    universe = pd.read_csv(ROOT / "data" / "universe.csv")["sym"].tolist()
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    if RETRY:
        todo = [s for s in universe if not cache.get(s) or cache[s].get("roe") is None or cache[s].get("pe") is None]
    else:
        todo = [s for s in universe if s not in cache]
    print(f"{len(universe)} stocks, {len(cache)} already done, {len(todo)} to fetch", flush=True)
    started = time.time()
    with ThreadPoolExecutor(max_workers=2 if RETRY else 4) as pool:
        for i, (sym, facts) in enumerate(pool.map(get_one, todo), 1):
            old = cache.get(sym) or {}
            if facts:                                  # keep any fact we already had if the new answer lacks it
                facts = {k: (facts[k] if facts.get(k) is not None else old.get(k)) for k in facts}
            cache[sym] = facts or old or None
            if i % 100 == 0 or i == len(todo):
                CACHE.write_text(json.dumps(cache))
                have = sum(1 for v in cache.values() if v and v.get("market_cap"))
                print(f"[{i}/{len(todo)}] {have} with market cap, {(time.time() - started) / 60:.1f} min", flush=True)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({s: v for s, v in cache.items() if v}, separators=(",", ":")))
    print("saved", OUT)


if __name__ == "__main__":
    main()
