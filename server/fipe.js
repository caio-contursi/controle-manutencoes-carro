const baseUrl = 'https://fipe.parallelum.com.br/api/v2/cars'

export function fipePath({ brand, model, year }) {
  if (brand === undefined && model === undefined && year === undefined) return '/brands'
  if (typeof brand !== 'string' || !/^\d{1,8}$/.test(brand)) return null
  const models = '/brands/' + brand + '/models'
  if (model === undefined && year === undefined) return models
  if (typeof model !== 'string' || !/^\d{1,8}$/.test(model)) return null
  const years = models + '/' + model + '/years'
  if (year === undefined) return years
  return typeof year === 'string' && /^\d{4}-\d{1,2}$/.test(year) ? years + '/' + year : null
}

export function registerFipeRoute(app) {
  app.get('/api/fipe/cars', async (request, response) => {
    const path = fipePath(request.query)
    if (!path) return response.status(400).json({ error: 'Seleção de veículo inválida.' })
    try {
      const token = process.env.LEMBRACAR_FIPE_TOKEN
      const upstream = await fetch(baseUrl + path, {
        headers: token ? { 'X-Subscription-Token': token } : {},
        signal: AbortSignal.timeout(8000),
      })
      if (upstream.status === 404) return response.status(404).json({ error: 'Veículo não encontrado na consulta FIPE.' })
      if (!upstream.ok) throw new Error('Provider unavailable')
      response.set('Cache-Control', 'private, max-age=300').json(await upstream.json())
    } catch {
      response.status(503).json({ error: 'Consulta FIPE indisponível. Tente novamente em instantes.' })
    }
  })
}
