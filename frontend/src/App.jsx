import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'

// Each page loads only when it is visited, which keeps the first visit fast (the chart library is the heavy part).
const Stock = lazy(() => import('./pages/Stock'))
const Compare = lazy(() => import('./pages/Compare'))
const Watchlist = lazy(() => import('./pages/Watchlist'))
const Explorer = lazy(() => import('./pages/Explorer'))
const Auth = lazy(() => import('./pages/Auth'))
const Account = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Account })))
const HowItWorks = lazy(() => import('./pages/HowItWorks'))
const About = lazy(() => import('./pages/About'))
const Glossary = lazy(() => import('./pages/Glossary'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1240px] px-6 py-8 text-t2">Loading…</div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/stock/:sym" element={<Stock />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/explorer" element={<Explorer />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/account" element={<Account />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/glossary" element={<Glossary />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
