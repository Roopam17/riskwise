import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

// A small message at the bottom of the screen that disappears by itself.
export function ToastProvider({ children }) {
  const [message, setMessage] = useState(null)
  const timer = useRef()
  const show = useCallback((text) => {
    setMessage(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(null), 2800)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {message && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-bd bg-pn px-4 py-2 text-sm shadow-lg">
          {message}
        </div>
      )}
    </ToastCtx.Provider>
  )
}
