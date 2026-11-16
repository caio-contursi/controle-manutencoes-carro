import { randomUUID } from 'node:crypto'
import pg from 'pg'

export async function isolatedPostgres() {
  const connectionString = process.env.LEMBRACAR_TEST_DATABASE_URL
  if (!connectionString) throw new Error('Configure LEMBRACAR_TEST_DATABASE_URL para um PostgreSQL de testes.')
  const schema = 'test_' + randomUUID().replace(/-/g, '')
  const admin = new pg.Pool({ connectionString })
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`)
  } catch (error) {
    await admin.end()
    throw error
  }

  const url = new URL(connectionString)
  url.searchParams.set('options', `-c search_path=${schema}`)
  return {
    connectionString: url.toString(),
    async cleanup() {
      try { await admin.query(`DROP SCHEMA "${schema}" CASCADE`) }
      finally { await admin.end() }
    },
  }
}
