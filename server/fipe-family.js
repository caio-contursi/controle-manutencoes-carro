import { fipeFamily, fipeVariant } from '../src/fipe-variants.js'

const brandPattern = /^\d{1,8}$/
const yearPattern = /^(?:\d{4}|32000)$/
const yearCodePattern = /^(?:\d{4}|32000)-\d{1,2}$/
const cacheTtl = 15 * 60 * 1000
const modelYearsCacheTtl = 12 * 60 * 60 * 1000
const maxCacheEntries = 2048
const lookupConcurrency = 6
const upstreamStates = new WeakMap()

export function isFipeFamilyQuery({ brand, model, family, year }) {
  return model === undefined && typeof brand === 'string' && brandPattern.test(brand) &&
    typeof family === 'string' && family.trim().length > 0 && family.length <= 80 &&
    (year === undefined || (typeof year === 'string' && yearPattern.test(year)))
}

function upstreamState(requestUpstream) {
  let state = upstreamStates.get(requestUpstream)
  if (!state) {
    state = { cache: new Map(), activeModelYears: 0, waitingModelYears: [] }
    upstreamStates.set(requestUpstream, state)
  }
  return state
}

function cachedResult(cache, key, load, ttl) {
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) return cached.result
  cache.delete(key)
  if (cache.size >= maxCacheEntries) cache.delete(cache.keys().next().value)

  const result = Promise.resolve().then(load)
  const entry = { result, expires: Date.now() + ttl }
  cache.set(key, entry)
  result.catch(() => { if (cache.get(key) === entry) cache.delete(key) })
  return result
}

async function withModelYearSlot(state, request) {
  if (state.activeModelYears < lookupConcurrency) {
    state.activeModelYears++
  } else {
    await new Promise((resolve) => state.waitingModelYears.push(resolve))
  }
  try {
    return await request()
  } finally {
    const next = state.waitingModelYears.shift()
    if (next) next()
    else state.activeModelYears--
  }
}

function listFromUpstream(path, requestUpstream, modelYears = false) {
  const state = upstreamState(requestUpstream)
  return cachedResult(state.cache, path, async () => {
    const request = () => requestUpstream(path)
    const rows = modelYears ? await withModelYearSlot(state, request) : await request()
    if (!Array.isArray(rows)) throw new Error('Lista de veículos inválida')
    return rows
  }, modelYears ? modelYearsCacheTtl : cacheTtl)
}

export function loadFipeBrandModels(brand, requestUpstream) {
  return listFromUpstream('/brands/' + brand + '/models', requestUpstream)
}

function isFamilyModel({ code, name }, familyKey) {
  return typeof code === 'string' && brandPattern.test(code) &&
    typeof name === 'string' && fipeFamily(name).toLocaleLowerCase('pt-BR') === familyKey
}

export async function loadFipeFamilyYears(query, requestUpstream) {
  if (!isFipeFamilyQuery(query) || query.year !== undefined) throw new Error('Seleção FIPE inválida')
  const { brand, family } = query
  const familyKey = family.trim().toLocaleLowerCase('pt-BR')
  const { cache } = upstreamState(requestUpstream)
  return cachedResult(cache, 'family-years:' + brand + '/' + familyKey, async () => {
    const models = await loadFipeBrandModels(brand, requestUpstream)
    const modelCodes = [...new Set(models.filter((model) => isFamilyModel(model, familyKey)).map(({ code }) => code))]
    const years = new Set()
    let next = 0
    let failed = false
    async function collectYears() {
      try {
        while (!failed && next < modelCodes.length) {
          const model = modelCodes[next++]
          const rows = await listFromUpstream('/brands/' + brand + '/models/' + model + '/years', requestUpstream, true)
          for (const { code } of rows) {
            if (typeof code === 'string' && yearCodePattern.test(code) && !code.startsWith('32000-')) {
              years.add(code.split('-')[0])
            }
          }
        }
      } catch (error) {
        failed = true
        throw error
      }
    }
    await Promise.all(Array.from({ length: Math.min(lookupConcurrency, modelCodes.length) }, collectYears))
    return [...years].sort((a, b) => Number(b) - Number(a)).map((code) => ({ code, name: code }))
  }, cacheTtl)
}

export async function loadFipeFamilyVersions(query, requestUpstream) {
  if (!isFipeFamilyQuery(query) || query.year === undefined) throw new Error('Seleção FIPE inválida')
  const { brand, family, year } = query
  const familyKey = family.trim().toLocaleLowerCase('pt-BR')
  const years = await listFromUpstream('/brands/' + brand + '/years', requestUpstream)
  const matchingYears = [...new Map(years
    .filter(({ code, name }) => typeof code === 'string' && yearCodePattern.test(code) && code.startsWith(year + '-') && typeof name === 'string')
    .map((entry) => [entry.code, entry])).values()]
  const versions = new Map()

  // A provider year code includes fuel. Fetch each fuel list once for the chosen year.
  for (let i = 0; i < matchingYears.length; i += 4) {
    const lists = await Promise.all(matchingYears.slice(i, i + 4).map(async (entry) => {
      const rows = await listFromUpstream('/brands/' + brand + '/years/' + entry.code + '/models', requestUpstream)
      return rows.filter((model) => isFamilyModel(model, familyKey))
        .map((model) => fipeVariant(model, entry))
    }))
    for (const variant of lists.flat()) {
      versions.set(variant.modelCode + '/' + variant.yearCode, {
        code: variant.modelCode, name: variant.name, yearCode: variant.yearCode, fuel: variant.fuel,
      })
    }
  }
  return [...versions.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.fuel.localeCompare(b.fuel, 'pt-BR'))
}
