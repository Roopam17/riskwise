"""Nightly job: latest prices -> forecasts -> JSON files for the website (app_data/).

    .venv/bin/python pipeline/nightly.py                 # download fresh prices from Yahoo, then build everything
    .venv/bin/python pipeline/nightly.py --offline       # reuse data/prices/*.csv (for testing, no internet needed)
    .venv/bin/python pipeline/nightly.py --limit 50      # only the first 50 stocks (for testing)

Needs the models in models/ (run pipeline/train_final.py first, and notebooks 07 and 08 once).
"""
import argparse
import json
import os
import sys
import time
import warnings
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

os.environ.setdefault("OMP_NUM_THREADS", "1")
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from anomaly import ANOMALY_COLS, main_reason, to_model_input     # noqa: E402
from common import ROOT, load_prices                              # noqa: E402
from features import FEATURE_COLS, make_features                  # noqa: E402
from risk import level, load_bands, vs_usual                      # noqa: E402

MODELS = ROOT / "models"
OUT = ROOT / "app_data"
HISTORY_YEARS = 5
KEEP_ROWS = 280          # how many recent days we forecast for (history chart, "usual" level, last week's level)
_cache = {}


def _models():
    """Load models once per worker process."""
    if not _cache:
        import joblib
        import torch
        import xgboost as xgb
        torch.set_num_threads(1)
        from lstm_model import Net
        x = xgb.XGBRegressor()
        x.load_model(str(MODELS / "xgb.json"))
        x.set_params(n_jobs=1)
        stats = json.loads((MODELS / "lstm_stats.json").read_text())
        net = Net(len(FEATURE_COLS))
        net.load_state_dict(torch.load(MODELS / "lstm.pt", map_location="cpu"))
        net.eval()
        iso = joblib.load(MODELS / "isolation_forest.joblib")
        _cache.update(xgb=x, lstm=net, stats=stats, iso=iso, bands=load_bands(),
                      garch=json.loads((MODELS / "garch_params.json").read_text()))
    return _cache


def clean(df):
    df = df[["Open", "High", "Low", "Close", "Volume"]].dropna()
    return df[df["Volume"] > 0]


def garch_series(sym, df, m):
    from arch import arch_model
    p = m["garch"].get(sym)
    if not p or len(df) < 400:
        return None
    r = np.log(df["Close"]).diff().dropna() * 100
    spec = arch_model(r, mean="Constant", vol="GARCH", p=1, q=1, dist="t")
    values = np.array([v for k, v in p.items() if k != "scale"])        # saved in the order the model expects: mu, omega, alpha, beta, nu
    fc = spec.fix(values).forecast(horizon=5, start=len(r) - KEEP_ROWS, reindex=False).variance
    return np.sqrt(fc.mean(axis=1)) * p["scale"]


def lstm_series(feats, m):
    import torch
    from lstm_model import L, predict
    s = m["stats"]
    X = torch.from_numpy(np.nan_to_num(((feats[FEATURE_COLS].values - np.array(s["mu"])) / np.array(s["sd"])).astype(np.float32)))
    idx = np.arange(max(L - 1, len(feats) - KEEP_ROWS), len(feats))
    pred = predict(m["lstm"], X, idx, torch.device("cpu"))
    return pd.Series(np.exp(pred * s["ysd"] + s["ymu"]), index=feats.index[idx])


