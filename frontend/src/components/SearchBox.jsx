import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { api } from '../lib/api'
import { searchIndex } from '../lib/search'

// Type a name, a symbol, a nickname (SBI, RIL) or even a typo; suggestions appear as you type.
export default function SearchBox({ onSelect, exclude = [], placeholder = 'Search for a stock (e.g. TCS, Reliance, Adani)', rounded = true, globalFocus = false, disabled = false, autoFocus = false, focusSignal = 0 }) {
  const navigate = useNavigate()
  const [index, setIndex] = useState([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef(null)
  const input = useRef(null)

  useEffect(() => { api.index().then(setIndex).catch(() => {}) }, [])
  useEffect(() => { if (autoFocus) input.current?.focus() }, [autoFocus])
  useEffect(() => { if (focusSignal) input.current?.focus() }, [focusSignal])
  useEffect(() => {
    if (!globalFocus) return undefined
    const focus = () => input.current?.focus()
    window.addEventListener('riskwise:focus-search', focus)
    return () => window.removeEventListener('riskwise:focus-search', focus)
  }, [globalFocus])
  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const results = searchIndex(index, query, { limit: 8, exclude })

  function choose(entry) {
    setQuery('')
    setOpen(false)
    if (onSelect) onSelect(entry)
    else navigate(`/stock/${encodeURIComponent(entry.sym)}`)
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); choose(results[active]) }
    else if (e.key === 'Escape') { setOpen(false); input.current?.blur() }
  }

  return (
    <div ref={box} className="relative w-full">
      <Search size={16} className="faint pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
      <input
        ref={input} className="input" style={{ paddingLeft: 36, borderRadius: rounded ? 999 : 10 }} value={query} disabled={disabled}
        placeholder={placeholder} aria-label="Search any NSE stock" autoComplete="off" role="combobox" aria-expanded={open}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
      />
      {open && query.trim() && (
        <div className="dropdown" role="listbox">
          {results.length === 0 && <div className="faint px-3 py-2.5">No stock found for "{query}". Try part of the company name.</div>}
          {results.map((entry, i) => (
            <button key={entry.sym} type="button" className={i === active ? 'active' : ''} role="option" aria-selected={i === active}
              onMouseEnter={() => setActive(i)} onClick={() => choose(entry)}>
              <span><b className="font-medium">{entry.sym}</b> <span className="faint">{entry.name}</span></span>
              <span className="faint text-xs">{entry.modelled ? entry.ex : `${entry.ex} · price only`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
