# RiskWise (working title: "Market Risk Monitor")

Educational, non-commercial web app for Indian stocks (all NSE and BSE symbols searchable). It gives NO buy/sell advice, ever.

A user searches a stock and sees: its live (delayed / indicative) price, a **risk level** for the next week (a volatility forecast), and an **unusual-activity** flag. Users can sign up (email + password, email verification) and keep a watchlist.

Design status: **approved by RB on 2026-10-06** (mockup v4 plus later tweaks). The clickable mockup is `mockup/index.html`, run with the `mockup` entry in `.claude/launch.json` (python http.server on port 5173). All numbers in the mockup are invented sample data.

## Who we are working with
RB is a 20-year-old B.Tech CSE (AI) student working SOLO. Knows very little ML and no web development. Explain everything in plain English with everyday examples; never use jargon without explaining it. The goal is for RB to understand and learn, not just receive working code.

## How we work (rules)
1. RB is the DESIGNER and decision-maker. RB decides what is in the app, what each page shows, how it looks. Claude writes the code.
2. Build in SMALL STAGES. Before each stage: explain the idea simply and stop for RB's decision if there are choices. After each stage: run it, show the result, explain what it means.
3. NEVER do more than one stage without RB's approval. **EXCEPTION (2026-10-06):** RB said "build everything and give me final project", so the remaining stages (LSTM, scoreboard + ensemble, Isolation Forest, risk-level rule, nightly pipeline, backend, frontend, deploy files) are authorised to run back-to-back. STILL STOP AND ASK for: creating accounts, entering keys/secrets/passwords (Claude must never do these), deploying or pushing anything online, image licence, design changes, deleting data, and any outward-facing action. Keep explaining commands, keep LEARNING.md updated, and make every ML notebook runnable by RB. Pick sensible defaults for undecided items and list them clearly at the end so RB can change them.
4. Tell RB what every command does BEFORE running it.
5. Be honest about weak results. If a model does not beat the Naive baseline, say so plainly, including on the How it works page.
6. ML must avoid lookahead bias: chronological splits only (train on older dates, test on later dates, rolling/walk-forward tests). Every model is compared against the Naive baseline.
7. **Teach first, notebook way.** For every ML stage: explain the idea with an everyday example, then show code in small pieces with a plain-English walkthrough. ML work lives in **Jupyter notebooks** that RB runs cell by cell (RB presses Run, changes a number, re-runs, sees what changes). Plumbing code (website, nightly job, login) is written by Claude with shorter explanations.
8. After each stage add a short "what you just learned" note (what the model does, what the result means, one thing that could go wrong) to `LEARNING.md`.
9. Occasionally ask RB to explain a concept back in their own words. It is not a test; if RB cannot yet, explain it differently.
10. UI wording is non-technical ("Risk level", "AI pattern model"). Technical names (GARCH, XGBoost, Isolation Forest, LSTM) appear ONLY on the How it works page.
11. Never give personalised financial advice. Never write copy that hints at buying or selling. Use "risk", "expected daily move", not "opportunity", "profit", "signal". No chart-indicator jargon (RSI, MACD) in the UI.

## Stack (agreed)
Python 3.12, pandas, scikit-learn, XGBoost, arch; FastAPI backend; React + Vite + Tailwind + Recharts frontend; Supabase for auth and watchlists; ML results precomputed nightly into JSON/CSV files; Vercel (frontend) and Render (backend), all on free tiers.
- Render free tier sleeps when idle (first visit can take ~30 s). Prices come from free, unofficial sources: always label them "Delayed price".
- Training/prediction does NOT run on Render. A nightly scheduled job (e.g. GitHub Actions) writes the result files; Render only serves them.

## What the ML predicts
ONE thing: **volatility**, i.e. how big the typical daily move (up or down) will be over the NEXT 5 TRADING DAYS. NOT price direction, NOT a future price, NOTHING about buy/sell.
- Inputs (past only): daily returns, volatility over last 5/10/20/60 days, high-low range, volume.
- Models: Naive baseline ("next week = last week's wiggle"), GARCH (fit per stock), XGBoost (one model on many stocks), optional LSTM.
- **Risk level (Low / Medium / High)** = predicted volatility compared with that stock's own normal range (exact rule to be decided with RB at that stage).
- **Unusual activity** = Isolation Forest anomaly flag: is TODAY strange compared to this stock's normal days (price jump, volume spike). Not a prediction.
- Retrain occasionally (about monthly); the nightly job only computes new predictions from saved models.
- Honest expectation: Naive is a strong baseline; fancy models may win only slightly or lose on some stocks.

