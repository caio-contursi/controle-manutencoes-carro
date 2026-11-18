import { isFipeFamilyQuery, loadFipeBrandModels, loadFipeFamilyVersions, loadFipeFamilyYears } from './fipe-family.js'
import { withManualToken, registerManualRoute } from './manual-pdf.js'
import { verifiedOwnerManual, supportedFipeBrands } from './db/fipe-matches.js'
import { chevroletOwnerManuals, listChevroletOwnerManuals } from './db/chevrolet-manuals.js'
import { createFipeManualIndex, fipeManualCatalogs } from './db/fipe-owner-manuals.js'

const baseUrl = 'https://fipe.parallelum.com.br/api/v2/cars'

export function fipePath({ brand, model, year }) {
  if (brand === undefined && model === undefined && year === undefined) return '/brands'
  if (typeof brand !== 'string' || !/^\d{1,8}$/.test(brand)) return null
  const models = '/brands/' + brand + '/models'
  if (model === undefined && year === undefined) return models
  if (typeof model !== 'string' || !/^\d{1,8}$/.test(model)) return null
  const years = models + '/' + model + '/years'
  if (year === undefined) return years
  return typeof year === 'string' && /^(?:\d{4}|32000)-\d{1,2}$/.test(year) ? years + '/' + year : null
}

async function requestUpstream(path) {
  const token = process.env.LEMBRACAR_FIPE_TOKEN
  const response = await fetch(baseUrl + path, {
    headers: token ? { 'X-Subscription-Token': token } : {},
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw Object.assign(new Error('Consulta FIPE indisponível'), { status: response.status })
  return response.json()
}

function registerManualCatalog(app, path, list) {
  app.get(path, (_request, response) => {
    const models = list().map(({ model, years }) => ({
      model,
      years: years.map(({ year, manuals }) => ({
        year,
        manuals: manuals.map(withManualToken),
      })),
    }))
    response.set('Cache-Control', 'no-store').json({ models })
  })
}

export function registerFipeRoute(app, manualRowsByBrand) {
  const manualIndexes = new Map()
  registerManualRoute(app)
  registerManualCatalog(app, '/api/catalog/chevrolet-manuals', listChevroletOwnerManuals)
  for (const { brand, slug, seed } of fipeManualCatalogs) {
    const index = createFipeManualIndex(manualRowsByBrand?.get(brand) ?? seed)
    manualIndexes.set(brand, index)
    registerManualCatalog(app, `/api/catalog/${slug}-manuals`, index.list)
  }
  app.get('/api/fipe/cars', async (request, response) => {
    const { brand, family, year } = request.query
    const path = family === undefined ? fipePath(request.query) : null
    if (!path && !isFipeFamilyQuery(request.query)) {
      return response.status(400).json({ error: 'Seleção de veículo inválida.' })
    }
    if (path === '/brands') return response.json(supportedFipeBrands)
    if (!supportedFipeBrands.some(({ code }) => code === brand)) {
      return response.status(400).json({ error: 'Marca fora da cobertura inicial.' })
    }
    try {
      if (family !== undefined) {
        const data = year === undefined
          ? await loadFipeFamilyYears(request.query, requestUpstream)
          : await loadFipeFamilyVersions(request.query, requestUpstream)
        return response.set('Cache-Control', 'private, max-age=300')
          .json(data)
      }
      const data = path === '/brands/' + brand + '/models'
        ? await loadFipeBrandModels(brand, requestUpstream)
        : await requestUpstream(path)
      if (year) {
        const manual = verifiedOwnerManual(request.query, data)
        const manuals = manual ? [manual] : []
        if (!manual && brand === '23') {
          manuals.push(...chevroletOwnerManuals(year, data, request.query.model))
        }
        const index = manualIndexes.get(brand)
        if (!manual && index) {
          manuals.push(...index.lookup(request.query.model, year, data))
        }
        data.manuals = manuals.map(withManualToken)
      }
      return response.set('Cache-Control', year ? 'no-store' : 'private, max-age=300').json(data)
    } catch (error) {
      if (error.status === 404) return response.status(404).json({ error: 'Veículo não encontrado na consulta FIPE.' })
      if (error.status === 429) return response.status(429).json({ error: 'O provedor FIPE atingiu o limite de consultas. Tente novamente mais tarde.' })
      return response.status(503).json({ error: 'Consulta FIPE indisponível. Tente novamente em instantes.' })
    }
  })
}
