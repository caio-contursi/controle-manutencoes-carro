import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const names = [
  'Abarth','Audi','BMW','BYD','CAOA Chery','Chevrolet','Citroën','Fiat','Ford','GAC',
  'Geely','GWM','Honda','Hyundai','JAC','Jeep','Kia','Land Rover','Leapmotor','Lexus',
  'Mercedes-Benz','Mitsubishi','Nissan','Omoda & Jaecoo','Peugeot','Porsche','RAM','Renault','Toyota','Volkswagen',
]
const fenabraveUrl = 'https://www.fenabrave.org.br/portalv2/Conteudo/Emplacamentos'
const recallUrl = 'https://dados.transportes.gov.br/dataset/recall'
const senatranUrl = 'https://www.gov.br/pt-br/servicos/realizar-consulta-sobre-recall-de-veiculos?id=10560&origem=servico'

export function createCatalog(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const db = new DatabaseSync(filePath)
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;`)
  db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'))
  migrate(db)
  seed(db)
  return db
}

function migrate(db) {
  const version = db.prepare('PRAGMA user_version').get().user_version
  if (version < 1) db.exec('PRAGMA user_version = 1')
}

function seed(db) {
  const addSource = db.prepare(`INSERT INTO sources (organization,title,url,source_type,accessed_on,notes)
    SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM sources WHERE url=?)`)
  const today = new Date().toISOString().slice(0, 10)
  addSource.run('Fenabrave', 'Índices e números: emplacamentos', fenabraveUrl, 'market_report', today, 'Fonte para atualização periódica do conjunto de marcas; não implica ranking individual por si só.', fenabraveUrl)
  addSource.run('Ministério dos Transportes / Senatran', 'Dados abertos de recall de veículos', recallUrl, 'recall_registry', today, 'Dataset público de campanhas de recall; deve ser importado e conciliado antes de orientar um veículo.', recallUrl)
  addSource.run('Senatran', 'Consulta de recall de veículos', senatranUrl, 'recall_registry', today, 'Consulta oficial por placa ou chassi. Confirmação individual deve ser feita no serviço oficial.', senatranUrl)
  const marketSource = db.prepare('SELECT id FROM sources WHERE url=?').get(fenabraveUrl).id
  const recallSource = db.prepare('SELECT id FROM sources WHERE url=?').get(recallUrl).id
  const senatranSource = db.prepare('SELECT id FROM sources WHERE url=?').get(senatranUrl).id
  const brand = db.prepare(`INSERT INTO brands(name,slug,market_scope,coverage_status,roster_source_id)
    VALUES(?,?, 'brazil','roster_only',?) ON CONFLICT(name) DO NOTHING`)
  for (const name of names) brand.run(name, slug(name), marketSource)
  const makeItem = db.prepare('INSERT INTO maintenance_items(code,name,category,description) VALUES(?,?,?,?) ON CONFLICT(code) DO NOTHING')
  for (const [code, title, category] of [
    ['engine-oil','Óleo do motor','lubrification'], ['oil-filter','Filtro de óleo','filter'], ['air-filter','Filtro de ar','filter'],
    ['cabin-filter','Filtro de cabine','filter'], ['brake-fluid','Fluido de freio','fluids'], ['coolant','Líquido de arrefecimento','fluids'],
    ['spark-plugs','Velas de ignição','ignition'], ['timing-belt','Correia dentada','engine'], ['transmission-fluid','Fluido da transmissão','transmission'],
    ['brakes','Sistema de freios','safety'], ['tires','Pneus e rodízio','tires'], ['battery','Bateria','electrical'],
  ]) makeItem.run(code, title, category, 'Item de catálogo; intervalo depende da versão e da fonte oficial aplicável.')
  // Record source association for seeded roster and registry references without importing uncited vehicle claims.
  db.prepare(`INSERT INTO data_reviews(entity_type,entity_id,decision,reviewer,reviewed_at,notes)
    SELECT 'source_registry',?, 'verified','system',?,? WHERE NOT EXISTS(SELECT 1 FROM data_reviews WHERE entity_type='source_registry' AND entity_id=?)`)
    .run(recallSource, today, `Fonte de dados registrada: ${recallUrl}`, recallSource)
  db.prepare(`INSERT INTO data_reviews(entity_type,entity_id,decision,reviewer,reviewed_at,notes)
    SELECT 'source_registry',?, 'verified','system',?,? WHERE NOT EXISTS(SELECT 1 FROM data_reviews WHERE entity_type='source_registry' AND entity_id=?)`)
    .run(senatranSource, today, `Serviço oficial registrado: ${senatranUrl}`, senatranSource)
}

function slug(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function catalogCounts(db) {
  const count = (table, where = '') => db.prepare(`SELECT COUNT(*) AS count FROM ${table} ${where}`).get().count
  return {
    brands: count('brands'), models: count('vehicles', "WHERE status='published'"),
    manuals: count('documents', "WHERE document_type='owner_manual' AND status='verified'"),
    schedules: count('maintenance_schedules', "WHERE review_status='verified'"),
    issues: count('known_issues', "WHERE review_status='verified'"),
    recalls: count('recall_campaigns', "WHERE status='verified'"),
    pendingContributions: count('contributions', "WHERE status='pending'"),
  }
}

export function listBrands(db) {
  return db.prepare(`SELECT b.id,b.name,b.slug,b.coverage_status,
    (SELECT COUNT(*) FROM vehicles v WHERE v.brand_id=b.id AND v.status='published') AS verified_models,
    (SELECT COUNT(*) FROM documents d WHERE d.brand_id=b.id AND d.document_type='owner_manual' AND d.status='verified') AS verified_manuals,
    (SELECT COUNT(*) FROM maintenance_schedules m JOIN vehicles v ON v.id=m.vehicle_id WHERE v.brand_id=b.id AND m.review_status='verified') AS verified_schedules
    FROM brands b ORDER BY b.name`).all()
}

export function searchVehicles(db, query = '') {
  const terms = String(query).slice(0, 100).trim().split(/\s+/).filter(Boolean)
  const searchable = "lower(b.name || ' ' || v.model || ' ' || COALESCE(v.generation,''))"
  const filters = terms.map(() => `AND instr(${searchable}, lower(?)) > 0`).join(' ')
  return db.prepare(`SELECT v.id, b.name AS brand, v.model, v.generation, v.model_year_from, v.model_year_to, v.status
    FROM vehicles v JOIN brands b ON b.id=v.brand_id WHERE v.status='published' ${filters}
    ORDER BY b.name,v.model LIMIT 100`).all(...terms)
}

export function getVerifiedVehicle(db, id) {
  const vehicle = db.prepare(`SELECT v.id,b.name AS brand,v.model,v.generation,v.body_style,v.model_year_from,v.model_year_to,v.market,v.status
    FROM vehicles v JOIN brands b ON b.id=v.brand_id WHERE v.id=? AND v.status='published'`).get(Number(id))
  if (!vehicle) return null
  const schedules = db.prepare(`SELECT mi.name,ms.interval_km,ms.interval_months,ms.applicability,ms.conditions,d.external_url AS manual_url
    FROM maintenance_schedules ms JOIN maintenance_items mi ON mi.id=ms.item_id JOIN documents d ON d.id=ms.document_id
    WHERE ms.vehicle_id=? AND ms.review_status='verified' ORDER BY mi.name`).all(vehicle.id)
  const issues = db.prepare(`SELECT title,component,description,symptom,severity,evidence_type,model_year_from,model_year_to
    FROM known_issues WHERE vehicle_id=? AND review_status='verified' ORDER BY severity,title`).all(vehicle.id)
  return { vehicle, schedules, issues, eligibility: { result: 'needs_dealer_confirmation', message: 'A elegibilidade para revisão ou garantia precisa ser confirmada pela concessionária com o chassi, ano e histórico do veículo.' } }
}

export function submitContribution(db, input) {
  const kinds = new Set(['document_link','maintenance_fact','known_issue','recall','warranty','dealer_eligibility','other'])
  if (!input || !kinds.has(input.kind) || typeof input.payload !== 'object' || input.payload === null || Array.isArray(input.payload)) throw new Error('invalid_contribution')
  const serialized = JSON.stringify(input.payload)
  if (serialized.length > 24000) throw new Error('contribution_too_large')
  if (input.brandId != null && !db.prepare('SELECT 1 FROM brands WHERE id=?').get(input.brandId)) throw new Error('invalid_contribution')
  if (input.vehicleId != null && !db.prepare('SELECT 1 FROM vehicles WHERE id=?').get(input.vehicleId)) throw new Error('invalid_contribution')
  const id = crypto.randomUUID()
  db.prepare(`INSERT INTO contributions(id,kind,brand_id,vehicle_id,payload_json,contributor_label,submitted_at)
    VALUES(?,?,?,?,?,?,?)`).run(id, input.kind, input.brandId ?? null, input.vehicleId ?? null, serialized, String(input.contributorLabel || 'contribuição local').slice(0, 80), new Date().toISOString())
  return { id, status: 'pending' }
}
