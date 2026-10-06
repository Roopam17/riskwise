import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftRight, MessageSquareText } from 'lucide-react'
import { Page } from '../components/Layout'
import { HelpTip, RiskChip, UnusualChip } from '../components/Badges'
import { LineChartBox, RangeSelect } from '../components/Charts'
import StarButton from '../components/StarButton'
import { useAsync, useMeta, useTitle } from '../hooks/data'
import { api } from '../lib/api'
import { changeClass, explain, meterPosition, plainPct, rupees, sign, sliceRange } from '../lib/format'

function Meter({ record, bands }) {
  const pos = meterPosition(record.forecast.expected_move, bands)
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <span className="muted">Risk level, next week<HelpTip to="/how-it-works#risk-levels" text="How we decide Low, Medium and High" /></span>
        <RiskChip level={record.forecast.level} />
      </div>
      <div className="meter" role="img" aria-label={`Risk meter: ${record.forecast.level}`}>
        <span style={{ background: 'var(--g)' }} /><span style={{ background: 'var(--a)' }} /><span style={{ background: 'var(--r)' }} />
        <b style={{ left: `${pos}%` }} />
      </div>
      <div className="faint flex justify-between text-[11px]"><span>Low</span><span>Medium</span><span>High</span></div>
      <div className="muted mt-3 text-xs">Expected move about <b className="font-medium text-tx">{record.forecast.expected_move.toFixed(1)}% a day</b>.{' '}
        {record.forecast.vs_usual !== 'About usual' && <>For this stock that is <b className="font-medium text-tx">{record.forecast.vs_usual.toLowerCase()}</b>.</>}
      </div>
    </div>
  )
}

export default function Stock() {
  const { sym: raw } = useParams()
  const sym = raw.toUpperCase()
  const navigate = useNavigate()
  const [days, setDays] = useState(182)
  const meta = useMeta()
  const { data: record, error, loading } = useAsync(() => api.stock(sym), [sym])
  const { data: quote } = useAsync(() => api.quote(sym).catch(() => null), [sym])
  useTitle(record ? `${record.name} (${record.sym})` : sym)

  if (loading) return <Page><div className="card muted">Loading {sym}…</div></Page>
  if (error) {
    return (
      <Page narrow>
        <div className="card mt-8 text-center">
          <h1 className="h2">{error.status === 404 ? 'We could not find that stock' : 'Something went wrong'}</h1>
          <p className="muted mt-2">{error.message}</p>
          <p className="faint mt-1 text-sm">Try searching for part of the company name.</p>
          <Link to="/" className="btn btn-primary mt-4">Back to the home page</Link>
        </div>
      </Page>
    )
  }

  const price = quote?.price ?? record.price?.close
  const change = quote ?? record.price
  const facts = record.facts || {}

  return (
    <Page>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h2">{record.name}</h1>
          <div className="muted">{record.sym} · {record.exchange}{facts.sector ? ` · ${facts.sector}` : ''}</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn" onClick={() => navigate(`/compare?s=${record.sym}&focus=1`)}><ArrowLeftRight size={15} aria-hidden="true" />Compare with…</button>
          <StarButton sym={record.sym} />
        </div>
      </div>

      {price != null && (
        <div className="mb-4 mt-3 flex flex-wrap items-baseline gap-x-3">
          <span className="text-[30px] font-semibold">{rupees(price)}</span>
          {change?.change_pct != null && <span className={`font-medium ${changeClass(change.change_pct)}`}>{sign(change.change, 2)} ({sign(change.change_pct)}%)</span>}
          <span className="muted text-sm">Delayed price{quote?.source === 'last close' ? ' (last close)' : ''}<HelpTip text="Prices come from a free source and can be delayed by 15 minutes or more. Do not use them to place trades." /></span>
        </div>
      )}

      {!record.modelled ? (
        <div className="card"><div className="flex items-start gap-2"><MessageSquareText size={18} className="muted mt-0.5 flex-none" aria-hidden="true" /><p>{record.message}</p></div></div>
      ) : (
        <>
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
            <Meter record={record} bands={meta?.risk_bands} />
            <div className="card">
              <div className="muted mb-2">Unusual activity today<HelpTip to="/how-it-works#unusual" text="How we spot unusual days" /></div>
              <UnusualChip unusual={record.unusual} />
              <div className="muted mt-2 text-sm">{record.unusual.flag ? `${record.unusual.reason}. Today looks different from this stock's normal days.` : "Today looks like a normal day for this stock."}</div>
            </div>
          </div>

          <div className="card mt-3.5 flex items-start gap-2">
            <MessageSquareText size={18} className="muted mt-0.5 flex-none" aria-hidden="true" />
            <p>{explain(record)}</p>
          </div>

          <div className="card mt-3.5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="h3">Price chart</span>
              <RangeSelect value={days} onChange={setDays} />
            </div>
            <LineChartBox series={[{ name: 'Price', color: '#14b8a6', points: sliceRange(record.history, days) }]}
              format={(v) => rupees(v)} ariaLabel={`Price chart for ${record.name}`} />
          </div>

          <div className="card mt-3.5">
            <div className="h3">Risk history</div>
            <div className="faint mb-3 text-xs">Last 26 weeks: how big a daily move was expected each week<HelpTip to="/how-it-works#risk-levels" text="What the expected daily move means" /></div>
            <LineChartBox series={[{ name: 'Expected daily move', color: '#8b5cf6', points: record.risk_history }]} height={200}
              format={(v) => `${v.toFixed(1)}% a day`} axisFormat={(v) => `${v.toFixed(1)}%`} ariaLabel="Risk history chart" />
          </div>

          <p className="faint mt-3 text-xs">Data as of {record.asof}. 1-year return {plainPct(record.returns['1y'])}. This is a forecast of how bumpy the week may be, not advice to buy or sell.</p>
        </>
      )}
    </Page>
  )
}
