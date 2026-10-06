import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Page } from '../components/Layout'
import { useTitle } from '../hooks/data'

// Ordinary market terms only. Terms produced by our own models (risk level, unusual activity, expected daily move) are explained on How it works.
const TERMS = [
  { id: 'current-price', term: 'Current price', group: 'Price facts', visual: 'pulse', meaning: 'The price of one share at the last trade we know about. On this site it is delayed, often by 15 minutes or more.', example: 'If a share last traded at ₹1,632.00, that is its current price.', why: 'It tells you what one share costs right now, but not whether that is cheap or expensive.' },
  { id: 'todays-change', term: "Today's change", group: 'Price facts', visual: 'pulse', meaning: 'How much the price moved since yesterday\'s close, in rupees and in percent.', example: 'A share closed at ₹100 yesterday and is ₹103 now: +₹3.00 (+3.0%).', why: 'A big move in one day shows how lively the stock is, but one day tells you little about next week.' },
  { id: '52-week-high-and-low', term: '52-week high and low', group: 'Price facts', visual: 'range', meaning: 'The highest and lowest prices the share has reached in the past year.', example: 'Low ₹600, high ₹912, price ₹812: the share is about 68% of the way up its yearly range.', why: 'It shows where today\'s price sits in its recent range. A price near its high has done well recently, but that does not tell us what happens next.' },
  { id: 'return', term: '1-month, 6-month and 1-year return', group: 'Price facts', visual: 'bars', meaning: 'How much the price went up or down over that time, in percent.', example: '₹100 a year ago and ₹124 today is a 1-year return of +24%.', why: 'Returns show the past. A strong past return is not a promise of a strong future one.' },
  { id: 'delayed-price', term: 'Delayed price', group: 'Price facts', visual: 'pulse', meaning: 'A price that arrives later than the real market, because the free source we use does not stream live trades.', example: 'The market price is now ₹101, but we show the ₹100 from a few minutes ago.', why: 'It is fine for learning and for getting a feel, but never for placing a trade.' },
  { id: 'adjusted-price', term: 'Adjusted price (stock splits)', group: 'Price facts', visual: 'bars', meaning: 'When a company splits its shares, for example one share becomes two, old prices are scaled down so the history stays fair.', example: 'A ₹200 share splits 1-for-2. The old ₹200 is shown as ₹100, so the chart has no fake 50% crash.', why: 'Without adjusting, a split would look like a crash and fool both people and models.' },
  { id: 'market-cap', term: 'Market cap', group: 'Company facts', visual: 'size', meaning: 'The total value of all a company\'s shares: the share price times the number of shares. In India it is shown in crores (1 crore = 10 million) and lakh crores (1 lakh crore = 1 trillion).', example: '10 crore shares at ₹500 each is ₹5,000 crore.', why: 'It shows how big the company is. Bigger companies tend to move less than small ones.' },
  { id: 'company-size', term: 'Company size (Large, Mid, Small)', group: 'Company facts', visual: 'size', meaning: 'A simple grouping by market cap. We call a company Large above ₹20,000 crore, Mid between ₹5,000 and ₹20,000 crore, and Small below that. These are approximate cut-offs of our own.', example: 'A ₹7,000 crore company is Mid.', why: 'Small companies are often more volatile and trade less, so their numbers are noisier.' },
  { id: 'pe-ratio', term: 'P/E ratio', group: 'Company facts', visual: 'ratio', meaning: 'Price divided by the company\'s yearly profit per share. It says how many rupees investors pay for each rupee of yearly profit.', example: 'Price ₹100 and profit of ₹5 per share a year gives a P/E of 20.', why: 'A high P/E can mean investors expect growth, or that the share is pricey. It is not shown when a company is losing money.' },
  { id: 'roe', term: 'Return on equity (ROE)', group: 'Company facts', visual: 'ratio', meaning: 'How much yearly profit a company makes for every rupee its owners have invested in it, in percent.', example: 'A company with ₹100 crore of owners\' money that earns ₹15 crore has an ROE of 15%.', why: 'A higher ROE means the company turns owners\' money into profit more efficiently. It is often missing for some companies.' },
  { id: 'dividend-yield', term: 'Dividend yield', group: 'Company facts', visual: 'coin', meaning: 'The yearly dividend (the share of profit a company pays out) as a percent of the share price.', example: 'A ₹2 yearly dividend on a ₹100 share is a 2% yield.', why: 'It shows how much cash a share has been paying out. Many growing companies pay none.' },
  { id: 'volume', term: 'Trading volume', group: 'Company facts', visual: 'bars', meaning: 'How many shares changed hands in a day. "Average daily volume" is the typical figure over recent months.', example: '14 lakh shares traded today against a usual 5 lakh is a busy day.', why: 'Stocks with very low volume are hard to trade and their prices can jump on small orders.' },
  { id: 'nse-and-bse', term: 'Exchange (NSE and BSE)', group: 'Company facts', visual: 'size', meaning: 'The marketplace where a share is traded. India has two big ones: the National Stock Exchange (NSE) and the Bombay Stock Exchange (BSE). Many companies are listed on both.', example: 'Reliance trades on both. A small company may trade on only one.', why: 'Prices on the two are usually almost identical. We currently cover NSE-listed stocks.' },
  { id: 'sector', term: 'Sector', group: 'Company facts', visual: 'size', meaning: 'The kind of business a company is in, such as banks, technology or energy.', example: 'TCS and Infosys are both in technology.', why: 'Stocks in the same sector often move together.' },
]

