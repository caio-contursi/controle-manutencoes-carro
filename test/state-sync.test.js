import assert from 'node:assert/strict'
import test from 'node:test'
import { createStateSync } from '../src/state-sync.js'

const mileage = 'lembracar.mileage'
const ok = (value) => ({ ok: true, json: async () => value })

function storage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

test('hydration shares one request and leaves unchanged fields untouched', async () => {
  const calls = []
  const state = createStateSync(storage(), async (path) => {
    calls.push(path)
    return ok({ mileage: 10, vehicle: null })
  })
  const values = await Promise.all([state.hydrate(mileage, 0), state.hydrate('lembracar.vehicle', {}), state.hydrate('lembracar.reminders', [])])
  assert.deepEqual(values, [10, null, []])
  assert.deepEqual(calls, ['/api/state'])
})

test('a failed load preserves local data without uploading defaults', async () => {
  const browser = storage()
  browser.setItem(mileage, '10')
  const calls = []
  const state = createStateSync(browser, async (path) => {
    calls.push(path)
    return { ok: false }
  })
  assert.equal(await state.hydrate(mileage, 0), 10)
  assert.deepEqual(calls, ['/api/state'])
})

test('unconfirmed edits survive reload and retry after a failed write', async () => {
  const browser = storage()
  const offline = createStateSync(browser, async () => ({ ok: false }), () => {})
  await offline.save(mileage, 12)
  const saves = []
  const scheduled = []
  const online = createStateSync(browser, async (_, options) => {
    if (!options.method) return ok({ mileage: 10 })
    saves.push(JSON.parse(options.body).value)
    return { ok: saves.length === 2 }
  }, (retry) => scheduled.push(retry))
  assert.equal(await online.hydrate(mileage, 0), 12)
  await new Promise(setImmediate)
  assert.equal(browser.getItem(mileage + '.pending'), '12')
  scheduled[0]()
  await new Promise(setImmediate)
  assert.deepEqual(saves, [12, 12])
  assert.equal(browser.getItem(mileage + '.pending'), null)
})

test('coalesces edits made while an older write is still pending', async () => {
  const browser = storage()
  const writes = []
  let finishFirst
  const firstWrite = new Promise((resolve) => { finishFirst = resolve })
  const state = createStateSync(browser, async (_, options) => {
    const value = JSON.parse(options.body).value
    writes.push(value)
    if (value === 10) await firstWrite
    return ok()
  })
  const first = state.save(mileage, 10)
  await Promise.resolve()
  state.save(mileage, 11)
  state.save(mileage, 12)
  assert.deepEqual(writes, [10])
  finishFirst()
  await first
  assert.deepEqual(writes, [10, 12])
  assert.equal(state.readLocal(mileage, 0), 12)
  assert.equal(browser.getItem(mileage + '.pending'), null)
})
