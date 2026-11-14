import { createReadStream, existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'
import { from as copyFrom } from 'pg-copy-streams'
import { createCatalog } from './catalog.js'

const tables = [
  'sources', 'brands', 'vehicles', 'powertrains', 'documents', 'vehicle_manual_coverage',
  'maintenance_items', 'maintenance_schedules', 'known_issues', 'recall_campaigns',
  'warranty_policies', 'dealer_eligibility_rules', 'dealer_services', 'user_vehicles',
  'vehicle_service_records', 'vehicle_expenses', 'vehicle_reminders', 'eligibility_checks',
  'contributions', 'data_reviews', 'import_batches',
]
const read = (file) => readFile(new URL(file, import.meta.url), 'utf8')

async function transaction(pool, work) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(591731)')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

function sqliteSnapshot(file) {
  const db = existsSync(file) ? new DatabaseSync(file, { readOnly: true }) : createCatalog(':memory:')
  try {
    db.exec('BEGIN')
    return tables.map((table) => [
      table,
      db.prepare('SELECT * FROM ' + table).all(),
      db.prepare('PRAGMA table_info(' + table + ')').all().find((column) => column.name === 'id').type === 'INTEGER',
    ])
  } finally {
    db.close()
  }
}

export async function openPostgresCatalog(connectionString, sqliteFile) {
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 8000 })
  pool.on('error', (error) => console.error('Conexão ociosa do catálogo perdida:', error.message))
  try {
    await transaction(pool, async (client) => {
      await client.query('CREATE TABLE IF NOT EXISTS catalog_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
      const applied = await client.query("SELECT 1 FROM catalog_migrations WHERE version = '001_catalog'")
      if (applied.rowCount) return
      await client.query(await read('./migrations/001_catalog.sql'))
      for (const [table, rows, identity] of sqliteSnapshot(sqliteFile)) {
        if (!rows.length) continue
        const columns = Object.keys(rows[0]).map((column) => '"' + column.replaceAll('"', '""') + '"').join(', ')
        await client.query('INSERT INTO ' + table + ' (' + columns + ') SELECT ' + columns +
          ' FROM json_populate_recordset(NULL::' + table + ', $1::json)', [JSON.stringify(rows)])
        if (identity) {
          await client.query("SELECT setval(pg_get_serial_sequence($1, 'id'), (SELECT max(id) FROM " + table + "))", [table])
        }
      }
      await client.query("INSERT INTO catalog_migrations(version) VALUES ('001_catalog')")
    })
    return new PostgresCatalog(pool)
  } catch (error) {
    await pool.end()
    throw error
  }
}

export async function importPilot(pool, csv = new URL('./imports/fiat-vw.csv', import.meta.url)) {
  return transaction(pool, async (client) => {
    await client.query(await read('./imports/stage.sql'))
    await pipeline(createReadStream(csv), client.query(copyFrom('COPY pilot_stage FROM STDIN WITH (FORMAT csv, HEADER MATCH)')))
    await client.query(await read('./imports/publish.sql'))
    const { rows } = await client.query('SELECT * FROM catalog_version_coverage ORDER BY brand, model, model_year, version')
    return rows
  })
}

class PostgresCatalog {
  constructor(pool) { this.pool = pool }
  async rows(sql, params) { return (await this.pool.query(sql, params)).rows }

  async counts() {
    const [counts] = await this.rows(`SELECT
      (SELECT count(*)::int FROM brands) AS brands,
      (SELECT count(*)::int FROM vehicles WHERE status='published') AS models,
      (SELECT count(*)::int FROM documents WHERE document_type='owner_manual' AND status='verified') AS manuals,
      (SELECT count(*)::int FROM maintenance_schedules WHERE review_status='verified') AS schedules,
      (SELECT count(*)::int FROM known_issues WHERE review_status='verified') AS issues,
      (SELECT count(*)::int FROM recall_campaigns WHERE status='verified') AS recalls,
      (SELECT count(*)::int FROM contributions WHERE status='pending') AS "pendingContributions"`)
    return counts
  }

