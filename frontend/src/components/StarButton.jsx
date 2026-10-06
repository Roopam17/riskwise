import { Star } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useWatchlist } from '../hooks/watchlist'
import { useToast } from '../hooks/toast'

// The watchlist star. Logged-out visitors are sent to the login page when logins are switched on.
export default function StarButton({ sym }) {
  const watchlist = useWatchlist()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const on = watchlist.has(sym)

  async function click(event) {
    event.stopPropagation()
    const result = await watchlist.toggle(sym)
    if (result === 'login') navigate(`/auth?mode=login&next=${encodeURIComponent(location.pathname + location.search)}&why=watchlist`)
    else if (result === 'full') toast(`Your watchlist is full (${watchlist.max} stocks). Remove one to add another.`)
    else if (result === 'error') toast('We could not save that. Please try again.')
    else if (result === 'added') toast(`${sym} added to your watchlist`)
    else if (result === 'removed') toast(`${sym} removed from your watchlist`)
  }

  return (
    <button type="button" className={`star ${on ? 'on' : ''}`} onClick={click}
      aria-pressed={on} aria-label={on ? `Remove ${sym} from watchlist` : `Add ${sym} to watchlist`}
      title={on ? 'Remove from watchlist' : 'Add to watchlist'}>
      <Star size={20} fill={on ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  )
}