def process_stock(job):
    """Everything for one stock. Returns (sym, record or None, reason_if_none)."""
    sym, name, df = job
    try:
        m = _models()
        df = clean(df)
        if len(df) < 400:
            return sym, None, "not enough history"
        recent_jump = np.log(df["Close"]).diff().iloc[-25:].abs().max()
        if recent_jump > 0.40:          # about -33% or +49% in one day: almost surely a stock split or a data error
            return sym, None, "price jump: possible stock split or data error in the last 25 days"
        f = make_features(df)
        feats = f.dropna(subset=FEATURE_COLS)
        if len(feats) < 100:
            return sym, None, "not enough history"

        guesses = {}
        tail = feats.iloc[-KEEP_ROWS:]
        guesses["xgb"] = pd.Series(np.exp(m["xgb"].predict(tail[FEATURE_COLS].astype("float32"))), index=tail.index)
        guesses["lstm"] = lstm_series(feats, m)
        g = garch_series(sym, df, m)
        if g is not None:
            guesses["garch"] = g
        table = pd.DataFrame(guesses).dropna(subset=["xgb", "lstm"])
        table["ensemble"] = table[[c for c in ("garch", "xgb", "lstm") if c in table]].mean(axis=1)
        today = table.iloc[-1]
        past = table["ensemble"].iloc[:-1].iloc[-250:]
        expected = float(today["ensemble"])
        now_level = level(expected, m["bands"])
        week_ago = level(float(table["ensemble"].iloc[-6]), m["bands"]) if len(table) > 6 else now_level

        last = df.iloc[-1]
        prev_close = float(df["Close"].iloc[-2])
        close = float(last["Close"])
        year = df.iloc[-252:]

        def ret(n):
            return round(float((close / df["Close"].iloc[-n - 1] - 1) * 100), 1) if len(df) > n else None

        row = f.iloc[[-1]]
        unusual = {"flag": False, "reason": None, "detail": {}}
        if row[ANOMALY_COLS].notna().all(axis=None):
            score = float(m["iso"]["forest"].score_samples(to_model_input(row))[0])
            flagged = score < m["iso"]["threshold"]
            vals = {c: float(row[c].iloc[0]) for c in ANOMALY_COLS}
            unusual = {"flag": bool(flagged), "reason": main_reason(vals, m["iso"]["q99"]) if flagged else None,
                       "detail": {"move": round(vals["a_move"], 1), "range": round(vals["a_range"], 1),
                                  "volume": round(vals["a_vol"], 1), "gap": round(vals["a_gap"], 1)}}

        closes = df["Close"]
        weekly = closes.iloc[:-260].iloc[::-5].iloc[::-1]                 # older part: one point per week
        hist_pts = list(weekly.items()) + list(closes.iloc[-260:].items())
        history = [[d.strftime("%Y-%m-%d"), round(float(v), 2)] for d, v in hist_pts]
        risk_hist = table["ensemble"].iloc[::-5].iloc[:26].iloc[::-1]    # last 26 weeks, one point per week
        rec = {
            "sym": sym, "name": name, "exchange": "NSE", "modelled": True,
            "asof": df.index[-1].strftime("%Y-%m-%d"),
            "price": {"close": round(close, 2), "prev_close": round(prev_close, 2),
                      "change": round(close - prev_close, 2), "change_pct": round((close / prev_close - 1) * 100, 2),
                      "high52": round(float(year["High"].max()), 2), "low52": round(float(year["Low"].min()), 2),
                      "avg_volume": int(df["Volume"].iloc[-60:].mean())},
            "returns": {"1m": ret(21), "3m": ret(63), "6m": ret(125), "1y": ret(250)},
            "forecast": {"expected_move": round(expected, 2), "level": now_level,
                         "level_week_ago": week_ago, "vs_usual": vs_usual(expected, float(past.median()) if len(past) > 50 else None),
                         "models": {k: round(float(today[k]), 2) for k in ("garch", "xgb", "lstm") if k in today and pd.notna(today[k])}},
            "unusual": unusual,
            "risk_history": [[d.strftime("%Y-%m-%d"), round(float(v), 2)] for d, v in risk_hist.items()],
            "history": history,
        }
        return sym, rec, ""
    except Exception as problem:
        return sym, None, f"{type(problem).__name__}: {problem}"[:150]


def drop_unfinished_bar(df):
    """If today's bar was fetched while the Indian market is still open (before 4 PM IST), drop it: it is not a real close yet."""
    now = pd.Timestamp.now(tz="Asia/Kolkata")
    if len(df) and df.index[-1].date() == now.date() and now.hour * 60 + now.minute < 16 * 60:
        return df.iloc[:-1]
    return df


def download_all(symbols, batch=100):
    """Fresh prices from Yahoo, in batches. Returns {sym: DataFrame}."""
    import yfinance as yf
    out = {}
    for i in range(0, len(symbols), batch):
        chunk = symbols[i:i + batch]
        data = yf.download([f"{s}.NS" for s in chunk], period=f"{HISTORY_YEARS}y", auto_adjust=True,
                           group_by="ticker", threads=True, progress=False)
        for s in chunk:
            try:
                d = data[f"{s}.NS"].dropna(how="all")
                d.index = d.index.tz_localize(None) if d.index.tz is not None else d.index
                d = drop_unfinished_bar(d)
                if len(d):
                    out[s] = d
            except Exception:
                pass
        print(f"  downloaded {min(i + batch, len(symbols))}/{len(symbols)}", flush=True)
    return out


