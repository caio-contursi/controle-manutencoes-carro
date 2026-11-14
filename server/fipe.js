import { isFipeFamilyQuery, loadFipeBrandModels, loadFipeFamilyVersions, loadFipeFamilyYears } from './fipe-family.js'
import { manualToken, registerManualRoute } from './manual-pdf.js'
import { verifiedOwnerManual, supportedFipeBrands } from './db/fipe-matches.js'

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

export function registerFipeRoute(app) {
  registerManualRoute(app)
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
        data.manuals = manual ? [{ ...manual, token: manualToken(manual.external_url) }] : []
      }
      return response.set('Cache-Control', year ? 'no-store' : 'private, max-age=300').json(data)
    } catch (error) {
      if (error.status === 404) return response.status(404).json({ error: 'Veículo não encontrado na consulta FIPE.' })
      if (error.status === 429) return response.status(429).json({ error: 'O provedor FIPE atingiu o limite de consultas. Tente novamente mais tarde.' })
      return response.status(503).json({ error: 'Consulta FIPE indisponível. Tente novamente em instantes.' })
    }
  })
}
