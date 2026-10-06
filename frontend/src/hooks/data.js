import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

// Runs an async function and tracks loading / error. Re-runs when `deps` change, or when refresh() is called.
export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [tick, setTick] = useState(0)
  const latest = useRef(0)
  useEffect(() => {
    const id = ++latest.current
    setState((s) => ({ ...s, loading: true, error: null }))
    fn().then(
      (data) => { if (id === latest.current) setState({ data, error: null, loading: false }) },
      (error) => { if (id === latest.current) setState({ data: null, error, loading: false }) },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  const refresh = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, refresh }
}

// Data date, risk cut-offs and counts. Fetched once and shared.
let metaPromise
export function useMeta() {
  const [meta, setMeta] = useState(null)
  useEffect(() => {
    metaPromise ||= api.meta().catch(() => { metaPromise = undefined; return null })
    metaPromise.then(setMeta)
  }, [])
  return meta
}

export function useTitle(title) {
  useEffect(() => { document.title = title ? `${title} | RiskWise` : 'RiskWise: weekly risk level for Indian stocks' }, [title])
}
