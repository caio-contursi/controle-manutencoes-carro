import { registerFipeRoute } from './fipe.js'
import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCatalog, catalogCounts, listBrands, searchVehicles, getVerifiedVehicle, submitContribution } from './db/catalog.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const dataDirectory = process.env.LEMBRACAR_DATA_DIR ? path.resolve(process.env.LEMBRACAR_DATA_DIR) : path.join(here, 'data')
const dataFile = path.join(dataDirectory, 'state.json')
const catalogFile = path.join(dataDirectory, 'catalog.sqlite')
const allowedKeys = new Set(['profile', 'vehicle', 'mileage', 'maintenance', 'expenses', 'reminders', 'firstSteps', 'dark', 'page'])
const app = express()
const catalog = createCatalog(catalogFile)
app.disable('x-powered-by')
registerFipeRoute(app)
app.use(express.json({ limit: '256kb' }))

async function readState() {
  try { return JSON.parse(await fs.readFile(dataFile, 'utf8')) } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

async function writeState(state) {
  await fs.mkdir(dataDirectory, { recursive: true })
  const temporaryFile = `${dataFile}.tmp`
  await fs.writeFile(temporaryFile, JSON.stringify(state, null, 2), 'utf8')
  await fs.rename(temporaryFile, dataFile)
}

let writeQueue = Promise.resolve()

app.get('/api/state', async (_request, response) => {
  try { response.json(await readState()) } catch { response.status(500).json({ error: 'Não foi possível ler os dados locais.' }) }
})

app.put('/api/state/:key', async (request, response) => {
  const { key } = request.params
  if (!allowedKeys.has(key) || !request.body || !Object.hasOwn(request.body, 'value')) {
    response.status(400).json({ error: 'Campo de dados inválido.' })
    return
  }
  try {
    const operation = writeQueue.then(async () => {
      const state = await readState()
      state[key] = request.body.value
      await writeState(state)
    })
    writeQueue = operation.catch(() => {})
    await operation
    response.json({ ok: true })
  } catch { response.status(500).json({ error: 'Não foi possível salvar os dados locais.' }) }
})

app.get('/api/health', (_request, response) => response.json({ status: 'ok', storage: 'local' }))

app.get('/api/catalog/health', (_request, response) => response.json({ status: 'ok', storage: 'sqlite', counts: catalogCounts(catalog) }))
app.get('/api/catalog/brands', (_request, response) => response.json({ brands: listBrands(catalog) }))
app.get('/api/catalog/search', (request, response) => response.json({ vehicles: searchVehicles(catalog, request.query.q || '') }))
app.get('/api/catalog/sources', (_request, response) => response.json({ sources: catalog.prepare('SELECT id,organization,title,url,source_type,accessed_on,notes FROM sources ORDER BY organization,title').all() }))
app.get('/api/catalog/vehicles/:id', (request, response) => {
  const result = getVerifiedVehicle(catalog, request.params.id)
  if (!result) return response.status(404).json({ error: 'Veículo verificado não encontrado.' })
  return response.json(result)
})
app.post('/api/catalog/contributions', (request, response) => {
  try {
    const result = submitContribution(catalog, request.body)
    return response.status(201).json(result)
  } catch (error) {
    const status = ['invalid_contribution','contribution_too_large'].includes(error.message) ? 400 : 500
    return response.status(status).json({ error: status === 400 ? 'Contribuição inválida ou acima do limite.' : 'Não foi possível registrar a contribuição.' })
  }
})

const production = process.argv.includes('--production')
if (production) {
  const buildDirectory = path.join(root, 'dist')
  app.use(express.static(buildDirectory, { index: false }))
  app.get('*', (_request, response) => response.sendFile(path.join(buildDirectory, 'index.html')))
} else {
  const { createServer: createViteServer } = await import('vite')
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' })
  app.use(vite.middlewares)
}

const port = Number(process.env.PORT || 5173)
const host = process.env.HOST || '127.0.0.1'
app.listen(port, host, () => console.log(`LembraCar local: http://localhost:${port}`))
