import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, TriangleAlert } from 'lucide-react'
import { Page } from '../components/Layout'
import { RiskChip } from '../components/Badges'
import { useAsync, useMeta, useTitle } from '../hooks/data'
import { api } from '../lib/api'

const SECTIONS = [['big-idea', 'The big idea'], ['flow', 'How a forecast is made'], ['models', 'The forecasters'], ['scoreboard', 'The scoreboard'], ['unusual', 'Unusual activity'], ['risk-levels', 'Risk levels'], ['limits', 'Limits'], ['data', 'Data'], ['demo', 'Try it']]

function Tech({ children }) {
  return <details className="tech"><summary>Technical details</summary><div className="muted mt-2 text-sm">{children}</div></details>
}

function ModelCard({ name, plain, children, badge }) {
  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-2"><h3 className="h3 !m-0">{name}</h3>{badge && <span className="badge ok">{badge}</span>}</div>
      <p className="muted mt-1.5">{plain}</p>
      <Tech>{children}</Tech>
    </div>
  )
}

const FLOW = [
  ['1', 'Daily prices', 'Up to 20 years of open, high, low, close and volume for each stock'],
  ['2', 'Clues', 'How wiggly the last 5, 10, 20, 60 and 120 days were, volume, daily ranges'],
  ['3', 'Three forecasters', 'GARCH, XGBoost and LSTM each guess next week\'s wiggle'],
  ['4', 'The average', 'Their average is the expected daily move'],
  ['5', 'What you see', 'A Low, Medium or High risk level, plus an unusual-activity check'],
]

