# RB's learning notes

After each stage, a short note goes here: what the model does, what the result means, and one thing that could go wrong. Written in plain English.

## Before Stage 1: the big idea

- **We predict volatility, not price.** Volatility = how much a stock's price wiggles day to day. Like weather: we can't say the exact temperature next Tuesday, but "it has been stormy lately, so next week is probably stormy too" is a reasonable forecast.
- **Naive baseline** = "next week will be as wiggly as last week". Every fancier model has to beat this to be worth using.
- **No peeking at the future (lookahead bias).** We always train on older dates and test on later dates, like studying last year's papers and sitting this year's exam.
- **Unusual activity is a smoke alarm, not a forecast.** It says "today looks strange compared to this stock's normal days".

## Stage 1: setting up the workshop

- **Virtual environment (`.venv`)** = a private toolbox for this one project. Tools installed into it can't clash with anything else on your Mac. The list of what's inside is saved in `requirements.txt`, so the toolbox can be rebuilt anywhere.
- **pandas** = tables of data (Excel in code). **numpy** = fast maths. **matplotlib** = charts. **ipykernel** = the engine that runs notebook cells.
- **Notebook** = a document of small cells you run one at a time. Each cell's result appears right below it.
- Could go wrong: if VS Code runs a notebook with the wrong Python (not `.venv`), you'll see "No module named pandas". Fix: pick the `.venv` kernel at the top right of the notebook.

## Stage 2: getting real price history

- **A price history is one row per trading day:** Open, High, Low, Close, Volume (plus Dividends and Stock Splits). Weekends and holidays have no row, so 20 years is about 4,900 rows, not 7,300.
- **Adjusted prices:** when a company splits its shares, old prices are scaled so the history stays fair. Without this, a 1-for-2 split would look like a 50% crash and fool the model. That is also why early Reliance prices look so low on a chart.
- **Daily return** = how much the price changed since yesterday, in percent. Volatility, the thing we predict, is built from these.
- **Resumable downloads:** one file per stock, and skip files that already exist. A crash or pause then loses nothing.
- **What we got:** all 2,599 NSE stocks, 622 MB, 0 failures. Only 827 have the full 20 years; the median is 9.6 years. 402 have under a year (recent listings). 247 stocks have trading volume of zero on more than 10% of days (barely traded), so their risk numbers will be noisy.
- Could go wrong: a stock with a short or patchy history gives a made-up-looking risk level. We will need a "not enough data" rule so the app does not pretend.

## Stage 3: what we predict, and the Naive baseline

- **The target ("wiggle"):** the typical size of a daily price move over the NEXT 5 trading days, ignoring direction. We measure it with the Yang-Zhang method, which uses three clues per day (overnight gap, open-to-close drift, high-low range) instead of just the closing price, so it is steadier from only 5 days of data. The simple closing-price version is kept as a cross-check.
- **Naive baseline:** "next week will be as wiggly as last week". It is the opponent every later model must beat. On the 3-year exam it misses by roughly a third of the typical wiggle (about 0.4 points of daily wiggle on top of a typical 1.2%).
- **Naive is always a week late:** its line is the real line shifted forward, so it is wrong exactly at the turning points (calm turning stormy, or the reverse). A good model has to do better there.
- **No peeking, and how we checked:** the guess uses days up to today; the answer uses days after today. Cell 6 of the notebook rebuilds one answer by hand and checks it matches the table.
- **Exam by date:** the most recent 3 years are the exam; everything older is study material. Mixing dates randomly would leak the future into the training (the model would "study" days from after the exam question).
- **Data surprise:** Yahoo adds fake rows for market holidays (nothing traded, price copied). We drop zero-volume rows for big stocks. For thinly traded stocks a zero-volume day can be real, so they need a different rule later.
- Could go wrong: a measure built from open, high and low is fragile when those prices are bad or the stock barely trades.

## Stage 4: GARCH

- **GARCH = "stormy weeks follow stormy weeks".** Like waves in a pot after stirring: a big move makes waves, and the waves die down slowly toward the stock's normal level. Three dials: baseline (how choppy it normally is), reaction (how much a big move yesterday raises the forecast), memory (how slowly waves die down).
- **"Training" = finding the dials** that make the stock's history most plausible, separately for each stock. For Reliance's first 5 years, persistence was about 0.99: a shock's effect halves only after roughly 60 trading days. Storms last.
- **Walk forward:** re-fit the dials every 63 trading days using only the past, then roll them forward day by day. A test chopped the data after one date and got the identical guess, which proves there is no peeking.
- **Scale problem:** GARCH forecasts closing-price wiggle; our target uses the whole day. Without one correction number per stock (learned from the study period only, with 5 boundary days thrown away), GARCH looked worse than Naive for a silly reason.
- **Honest result (3-year exam, 5 big stocks):** scaled GARCH beat Naive by about 7% to 23%, but beat the cheap "last month" yardstick (Naive-20) by only about 4% to 9%. Much of GARCH's edge over Naive is simply "look back further than one week".
- Could go wrong: a model can look good only because the opponent is weak. Always add a stronger cheap yardstick.

## Stage 5: XGBoost

