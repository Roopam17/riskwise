import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Activity, ChevronDown, Menu, Moon, Sun, UserCircle, X } from 'lucide-react'
import SearchBox from './SearchBox'
import { useAuth } from '../hooks/auth'
import { useTheme } from '../hooks/theme'

const LEARN = [['/how-it-works', 'How it works'], ['/glossary', 'Glossary'], ['/about', 'About and disclaimer']]
const linkClass = ({ isActive }) => `rounded-lg px-3 py-1.5 text-sm whitespace-nowrap ${isActive ? 'bg-pn2 font-medium text-tx shadow-[inset_0_-2px_0_var(--ac)]' : 'text-t2 hover:bg-pn2 hover:text-tx'}`

export default function NavBar() {
  const { user, configured } = useAuth()
  const [theme, toggleTheme] = useTheme()
  const [learnOpen, setLearnOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const learnRef = useRef(null)
  const location = useLocation()

  useEffect(() => { setLearnOpen(false); setMenuOpen(false) }, [location.pathname])
  useEffect(() => {
    const close = (e) => { if (learnRef.current && !learnRef.current.contains(e.target)) setLearnOpen(false) }
    const shortcut = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); window.dispatchEvent(new Event('riskwise:focus-search')) } }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', shortcut)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', shortcut) }
  }, [])

  const links = (
    <>
      <NavLink to="/explorer" className={linkClass}>Explorer</NavLink>
      <NavLink to="/compare" className={linkClass}>Compare</NavLink>
      <NavLink to="/watchlist" className={linkClass}>Watchlist</NavLink>
      <div className="relative" ref={learnRef}>
        <button type="button" className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-t2 hover:bg-pn2 hover:text-tx" aria-expanded={learnOpen} onClick={() => setLearnOpen((o) => !o)}>
          Learn <ChevronDown size={14} aria-hidden="true" />
        </button>
        {learnOpen && (
          <div className="absolute left-0 top-full z-40 mt-1 min-w-48 overflow-hidden rounded-lg border border-ln bg-pn shadow-xl">
            {LEARN.map(([to, label]) => <Link key={to} to={to} className="block px-4 py-2 text-sm hover:bg-pn2">{label}</Link>)}
          </div>
        )}
      </div>
    </>
  )

  return (
    <header className="relative z-30 border-b border-ln bg-pn">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-3 px-4 py-2.5 md:px-6">
        <Link to="/" className="flex items-center gap-1.5 text-lg font-semibold" aria-label="RiskWise home">
          <Activity size={24} className="text-ac" aria-hidden="true" />RiskWise
        </Link>
        <div className="order-last w-full md:order-none md:w-[340px] md:flex-none"><SearchBox globalFocus /></div>
        <nav className="hidden flex-1 items-center gap-0.5 md:flex" aria-label="Main">{links}</nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
            {theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
          </button>
          {user ? (
            <Link to="/account" className="btn"><UserCircle size={16} aria-hidden="true" />Account</Link>
          ) : (
            <>
              <Link to="/auth?mode=signup" className="btn btn-primary">Sign up</Link>
              <Link to="/auth?mode=login" className="btn hidden sm:inline-flex">Log in</Link>
            </>
          )}
          <button type="button" className="icon-btn md:hidden" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-label="Menu">
            {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-ln px-4 py-3 md:hidden" aria-label="Main (mobile)">
          {links}
          {!user && <Link to="/auth?mode=login" className={linkClass({ isActive: false })}>Log in</Link>}
          {!configured && <span className="faint px-3 text-xs">Local mode: logins are not connected yet.</span>}
        </nav>
      )}
    </header>
  )
}