function Visual({ kind }) {
  const s = { width: 84, height: 40, viewBox: '0 0 84 40', 'aria-hidden': true }
  if (kind === 'range') return <svg {...s}><rect x="4" y="18" width="76" height="5" rx="2.5" fill="var(--pn2)" /><rect x="4" y="18" width="52" height="5" rx="2.5" fill="var(--ac)" opacity=".6" /><circle cx="56" cy="20.5" r="6" fill="var(--ac)" stroke="var(--pn)" strokeWidth="2" /></svg>
  if (kind === 'bars') return <svg {...s}>{[14, 24, 18, 32].map((h, i) => <rect key={i} x={8 + i * 19} y={36 - h} width="12" height={h} rx="2" fill="var(--ac)" opacity={0.45 + i * 0.15} />)}</svg>
  if (kind === 'ratio') return <svg {...s}><text x="42" y="26" textAnchor="middle" fontSize="16" fill="var(--tx)" fontWeight="600">100 ÷ 5</text></svg>
  if (kind === 'coin') return <svg {...s}><circle cx="42" cy="20" r="14" fill="none" stroke="var(--star)" strokeWidth="3" /><text x="42" y="25" textAnchor="middle" fontSize="14" fill="var(--star)" fontWeight="600">₹</text></svg>
  if (kind === 'size') return <svg {...s}><circle cx="16" cy="26" r="7" fill="var(--ac)" opacity=".5" /><circle cx="40" cy="22" r="11" fill="var(--ac)" opacity=".65" /><circle cx="66" cy="18" r="15" fill="var(--ac)" opacity=".8" /></svg>
  return <svg {...s}><polyline points="4,30 16,22 26,26 38,12 50,18 62,8 80,14" fill="none" stroke="var(--ac)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

export default function Glossary() {
  useTitle('Glossary')
  const { hash } = useLocation()
  const [q, setQ] = useState('')
  useEffect(() => { if (hash) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView(), 50) }, [hash])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return TERMS.filter((t) => !needle || `${t.term} ${t.meaning}`.toLowerCase().includes(needle)).sort((a, b) => a.term.localeCompare(b.term))
  }, [q])
  const letters = [...new Set(shown.map((t) => t.term[0].toUpperCase().replace(/[^A-Z]/, '#')))]
  const firstOfLetter = new Set(letters.map((l) => shown.find((t) => t.term[0].toUpperCase().replace(/[^A-Z]/, '#') === l)?.id))

  return (
    <Page>
      <h1 className="h2">Glossary</h1>
      <p className="muted mt-1 max-w-3xl">Plain-English meanings of the market terms you will see on RiskWise. Our own forecast terms (risk level, unusual activity, expected daily move) are explained on <a href="/how-it-works" className="underline">How it works</a>.</p>
      <div className="my-4 flex flex-wrap items-center gap-3">
        <input className="input !w-full sm:!w-72" placeholder="Search the glossary" aria-label="Search the glossary" value={q} onChange={(e) => setQ(e.target.value)} />
        <nav className="flex flex-wrap gap-1" aria-label="Jump to letter">{letters.map((l) => <a key={l} href={`#${shown.find((t) => t.term[0].toUpperCase().replace(/[^A-Z]/, '#') === l)?.id}`} className="btn btn-ghost !px-2.5">{l}</a>)}</nav>
      </div>
      {['Price facts', 'Company facts'].map((group) => {
        const list = shown.filter((t) => t.group === group)
        if (!list.length) return null
        return (
          <section key={group} className="mb-6">
            <h2 className="h3 mb-2.5">{group}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((t) => (
                <article key={t.id} id={t.id} className="card scroll-mt-20" data-first={firstOfLetter.has(t.id)}>
                  <div className="flex items-start justify-between gap-3"><h3 className="h3">{t.term}</h3><Visual kind={t.visual} /></div>
                  <p className="muted mt-1">{t.meaning}</p>
                  <p className="mt-2 text-sm"><b className="font-medium">Example:</b> <span className="muted">{t.example}</span></p>
                  <p className="mt-1 text-sm"><b className="font-medium">Why it matters:</b> <span className="muted">{t.why}</span></p>
                </article>))}
            </div>
          </section>)
      })}
      {shown.length === 0 && <div className="card muted">Nothing matches "{q}". Try a shorter word.</div>}
    </Page>
  )
}
