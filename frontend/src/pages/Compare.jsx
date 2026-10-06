import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MessageSquareText, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { Page } from '../components/Layout'
import { HelpTip, Initials, RiskTile, UnusualTile } from '../components/Badges'
import { LineChartBox, RangeSelect } from '../components/Charts'
import Range52 from '../components/Range52'
import SearchBox from '../components/SearchBox'
import StarButton from '../components/StarButton'
import { useAsync, useMeta, useTitle } from '../hooks/data'
import { api } from '../lib/api'
import { changeClass, levelClass, marketCap, plainPct, pct, rupees, rupeesShort, sign, sliceRange, volume, SERIES_COLORS } from '../lib/format'

const TABS = [
  ['ov', 'Quick comparison', 'Price, risk and a performance chart, side by side.'],
  ['co', 'Company details', 'How big each company is, what it earns and what it pays out to shareholders.'],
  ['pm', 'Price history', 'How much each stock went up or down over 1 month, 6 months and 1 year, plus its yearly high and low.'],
  ['rk', 'Risk forecast', 'How bumpy next week is expected to be for each stock, and how that has changed over time.'],
]

const Ret = ({ v }) => <span className={changeClass(v)}>{pct(v)}</span>
const Level = ({ level }) => <b className={`font-medium ${levelClass(level)}`}>{level}</b>