## Look and feel
- TradingView-inspired: dark by default, with a sun/moon switch to light. Chart-first, tidy panels. Copy the STYLE only, never TradingView's logo, name or exact designs.
- Accent colour: teal (teal-to-blue gradient on the main call-to-action button).
- Risk colours are reserved: green = Low, amber = Medium, red = High. Never use them for anything else. Every risk label also has a word and an icon (not colour alone).
- Background: Earth-from-space photo as the Home hero (`mockup/hero.jpg`) with a dark fade for readability and a very slow zoom (disabled for reduced-motion users). LICENCE OF THIS IMAGE IS UNKNOWN: confirm or replace before going public. A video background may be considered later (Home only, muted, short, with pause control, still image on phones).
- Company logos: use coloured initials. Real logos need permission.
- Top bar on every page: logo (RiskWise), wide search box, links Explorer, Compare, Watchlist, "Learn" dropdown (How it works, Glossary, About and disclaimer), sun/moon switch, then Sign up and Log in buttons (account button when logged in). Current page underlined. On phones links collapse into a menu button.
- Footer on every page: "Educational only, not buy/sell advice."
- App name: "RiskWise" is chosen but generic: do a quick availability check (website address, existing apps) before using it publicly. Fallback ideas: RiskWise India, Stormcast, Calmcast.

## Search (top bar and Compare)
Typing "adani" must list ALL Adani stocks. Based on a full list of NSE and BSE companies (symbol, full name, exchange, sector) from the exchanges' official published lists (verify source and terms at build time). Ranking: exact symbol, name starts with, a word starts with, nickname (e.g. SBI, RIL), contains, then typo-tolerant (e.g. "relaince" finds Reliance). Each suggestion shows symbol, full name and exchange; a company on both exchanges appears once with both tags.

