// A tiny line with no axes: just the shape of the last month.
export default function Sparkline({ values = [], width = 60, height = 24 }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const points = values.map((v, i) => `${((i * width) / (values.length - 1)).toFixed(1)},${(height - 2 - ((v - min) / (max - min || 1)) * (height - 4)).toFixed(1)}`).join(' ')
  const up = values[values.length - 1] >= values[0]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={up ? 'Price rose over the last month' : 'Price fell over the last month'}>
      <polyline points={points} fill="none" stroke={up ? 'var(--g)' : 'var(--r)'} strokeWidth="1.5" />
    </svg>
  )
}
