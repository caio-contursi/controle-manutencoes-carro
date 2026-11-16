import fs from 'node:fs'
import { importOwnerManuals } from './owner-manuals.js'

import { importLegacyCatalog } from './legacy-catalog.js'

const names = [
  'Abarth','Audi','BMW','BYD','CAOA Chery','Chevrolet','Citroën','Fiat','Ford','GAC',
  'Geely','GWM','Honda','Hyundai','JAC','Jeep','Kia','Land Rover','Leapmotor','Lexus',
  'Mercedes-Benz','Mitsubishi','Nissan','Omoda & Jaecoo','Peugeot','Porsche','RAM','Renault','Toyota','Volkswagen',
]
const fenabraveUrl = 'https://www.fenabrave.org.br/portalv2/Conteudo/Emplacamentos'
const recallUrl = 'https://dados.transportes.gov.br/dataset/recall'
const senatranUrl = 'https://www.gov.br/pt-br/servicos/realizar-consulta-sobre-recall-de-veiculos?id=10560&origem=servico'

export async function initializeCatalog(pool, legacyFile) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(21714, 1)')
    await client.query(`CREATE TABLE IF NOT EXISTS catalog_migrations (
      version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
    const { rowCount } = await client.query('SELECT 1 FROM catalog_migrations WHERE version=1')
    if (!rowCount) {
      await client.query(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))
      await importLegacyCatalog(client, legacyFile)
      await seed(client)
      await importOwnerManuals(client)
      await client.query('INSERT INTO catalog_migrations(version) VALUES(1)')
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function seed(db) {
  const today = new Date().toISOString().slice(0, 10)
  const entries = [
    ['Fenabrave', 'Índices e números: emplacamentos', fenabraveUrl, 'market_report', 'Fonte para atualização periódica do conjunto de marcas; não implica ranking individual por si só.'],
    ['Ministério dos Transportes / Senatran', 'Dados abertos de recall de veículos', recallUrl, 'recall_registry', 'Dataset público de campanhas de recall; deve ser importado e conciliado antes de orientar um veículo.'],
    ['Senatran', 'Consulta de recall de veículos', senatranUrl, 'recall_registry', 'Consulta oficial por placa ou chassi. Confirmação individual deve ser feita no serviço oficial.'],
  ]
  for (const [organization, title, url, type, notes] of entries) {
    await db.query(`INSERT INTO sources(organization,title,url,source_type,accessed_on,notes)
      SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS (SELECT FROM sources WHERE url=$3)`,
    [organization, title, url, type, today, notes])
  }
  const { rows: [marketSource] } = await db.query('SELECT id FROM sources WHERE url=$1 ORDER BY id LIMIT 1', [fenabraveUrl])
  await db.query(`INSERT INTO brands(name,slug,roster_source_id)
    SELECT name, slug, $3 FROM unnest($1::text[], $2::text[]) AS brand(name,slug)
    ORDER BY name ON CONFLICT(name) DO NOTHING`, [names, names.map(slug), marketSource.id])
  for (const [code, title, category] of [
    ['engine-oil','Óleo do motor','lubrification'], ['oil-filter','Filtro de óleo','filter'], ['air-filter','Filtro de ar','filter'],
    ['cabin-filter','Filtro de cabine','filter'], ['brake-fluid','Fluido de freio','fluids'], ['coolant','Líquido de arrefecimento','fluids'],
    ['spark-plugs','Velas de ignição','ignition'], ['timing-belt','Correia dentada','engine'], ['transmission-fluid','Fluido da transmissão','transmission'],
    ['brakes','Sistema de freios','safety'], ['tires','Pneus e rodízio','tires'], ['battery','Bateria','electrical'],
  ]) {
    await db.query(`INSERT INTO maintenance_items(code,name,category,description) VALUES($1,$2,$3,$4)
      ON CONFLICT(code) DO NOTHING`, [code, title, category, 'Item de catálogo; intervalo depende da versão e da fonte oficial aplicável.'])
  }
  for (const [url, label] of [[recallUrl, 'Fonte de dados registrada'], [senatranUrl, 'Serviço oficial registrado']]) {
    await db.query(`INSERT INTO data_reviews(entity_type,entity_id,decision,reviewer,reviewed_at,notes)
      SELECT 'source_registry',s.id,'verified','system',$1,$2 FROM sources s
      WHERE s.url=$3 AND NOT EXISTS (SELECT FROM data_reviews WHERE entity_type='source_registry' AND entity_id=s.id)
      ORDER BY s.id LIMIT 1`, [today, `${label}: ${url}`, url])
  }
}

function slug(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function catalogCounts(db) {
  const { rows: [counts] } = await db.query(`SELECT
    (SELECT count(*) FROM brands) AS brands,
    (SELECT count(*) FROM vehicles WHERE status='published') AS models,
    (SELECT count(*) FROM documents WHERE document_type='owner_manual' AND status='verified') AS manuals,
    (SELECT count(*) FROM maintenance_schedules WHERE review_status='verified') AS schedules,
    (SELECT count(*) FROM known_issues WHERE review_status='verified') AS issues,
    (SELECT count(*) FROM recall_campaigns WHERE status='verified') AS recalls,
    (SELECT count(*) FROM contributions WHERE status='pending') AS "pendingContributions"`)
  return Object.fromEntries(Object.entries(counts).map(([name, count]) => [name, Number(count)]))
}

export async function listBrands(db) {
  const { rows } = await db.query(`SELECT b.id,b.name,b.slug,b.coverage_status,
    (SELECT COUNT(*)::int FROM vehicles v WHERE v.brand_id=b.id AND v.status='published') AS verified_models,
    (SELECT COUNT(*)::int FROM documents d WHERE d.brand_id=b.id AND d.document_type='owner_manual' AND d.status='verified') AS verified_manuals,
    (SELECT COUNT(*)::int FROM maintenance_schedules m JOIN vehicles v ON v.id=m.vehicle_id WHERE v.brand_id=b.id AND m.review_status='verified') AS verified_schedules
    FROM brands b ORDER BY b.name`)
  return rows
}

export async function searchVehicles(db, query = '') {
  const terms = String(query).slice(0, 100).trim().split(/\s+/).filter(Boolean)
  const searchable = "lower(b.name || ' ' || v.model || ' ' || COALESCE(v.generation,''))"
  const filters = terms.map((_, index) => `AND strpos(${searchable}, lower($${index + 1})) > 0`).join(' ')
  const { rows: vehicles } = await db.query(`SELECT v.id,b.name AS brand,v.model,v.generation,v.model_year_from,v.model_year_to,v.status
    FROM vehicles v JOIN brands b ON b.id=v.brand_id WHERE v.status='published' ${filters}
    ORDER BY b.name,v.model LIMIT 100`, terms)
  if (!vehicles.length) return vehicles
  const manuals = await vehicleManuals(db, vehicles.map((vehicle) => vehicle.id))
  return vehicles.map((vehicle) => ({ ...vehicle, manuals: manuals.get(vehicle.id) ?? [] }))
}

async function vehicleManuals(db, vehicleIds) {
  const { rows } = await db.query(`SELECT c.vehicle_id,c.id,d.title,d.external_url,s.url AS source_url,c.model_year_from,c.model_year_to,c.edition,c.notes
    FROM vehicle_manual_coverage c JOIN documents d ON d.id=c.document_id
    JOIN sources s ON s.id=COALESCE(c.source_id,d.source_id)
    WHERE c.vehicle_id=ANY($1::integer[]) AND d.document_type='owner_manual' AND d.status='verified'
    ORDER BY c.vehicle_id,c.model_year_from DESC NULLS LAST,c.model_year_to DESC NULLS LAST,c.id`, [vehicleIds])
  const manuals = new Map()
  for (const { vehicle_id, ...manual } of rows) {
    if (!manuals.has(vehicle_id)) manuals.set(vehicle_id, [])
    manuals.get(vehicle_id).push(manual)
  }
  return manuals
}

export async function getVerifiedVehicle(db, id) {
  const vehicleId = Number(id)
  if (!Number.isInteger(vehicleId) || vehicleId < 1 || vehicleId > 2147483647) return null
  const { rows: [vehicle] } = await db.query(`SELECT v.id,b.name AS brand,v.model,v.generation,v.body_style,v.model_year_from,v.model_year_to,v.market,v.status
    FROM vehicles v JOIN brands b ON b.id=v.brand_id WHERE v.id=$1 AND v.status='published'`, [vehicleId])
  if (!vehicle) return null
  const [{ rows: schedules }, { rows: issues }, manuals] = await Promise.all([
    db.query(`SELECT mi.name,ms.interval_km,ms.interval_months,ms.applicability,ms.conditions,d.external_url AS manual_url
      FROM maintenance_schedules ms JOIN maintenance_items mi ON mi.id=ms.item_id JOIN documents d ON d.id=ms.document_id
      WHERE ms.vehicle_id=$1 AND ms.review_status='verified' ORDER BY mi.name`, [vehicle.id]),
    db.query(`SELECT title,component,description,symptom,severity,evidence_type,model_year_from,model_year_to
      FROM known_issues WHERE vehicle_id=$1 AND review_status='verified' ORDER BY severity,title`, [vehicle.id]),
    vehicleManuals(db, [vehicle.id]),
  ])
  return { vehicle, schedules, issues, manuals: manuals.get(vehicle.id) ?? [], eligibility: { result: 'needs_dealer_confirmation', message: 'A elegibilidade para revisão ou garantia precisa ser confirmada pela concessionária com o chassi, ano e histórico do veículo.' } }
}

export async function submitContribution(db, input) {
  const kinds = new Set(['document_link','maintenance_fact','known_issue','recall','warranty','dealer_eligibility','other'])
  if (!input || !kinds.has(input.kind) || typeof input.payload !== 'object' || input.payload === null || Array.isArray(input.payload)) throw new Error('invalid_contribution')
  const serialized = JSON.stringify(input.payload)
  if (serialized.length > 24000) throw new Error('contribution_too_large')
  for (const id of [input.brandId, input.vehicleId]) {
    if (id != null && (!['number', 'string'].includes(typeof id) || !/^\d+$/.test(String(id)) || Number(id) > 2147483647)) {
      throw new Error('invalid_contribution')
    }
  }
  const id = crypto.randomUUID()
  try {
    await db.query(`INSERT INTO contributions(id,kind,brand_id,vehicle_id,payload_json,contributor_label,submitted_at)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [id, input.kind, input.brandId ?? null, input.vehicleId ?? null, serialized, String(input.contributorLabel || 'contribuição local').slice(0, 80), new Date().toISOString()])
  } catch (error) {
    if (error.code === '23503') throw new Error('invalid_contribution')
    throw error
  }
  return { id, status: 'pending' }
}