function CompareTable({ stocks, rows }) {
  return (
    <div className="table-wrap">
      <table className="t">
        <thead><tr><th>What we compare</th>{stocks.map((s, i) => <th key={s.sym} style={{ color: SERIES_COLORS[i] }}>{s.sym}</th>)}</tr></thead>
        <tbody>{rows.map(([label, get, tip]) => (
          <tr key={label}><td>{label}{tip && <HelpTip to={`/glossary#${tip}`} text={`What is ${label}?`} />}</td>{stocks.map((s) => <td key={s.sym}>{get(s)}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function StockCardCompare({ s, color }) {
  const p = s.price
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <Initials sym={s.sym} color={color} />
          <div><Link to={`/stock/${s.sym}`} className="font-semibold hover:text-ac">{s.sym}</Link><div className="faint text-xs">{s.name}</div></div>
        </div>
        <StarButton sym={s.sym} />
      </div>
      {s.modelled ? (
        <>
          <div className="mb-0.5 mt-3"><span className="text-[26px] font-semibold">{rupees(p.close)}</span>
            <span className={`ml-2 font-medium ${changeClass(p.change_pct)}`}>{sign(p.change, 2)} ({sign(p.change_pct)}%)</span></div>
          <Range52 low={p.low52} high={p.high52} price={p.close} color={color} />
          <div className="mt-2.5 flex flex-wrap gap-2"><RiskTile level={s.forecast.level} /><UnusualTile unusual={s.unusual} /></div>
        </>
      ) : <p className="muted mt-3 text-sm">{s.message}</p>}
    </div>
  )
}

export default function Compare() {
  useTitle('Compare stocks')
  const [params, setParams] = useSearchParams()
  const syms = useMemo(() => (params.get('s') || '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean).slice(0, 3), [params])
  const tab = params.get('tab') || 'ov'
  const [days, setDays] = useState(182)
  const [focusSignal, setFocusSignal] = useState(params.get('focus') ? 1 : 0)
  const meta = useMeta()
  const { data, error, loading, refresh } = useAsync(() => (syms.length ? api.compare(syms) : Promise.resolve([])), [syms.join(',')])

  const set = (changes) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    next.delete('focus')
    setParams(next, { replace: true })
  }
  const setSymbols = (list) => set({ s: list.join(',') })
  const stocks = (data || []).filter((s) => syms.includes(s.sym)).sort((a, b) => syms.indexOf(a.sym) - syms.indexOf(b.sym))
  const modelled = stocks.filter((s) => s.modelled)
  const full = syms.length >= 3
  const current = TABS.find((t) => t[0] === tab) || TABS[0]

  const rebased = modelled.map((s, i) => {
    const pts = sliceRange(s.history, days)
    return { name: s.sym, color: SERIES_COLORS[syms.indexOf(s.sym)], points: pts.map(([d, v]) => [d, (v / pts[0][1]) * 100]) }
  })
  const riskSeries = modelled.map((s) => ({ name: s.sym, color: SERIES_COLORS[syms.indexOf(s.sym)], points: s.risk_history }))
  const ranked = [...modelled].sort((a, b) => b.forecast.expected_move - a.forecast.expected_move)
  const f = (s) => s.facts || {}

  return (
    <Page>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h2">Compare stocks</h1>
          <p className="muted mt-0.5">Search and add up to 3 stocks to compare their price, risk and key company facts.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setSymbols([])} disabled={!syms.length}><Trash2 size={15} aria-hidden="true" />Clear all</button>
      </div>

      <div className="my-4 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-[420px] flex-1 basis-[280px]">
          <SearchBox rounded={false} exclude={syms} disabled={full} focusSignal={focusSignal} autoFocus={Boolean(params.get('focus'))}
            placeholder={full ? '3 chosen. Remove one to add another' : 'Search and add a stock…'}
            onSelect={(entry) => setSymbols([...syms, entry.sym])} />
        </div>
        {syms.map((s, i) => (
          <span key={s} className="chip" style={{ borderColor: SERIES_COLORS[i], background: `${SERIES_COLORS[i]}1a`, color: SERIES_COLORS[i] }}>
            {s}<button type="button" aria-label={`Remove ${s}`} onClick={() => setSymbols(syms.filter((x) => x !== s))}><X size={15} aria-hidden="true" /></button>
          </span>
        ))}
        {!full && <button type="button" className="dash" onClick={() => setFocusSignal((n) => n + 1)}><Plus size={14} className="mr-1 inline" aria-hidden="true" />Add stock</button>}
      </div>

      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="tabs" role="tablist">
          {TABS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={`tab ${tab === key ? 'on' : ''}`} onClick={() => set({ tab: key === 'ov' ? '' : key })}>{label}</button>)}
        </div>
        <span className="faint text-xs">Delayed prices · data as of {meta?.asof || '…'}
          <button type="button" className="star ml-1 align-middle" aria-label="Refresh" onClick={refresh}><RefreshCw size={14} aria-hidden="true" /></button></span>
      </div>
      <p className="muted mb-3.5 text-[13px]">{current[2]}</p>

      {error && <div className="card dn">{error.message}</div>}
      {!syms.length && <div className="card muted py-10 text-center">Add a stock to start comparing.</div>}
      {syms.length > 0 && loading && !data && <div className="card muted">Loading…</div>}

      {stocks.length > 0 && tab === 'ov' && (
        <>
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
            {stocks.map((s) => <StockCardCompare key={s.sym} s={s} color={SERIES_COLORS[syms.indexOf(s.sym)]} />)}
          </div>
          {modelled.length > 0 && (
            <div className="card mt-3.5">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <div><div className="h3">Relative performance</div><div className="faint text-xs">All stocks start at 100, so you can see which moved more</div></div>
                <RangeSelect value={days} onChange={setDays} />
              </div>
              <div className="grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_210px]">
                <LineChartBox series={rebased} format={(v) => v.toFixed(1)} ariaLabel="Relative performance chart" />
                <div>{rebased.map((s) => { const r = s.points.length ? s.points[s.points.length - 1][1] - 100 : null; return (
                  <div key={s.name} className="flex items-center justify-between border-b border-ln py-2 last:border-0"><span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}</span><Ret v={r} /></div>) })}</div>
              </div>
            </div>
          )}
          <div className="card mt-3.5">
            <div className="h3">Key comparison metrics</div>
            <div className="faint mb-2.5 text-xs">Important facts side by side</div>
            <CompareTable stocks={stocks} rows={[
              ['Current price', (s) => (s.modelled ? rupees(s.price.close) : 'Not available')],
              ['Market cap', (s) => marketCap(f(s).market_cap), 'market-cap'],
              ['P/E ratio', (s) => f(s).pe ?? 'Not available', 'pe-ratio'],
              ['Dividend yield', (s) => plainPct(f(s).div_yield, 2), 'dividend-yield'],
              ['1-year return', (s) => (s.modelled ? <Ret v={s.returns['1y']} /> : 'Not available')],
              ['Risk level, next week', (s) => (s.modelled ? <Level level={s.forecast.level} /> : 'Not enough data')],
            ]} />
          </div>
        </>
      )}

      {stocks.length > 0 && tab === 'co' && (
        <div className="card"><CompareTable stocks={stocks} rows={[
          ['Sector', (s) => f(s).sector || 'Not available'],
          ['Exchange', (s) => s.exchange],
          ['Company size', (s) => f(s).size || 'Not available', 'company-size'],
          ['Market cap', (s) => marketCap(f(s).market_cap), 'market-cap'],
          ['P/E ratio', (s) => f(s).pe ?? 'Not available', 'pe-ratio'],
          ['Return on equity (ROE)', (s) => plainPct(f(s).roe), 'roe'],
          ['Dividend yield', (s) => plainPct(f(s).div_yield, 2), 'dividend-yield'],
          ['Average daily volume', (s) => (s.modelled ? volume(s.price.avg_volume) : 'Not available'), 'volume'],
        ]} />
          <p className="faint mt-2 text-xs">Some facts are not available for every company, for example a P/E ratio for a company that is losing money.</p></div>
      )}

      {stocks.length > 0 && tab === 'pm' && modelled.length > 0 && (
        <>
          <div className="card"><CompareTable stocks={modelled} rows={[
            ['1-month return', (s) => <Ret v={s.returns['1m']} />, 'return'],
            ['6-month return', (s) => <Ret v={s.returns['6m']} />, 'return'],
            ['1-year return', (s) => <Ret v={s.returns['1y']} />, 'return'],
            ['52-week high', (s) => rupeesShort(s.price.high52), '52-week-high-and-low'],
            ['52-week low', (s) => rupeesShort(s.price.low52), '52-week-high-and-low'],
            ['Below 52-week high', (s) => `${(((s.price.high52 - s.price.close) / s.price.high52) * 100).toFixed(1)}%`],
          ]} /></div>
          <div className="card mt-3.5">
            <div className="h3 mb-2.5">1-year return</div>
            {modelled.map((s) => { const v = s.returns['1y'] ?? 0; const color = SERIES_COLORS[syms.indexOf(s.sym)]; return (
              <div key={s.sym} className="mb-2 flex items-center gap-3">
                <span className="w-24 font-medium" style={{ color }}>{s.sym}</span>
                <div className="relative h-2.5 flex-1 rounded bg-pn2"><div className="absolute left-0 h-2.5 rounded" style={{ width: `${Math.min(100, (Math.abs(v) / 40) * 100)}%`, background: v >= 0 ? color : 'var(--r)' }} /></div>
                <span className="w-16 text-right"><Ret v={s.returns['1y']} /></span>
              </div>) })}
          </div>
        </>
      )}

      {stocks.length > 0 && tab === 'rk' && modelled.length > 0 && (
        <>
          <div className="card"><CompareTable stocks={modelled} rows={[
            ['Risk level', (s) => <Level level={s.forecast.level} />],
            ['Expected daily move', (s) => `${s.forecast.expected_move.toFixed(1)}%`],
            ['Compared with its usual', (s) => s.forecast.vs_usual],
            ['Unusual activity today', (s) => (s.unusual.flag ? <span className="dn font-medium">{s.unusual.reason}</span> : 'No')],
          ]} />
            {modelled.map((s) => (
              <div key={s.sym} className="mt-3 flex items-center gap-3">
                <span className="w-24 font-medium" style={{ color: SERIES_COLORS[syms.indexOf(s.sym)] }}>{s.sym}</span>
                <div className="h-2.5 flex-1 rounded bg-pn2"><div className="h-2.5 rounded" style={{ width: `${Math.min(100, (s.forecast.expected_move / 6) * 100)}%`, background: SERIES_COLORS[syms.indexOf(s.sym)] }} /></div>
                <span className="w-14 text-right">{s.forecast.expected_move.toFixed(1)}%</span>
              </div>))}
          </div>
          <div className="card mt-3.5">
            <div className="h3">Risk history</div>
            <div className="faint mb-2.5 text-xs">Last 26 weeks, expected daily move in %</div>
            <LineChartBox series={riskSeries} height={220} format={(v) => `${v.toFixed(1)}%`} axisFormat={(v) => `${v.toFixed(1)}%`} ariaLabel="Risk history for the chosen stocks" />
          </div>
          <div className="card mt-3.5 flex items-start gap-2">
            <MessageSquareText size={18} className="muted mt-0.5 flex-none" aria-hidden="true" />
            <p>{ranked.length > 1
              ? `${ranked[0].name} is expected to be more unpredictable than ${ranked[ranked.length - 1].name} next week (about ${ranked[0].forecast.expected_move.toFixed(1)}% vs ${ranked[ranked.length - 1].forecast.expected_move.toFixed(1)}% a day). This describes risk only, not a reason to buy or sell.`
              : 'Add a second stock to compare their risk.'}</p>
          </div>
        </>
      )}
      {stocks.length > 0 && modelled.length === 0 && tab !== 'co' && <div className="card muted">None of these stocks has enough history for a risk forecast yet.</div>}
    </Page>
  )
}