def read_saved(symbols):
    """Offline mode: reuse the saved CSV files (last 5 years)."""
    out = {}
    for s in symbols:
        d = pd.read_csv(ROOT / "data" / "prices" / f"{s}.csv", index_col="date", parse_dates=True)
        out[s] = d[d.index >= d.index.max() - pd.DateOffset(years=HISTORY_YEARS)]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()
    started = time.time()

    names = pd.read_csv(ROOT / "data" / "nse_symbols.csv")
    names.columns = [c.strip() for c in names.columns]
    name_of = dict(zip(names["SYMBOL"].str.strip(), names["NAME OF COMPANY"].str.strip()))
    universe = pd.read_csv(ROOT / "data" / "universe.csv")["sym"].tolist()
    if args.limit:
        universe = universe[: args.limit]

    print(f"{len(universe)} stocks; prices from {'saved files' if args.offline else 'Yahoo'}")
    prices = read_saved(universe) if args.offline else download_all(universe)

    OUT.mkdir(exist_ok=True)
    (OUT / "stocks").mkdir(exist_ok=True)
    jobs = [(s, name_of.get(s, s), prices[s]) for s in universe if s in prices]
    records, skipped = {}, {}
    with ProcessPoolExecutor(max_workers=max(1, (os.cpu_count() or 2) - 2)) as pool:
        for i, (sym, rec, why) in enumerate(pool.map(process_stock, jobs, chunksize=4), 1):
            if rec:
                records[sym] = rec
                (OUT / "stocks" / f"{sym}.json").write_text(json.dumps(rec, separators=(",", ":")))
            else:
                skipped[sym] = why
            if i % 200 == 0:
                print(f"  processed {i}/{len(jobs)}  ({(time.time() - started) / 60:.1f} min)", flush=True)
    print(f"built {len(records)} stocks, skipped {len(skipped)}")

    # search index: ALL NSE symbols; 'modelled' says whether we have a forecast for it
    index = [{"sym": s.strip(), "name": n.strip(), "ex": "NSE", "modelled": s.strip() in records}
             for s, n in zip(names["SYMBOL"], names["NAME OF COMPANY"])]
    (OUT / "index.json").write_text(json.dumps(index, separators=(",", ":")))

    explorer = [{"sym": r["sym"], "name": r["name"], "price": r["price"]["close"], "change_pct": r["price"]["change_pct"],
                 "expected_move": r["forecast"]["expected_move"], "level": r["forecast"]["level"],
                 "level_week_ago": r["forecast"]["level_week_ago"], "vs_usual": r["forecast"]["vs_usual"],
                 "unusual": r["unusual"]["flag"], "reason": r["unusual"]["reason"]} for r in records.values()]
    (OUT / "explorer.json").write_text(json.dumps(explorer, separators=(",", ":")))

    board = pd.read_csv(ROOT / "data" / "scoreboard.csv").to_dict("records")
    blocks = pd.read_csv(ROOT / "data" / "scoreboard_blocks.csv").to_dict("records")
    breakdown = pd.read_csv(ROOT / "data" / "scoreboard_breakdown.csv").to_dict("records")
    (OUT / "scoreboard.json").write_text(json.dumps({"board": board, "blocks": blocks, "breakdown": breakdown}))

    levels = pd.Series([r["forecast"]["level"] for r in records.values()]).value_counts().to_dict()
    asof = max(r["asof"] for r in records.values())
    (OUT / "meta.json").write_text(json.dumps({
        "asof": asof, "generated_at": pd.Timestamp.now(tz="Asia/Kolkata").isoformat(timespec="seconds"),
        "stocks_with_forecast": len(records), "stocks_total": len(index),
        "levels": levels, "flagged_today": int(sum(r["unusual"]["flag"] for r in records.values())),
        "risk_bands": load_bands(), "skipped": skipped,
        "models": json.loads((MODELS / "meta.json").read_text()),
    }, indent=1))
    print(f"done in {(time.time() - started) / 60:.1f} min -> {OUT} (data as of {asof}); levels: {levels}")


if __name__ == "__main__":
    main()
