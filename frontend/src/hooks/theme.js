import { useEffect, useState } from 'react'

// Dark by default; the choice is remembered in this browser.
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('riskwise.theme') || 'dark' } catch { return 'dark' }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('riskwise.theme', theme) } catch { /* storage blocked: the theme just will not be remembered */ }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}
