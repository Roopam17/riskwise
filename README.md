# RiskWise

A free, educational website for Indian (NSE) stocks. Search a stock and see a delayed price, a **risk level** for the coming week (Low / Medium / High, from a volatility forecast), and an **unusual-activity** flag. It gives **no buy or sell advice**. Users can sign up and keep a watchlist.

New here? Read `CLAUDE.md` (the design and the rules we work by) and `LEARNING.md` (plain-English notes on every ML stage). To put the site online, follow `DEPLOY.md`.

## What is in each folder

| Folder | What it holds |
|---|---|
| `notebooks/` | The learning work, run cell by cell in VS Code (kernel **RiskWise (.venv)**). 00 hello, 01 prices, 02 target and Naive, 03 GARCH, 04 XGBoost, 05 LSTM, 06 scoreboard, 07 Isolation Forest, 08 risk levels |
| `pipeline/` | The scripts behind the notebooks: download prices, build the clues table, train, and the nightly job that writes the website's data |
| `models/` | The trained models (small; committed so the nightly job can use them) |
| `data/` | Downloaded prices and big working files (not committed), plus a few small files that are |
| `app_data/` | What the nightly job writes and the backend serves (not committed) |
| `backend/` | The FastAPI server |
| `frontend/` | The React website |
| `supabase/` | The database setup for logins and watchlists |
| `mockup/` | The original clickable design picture (kept for reference) |

## Run it on your laptop

You need the `.venv` toolbox (already built) and Node. Two terminals:

```bash
# 1) the backend (port 8000)
.venv/bin/uvicorn --app-dir backend app.main:app --port 8000
```

```bash
# 2) the website (port 5173), first time install the libraries
cd frontend && npm install && npm run dev
```

Open http://localhost:5173. With no Supabase keys it runs in **local mode**: everything works, and the watchlist is saved in your browser.

## Rebuild the data and models

```bash
.venv/bin/python pipeline/download_prices.py            # prices for every NSE stock, resumable (about 40 minutes)
.venv/bin/python pipeline/features.py                   # the clues table
.venv/bin/python pipeline/train_final.py                # train XGBoost, LSTM and GARCH settings (about 2 minutes)
.venv/bin/python pipeline/fundamentals.py               # company facts (add --retry-missing for a slower second pass)
.venv/bin/python pipeline/nightly.py --offline          # build app_data/ from the saved prices (no internet)
.venv/bin/python pipeline/nightly.py                    # same, with fresh prices from Yahoo (what the server runs)
```

## Run the tests

```bash
cd backend && ../.venv/bin/python -m pytest             # 13 backend tests
cd frontend && npm test                                 # 18 website tests
```

## The honest summary of the ML

The models predict only how big the typical daily move will be over the next 5 trading days, never the direction. On the most recent 3 years of unseen data, the average of three forecasters (GARCH, XGBoost, LSTM) misses about 18% less than "next week will be as wiggly as last week", and the best single models about 21% less. A cheap "last month's wiggle" rule already beats the plain baseline by about 7%, so not all of that is cleverness. Surprises (news shocks) are missed by every model. The full scoreboard is on the How it works page and in `notebooks/06_scoreboard.ipynb`.
