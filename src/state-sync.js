const retryDelays = [1000, 3000, 10000]

export function createStateSync(storage, request, schedule = setTimeout) {
  const pending = new Map()
  const active = new Map()
  const retries = new Map()
  let hydration

  function read(key) {
    try { return storage.getItem(key) } catch { return null }
  }

  function write(key, value) {
    try {
      if (value === null) storage.removeItem(key)
      else storage.setItem(key, value)
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
  }

  function parse(value, fallback) {
    try { return value === null ? fallback : JSON.parse(value) } catch { return fallback }
  }

  const pendingKey = (key) => key + '.pending'
  const shortKey = (key) => key.replace(/^lembracar\./, '')
  const readLocal = (key, fallback) => parse(read(pendingKey(key)) ?? read(key), fallback)

  function loadRemote() {
    hydration ??= Promise.resolve()
      .then(() => request('/api/state', { signal: AbortSignal.timeout(8000) }))
      .then((response) => response.ok ? response.json() : null)
      .catch(() => null)
    return hydration
  }

  function flush(key) {
    if (active.has(key)) return active.get(key)
    const operation = Promise.resolve().then(async () => {
      try {
        while (pending.has(key)) {
          const value = pending.get(key)
          const response = await request('/api/state/' + shortKey(key), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: '{"value":' + value + '}',
            signal: AbortSignal.timeout(8000),
          })
          if (!response.ok) throw new Error('Falha ao sincronizar os dados')
          if (pending.get(key) === value) {
            pending.delete(key)
            if (read(pendingKey(key)) === value) write(pendingKey(key), null)
          }
        }
        retries.delete(key)
      } catch {
        const attempt = retries.get(key) ?? 0
        if (attempt < retryDelays.length) {
          retries.set(key, attempt + 1)
          schedule(() => { if (pending.has(key)) void flush(key) }, retryDelays[attempt])
        }
      } finally {
        active.delete(key)
      }
    })
    active.set(key, operation)
    return operation
  }

  function save(key, value) {
    const serialized = JSON.stringify(value)
    pending.set(key, serialized)
    write(pendingKey(key), serialized)
    write(key, serialized)
    return flush(key)
  }

  async function hydrate(key, fallback) {
    const remote = await loadRemote()
    const queued = pending.get(key) ?? read(pendingKey(key))
    if (queued !== null && queued !== undefined) {
      const value = parse(queued, fallback)
      void save(key, value)
      return value
    }
    if (remote && Object.hasOwn(remote, shortKey(key))) {
      const value = remote[shortKey(key)]
      write(key, JSON.stringify(value))
      return value
    }
    const local = readLocal(key, undefined)
    if (local !== undefined && remote) void save(key, local)
    return local === undefined ? fallback : local
  }

  function retryPending() {
    for (const key of pending.keys()) {
      retries.delete(key)
      void flush(key)
    }
  }

  return { hydrate, readLocal, save, retryPending }
}
