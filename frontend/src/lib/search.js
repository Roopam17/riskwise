// Stock search that runs in the browser: partial names, nicknames and typos.
// Typing "adani" finds every Adani stock. The backend has the same ranking (backend/app/search.py).
export const NICKNAMES = {
  SBIN: 'sbi', RELIANCE: 'ril', HDFCBANK: 'hdfc', TCS: 'tata consultancy', HINDUNILVR: 'hul', LT: 'l&t',
  ICICIBANK: 'icici', BAJFINANCE: 'bajaj fin', MARUTI: 'maruti suzuki', INFY: 'infosys', BHARTIARTL: 'airtel',
  ASIANPAINT: 'asian paints', ONGC: 'oil and natural gas', COALINDIA: 'coal india', TATAMOTORS: 'tata motors',
  'M&M': 'mahindra', KOTAKBANK: 'kotak', AXISBANK: 'axis', ULTRACEMCO: 'ultratech', SUNPHARMA: 'sun pharma',
}

// How many single-letter edits turn a into b.
export function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)))
    }
    prev = cur
  }
  return prev[b.length]
}

export function score(entry, q) {
  const sym = entry.sym.toLowerCase()
  const name = entry.name.toLowerCase()
  const words = name.replace(/-/g, ' ').split(/\s+/)
  const nick = NICKNAMES[entry.sym] || ''
  if (sym === q) return 100
  if (sym.startsWith(q)) return 90
  if (name.startsWith(q)) return 85
  if (words.some((w) => w.startsWith(q))) return 80
  if (nick && nick.startsWith(q)) return 75
  if (name.includes(q) || sym.includes(q)) return 60
  if (q.length > 3) {
    const tolerance = q.length >= 6 ? 2 : 1
    if ([...words, sym].some((w) => editDistance(w.slice(0, q.length), q) <= tolerance)) return 40
  }
  return 0
}

export function searchIndex(index, query, { limit = 8, exclude = [] } = {}) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return []
  return index
    .filter((e) => !exclude.includes(e.sym))
    .map((e) => [score(e, q), e])
    .filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0] || Number(b[1].modelled) - Number(a[1].modelled) || a[1].sym.length - b[1].sym.length || a[1].sym.localeCompare(b[1].sym))
    .slice(0, limit)
    .map(([, e]) => e)
}
