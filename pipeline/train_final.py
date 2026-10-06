"""Train the production models on ALL data up to today and save them to models/.

Run (a few minutes; re-run about once a month):
    .venv/bin/python pipeline/train_final.py

Saves: models/xgb.json, models/lstm.pt, models/lstm_stats.json, models/garch_params.json, models/meta.json
(models/isolation_forest.joblib and models/risk_bands.json come from notebooks 07 and 08.)
"""
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
from common import ROOT, load_prices                      # noqa: E402
from features import FEATURE_COLS                         # noqa: E402

MODELS = ROOT / "models"
XGB_PARAMS = dict(objective="reg:squarederror", tree_method="hist", max_depth=4, learning_rate=0.05,
                  subsample=0.8, colsample_bytree=0.8, min_child_weight=50, n_jobs=-1)


def load_table():
    tab = pd.read_parquet(ROOT / "data" / "features.parquet")
    tab["date"] = pd.to_datetime(tab["date"])
    return tab.sort_values(["sym", "date"]).reset_index(drop=True)


def train_xgb(tab):
    import xgboost as xgb
    cutoff = tab["date"].max() - pd.Timedelta(days=10)             # newest training answers must have finished
    stride = tab.groupby("sym").cumcount() % 3 == 0
    train = tab[(tab["date"] <= cutoff) & tab["target"].notna() & stride]
    practice_start = cutoff - pd.DateOffset(years=1)
    learn, practice = train[train["date"] <= practice_start], train[train["date"] > practice_start]
    probe = xgb.XGBRegressor(n_estimators=800, early_stopping_rounds=30, **XGB_PARAMS)
    probe.fit(learn[FEATURE_COLS], learn["target"], eval_set=[(practice[FEATURE_COLS], practice["target"])], verbose=False)
    trees = probe.best_iteration + 1
    final = xgb.XGBRegressor(n_estimators=trees, **XGB_PARAMS).fit(train[FEATURE_COLS], train["target"])
    final.save_model(str(MODELS / "xgb.json"))
    print(f"XGBoost: {trees} trees, {len(train):,} training rows")
    return trees


def train_lstm(tab):
    import torch
    import torch.nn as nn
    from lstm_model import L, Net, get_device, predict, story_batch
    device = get_device()
    torch.manual_seed(0); np.random.seed(0)
    cutoff = tab["date"].max() - pd.Timedelta(days=10)
    pos = tab.groupby("sym").cumcount()
    usable = pos >= L - 1
    train_rows = tab[(tab["date"] <= cutoff) & tab["target"].notna() & usable]
    mu, sd = train_rows[FEATURE_COLS].mean().values, train_rows[FEATURE_COLS].std().values
    ymu, ysd = float(train_rows["target"].mean()), float(train_rows["target"].std())
    X = torch.from_numpy(np.nan_to_num(((tab[FEATURE_COLS].values - mu) / sd).astype(np.float32))).to(device)
    y_np = ((tab["target"].values - ymu) / ysd).astype(np.float32)
    y = torch.from_numpy(np.nan_to_num(y_np)).to(device)
    sel = train_rows[(pos % 8 == 0)[train_rows.index]]
    practice_start = cutoff - pd.DateOffset(years=1)
    learn_idx = sel[sel["date"] <= practice_start].index.values
    practice_idx = sel[sel["date"] > practice_start].index.values

    net = Net(len(FEATURE_COLS)).to(device)
    opt = torch.optim.Adam(net.parameters(), lr=2e-3)
    best, best_state, patience, epochs = 9e9, None, 0, 0
    for epoch in range(1, 13):
        net.train()
        order = np.random.permutation(learn_idx)
        for i in range(0, len(order), 1024):
            xb, yb = story_batch(X, y, order[i:i + 1024], device)
            opt.zero_grad(); nn.functional.mse_loss(net(xb), yb).backward(); opt.step()
        loss = float(((predict(net, X, practice_idx, device) - y_np[practice_idx]) ** 2).mean())
        epochs = epoch
        if loss < best - 1e-4:
            best, patience, best_state = loss, 0, {k: v.clone() for k, v in net.state_dict().items()}
        else:
            patience += 1
            if patience >= 2:
                break
    torch.save(best_state, MODELS / "lstm.pt")
    (MODELS / "lstm_stats.json").write_text(json.dumps({"mu": mu.tolist(), "sd": sd.tolist(), "ymu": ymu, "ysd": ysd,
                                                        "features": FEATURE_COLS, "L": L}))
    print(f"LSTM: {epochs} epochs, best practice loss {best:.4f}, {len(learn_idx):,} stories")


def fit_one_garch(sym):
    from arch import arch_model
    try:
        r = np.log(load_prices(sym)["Close"]).diff().dropna() * 100
        fit = arch_model(r, mean="Constant", vol="GARCH", p=1, q=1, dist="t").fit(disp="off")
        return sym, {k: float(v) for k, v in fit.params.items()}
    except Exception:
        return sym, None


def train_garch(tab):
    universe = pd.read_csv(ROOT / "data" / "universe.csv")["sym"].tolist()
    # correction number per stock: typical (real wiggle / GARCH guess) over all history we have walk-forward guesses for
    pieces = []
    for sym in universe:
        f = ROOT / "data" / "garch" / f"{sym}.csv"
        if f.exists():
            pieces.append(pd.read_csv(f, parse_dates=["date"]).assign(sym=sym))
    g = pd.concat(pieces).merge(tab[["sym", "date", "actual_next5"]].dropna(), on=["sym", "date"])
    ratio = (g["actual_next5"] / g["garch_raw"]).groupby(g["sym"])
    scale = ratio.median()[ratio.size() >= 150]
    keep = [s for s in universe if s in scale.index]
    with ProcessPoolExecutor(max_workers=max(1, (os.cpu_count() or 2) // 2)) as pool:
        results = dict(pool.map(fit_one_garch, keep, chunksize=8))
    out = {s: {**p, "scale": float(scale[s])} for s, p in results.items() if p}
    (MODELS / "garch_params.json").write_text(json.dumps(out))
    print(f"GARCH: settings saved for {len(out)} stocks (the rest use the other models only)")


def main():
    MODELS.mkdir(exist_ok=True)
    started = time.time()
    tab = load_table()
    print(f"{len(tab):,} rows up to {tab['date'].max().date()}")
    trees = train_xgb(tab)
    train_lstm(tab)
    train_garch(tab)
    (MODELS / "meta.json").write_text(json.dumps({
        "trained_on_data_until": str(tab["date"].max().date()), "xgb_trees": trees,
        "trained_at": pd.Timestamp.now().isoformat(timespec="seconds")}, indent=2))
    print(f"done in {(time.time() - started) / 60:.1f} min")


if __name__ == "__main__":
    main()
