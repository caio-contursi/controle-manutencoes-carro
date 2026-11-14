import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openPostgresCatalog, importPilot } from './postgres.js'

if (!process.env.DATABASE_URL) throw new Error('Defina DATABASE_URL antes de importar o piloto.')
const directory = process.env.LEMBRACAR_DATA_DIR || fileURLToPath(new URL('../data/', import.meta.url))
const sqliteFile = path.resolve(directory, 'catalog.sqlite')
const catalog = await openPostgresCatalog(process.env.DATABASE_URL, sqliteFile)
try {
  await importPilot(catalog.pool, process.argv[2])
  const { versions, ...totals } = await catalog.coverage()
  console.table(versions)
  console.log(totals)
} finally {
  await catalog.pool.end()
}
