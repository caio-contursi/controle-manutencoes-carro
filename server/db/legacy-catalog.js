import { statSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

// Foreign-key order of the tables in the legacy catalog.
const tables = [
  'sources', 'brands', 'vehicles', 'powertrains', 'documents', 'vehicle_manual_coverage',
  'maintenance_items', 'maintenance_schedules', 'known_issues', 'recall_campaigns',
  'warranty_policies', 'dealer_eligibility_rules', 'dealer_services', 'user_vehicles',
  'vehicle_service_records', 'vehicle_expenses', 'vehicle_reminders', 'eligibility_checks',
  'contributions', 'data_reviews', 'import_batches',
]

export async function importLegacyCatalog(client, filePath) {
  if (!filePath) return
  try { statSync(filePath) } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }

  const source = new DatabaseSync(filePath, { readOnly: true })
  try {
    source.exec('BEGIN')
    if (source.prepare('PRAGMA quick_check').get().quick_check !== 'ok') {
      throw new Error('O catálogo SQLite não passou na verificação de integridade.')
    }
    const existingTables = new Set(source.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map((row) => row.name))
    if (!existingTables.has('brands') || !existingTables.has('documents')) {
      throw new Error('O arquivo SQLite não contém o catálogo do LembraCar.')
    }

    for (const table of tables) {
      if (!existingTables.has(table)) continue
      const { rows: targetColumns } = await client.query(`SELECT column_name,is_identity FROM information_schema.columns
        WHERE table_schema=current_schema() AND table_name=$1 ORDER BY ordinal_position`, [table])
      const sourceColumns = new Set(source.prepare(`PRAGMA table_info("${table}")`).all().map((column) => column.name))
      const columns = targetColumns.map((column) => column.column_name).filter((column) => sourceColumns.has(column))
      const projection = columns.map((column) => `"${column}"`).join(',')
      const rows = source.prepare(`SELECT ${projection} FROM "${table}"`)
      let batch = []
      async function insertBatch() {
        const values = batch.flatMap((row) => columns.map((column) => row[column]))
        const placeholders = batch.map((_, i) => '(' + columns.map((_, j) => '$' + (i * columns.length + j + 1)).join(',') + ')')
        await client.query(`INSERT INTO "${table}" (${projection}) VALUES ${placeholders.join(',')}`, values)
        batch = []
      }
      for (const row of rows.iterate()) {
        batch.push(row)
        if (batch.length === 250) await insertBatch()
      }
      if (batch.length) await insertBatch()

      if (targetColumns.some((column) => column.is_identity === 'YES')) {
        await client.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), GREATEST(COALESCE(MAX(id), 1), 1), COALESCE(MAX(id), 0) >= 1) FROM "${table}"`, [table])
      }
    }
  } finally {
    source.close()
  }
}
