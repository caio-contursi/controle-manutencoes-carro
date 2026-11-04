import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const dataDirectory = path.join(here, 'data')
const dataFile = path.join(dataDirectory, 'state.json')
const allowedKeys = new Set(['profile', 'vehicle', 'mileage', 'maintenance', 'expenses', 'reminders', 'firstSteps', 'dark', 'page'])
const app = express()
app.disable('x-powered-by')
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
