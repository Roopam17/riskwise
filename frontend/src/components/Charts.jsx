import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { RANGES } from '../lib/format'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const longDate = (t) => { const d = new Date(t); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` }

// "14 Aug" for short windows, "Aug 24" for long ones.
function tickFormatter(spanDays) {
  return (t) => {
    const d = new Date(t)
    return spanDays <= 70 ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
  }
}

function Tip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-bd bg-pn px-3 py-2 text-xs shadow-lg">
      <div className="faint mb-1">{longDate(label)}</div>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>{p.name !== 'v' ? `${p.name}  ` : ''}{format(p.value)}</div>
      ))}
    </div>
  )
}

// One or several lines against dates. series = [{ name, color, points: [[date, value], ...] }]
export function LineChartBox({ series, height = 260, format = (v) => v.toFixed(2), axisFormat, ariaLabel }) {
  const byTime = new Map()
  series.forEach((s) => s.points.forEach(([d, v]) => {
    const t = new Date(d).getTime()
    byTime.set(t, { ...(byTime.get(t) || { t }), [s.name]: v })
  }))
  const data = [...byTime.values()].sort((a, b) => a.t - b.t)
  const span = data.length ? (data[data.length - 1].t - data[0].t) / 86400000 : 0
  // five evenly spaced dates along the bottom (otherwise the library crowds the axis with repeats)
  const ticks = data.length ? [0, 1, 2, 3, 4].map((i) => data[0].t + ((data[data.length - 1].t - data[0].t) * i) / 4) : []
  return (
    <div role="img" aria-label={ariaLabel} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--ln)" vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} ticks={ticks}
            tickFormatter={tickFormatter(span)} tick={{ fill: 'var(--t3)', fontSize: 11 }} stroke="var(--ln)" />
          <YAxis domain={['auto', 'auto']} width={52} tick={{ fill: 'var(--t3)', fontSize: 11 }} stroke="var(--ln)"
            tickFormatter={axisFormat || ((v) => Math.round(v).toLocaleString('en-IN'))} />
          <Tooltip content={<Tip format={format} />} />
          {series.map((s) => (
            <Line key={s.name} type="monotone" dataKey={s.name} name={s.name} stroke={s.color} strokeWidth={2} dot={false}
              connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// 1M / 3M / ... buttons
export function RangeSelect({ value, onChange }) {
  return (
    <div className="seg" role="group" aria-label="Time range">
      {RANGES.map((r) => (
        <button key={r.label} type="button" className={value === r.days ? 'on' : ''} aria-pressed={value === r.days}
          onClick={() => onChange(r.days)}>{r.label}</button>
      ))}
    </div>
  )
}
