import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { Page } from '../components/Layout'
import { RiskChip, UnusualChip } from '../components/Badges'
import StarButton from '../components/StarButton'
import { useAsync, useMeta, useTitle } from '../hooks/data'
import { api } from '../lib/api'
import { changeClass, rupees, sign } from '../lib/format'

const TABS = [['All', ''], ['Low', 'Low'], ['Medium', 'Medium'], ['High', 'High'], ['Unusual today', 'unusual']]
const SORTS = [['risk', 'Riskiest first'], ['calm', 'Calmest first'], ['change', 'Biggest change today']]
const SIZE_PX = { Large: 150, Mid: 80, Small: 36 }
const LEVEL_COLOR = { Low: 'var(--g)', Medium: 'var(--a)', High: 'var(--r)' }
const MAP_LIMIT = 300

function MapTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-bd bg-pn px-3 py-2 text-xs shadow-lg">
      <b>{p.sym}</b> <span className="faint">{p.name}</span>
      <div>{p.level} risk · expected move {p.expected_move.toFixed(1)}% a day</div>
      <div className={changeClass(p.change_pct)}>Today {sign(p.change_pct)}%</div>
      <div className="faint">{p.size ? `${p.size} company` : 'Size not available'}</div>
    </div>
  )
}

export default function Explorer() {
  useTitle('Risk explorer')
  const navigate = useNavigate()
  const meta = useMeta()
  const [tab, setTab] = useState('')
  const [sort, setSort] = useState('risk')
  const [size, setSize] = useState('')
  const [sector, setSector] = useState('')
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [shown, setShown] = useState(40)
  const [picked, setPicked] = useState([])
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 250); return () => clearTimeout(t) }, [q])
  useEffect(() => setShown(40), [tab, sort, size, sector, debounced])

  const params = { level: ['Low', 'Medium', 'High'].includes(tab) ? tab : '', unusual: tab === 'unusual', size, sector, q: debounced, sort, limit: MAP_LIMIT }
  const { data, error, loading } = useAsync(() => api.explorer(params), [JSON.stringify(params)])
  const items = data?.items || []
  const bubbles = useMemo(() => items.map((r) => ({ ...r, z: SIZE_PX[r.size] || 50 })), [items])

  return (
    <Page>
      <h1 className="h2">Risk explorer</h1>
      <p className="muted mb-3 mt-0.5">Browse every stock we cover by its risk level for next week{meta ? `, with data as of ${meta.asof}` : ''}.</p>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="tabs" role="tablist">{TABS.map(([label, value]) => <button key={label} type="button" role="tab" aria-selected={tab === value} className={`tab ${tab === value ? 'on' : ''}`} onClick={() => setTab(value)}>{label}</button>)}</div>
        <div className="flex flex-wrap items-center gap-2">
          <input className="input !h-9 !w-44" placeholder="Search in this list" aria-label="Search within the list" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input !h-9 !w-auto" aria-label="Company size" value={size} onChange={(e) => setSize(e.target.value)}>
            <option value="">Any size</option><option value="Large">Large</option><option value="Mid">Mid</option><option value="Small">Small</option>
          </select>
          <select className="input !h-9 !w-auto" aria-label="Sector" value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">Any sector</option>{(data?.sectors || []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input !h-9 !w-auto" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
      </div>

      {error && <div className="card dn">{error.message}</div>}
      {loading && !data && <div className="card muted">Loading…</div>}

      {data && (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="faint">{data.total.toLocaleString('en-IN')} stocks match. Tick 2 or 3 to compare.</span>
            {picked.length > 1 && <button type="button" className="btn btn-grad" onClick={() => navigate(`/compare?s=${picked.join(',')}`)}>Compare ({picked.length})</button>}
          </div>

          {items.length > 0 && (
            <div className="card mb-3.5">
              <div className="h3">Risk map</div>
              <div className="faint mb-2 text-xs">Each bubble is a stock: colour is its risk level, size is the company's size. Across: today's price change. Up: expected daily move. Click a bubble to open the stock. {data.total > MAP_LIMIT ? `Showing the first ${MAP_LIMIT} of this list.` : ''}</div>
              <div className="flex gap-4 text-xs">{['Low', 'Medium', 'High'].map((l) => <span key={l}><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: LEVEL_COLOR[l] }} />{l}</span>)}</div>
              <div style={{ width: '100%', height: 300 }} role="img" aria-label="Risk map of stocks">
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                    <CartesianGrid stroke="var(--ln)" />
                    <XAxis type="number" dataKey="change_pct" name="Today" unit="%" tick={{ fill: 'var(--t3)', fontSize: 11 }} stroke="var(--ln)" />
                    <YAxis type="number" dataKey="expected_move" name="Expected move" unit="%" tick={{ fill: 'var(--t3)', fontSize: 11 }} stroke="var(--ln)" width={44} />
                    <ZAxis type="number" dataKey="z" range={[30, 220]} />
                    <Tooltip content={<MapTip />} cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter data={bubbles} isAnimationActive={false} onClick={(p) => navigate(`/stock/${p.sym}`)}
                      shape={({ cx, cy, payload, size: s }) => <circle cx={cx} cy={cy} r={Math.sqrt(s / Math.PI)} fill={LEVEL_COLOR[payload.level]} fillOpacity={0.55} stroke={LEVEL_COLOR[payload.level]} style={{ cursor: 'pointer' }} />} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid gap-2">
            {items.slice(0, shown).map((r) => (
              <div key={r.sym} className="card flex flex-wrap items-center gap-x-4 gap-y-1.5 !py-2.5">
                <label className="flex w-52 items-center gap-2">
                  <input type="checkbox" aria-label={`Select ${r.sym} to compare`} checked={picked.includes(r.sym)}
                    onChange={() => setPicked((p) => (p.includes(r.sym) ? p.filter((x) => x !== r.sym) : p.length < 3 ? [...p, r.sym] : p))} />
                  <span className="min-w-0"><Link to={`/stock/${r.sym}`} className="font-medium hover:text-ac">{r.sym}</Link><div className="faint truncate text-xs">{r.name}</div></span>
                </label>
                <span className="w-44">{rupees(r.price)} <span className={changeClass(r.change_pct)}>{sign(r.change_pct)}%</span></span>
                <RiskChip level={r.level} />
                <span className="faint text-xs">{r.expected_move.toFixed(1)}% a day</span>
                <UnusualChip unusual={{ flag: r.unusual }} />
                {r.unusual && r.reason && <span className="faint text-xs">{r.reason}</span>}
                <span className="ml-auto"><StarButton sym={r.sym} /></span>
              </div>))}
            {items.length === 0 && <div className="card muted">No stocks match. Try removing a filter.</div>}
            {shown < items.length && <button type="button" className="btn justify-self-center" onClick={() => setShown((n) => n + 40)}>Show more</button>}
          </div>
        </>
      )}
    </Page>
  )
}
