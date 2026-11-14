import assert from 'node:assert/strict'
import test from 'node:test'
import { isFipeFamilyQuery, loadFipeFamilyVersions, loadFipeFamilyYears } from '../server/fipe-family.js'

test('combines only the recorded model years of the selected car', async () => {
  const paths = []
  const responses = {
    '/brands/21/models': [
      { code: '1', name: 'Palio Economy' },
      { code: '1', name: 'Palio Economy' },
      { code: '2', name: 'Uno Mille' },
      { code: '3', name: 'Novo Palio Attractive' },
      { code: '4', name: 'Palio Week.Adv. ITAL. Dual. 1.8 Flex 16V' },
    ],
    '/brands/21/models/1/years': [{ code: '2012-1' }, { code: '2012-5' }, { code: '2010-5' }],
    '/brands/21/models/3/years': [{ code: '2016-5' }, { code: '32000-5' }],
    '/brands/21/models/4/years': [{ code: '2020-5' }],
  }
  const request = async (path) => {
    paths.push(path)
    assert.ok(Object.hasOwn(responses, path), path)
    return responses[path]
  }
  const query = { brand: '21', family: 'Palio' }
  const expected = ['2016', '2012', '2010'].map((code) => ({ code, name: code }))
  assert.deepEqual(await loadFipeFamilyYears(query, request), expected)
  assert.deepEqual(await loadFipeFamilyYears(query, request), expected)
  assert.deepEqual(await loadFipeFamilyYears({ ...query, family: 'palio weekend' }, request), [{ code: '2020', name: '2020' }])
  assert.deepEqual(await loadFipeFamilyYears({ ...query, family: 'Scudo' }, request), [])
  assert.deepEqual(paths, Object.keys(responses))
})

test('shares pending lookups and fills each free provider slot across families', { timeout: 2000 }, async () => {
  let peak = 0
  let active = 0
  const started = []
  const { promise: firstYear, resolve: releaseFirst } = Promise.withResolvers()
  const { promise: seventhPalioStarted, resolve: markSeventhPalio } = Promise.withResolvers()
  const models = Array.from({ length: 14 }, (_, index) => ({
    code: String(index + 1),
    name: (index < 7 ? 'Palio' : 'Uno') + ' ' + index,
  }))
  const request = async (path) => {
    if (path.endsWith('/models')) return models
    started.push(path)
    active++
    peak = Math.max(peak, active)
    if (path.endsWith('/7/years')) markSeventhPalio()
    if (started.length === 1) await firstYear
    else await new Promise(setImmediate)
    active--
    return [{ code: '2024-5' }]
  }

  const palio = loadFipeFamilyYears({ brand: '21', family: 'Palio' }, request)
  const samePalio = loadFipeFamilyYears({ brand: '21', family: ' palio ' }, request)
  const uno = loadFipeFamilyYears({ brand: '21', family: 'Uno' }, request)
  await seventhPalioStarted
  releaseFirst()
  const expected = [{ code: '2024', name: '2024' }]
  assert.deepEqual(await Promise.all([palio, samePalio, uno]), [expected, expected, expected])
  assert.equal(new Set(started).size, 14)
  assert.equal(started.length, 14)
  assert.equal(peak, 6)
})

test('surfaces a provider rate limit and retries only the failed source list', async () => {
  let quotaAvailable = false
  const paths = []
  const request = async (path) => {
    paths.push(path)
    if (path.endsWith('/models')) return [{ code: '1', name: 'Uno' }, { code: '2', name: 'Uno Mille' }]
    if (path.endsWith('/1/years')) return [{ code: '2014-5' }]
    if (!quotaAvailable) throw Object.assign(new Error('Rate limited'), { status: 429 })
    return [{ code: '2013-5' }]
  }
  const query = { brand: '21', family: 'Uno' }
  await assert.rejects(loadFipeFamilyYears(query, request), { status: 429 })
  quotaAvailable = true
  assert.deepEqual(await loadFipeFamilyYears(query, request), [
    { code: '2014', name: '2014' }, { code: '2013', name: '2013' },
  ])
  assert.deepEqual(paths, ['/brands/21/models', '/brands/21/models/1/years', '/brands/21/models/2/years', '/brands/21/models/2/years'])
})

test('lists only the selected car and model year, using each available fuel code', async () => {
  const paths = []
  const request = async (path) => {
    paths.push(path)
    if (path === '/brands/21/years') return [
      { code: '2012-5', name: '2012 Flex' },
      { code: '2012-1', name: '2012 Gasolina' },
      { code: '2013-5', name: '2013 Flex' },
      { code: '32000-5', name: '32000 Flex' },
    ]
    if (path === '/brands/21/years/2012-5/models') return [
      { code: '1', name: 'Palio Economy 2 portas' },
      { code: '2', name: 'Uno 5 portas' },
    ]
    if (path === '/brands/21/years/2012-1/models') return [{ code: '3', name: 'Palio ELX' }]
    throw new Error('Unexpected upstream path: ' + path)
  }
  const query = { brand: '21', family: 'palio', year: '2012' }
  const first = await loadFipeFamilyVersions(query, request)
  assert.deepEqual(first.map(({ code, yearCode, fuel }) => [code, yearCode, fuel]), [
    ['1', '2012-5', 'Flex'],
    ['3', '2012-1', 'Gasolina'],
  ])
  assert.deepEqual(await loadFipeFamilyVersions(query, request), first)
  assert.deepEqual(paths, [
    '/brands/21/years',
    '/brands/21/years/2012-5/models',
    '/brands/21/years/2012-1/models',
  ])
})

test('accepts family queries with or without a year and rejects incompatible or unsafe parameters', () => {
  const query = { brand: '21', family: 'Palio', year: '2012' }
  assert.equal(isFipeFamilyQuery(query), true)
  assert.equal(isFipeFamilyQuery({ ...query, year: '32000' }), true)
  assert.equal(isFipeFamilyQuery({ ...query, year: undefined }), true)
  assert.equal(isFipeFamilyQuery({ ...query, year: '2012-5' }), false)
  assert.equal(isFipeFamilyQuery({ ...query, model: '1' }), false)
  assert.equal(isFipeFamilyQuery({ ...query, brand: '../brands' }), false)
})