- **XGBoost = a panel of hundreds of simple advisors.** Each asks a few yes/no questions about the clues (e.g. "is the 20-day wiggle below 0.83?") and nudges the forecast; each new advisor focuses on what the earlier ones got wrong. The first advisor's questions are readable in the notebook (Cell 5).
- **One model for all stocks.** Unlike GARCH (one fit per stock), XGBoost learned from 1,586 stocks pooled together, so it saw many more storms and calms. We trained on every stock with at least 3 years of history that trades on 95% of days (RB's "Option B"), each using up to 20 years.
- **The clues (all past-only, in log form):** wiggle over 5/10/20/60/120 days, simple wiggle, yesterday's move size, recent high-low range, volume vs normal, and "is last week wigglier than usual". The answer (next 5 days' wiggle) is never a clue; a test that chops history after a date confirmed the clues do not change.
- **Early stopping:** keep adding advisors only while a practice slice (the last year of the training data) keeps improving. This protects against overfitting (memorising old data instead of learning the pattern). Choosing settings on the real exam would be cheating, because the exam score would then be too optimistic.
- **Walk forward:** the 3-year exam is cut into six 6-month blocks; before each block the model is re-trained on data before it, with a 10-day gap at the boundary.
- **Honest result:** averaged over all 1,586 stocks, XGBoost's average miss was 20.6% smaller than Naive's and 14.7% smaller than Naive-20's. It beat Naive on 100% of stocks and won in all six blocks. On the 5 big stocks it beat scaled GARCH by only about 5%: a pooled model with many clues is better, but not magic.
- Could go wrong: no model sees surprises. News shocks are missed by all of them; what they capture is the normal rhythm of calm and stormy spells.

## Stage 6: LSTM and the final scoreboard

- **LSTM = a small neural network that reads the last 40 days in order**, like the last 40 pages of a story instead of one summary card. It carries a small memory from day to day. Ours has only about 5,700 numbers to learn, on purpose: less to memorise.
- **Same honesty rules:** standardise the clues using training rows only (otherwise the test period leaks into how we measure things), stop training when a practice slice stops improving, and re-train before each 6-month block.
- **Scoreboard on identical rows** (1,312 stocks, 3 years, ~956,000 stock-days): Naive 0.351 (average miss as a share of the typical wiggle), Naive-20 0.327, GARCH 0.345, XGBoost 0.279, LSTM 0.276. LSTM and XGBoost are nearly tied; LSTM beat XGBoost on about 73% of stocks by a small margin.
- **Two rulers can disagree, and that is the point.** On plain average miss, XGBoost and LSTM win and GARCH looks weak. On QLIKE (which punishes guessing too low far more than too high), the averages that include GARCH win, and GARCH alone beats Naive-20. Underestimating risk is the costly mistake for a risk tool, so we ship the **average of all three**: still 18.5% better than Naive on the plain ruler, and best or near-best on QLIKE. Weights are NOT tuned on the exam, because that would flatter the result.
- **A bug that taught something:** QLIKE first showed `inf` because a flat week has a real wiggle of exactly 0, and the logarithm of 0 is minus infinity. Fix: floor values at 0.05% a day. Always check what your formula does at zero.
- Could go wrong: the exam is only 3 years of one market. A different kind of year could shuffle the ranking.

## Stage 7: Isolation Forest (the unusual-activity flag)

- **A smoke alarm, not a forecast.** It compares TODAY with the stock's previous 60 days on four things: price move, day range, volume and opening gap, each as a multiple of normal. The most extreme one becomes the reason ("Volume 3.2x normal").
- **How it works:** build hundreds of random question trees; a truly odd day is separated from the crowd after only a few questions. Quick to isolate means unusual.
- **No accuracy score exists** because nobody labelled "really unusual" days. We sanity-check instead: on the Covid panic day 39.9% of all stocks were flagged and on the crash day 21.7%, against 0.8% on a typical day; on election-result day 2024 (a day the forest never saw) 7.4%. On unseen days 0.93% were flagged, close to the 1% we aimed for.
- Important: "1% flagged" is by design (we set the alarm level), so it is not a result. The famous-days check is.
- Could go wrong: thinly traded stocks look unusual when one large trade moves the volume.

## Stage 8: turning a forecast into Low / Medium / High

- **Compare with the whole market, not with the stock itself.** Comparing a stock with itself would call a very jumpy stock "Low" in a quiet week and a very calm one "High", which would mislead anyone comparing stocks. So the level is market-wide, and a second small label says "calmer / about usual / wigglier than usual" for that stock.
- **Cut-offs:** the thirds of the models' honest out-of-sample forecasts over the latest 12 months: Low below 2.31% a day, High from 3.07% a day. Then fixed, so a label means the same thing every night; re-check yearly.
- **Honest error rates of the label:** about 8% of Low weeks turned out wigglier than the High cut-off, and about 10% of High weeks turned out calmer than the Low cut-off. About 23% of stock-weeks change label from the previous week, because many stocks sit near a cut-off.
- **Like with like:** our first "vs usual" compared a forecast with the median of past REAL wiggles, which is a different kind of number, and labelled a third of weeks "wigglier than usual". Comparing with the median of the model's own past forecasts fixed it.

## Stages 9 to 11: from notebooks to a website

- **Nightly job** (`pipeline/nightly.py`): fetch fresh prices, build today's clues, ask the three models, average them, apply the risk bands and the unusual-activity check, and write small JSON files. The website only reads those files, so a free server is enough.
- **Never treat an unfinished bar as a close.** Our saved data had today's price from the middle of the trading day. The job now drops today's bar if it is fetched before 4 PM India time.
- **A safety check that earned its keep:** a stock showed -86% in one day. NSE price limits make that essentially impossible, so it was an unadjusted stock split. The job now refuses to forecast any stock with such a jump in the last 25 days and says why. Only 4 of 1,586 stocks were affected.
- **A test that proved its worth:** `sr-only` (a hidden label for screen readers) escaped its table's scrolling box and made one page wider than a phone screen. Fix: make the box its own positioning context.
- **Free data has holes:** ROE exists for only about 6% of stocks from our source. Rather than show "Not available" on a headline metric for 94% of stocks, the Compare key-metrics table uses dividend yield and ROE stays in the details tab.
