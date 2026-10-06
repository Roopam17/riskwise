import { rupeesShort } from '../lib/format'

// Where today's price sits between the 52-week low and high.
export default function Range52({ low, high, price, color }) {
  const pct = Math.max(0, Math.min(100, ((price - low) / (high - low || 1)) * 100))
  const labelAt = Math.min(85, Math.max(15, pct))
  return (
    <div>
      <div className="faint mt-2 text-xs">52-week range</div>
      <div className="range52" role="img" aria-label={`Price is ${pct.toFixed(0)}% of the way from the 52-week low to the high`}>
        <div className="fill" style={{ width: `${pct}%`, background: `${color}8c` }} />
        <div className="dot" style={{ left: `${pct}%`, background: color }} />
      </div>
      <div className="faint flex justify-between text-xs"><span>{rupeesShort(low)}</span><span>{rupeesShort(high)}</span></div>
      <div className="relative h-4 text-xs">
        <span className="absolute font-medium text-tx" style={{ left: `${labelAt}%`, transform: 'translateX(-50%)' }}>{rupeesShort(price)}</span>
      </div>
    </div>
  )
}
