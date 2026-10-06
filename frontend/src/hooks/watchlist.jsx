import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { WATCHLIST_MAX } from '../lib/format'
import { useAuth } from './auth'

const Ctx = createContext(null)
export const useWatchlist = () => useContext(Ctx)
const LOCAL_KEY = 'riskwise.watchlist'

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') } catch { return [] }
}

// With Supabase keys and a logged-in user, the watchlist lives in the database.
// With no Supabase keys at all ("local mode"), it lives in this browser only.
// With keys but no user, saving needs a login.
export function WatchlistProvider({ children }) {
  const { configured, user, loading: authLoading } = useAuth()
  const [symbols, setSymbols] = useState(configured ? [] : readLocal)
  const [loading, setLoading] = useState(configured)

  useEffect(() => {
    if (!configured) return
    if (authLoading) return
    if (!user) { setSymbols([]); setLoading(false); return }
    setLoading(true)
    supabase.from('watchlist').select('symbol').order('created_at').then(({ data }) => {
      setSymbols((data || []).map((r) => r.symbol))
      setLoading(false)
    })
  }, [configured, user, authLoading])

  const toggle = useCallback(async (sym) => {
    const has = symbols.includes(sym)
    if (!has && symbols.length >= WATCHLIST_MAX) return 'full'
    if (configured && !user) return 'login'
    const next = has ? symbols.filter((s) => s !== sym) : [...symbols, sym]
    setSymbols(next)                                     // update the screen straight away
    if (!configured) {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)) } catch { /* storage blocked */ }
    } else {
      const { error } = has
        ? await supabase.from('watchlist').delete().eq('symbol', sym)
        : await supabase.from('watchlist').insert({ symbol: sym })
      if (error) { setSymbols(symbols); return 'error' }
    }
    return has ? 'removed' : 'added'
  }, [symbols, configured, user])

  const value = useMemo(() => ({
    symbols, loading, toggle, has: (s) => symbols.includes(s), max: WATCHLIST_MAX,
    localMode: !configured, needsLogin: configured && !user,
  }), [symbols, loading, toggle, configured, user])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
