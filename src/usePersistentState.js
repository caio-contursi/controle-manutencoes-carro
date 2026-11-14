import { useEffect, useRef, useState } from 'react'
import { createStateSync } from './state-sync.js'

const stateSync = createStateSync({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
}, (...args) => fetch(...args))

window.addEventListener('online', stateSync.retryPending)

export const loadState = stateSync.readLocal

export function usePersistentState(key, fallback) {
  const [state, setState] = useState(() => loadState(key, fallback))
  const [hydrated, setHydrated] = useState(false)
  const initialFallback = useRef(fallback)
  const lastValue = useRef()

  useEffect(() => {
    let active = true
    stateSync.hydrate(key, initialFallback.current).then((value) => {
      if (!active) return
      lastValue.current = JSON.stringify(value)
      setState(value)
      setHydrated(true)
    })
    return () => { active = false }
  }, [key])

  useEffect(() => {
    const current = JSON.stringify(state)
    if (hydrated && current !== lastValue.current) {
      lastValue.current = current
      void stateSync.save(key, state)
    }
  }, [hydrated, key, state])

  return [state, setState, hydrated]
}
