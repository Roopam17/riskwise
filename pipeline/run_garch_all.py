"""Run walk-forward GARCH for every stock in the universe and save each stock's guesses.

Output: data/garch/SYMBOL.csv (columns: date, garch_raw); failures go to data/garch_failed.csv.
Safe to stop and restart: stocks that already have a file are skipped.

    caffeinate -i .venv/bin/python pipeline/run_garch_all.py
"""
import csv
import os
import sys
import time
import warnings
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

os.environ.setdefault("OMP_NUM_THREADS", "1")      # one thread per worker, so workers do not fight each other
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, load_prices          # noqa: E402
from garch_model import garch_guesses         # noqa: E402

OUT_DIR = ROOT / "data" / "garch"
FAILED = ROOT / "data" / "garch_failed.csv"


def work(sym):
    warnings.filterwarnings("ignore")
    target = OUT_DIR / f"{sym}.csv"
    if target.exists():
        return sym, "skipped", ""
    try:
        g = garch_guesses(load_prices(sym)).dropna().rename("garch_raw")
        if g.empty:
            return sym, "failed", "not enough history for GARCH"
        g.rename_axis("date").to_csv(target)
        return sym, "done", ""
    except Exception as problem:
        return sym, "failed", f"{type(problem).__name__}: {problem}"[:150]


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    symbols = pd.read_csv(ROOT / "data" / "universe.csv")["sym"].tolist()
    workers = max(1, (os.cpu_count() or 2) // 2)
    print(f"{len(symbols)} stocks, {workers} workers")
    counts = {"done": 0, "skipped": 0, "failed": 0}
    started = time.time()
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for i, (sym, status, why) in enumerate(pool.map(work, symbols, chunksize=4), 1):
            counts[status] += 1
            if status == "failed":
                with open(FAILED, "a", newline="") as f:
                    csv.writer(f).writerow([sym, why])
            if i % 100 == 0 or i == len(symbols):
                print(f"[{i}/{len(symbols)}] {counts}  {(time.time() - started) / 60:.1f} min", flush=True)
    print("Finished:", counts)


if __name__ == "__main__":
    main()
