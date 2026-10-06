import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, Lock, Trash2 } from 'lucide-react'
import { Page } from '../components/Layout'
import { RiskChip, UnusualChip } from '../components/Badges'
import Sparkline from '../components/Sparkline'
import { useAuth } from '../hooks/auth'
import { useAsync, useTitle } from '../hooks/data'
import { useToast } from '../hooks/toast'
import { useWatchlist } from '../hooks/watchlist'
import { api } from '../lib/api'
import { changeClass, rupees, sign } from '../lib/format'

export default function Watchlist() {
  useTitle('Watchlist')
  const watchlist = useWatchlist()
  const { configured } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [sort, setSort] = useState('')
  const [picked, setPicked] = useState([])
  const symbols = watchlist.symbols
  const { data, error } = useAsync(() => (symbols.length ? api.watchlist(symbols) : Promise.resolve([])), [symbols.join(',')])

  const rows = useMemo(() => {
    const list = (data || []).filter((r) => symbols.includes(r.sym))
    if (sort === 'risk') return [...list].sort((a, b) => (b.expected_move ?? -1) - (a.expected_move ?? -1))
    if (sort === 'change') return [...list].sort((a, b) => (b.change_pct ?? -99) - (a.change_pct ?? -99))
    return list
  }, [data, symbols, sort])

  if (watchlist.needsLogin) {
    return (
      <Page narrow>
        <div className="card mt-8 text-center">
          <Lock size={26} className="muted mx-auto" aria-hidden="true" />
          <h1 className="h2 mt-2">Log in to see your watchlist</h1>
          <p className="muted mt-1">Your saved stocks are kept with your account, so they follow you to any device.</p>
          <div className="mt-4 flex justify-center gap-2"><Link to="/auth?mode=login&next=/watchlist" className="btn btn-primary">Log in</Link><Link to="/auth?mode=signup" className="btn">Sign up</Link></div>
        </div>
      </Page>
    )
  }

  const changed = rows.filter((r) => r.modelled && r.level !== r.level_week_ago).length
  const flagged = rows.filter((r) => r.unusual).length

  return (
    <Page>
      <h1 className="h2 mb-3">Watchlist</h1>
      {watchlist.localMode && <div className="note mb-3 text-sm">Local mode: your watchlist is saved in this browser only. It will move to your account once logins are connected.</div>}
      {error && <div className="card dn">{error.message}</div>}
      {watchlist.loading && <div className="card muted">Loading…</div>}

      {!watchlist.loading && !symbols.length && (
        <div className="card muted py-10 text-center">Your watchlist is empty. Search for a stock and tap the star to save it here.</div>
      )}

      {rows.length > 0 && (
        <>
          <div className="banner mb-3 flex items-center gap-2">
            <Bell size={16} className="flex-none text-ac" aria-hidden="true" />
            <span>{changed === 0 ? 'No risk levels changed this week.' : `${changed} of your stocks changed risk level this week.`}{' '}
              {flagged === 0 ? 'Nothing unusual today.' : `${flagged} showing unusual activity today.`}</span>
          </div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="faint">{symbols.length} of {watchlist.max} saved</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`btn ${sort === 'risk' ? 'btn-primary' : ''}`} onClick={() => setSort(sort === 'risk' ? '' : 'risk')}>Sort: riskiest</button>
              <button type="button" className={`btn ${sort === 'change' ? 'btn-primary' : ''}`} onClick={() => setSort(sort === 'change' ? '' : 'change')}>Sort: today's change</button>
              <button type="button" className="btn btn-grad" onClick={() => (picked.length > 1 ? navigate(`/compare?s=${picked.slice(0, 3).join(',')}`) : toast('Tick 2 or 3 stocks first, then press Compare selected.'))}>Compare selected{picked.length ? ` (${picked.length})` : ''}</button>
            </div>
          </div>
          <div className="table-wrap card !p-0">
            <table className="t">
              <thead><tr><th>Stock</th><th>Price</th><th>Today</th><th>1 month</th><th>Risk</th><th>Unusual</th><th><span className="sr-only">Remove</span></th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.sym}>
                  <td><label className="flex items-center gap-2"><input type="checkbox" checked={picked.includes(r.sym)} aria-label={`Select ${r.sym} to compare`}
                    onChange={() => setPicked((p) => (p.includes(r.sym) ? p.filter((x) => x !== r.sym) : p.length < 3 ? [...p, r.sym] : p))} />
                    <Link to={`/stock/${r.sym}`} className="hover:text-ac">{r.sym}</Link></label></td>
                  {r.modelled ? (<>
                    <td>{rupees(r.price)}</td>
                    <td className={changeClass(r.change_pct)}>{sign(r.change_pct)}%</td>
                    <td><Sparkline values={r.spark} /></td>
                    <td><RiskChip level={r.level} />{r.level !== r.level_week_ago && <div className="faint text-[11px]">was {r.level_week_ago} last week</div>}</td>
                    <td><UnusualChip unusual={{ flag: r.unusual }} /></td>
                  </>) : <td colSpan={5} className="faint">Not enough history for a forecast yet</td>}
                  <td><button type="button" className="star" aria-label={`Remove ${r.sym}`} onClick={() => watchlist.toggle(r.sym)}><Trash2 size={16} aria-hidden="true" /></button></td>
                </tr>))}
              </tbody>
            </table>
          </div>
          {!configured && <p className="faint mt-2 text-xs">Logins are not connected yet, so there is no account to sync with.</p>}
        </>
      )}
    </Page>
  )
}