  async coverage() {
    const versions = await this.rows('SELECT * FROM catalog_version_coverage ORDER BY brand, model, model_year, version')
    return {
      identified: versions.length,
      withManual: versions.filter((entry) => entry.has_manual).length,
      withReviewedPlan: versions.filter((entry) => entry.has_reviewed_plan).length,
      withReviewedRule: versions.filter((entry) => entry.has_reviewed_rule).length,
      versions,
    }
  }

  brands() {
    return this.rows(`SELECT b.id,b.name,b.slug,b.coverage_status,
      (SELECT count(*)::int FROM vehicles v WHERE v.brand_id=b.id AND v.status='published') AS verified_models,
      (SELECT count(*)::int FROM documents d WHERE d.brand_id=b.id AND d.document_type='owner_manual' AND d.status='verified') AS verified_manuals,
      (SELECT count(*)::int FROM maintenance_schedules m JOIN vehicles v ON v.id=m.vehicle_id WHERE v.brand_id=b.id AND m.review_status='verified') AS verified_schedules
      FROM brands b ORDER BY b.name`)
  }

  search(query) {
    const terms = String(query).slice(0, 100).trim().split(/\s+/).filter(Boolean)
    return this.rows(`SELECT v.id,b.name AS brand,v.model,v.generation,v.model_year_from,v.model_year_to,v.status
      FROM vehicles v JOIN brands b ON b.id=v.brand_id WHERE v.status='published'
      AND NOT EXISTS (SELECT 1 FROM unnest($1::text[]) AS term
        WHERE strpos(lower(concat_ws(' ', b.name, v.model, v.generation, v.model_year_from, v.model_year_to)), lower(term)) = 0)
      ORDER BY b.name,v.model,v.model_year_from LIMIT 100`, [terms])
  }

  sources() { return this.rows('SELECT id,organization,title,url,source_type,accessed_on,notes FROM sources ORDER BY organization,title') }

  async fipeDetails(match) {
    const [brand, model, version, year] = match
    const [manuals, schedules] = await Promise.all([
      this.fipeManuals(match),
      this.rows(`SELECT DISTINCT mi.name, ms.interval_km, ms.interval_months, ms.conditions, ms.evidence_page
        FROM catalog_version_coverage cv
        JOIN maintenance_schedules ms ON ms.vehicle_id = cv.vehicle_id
        JOIN documents d ON d.id = ms.document_id
        JOIN maintenance_items mi ON mi.id = ms.item_id
        WHERE cv.brand = $1 AND cv.model = $2 AND cv.version = $3 AND cv.model_year = $4
          AND (ms.powertrain_id IS NULL OR ms.powertrain_id = cv.powertrain_id)
          AND $4 BETWEEN ms.valid_from_year AND ms.valid_to_year
          AND ms.review_status = 'verified' AND d.status = 'verified'
        ORDER BY mi.name`, [brand, model, version, year]),
    ])
    return { manuals, schedules }
  }

  fipeManuals([brand, model, version, year]) {
    return this.rows(`SELECT DISTINCT d.title, d.external_url, c.edition, c.notes
      FROM catalog_version_coverage cv
      JOIN vehicle_manual_coverage c ON c.vehicle_id = cv.vehicle_id
      JOIN documents d ON d.id = c.document_id AND d.brand_id = c.brand_id
      JOIN vehicles v ON v.id = cv.vehicle_id AND v.brand_id = c.brand_id
      JOIN sources s ON s.id = d.source_id
      WHERE cv.brand = $1 AND cv.model = $2 AND cv.version = $3 AND cv.model_year = $4 AND cv.has_manual
        AND (c.powertrain_id IS NULL OR c.powertrain_id = cv.powertrain_id)
        AND c.region = v.market AND (d.vehicle_id IS NULL OR d.vehicle_id = v.id)
        AND $4 BETWEEN c.model_year_from AND c.model_year_to
        AND $4 BETWEEN d.model_year_from AND d.model_year_to
        AND d.status = 'verified' AND d.document_type = 'owner_manual'
        AND s.source_type = 'manufacturer_manual' AND d.external_url LIKE 'https://%'
      ORDER BY d.title, c.edition`, [brand, model, version, year])
  }

