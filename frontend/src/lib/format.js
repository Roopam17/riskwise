// Small helpers for showing numbers and wording.
export const rupees = (n) => (n == null ? 'Not available' : '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
export const rupeesShort = (n) => (n == null ? '–' : '₹' + Math.round(n).toLocaleString('en-IN'))
export const sign = (v, d = 1) => (v == null ? '' : (v >= 0 ? '+' : '') + Number(v).toFixed(d))
export const pct = (v, d = 1) => (v == null ? 'Not available' : sign(v, d) + '%')
export const plainPct = (v, d = 1) => (v == null ? 'Not available' : Number(v).toFixed(d) + '%')
export const dash = (v) => (v == null ? 'Not available' : v)

// 1 crore = 10 million; 1 lakh crore = 1 trillion.
export function marketCap(cap) {
  if (cap == null) return 'Not available'
  if (cap >= 1e12) return `₹${(cap / 1e12).toFixed(1)} L Cr`
  return `₹${Math.round(cap / 1e7).toLocaleString('en-IN')} Cr`
}
export function volume(n) {
  if (n == null) return 'Not available'
  if (n >= 1e7) return (n / 1e7).toFixed(1) + ' Cr'
  if (n >= 1e5) return (n / 1e5).toFixed(1) + ' L'
  return Math.round(n).toLocaleString('en-IN')
}
export const changeClass = (v) => (v == null ? '' : v >= 0 ? 'up' : 'dn')
export const levelClass = (level) => (level === 'Low' ? 'up' : level === 'High' ? 'dn' : 'am')
export const initials = (sym) => sym.replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase()

// Where the marker sits on the Low / Medium / High bar (0 to 100).
export function meterPosition(move, bands) {
  if (!bands || move == null) return 50
  const { low_below: low, high_from: high } = bands
  if (move < low) return Math.max(2, (move / low) * 33)
  if (move < high) return 33 + ((move - low) / (high - low)) * 34
  return Math.min(98, 67 + ((move - high) / high) * 33)
}

// One plain-English sentence about a stock's forecast (no advice, and never about direction).
export function explain(record) {
  const f = record.forecast
  const first = record.name.replace(/ (Limited|Ltd\.?)$/i, '')
  const how = { Low: 'lower than for most stocks, so we call it Low risk', Medium: 'around the usual level for the market, so we call it Medium risk', High: 'higher than for most stocks, so we call it High risk' }[f.level]
  const usual = { 'Calmer than usual': ' It is calmer than this stock usually is.', 'Wigglier than usual': ' It is wigglier than this stock usually is.', 'About usual': ' That is about usual for this stock.' }[f.vs_usual] || ''
  return `${first} is expected to move about ${f.expected_move.toFixed(1)}% a day next week. That is ${how}.${usual} This describes how bumpy the ride may be, not which way the price will go.`
}

export const RANGES = [
  { label: '1M', days: 30 }, { label: '3M', days: 91 }, { label: '6M', days: 182 },
  { label: '1Y', days: 365 }, { label: '3Y', days: 1095 }, { label: '5Y', days: 1825 },
]

// Keep only the points inside the last `days` calendar days. Points are [date, value].
export function sliceRange(points, days) {
  if (!points?.length) return []
  const last = new Date(points[points.length - 1][0]).getTime()
  const from = last - days * 86400000
  return points.filter(([d]) => new Date(d).getTime() >= from)
}

export const SERIES_COLORS = ['#14b8a6', '#8b5cf6', '#ec4899']
export const WATCHLIST_MAX = 50
