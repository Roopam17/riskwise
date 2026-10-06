import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/auth'
import { useWatchlist } from '../hooks/watchlist'
import { useAsync, useTitle } from '../hooks/data'
import { api } from '../lib/api'
import { changeClass, rupees, sign } from '../lib/format'
import { RiskChip, UnusualChip } from '../components/Badges'

function StockCard({ row }) {
  return (
    <Link to={`/stock/${row.sym}`} className="card block transition-colors hover:border-bd">
      <div className="flex items-center justify-between"><b className="font-semibold">{row.sym}</b><span className={changeClass(row.change_pct)}>{sign(row.change_pct)}%</span></div>
      <div className="faint mb-2 truncate text-xs">{row.name}</div>
      <div className="flex items-center justify-between"><span>{rupees(row.price)}</span><RiskChip level={row.level} /></div>
    </Link>
  )
}

function WatchlistPreview() {
  const watchlist = useWatchlist()
  const symbols = watchlist.symbols.slice(0, 5)
  const { data } = useAsync(() => (symbols.length ? api.watchlist(symbols) : Promise.resolve([])), [symbols.join(',')])
  if (watchlist.needsLogin) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <span className="muted">Log in to save stocks here.</span>
        <Link to="/auth?mode=login" className="btn">Log in</Link>
      </div>
    )
  }
  if (!symbols.length) return <div className="card muted">Your watchlist is empty. Search for a stock and tap the star to save it here.</div>
  return (
    <div className="grid gap-2">
      {(data || []).map((r) => (
        <Link key={r.sym} to={`/stock/${r.sym}`} className="card flex flex-wrap items-center justify-between gap-2 !py-2.5">
          <span className="font-medium">{r.sym}</span>
          {r.modelled ? <><span>{rupees(r.price)} <span className={changeClass(r.change_pct)}>{sign(r.change_pct)}%</span></span><span className="flex gap-2"><RiskChip level={r.level} /><UnusualChip unusual={{ flag: r.unusual }} /></span></> : <span className="faint">No forecast yet</span>}
        </Link>
      ))}
      {watchlist.symbols.length > 5 && <Link to="/watchlist" className="btn btn-ghost justify-self-start">See all {watchlist.symbols.length}</Link>}
    </div>
  )
}

export default function Home() {
  useTitle('')
  const { user } = useAuth()
  const { data: popular, error } = useAsync(api.popular, [])
  useEffect(() => { window.scrollTo(0, 0) }, [])

  return (
    <>
      <section className="hero">
        <div className="bgimg" aria-hidden="true" />
        <div className="ov" aria-hidden="true" />
        <div className="content mx-auto max-w-3xl">
          <h1>See a stock's risk before the week begins</h1>
          <p>Calm or stormy? Check any Indian stock in plain English.</p>
          {user
            ? <button type="button" className="btn btn-grad !rounded-xl !px-8 !py-3 !text-base" onClick={() => window.dispatchEvent(new Event('riskwise:focus-search'))}>Search a stock</button>
            : <Link to="/auth?mode=signup" className="btn btn-grad !rounded-xl !px-8 !py-3 !text-base">Sign up free</Link>}
          <div className="small">Free, no card needed. Educational only, not investment advice.</div>
        </div>
      </section>
      <div className="mx-auto w-full max-w-[1240px] px-4 pb-8 md:px-6">
        <h2 className="h3 mb-3 mt-2">Popular stocks</h2>
        {error && <div className="card dn">{error.message}</div>}
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">{(popular || []).map((r) => <StockCard key={r.sym} row={r} />)}</div>
        <h2 className="h3 mb-3 mt-6">Your watchlist</h2>
        <WatchlistPreview />
      </div>
    </>
  )
}