## Pages (9)
1. **Home**: hero (headline "See a stock's risk before the week begins", sub-line "Calm or stormy? Check any Indian stock in plain English.", big "Sign up free" gradient button, which becomes "Search a stock" when logged in, small line "Free, no card needed. Educational only, not investment advice."), popular stock cards, watchlist preview (or "Log in to save stocks here").
2. **Stock page** (order): company basics (name, symbol, NSE/BSE, sector) with watchlist star and "Compare with..." button; price block (price, today's change, "Delayed price" label); risk level meter and unusual-activity badge side by side; plain-English explanation sentence; interactive price chart (1M, 3M, 6M, 1Y, 3Y, 5Y) with dated axes and hover values; risk-history chart (last 26 weeks of expected daily move). "?" hover tips link to How it works for AI terms.
3. **Compare** (up to 3 stocks): title, "Clear all", search-and-add box, colour-matched stock chips with remove, dashed "Add stock" button, "Delayed prices - updated ..." line with refresh. Four tabs, each with a one-line description under the tab row:
   - **Quick comparison**: per-stock cards (initials avatar, name, star, price and change, 52-week range bar with current marker, risk badge, unusual-activity badge with detail such as "Volume 2.4x avg"), "Relative performance" chart (all start at 100, range buttons 1M to 5Y, side legend with each stock's return), "Key comparison metrics" table (price, market cap, P/E, ROE, 1-year return, risk level).
   - **Company details**: sector, exchange, size, market cap, P/E, ROE, dividend yield, average daily volume ("Not available" where missing).
   - **Price history**: 1M/6M/1Y returns, 52-week high and low, distance below 52-week high, 1-year return bars.
   - **Risk forecast**: risk level, expected daily move, unusual activity, risk history chart for all chosen stocks, and the "which is riskier?" sentence (risk only, never advice).
   Ways INTO Compare: the search-and-add box; "Compare with..." on the Stock page; "Compare selected" on the Watchlist; checkboxes plus "Compare (n)" in the Risk explorer. The chosen stocks go in the web address (e.g. /compare?s=SBIN,INFY) so links are shareable.
4. **Watchlist** (login required, cap 50 stocks, a single adjustable number): alerts banner (risk level changes, unusual activity), sortable table with price, today's change, 1-month sparkline, risk, unusual flag, remove button, "Compare selected", friendly empty state.
5. **Risk explorer**: tabs All / Low / Medium / High / Unusual today, stock list, filters (exchange, size, sector), sort (riskiest, calmest, biggest change today), bubble risk map (bubble colour = risk, size = company size, click opens Stock page), search within list, checkboxes for Compare. The mockup does not yet draw the bubble map or the filters.
6. **Sign up / Log in**: Log in and Sign up tabs, password strength meter with show/hide, "Forgot password?", "Check your email" screen with Resend, account area (change password, delete account), and "Log in with Google" added as a LATE stage (needs RB to do Google Cloud and Supabase dashboard steps; Claude cannot enter secrets).
7. **How it works**: big idea in plain English; flow picture; model cards (Naive, GARCH, XGBoost, optional LSTM) with expandable technical details; honest accuracy scoreboard vs Naive on unseen dates; Isolation Forest explainer; how risk levels are decided; limits and honesty box; data sources and last-updated time; interactive slider demo.
8. **About and disclaimer**: what the app is; disclaimer (not advice, not a registered adviser, forecasts can be wrong); data notice (delayed prices); privacy summary (store only email and watchlist, account deletion); contact/feedback. NO builder/about-me section.
9. **Glossary**: ordinary market terms only (price facts, company facts), with search, A-Z jump, grouped sections, tiny visual per term, "why it matters" line, and "?" hover tips elsewhere. Terms produced by our AI models are NOT here; they are explained on How it works.

## Data scope
RB's decision (2026-10-06): use ALL NSE and BSE stocks (about 5,000 symbols) and up to 20 YEARS of daily history each (many stocks have less; take what exists). Download in a resumable way: one file per stock, polite pacing, runs in the background (hours). Symbol list comes from the exchanges' official published files.
- Very thinly traded stocks give noisy risk numbers. Later, decide with RB how to handle them (e.g. a "not enough data" label instead of a made-up risk level).
- Whether the NIGHTLY forecast covers all stocks or a core list (about 500 large companies) is decided from real timings, not guesses. Stocks outside the nightly set would show price plus a simpler, live-estimated risk.
- Data source for learning: yfinance (free, unofficial, adjusted prices). Revisit for the live site at the pipeline stage.
- MODELLING UNIVERSE (RB chose "Option B", 2026-10-06): a stock is used for training and scoring only if it has at least 3 years of history AND trades (nonzero volume) on at least 95% of days. That keeps 1,586 of 2,599 NSE stocks (see `data/universe.csv`). Each stock uses up to 20 years. RB rejected "full 20 years only" (725 stocks) because of survivorship bias. Other stocks need a "not enough data" treatment in the app (decide later).
- Model files: `pipeline/common.py` (loading, wiggle measures), `pipeline/features.py` (clues table -> `data/features.parquet`), `pipeline/garch_model.py`. Notebooks 00-04 in `notebooks/`. The kernel to select in VS Code is "RiskWise (.venv)" (registered Jupyter kernel).
- Exam = most recent 3 years; models are re-fit every 6 months (GARCH every 63 trading days) using only the past, with a 10-day purge at boundaries. Scores are "average miss as a share of the stock's typical wiggle". Always compare with Naive AND the stronger cheap yardstick Naive-20.

## Open decisions (bring to RB at the right stage, one at a time)
How Low/Medium/High is calculated; the core stock list; which free data source supplies prices and fundamentals (ROE, P/E, market cap may be missing for some stocks); image licence; name availability check; Google login timing.

## Planned stages (each needs RB's approval before starting)
1. Environment check and project folders (what is installed; Python virtual environment).
2. Get price history for a few stocks and look at it (notebook).
3. Define the target (next-5-day volatility) and the Naive baseline (notebook).
4. GARCH. 5. XGBoost. 6. Scoreboard of all models vs Naive. 7. Isolation Forest anomaly flag. 8. Risk-level rule. (Optional LSTM after 6.)
9. Nightly pipeline that writes the JSON/CSV result files.
10. FastAPI backend serving them. 11. React frontend, page by page, following the mockup. 12. Supabase login and watchlist. 13. Deploy (Vercel, Render). 14. Google login (late, optional).


## STATE OF THE PROJECT (2026-10-06, end of the autonomous build)
Built and tested: notebooks 00-08 (all executed), pipeline (download, features, train_final, nightly, fundamentals), models/, backend (13 tests), website (18 tests, all 9 pages, dark and light, phone-friendly), deployment kit (render.yaml, vercel.json, GitHub workflows, supabase/schema.sql, DEPLOY.md, README.md).
NOT done because it needs RB: Supabase/Render/Vercel/GitHub accounts and keys, deploying, Google login (code ready behind VITE_ENABLE_GOOGLE), BSE-only stocks (needs RB to click Download on bseindia.com), photo licence, name availability check, contact email.

## DEFAULTS CLAUDE CHOSE ON RB'S BEHALF (RB can change any of these)
- LSTM was built (RB said "build everything"), and the live "AI pattern model" is the plain average of GARCH + XGBoost + LSTM (XGBoost + LSTM where GARCH is unavailable). Reason: the two rulers disagree; QLIKE (punishes underestimating risk) favours including GARCH. Weights are not tuned on the exam.
- Risk level is MARKET-WIDE (thirds of the last 12 months of out-of-sample forecasts): Low < 2.31% a day, High >= 3.07% a day (models/risk_bands.json). A second label says calmer / about usual / wigglier than usual for that stock. Re-check yearly.
- Unusual activity: Isolation Forest on 4 "multiple of normal" measures, alarm level = most unusual 1% of pre-exam stock-days.
- Stocks with a recent impossible price jump (> about -33% / +49% in a day within 25 days) get no forecast that night (likely unadjusted split).
- Stocks outside the modelling universe (under 3 years of history, or thinly traded) show price only, with a plain explanation.
- Compare key-metrics table uses dividend yield instead of ROE (ROE is available for only about 6% of stocks); ROE stays in Company details.
- Company size buckets by market cap: Large >= Rs 20,000 crore, Mid >= Rs 5,000 crore, else Small (approximate, our own).
- Search is client-side from index.json; backend has the same ranking at /api/search.
- Local mode: with no Supabase keys the watchlist is stored in the browser and the login page says logins are not connected.
- Nightly job runs 18:00 India time on weekdays via GitHub Actions; company facts weekly (Sunday). Models are retrained by hand about monthly (see DEPLOY.md).
- Data source stays yfinance (free, unofficial). Revisit if it gets blocked.
- Contact address comes from VITE_CONTACT_EMAIL; the About page says it will be added if unset.
