import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import NavBar from './NavBar'

export default function Layout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-ln bg-pn px-6 py-3 text-center text-xs text-t3">
        Educational only, not buy/sell advice. Prices are delayed and risk levels are forecasts that can be wrong.{' '}
        <Link to="/about" className="underline hover:text-ac">Read the disclaimer</Link>
      </footer>
    </div>
  )
}

// Standard page container.
export function Page({ children, narrow = false }) {
  return <div className={`mx-auto w-full px-4 py-5 md:px-6 ${narrow ? 'max-w-[560px]' : 'max-w-[1240px]'}`}>{children}</div>
}
