// Talks to the backend. In development Vite forwards /api to localhost:8000; after deploying, VITE_API_BASE points at Render.
const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

async function get(path, params) {
  const url = new URL(BASE + path, window.location.origin)
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== false) url.searchParams.set(k, v)
  })
  let response
  try {
    response = await fetch(url)
  } catch {
    throw new Error('We could not reach the server. Please check your connection and try again.')
  }
  if (!response.ok) {
    let message = 'Something went wrong. Please try again.'
    try { message = (await response.json()).detail || message } catch { /* keep the generic message */ }
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  return response.json()
}

let indexPromise
export const api = {
  index: () => (indexPromise ||= get('/api/index').catch((e) => { indexPromise = undefined; throw e })),
  meta: () => get('/api/meta'),
  stock: (sym) => get(`/api/stock/${encodeURIComponent(sym)}`),
  quote: (sym) => get(`/api/quote/${encodeURIComponent(sym)}`),
  compare: (syms) => get('/api/compare', { s: syms.join(',') }),
  explorer: (params) => get('/api/explorer', params),
  popular: () => get('/api/popular'),
  scoreboard: () => get('/api/scoreboard'),
  watchlist: (syms) => get('/api/watchlist', { s: syms.join(',') }),
}