function Scoreboard() {
  const { data, error, loading } = useAsync(api.scoreboard, [])
  if (loading) return <div className="card muted">Loading the scoreboard…</div>
  if (error) return <div className="card dn">{error.message}</div>
  const board = data.board
  const chart = [...board].sort((a, b) => b['miss share'] - a['miss share']).map((r) => ({ model: r.model.replace('Ensemble: ', 'Average of ').replace('GARCH + XGBoost', 'GARCH + XGBoost').replace('XGBoost + LSTM', 'XGBoost + LSTM'), miss: r['miss share'], key: r.model }))
  const blockModels = ['Naive', 'Naive-20', 'GARCH', 'XGBoost', 'LSTM', 'Ensemble: all three']
  const groups = (type) => [...new Set(data.breakdown.filter((r) => r.group_type === type).map((r) => r.group))]
  const cell = (type, group, model) => data.breakdown.find((r) => r.group_type === type && r.group === group && r.model === model)?.miss_share
  const colorFor = (key) => (key === 'Naive' || key === 'Naive-20' ? 'var(--t3)' : key.startsWith('Ensemble: all') ? 'var(--ac)' : '#8b5cf6')
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5">
      <div className="card">
        <div className="h3">Average miss, as a share of the stock's typical weekly wiggle (shorter bar is better)</div>
        <div className="faint mb-2 text-xs">Tested on the most recent 3 years, on days the models never saw while learning.</div>
        <div style={{ width: '100%', height: 300 }} role="img" aria-label="Bar chart of each model's average miss">
          <ResponsiveContainer>
            <BarChart data={chart} layout="vertical" margin={{ left: 120, right: 20 }}>
              <CartesianGrid stroke="var(--ln)" horizontal={false} />
              <XAxis type="number" domain={[0, 'dataMax']} tick={{ fill: 'var(--t3)', fontSize: 11 }} stroke="var(--ln)" />
              <YAxis type="category" dataKey="model" width={120} tick={{ fill: 'var(--t2)', fontSize: 12 }} stroke="var(--ln)" />
              <Tooltip formatter={(v) => v.toFixed(3)} contentStyle={{ background: 'var(--pn)', border: '1px solid var(--bd)', borderRadius: 8 }} />
              <Bar dataKey="miss" radius={[0, 4, 4, 0]} isAnimationActive={false}>{chart.map((c) => <Cell key={c.key} fill={colorFor(c.key)} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Forecaster</th><th>Average miss (lower is better)</th><th>Better than Naive by</th><th>Underestimating-risk score (lower is better)</th><th>Stocks where it beats Naive</th></tr></thead>
            <tbody>{board.map((r) => (
              <tr key={r.model}><td>{r.model}</td><td>{r['miss share'].toFixed(3)}</td><td>{r['gain vs Naive (%)'].toFixed(1)}%</td><td>{r.QLIKE.toFixed(3)}</td><td>{r['stocks beating Naive (%)'].toFixed(0)}%</td></tr>))}
            </tbody>
          </table>
        </div>
        <div className="prose-rw mt-3 text-sm">
          <p><b className="text-tx">Two rulers, and they disagree.</b> The first ruler is the plain average miss. On it, XGBoost and LSTM are the best forecasters and GARCH looks weak. The second ruler (called QLIKE) punishes <i>guessing too low</i> much more than guessing too high, because underestimating risk is the costly mistake. On it, GARCH looks good and the averages that include GARCH are best.</p>
          <p><b className="text-tx">Why we ship the average of all three.</b> For a risk tool, the second ruler matters. The average of all three is still about 18.5% better than Naive on the plain ruler, and best or near best on the second. We did not tune the weights on the test period, because that would flatter the result.</p>
          <p><b className="text-tx">Honest caveats.</b> Even a cheap "last month's wiggle" guess (Naive-20) beats plain Naive by about 7%, so a good part of any gain is simply "look back further than one week". The models gain about 15 to 20% on top of that. Stocks move together, so the usual "plus or minus" ranges are a little too narrow.</p>
        </div>
      </div>
      <div className="card">
        <div className="h3">Is the gain stable over time?</div>
        <div className="faint mb-2 text-xs">Average miss in each 6-month block of the test period.</div>
        <div className="table-wrap"><table className="t">
          <thead><tr><th>Block</th>{blockModels.map((m) => <th key={m}>{m.replace('Ensemble: all three', 'Average of all three')}</th>)}</tr></thead>
          <tbody>{data.blocks.map((b) => <tr key={b.block}><td>{b.block}</td>{blockModels.map((m) => <td key={m}>{Number(b[m]).toFixed(3)}</td>)}</tr>)}</tbody>
        </table></div>
      </div>
      <div className="card">
        <div className="h3">Does it help every kind of stock?</div>
        {[['jumpiness', 'By how jumpy the stock is'], ['history', 'By how long the stock has existed before the test period']].map(([type, label]) => (
          <div key={type} className="mt-3"><div className="muted mb-1.5 text-sm">{label}</div>
            <div className="table-wrap"><table className="t">
              <thead><tr><th>Group</th>{blockModels.map((m) => <th key={m}>{m.replace('Ensemble: all three', 'Average of all three')}</th>)}</tr></thead>
              <tbody>{groups(type).map((g) => <tr key={g}><td>{g}</td>{blockModels.map((m) => <td key={m}>{cell(type, g, m)?.toFixed(3)}</td>)}</tr>)}</tbody>
            </table></div></div>))}
      </div>
    </div>
  )
}

function Demo({ bands }) {
  const [week, setWeek] = useState(1.5)
  const [month, setMonth] = useState(1.8)
  const [year, setYear] = useState(2.0)
  const low = bands?.low_below ?? 2.31
  const high = bands?.high_from ?? 3.07
  const guess = 0.4 * week + 0.35 * month + 0.25 * year
  const level = guess < low ? 'Low' : guess >= high ? 'High' : 'Medium'
  const Slider = ({ label, value, set }) => (
    <label className="block"><span className="mb-1 flex justify-between text-sm"><span>{label}</span><b>{value.toFixed(1)}% a day</b></span>
      <input type="range" min="0.5" max="6" step="0.1" value={value} onChange={(e) => set(Number(e.target.value))} className="w-full accent-[var(--ac)]" /></label>
  )
  return (
    <div className="card">
      <p className="muted mb-3">Move the sliders to see how a forecast responds to recent behaviour. <b className="text-tx">This is a simplified illustration</b> (a weighted blend of three numbers). The real forecasters use many more clues and are trained on millions of days, but the spirit is the same: recent wiggle matters, and so does a stock's longer-run habit.</p>
      <div className="grid gap-4 md:grid-cols-3"><Slider label="Last week's wiggle" value={week} set={setWeek} /><Slider label="Last month's wiggle" value={month} set={setMonth} /><Slider label="Last year's usual wiggle" value={year} set={setYear} /></div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><span className="text-lg font-semibold">Expected move next week: {guess.toFixed(1)}% a day</span><RiskChip level={level} /></div>
      <div className="faint mt-1 text-xs">Low is below {low}% a day, High is {high}% a day or more.</div>
    </div>
  )
}

export default function HowItWorks() {
  useTitle('How it works')
  const meta = useMeta()
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView(), 50)
  }, [hash])
  const bands = meta?.risk_bands

  return (
    <Page>
      <h1 className="h2">How it works</h1>
      <p className="muted mt-1 max-w-3xl">The short version: we look at how wiggly a stock has been, use that to guess how wiggly next week will be, and call it Low, Medium or High risk. We never predict whether a price goes up or down.</p>
      <nav className="my-4 flex flex-wrap gap-2" aria-label="On this page">{SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className="btn btn-ghost !border-ln">{label}</a>)}</nav>

      <section id="big-idea" className="scroll-mt-20">
        <h2 className="h3 mb-2">The big idea</h2>
        <div className="card prose-rw !pb-1">
          <p><b className="text-tx">We predict the wiggle, not the price.</b> Think of weather. Nobody can say exactly what the temperature will be next Tuesday, but "it has been stormy lately, so next week will probably be stormy too" is a reasonable forecast. A stock's price works the same way: calm weeks tend to follow calm weeks, and wild weeks tend to follow wild weeks.</p>
          <p><b className="text-tx">What "risk level" means.</b> We estimate how big a typical daily move (up or down) will be over the next 5 trading days, for example "about 1.8% a day". Low means calmer than most stocks, High means wigglier than most.</p>
          <p><b className="text-tx">What it is not.</b> It is not a prediction of whether the price will rise or fall, not a target price, and not advice to buy or sell. A "Low risk" stock can still fall. RiskWise is an educational project.</p>
        </div>
      </section>

      <section id="flow" className="mt-6 scroll-mt-20">
        <h2 className="h3 mb-2">How a forecast is made</h2>
        <ol className="grid list-none gap-2.5 p-0 md:grid-cols-5">
          {FLOW.map(([n, title, text], i) => (
            <li key={n} className="card relative">
              <div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-ac text-xs font-semibold text-[var(--onac)]">{n}</span><b className="font-semibold">{title}</b></div>
              <p className="muted mt-1.5 text-sm">{text}</p>
              {i < FLOW.length - 1 && <ArrowRight size={16} className="faint absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-bg md:block" aria-hidden="true" />}
            </li>))}
        </ol>
      </section>

      <section id="models" className="mt-6 scroll-mt-20">
        <h2 className="h3 mb-2">The forecasters</h2>
        <p className="muted mb-3 max-w-3xl">The "AI pattern model" you see in the app is really three different forecasters whose guesses are averaged, plus a lazy baseline we use to check whether the clever ones are worth anything. Here they are, with the technical names.</p>
        <div className="grid gap-3.5 md:grid-cols-2">
          <ModelCard name="Naive baseline" badge="the opponent" plain="Next week will be as wiggly as last week. No learning at all. Every other forecaster has to beat this, or it is not worth having.">
            <p>The wiggle is the Yang-Zhang volatility estimate over the past 5 trading days, an estimator that uses the overnight gap, the open-to-close move and the high-low range of each day, so it is steadier than a closing-price-only measure. Naive-20 does the same over 20 days and is a tougher cheap yardstick.</p>
          </ModelCard>
          <ModelCard name="GARCH" plain="A classic formula for 'stormy weeks follow stormy weeks'. Think of waves in a pot: a big move stirs them up, and they die down slowly. It has three dials (normal choppiness, reaction to yesterday's move, how slowly waves fade), fitted separately for each stock.">
            <p>GARCH(1,1) with Student-t errors, fitted by maximum likelihood on each stock's daily log returns. Dials are re-fitted every 63 trading days using only past data, then the frozen model is rolled forward day by day. Because it models closing-price volatility, its forecast is scaled by one correction number per stock, measured only on the study period.</p>
          </ModelCard>
          <ModelCard name="XGBoost" plain="A panel of hundreds of simple advisors. Each asks a few yes/no questions about the clues ('was last month's wiggle above 1.5%?') and nudges the forecast; each new advisor focuses on what the previous ones got wrong. One model learns from more than 1,500 stocks at once.">
            <p>Gradient-boosted trees (depth 4, learning rate 0.05, row and column subsampling) predicting the log of the next-5-day Yang-Zhang volatility from ten past-only clues. Trained on all stocks pooled, re-trained every 6 months in the test, with the number of trees chosen by early stopping on the final year of the training data.</p>
          </ModelCard>
          <ModelCard name="LSTM" plain="A small neural network that reads the last 40 days in order, like reading the last 40 pages of a story instead of one summary card. It carries a little memory from day to day and learns which patterns tend to come before a wiggly week.">
            <p>One LSTM layer (32 units, about 5,700 parameters) over 40-day sequences of the same ten clues, standardised using training rows only, trained with Adam and early stopping on a practice slice. Re-trained before each 6-month block of the test.</p>
          </ModelCard>
        </div>
        <div className="card mt-3.5 !border-ac">
          <div className="flex flex-wrap items-center gap-2"><h3 className="h3 !m-0">The AI pattern model (what you see in the app)</h3><span className="badge ok">average of three</span></div>
          <p className="muted mt-1.5">The simple average of the GARCH, XGBoost and LSTM guesses (where all three exist; otherwise the average of XGBoost and LSTM). Averaging forecasters that think differently is a classic way to be steadier than any single one, and it needs no extra tuning.</p>
        </div>
        <div className="note mt-3.5 flex gap-2 text-sm"><TriangleAlert size={16} className="mt-0.5 flex-none" aria-hidden="true" />
          <span>Every forecaster is tested only on dates later than the ones it learned from. Mixing dates randomly would let a model "study" the exam, which is called lookahead bias, and we avoid it everywhere.</span></div>
      </section>

      <section id="scoreboard" className="mt-6 scroll-mt-20">
        <h2 className="h3 mb-2">The scoreboard</h2>
        <Scoreboard />
      </section>

      <section id="unusual" className="mt-6 scroll-mt-20">
        <h2 className="h3 mb-2">Unusual activity</h2>
        <div className="card prose-rw !pb-1">
          <p><b className="text-tx">A smoke alarm, not a forecast.</b> The flag says "today looks different from this stock's normal days". It does not say why (news, results, a big order), and it does not say the price will rise or fall.</p>
          <p>We compare four things about today with the stock's own previous 60 days: the size of the price move, the high-low range of the day, the trading volume, and the jump from yesterday's close to this morning's open. When a day is extreme, the flag also says which measure stood out, for example "Volume 3.2× normal".</p>
          <p><b className="text-tx">A real example.</b> On 23 March 2020, the Covid crash day, a typical stock's price move was 4.6 times its normal size and its opening gap was 3.4 times normal, and about 22% of all stocks were flagged, compared with under 1% on a normal day. On the general-election result day (4 June 2024), about 7% were flagged.</p>
          <Tech>An Isolation Forest (200 trees) trained on a random sample of 400,000 stock-days from before the test period. It isolates unusual points with fewer random splits. The alarm level is set so the most unusual 1% of training stock-days are flagged; on days it never saw, about 0.93% were flagged. It is unsupervised, so there is no accuracy score. We only sanity-check it, for example against famous market days.</Tech>
        </div>
      </section>

      <section id="risk-levels" className="mt-6 scroll-mt-20">
        <h2 className="h3 mb-2">How Low, Medium and High are decided</h2>
        <div className="card prose-rw !pb-1">
          <p>The expected daily move is compared with the whole market. {bands ? <>Below <b className="text-tx">{bands.low_below}% a day</b> is <b className="text-tx">Low</b>, from <b className="text-tx">{bands.high_from}% a day</b> upward is <b className="text-tx">High</b>, and in between is <b className="text-tx">Medium</b>.</> : 'The cut-offs are fixed numbers.'} We chose the two cut-offs so that, over the most recent year of out-of-sample forecasts, about a third of stock-weeks fall in each group. They are then held fixed, so a label means the same thing every night, and we re-check them about once a year.</p>
          <p><b className="text-tx">"Compared with its usual".</b> A second small label says whether this week looks calmer than usual, about usual or wigglier than usual for that particular stock.</p>
          <p><b className="text-tx">How often the label is wrong.</b> In testing, about 8% of weeks labelled Low turned out wigglier than the High cut-off, and about 10% of weeks labelled High turned out calmer than the Low cut-off. A label is a forecast, not a promise. Labels also change from one week to the next for roughly one stock in four, because many stocks sit close to a cut-off.</p>
        </div>
      </section>

      <section id="limits" className="mt-6 scroll-mt-20">
        <h2 className="h3 mb-2">What can go wrong</h2>
        <div className="card !border-risk-med">
          <ul className="muted m-0 list-disc space-y-1.5 pl-5">
            <li><b className="text-tx">Surprises.</b> No forecaster can see a sudden news shock coming. They capture the normal rhythm of calm and stormy spells, not events.</li>
            <li><b className="text-tx">Delayed, unofficial data.</b> Prices and company facts come from a free source. They can be late, wrong or missing. Do not use them to place trades.</li>
            <li><b className="text-tx">Thinly traded stocks.</b> Stocks that barely trade, or that listed recently, have too little history for a fair forecast, so we show no risk level for them rather than invent one.</li>
            <li><b className="text-tx">The past is not the future.</b> A new kind of market could behave differently from the years the models learned from.</li>
            <li><b className="text-tx">Forecasts are not advice.</b> RiskWise is an educational project, not a registered investment adviser.</li>
          </ul>
        </div>
      </section>

      <section id="data" className="mt-6 scroll-mt-20">
        <h2 className="h3 mb-2">Where the data comes from</h2>
        <div className="card prose-rw !pb-1">
          <p><b className="text-tx">Prices and company facts:</b> Yahoo Finance, through a free, unofficial route. Prices are adjusted for stock splits and dividends so that history is comparable. <b className="text-tx">The list of stocks:</b> the National Stock Exchange of India's published list of listed companies.</p>
          <p><b className="text-tx">Updates:</b> the forecasts are recalculated every night after the market closes. {meta ? <>The data on this site is as of <b className="text-tx">{meta.asof}</b>, covering <b className="text-tx">{meta.stocks_with_forecast?.toLocaleString('en-IN')}</b> stocks with a forecast out of <b className="text-tx">{meta.stocks_total?.toLocaleString('en-IN')}</b> searchable ones.</> : null} The forecasters were last trained on data up to {meta?.models?.trained_on_data_until || '…'}.</p>
        </div>
      </section>

      <section id="demo" className="mt-6 scroll-mt-20">
        <h2 className="h3 mb-2">Try it yourself</h2>
        <Demo bands={bands} />
      </section>
    </Page>
  )
}
