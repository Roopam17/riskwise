"""Walk-forward GARCH guesses (same function as in notebook 03), shared so later notebooks can reuse it."""
import numpy as np
import pandas as pd
from arch import arch_model


def garch_guesses(df, refit_every=63, min_train=500, dist="t"):
    """For every day, GARCH's guess of the next-5-day wiggle (% a day), using only the past."""
    r = np.log(df["Close"]).diff().dropna() * 100
    guesses = pd.Series(np.nan, index=r.index)
    for start in range(min_train, len(r), refit_every):
        block_end = min(start + refit_every, len(r))
        # 1) find the dials using ONLY the past: rows before `start`
        spec = arch_model(r.iloc[:start], mean="Constant", vol="GARCH", p=1, q=1, dist=dist)
        dials = spec.fit(disp="off").params
        # 2) freeze those dials, roll forward day by day through the next block
        rolling = arch_model(r.iloc[:block_end], mean="Constant", vol="GARCH", p=1, q=1, dist=dist).fix(dials)
        forecast = rolling.forecast(horizon=5, start=start - 1, reindex=False).variance
        # 3) average the 5 forecast variances, then square root
        block_guess = np.sqrt(forecast.mean(axis=1)).iloc[: block_end - start]
        guesses.loc[block_guess.index] = block_guess.values
    return guesses
