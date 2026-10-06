"""Download up to 20 years of daily prices for every NSE stock in data/nse_symbols.csv.

Each stock is saved as its own file: data/prices/SYMBOL.csv
Safe to stop and restart: stocks that already have a file are skipped.

Examples (run from the project folder):
    .venv/bin/python pipeline/download_prices.py --limit 10     # small test
    .venv/bin/python pipeline/download_prices.py                # everything
"""
import argparse
import csv
import time
from pathlib import Path

import pandas as pd
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
SYMBOLS_FILE = ROOT / "data" / "nse_symbols.csv"
PRICES_DIR = ROOT / "data" / "prices"
FAILED_FILE = ROOT / "data" / "prices_failed.csv"


def load_symbols():
    table = pd.read_csv(SYMBOLS_FILE)
    table.columns = [c.strip() for c in table.columns]   # the NSE file has stray spaces in headers
    return table["SYMBOL"].astype(str).str.strip().tolist()


def fetch_one(symbol, start, tries=3):
    """Ask Yahoo for one stock. Retry a few times, waiting longer after each failure."""
    last_problem = "unknown"
    for attempt in range(1, tries + 1):
        try:
            df = yf.Ticker(f"{symbol}.NS").history(start=start, auto_adjust=True)
            if df.empty:
                return None, "no data returned"
            df.index = df.index.tz_localize(None)   # keep just the date
            df.index.name = "date"
            return df, ""
        except Exception as problem:               # network trouble, rate limit, etc.
            last_problem = f"{type(problem).__name__}: {problem}"[:200]
            wait = 60 if "rate" in last_problem.lower() else 5 * attempt
            time.sleep(wait)
    return None, last_problem


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="only the first N symbols (for testing)")
    parser.add_argument("--years", type=int, default=20)
    parser.add_argument("--pause", type=float, default=0.3, help="seconds to wait between stocks")
    parser.add_argument("--refresh", action="store_true", help="download again even if a file already exists (use before retraining)")
    args = parser.parse_args()

    PRICES_DIR.mkdir(parents=True, exist_ok=True)
    symbols = load_symbols()
    if args.limit:
        symbols = symbols[: args.limit]
    start = pd.Timestamp.today().normalize() - pd.DateOffset(years=args.years)

    done = skipped = failed = 0
    started = time.time()
    try:
        for i, symbol in enumerate(symbols, 1):
            target = PRICES_DIR / f"{symbol.replace('/', '_')}.csv"
            if target.exists() and target.stat().st_size > 0 and not args.refresh:
                skipped += 1
                continue
            df, problem = fetch_one(symbol, start)
            if df is None:
                failed += 1
                with open(FAILED_FILE, "a", newline="") as f:
                    csv.writer(f).writerow([symbol, problem])
            else:
                df.to_csv(target)
                done += 1
            if i % 25 == 0 or i == len(symbols):
                minutes = (time.time() - started) / 60
                print(f"[{i}/{len(symbols)}] downloaded {done}, skipped {skipped}, failed {failed}, {minutes:.1f} min")
            time.sleep(args.pause)
    except KeyboardInterrupt:
        print("\nStopped by you. Run the same command again to carry on where it stopped.")

    print(f"Finished: downloaded {done}, skipped (already had) {skipped}, failed {failed}.")
    if failed:
        print(f"Failures are listed in {FAILED_FILE}")


if __name__ == "__main__":
    main()