  async vehicle(id) {
    if (!/^\d{1,10}$/.test(id) || Number(id) > 2147483647) return null
    const [vehicle] = await this.rows(`SELECT v.id,b.name AS brand,v.model,v.generation,v.body_style,v.model_year_from,v.model_year_to,v.market,v.status
      FROM vehicles v JOIN brands b ON b.id=v.brand_id WHERE v.id=$1 AND v.status='published'`, [id])
    if (!vehicle) return null
    const [schedules, issues, manuals] = await Promise.all([
      this.rows(`SELECT mi.name,ms.interval_km,ms.interval_months,ms.applicability,ms.conditions,ms.evidence_page,
        ms.valid_from_year,ms.valid_to_year,p.trim AS version,d.external_url AS manual_url
        FROM maintenance_schedules ms JOIN maintenance_items mi ON mi.id=ms.item_id JOIN documents d ON d.id=ms.document_id
        LEFT JOIN powertrains p ON p.id=ms.powertrain_id
        WHERE ms.vehicle_id=$1 AND ms.review_status='verified' AND d.status='verified' ORDER BY mi.name`, [id]),
      this.rows(`SELECT title,component,description,symptom,severity,evidence_type,model_year_from,model_year_to
        FROM known_issues WHERE vehicle_id=$1 AND review_status='verified' ORDER BY severity,title`, [id]),
      this.rows(`SELECT d.title,d.external_url,c.edition,c.notes,p.trim AS version,c.model_year_from,c.model_year_to
        FROM vehicle_manual_coverage c JOIN documents d ON d.id=c.document_id JOIN sources s ON s.id=d.source_id
        LEFT JOIN powertrains p ON p.id=c.powertrain_id
        WHERE c.vehicle_id=$1 AND d.status='verified' AND d.document_type='owner_manual'
          AND s.source_type='manufacturer_manual' AND (d.vehicle_id IS NULL OR d.vehicle_id=c.vehicle_id)
          AND d.brand_id=c.brand_id AND (p.id IS NULL OR p.vehicle_id=c.vehicle_id)
        ORDER BY c.model_year_from,d.title,p.trim`, [id]),
    ])
    return { vehicle, schedules, issues, manuals, eligibility: { result: 'needs_dealer_confirmation', message: 'A elegibilidade precisa ser confirmada pela concessionária com o chassi, ano e histórico do veículo.' } }
  }

  async contribute(input) {
    const kinds = ['document_link', 'maintenance_fact', 'known_issue', 'recall', 'warranty', 'dealer_eligibility', 'other']
    if (!input || !kinds.includes(input.kind) || !input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
      throw new Error('invalid_contribution')
    }
    const payload = JSON.stringify(input.payload)
    if (payload.length > 24000) throw new Error('contribution_too_large')
    for (const id of [input.brandId, input.vehicleId]) {
      if (id != null && (!Number.isInteger(Number(id)) || !/^\d+$/.test(String(id)) || Number(id) > 2147483647)) throw new Error('invalid_contribution')
    }
    const id = crypto.randomUUID()
    try {
      await this.pool.query(`INSERT INTO contributions(id,kind,brand_id,vehicle_id,payload_json,contributor_label,submitted_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, input.kind, input.brandId ?? null, input.vehicleId ?? null, payload,
        String(input.contributorLabel || 'contribuição local').slice(0, 80), new Date().toISOString()])
    } catch (error) {
      if (error.code === '23503') throw new Error('invalid_contribution')
      throw error
    }
    return { id, status: 'pending' }
  }
}
