import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'
import { isolatedPostgres } from './postgres-fixture.js'
import { initializeCatalog, catalogCounts, listBrands, searchVehicles, getVerifiedVehicle, submitContribution } from '../server/db/catalog.js'

async function fixture(t, legacyFile) {
  const postgres = await isolatedPostgres()
  const database = new pg.Pool({ connectionString: postgres.connectionString })
  t.after(async () => {
    await database.end()
    await postgres.cleanup()
  })
  await initializeCatalog(database, legacyFile)
  return database
}

test('seeds 30 Brazilian-market brands and zero unsourced technical claims', async (t) => {
  const db = await fixture(t)
  const counts = await catalogCounts(db)
  assert.equal(counts.brands, 30)
  assert.equal(counts.models, 163)
  assert.equal(counts.manuals, 837)
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM vehicle_manual_coverage')).rows[0].count, 880)
  assert.equal(counts.schedules, 0)
  assert.equal(counts.issues, 0)
  assert.equal((await listBrands(db)).filter((brand) => brand.coverage_status === 'partial').length, 11)
})

test('finds new Chevrolet and Fiat manuals and preserves Volkswagen coverage', async (t) => {
  const db = await fixture(t)
  const [celta] = await searchVehicles(db, 'chevrolet celta')
  const celta2010 = celta.manuals.find((manual) => manual.model_year_from === 2010)
  assert.match(celta2010.external_url, /manual-celta-2010\.pdf$/)
  assert.match(celta2010.source_url, /anos-anteriores$/)

  const [argo] = await searchVehicles(db, 'fiat argo')
  const argo2026 = argo.manuals.find((manual) => manual.model_year_from === 2026 && manual.edition.includes('Fabricação 2025'))
  assert.match(argo2026.edition, /DRIVE/)
  assert.equal(argo2026.source_url, 'https://servicos.fiat.com.br/manuais.html')

  const [gol] = await searchVehicles(db, 'volkswagen gol')
  assert.ok(gol.manuals.some((manual) => manual.model_year_from === 2023))
  assert.equal((await listBrands(db)).find((brand) => brand.name === 'Volkswagen').verified_manuals, 187)
})

test('returns manuals with their model, year references and original sources', async (t) => {
  const db = await fixture(t)
  const [aircross] = await searchVehicles(db, 'citroën c3 aircross')
  assert.equal(aircross.manuals.length, 1)
  const [manual] = aircross.manuals
  assert.equal(manual.model_year_from, 2024)
  assert.equal(manual.model_year_to, 2025)
  assert.match(manual.external_url, /c3-aircross-2024_2025\.pdf$/)
  assert.equal(manual.source_url, 'https://www.citroen.com.br/meu-citroen/manuais.html')
  assert.deepEqual((await getVerifiedVehicle(db, aircross.id)).manuals, aircross.manuals)
  const [hb20] = await searchVehicles(db, 'hyundai hb20')
  assert.equal(hb20.manuals.length, 2)
  assert.equal(hb20.manuals.every((entry) => entry.model_year_from === null && entry.model_year_to === null), true)
  const [captur] = await searchVehicles(db, 'renault captur')
  assert.equal(captur.manuals.some((entry) => entry.model_year_from === 2019), false)
  const [oroch] = await searchVehicles(db, 'renault oroch')
  assert.equal(oroch.manuals.some((entry) => entry.model_year_from === 2015), false)
})

test('keeps unpublished or draft vehicles out of catalog search', async (t) => {
  const db = await fixture(t)
  const brandId = (await db.query("SELECT id FROM brands WHERE name='Toyota'")).rows[0].id
  await db.query('INSERT INTO vehicles(brand_id,model,model_year_from,status) VALUES($1,$2,$3,$4)', [brandId, 'Corolla Draft', 2025, 'draft'])
  assert.deepEqual(await searchVehicles(db, 'Corolla'), [])
  await db.query("UPDATE vehicles SET status='published' WHERE model='Corolla Draft'")
  assert.equal((await searchVehicles(db, 'Corolla')).length, 1)
  assert.equal((await searchVehicles(db, 'toyota corolla')).length, 1)
  assert.deepEqual(await searchVehicles(db, 'Honda Corolla'), [])
  assert.deepEqual(await searchVehicles(db, '%'), [])
  const vehicleId = (await db.query("SELECT id FROM vehicles WHERE model='Corolla Draft'")).rows[0].id
  assert.equal((await getVerifiedVehicle(db, vehicleId)).eligibility.result, 'needs_dealer_confirmation')
})

test('accepts bounded catalog contributions as pending review records', async (t) => {
  const db = await fixture(t)
  const contribution = await submitContribution(db, { kind: 'document_link', payload: { url: 'https://example.test/manual.pdf' }, contributorLabel: 'Caio' })
  assert.equal(contribution.status, 'pending')
  assert.equal((await catalogCounts(db)).pendingContributions, 1)
  await assert.rejects(submitContribution(db, { kind: 'unknown', payload: {} }), /invalid_contribution/)
  await assert.rejects(submitContribution(db, { kind: 'other', payload: { text: 'x'.repeat(25000) } }), /contribution_too_large/)
  await assert.rejects(submitContribution(db, { kind: 'other', brandId: 999999, payload: {} }), /invalid_contribution/)
})

test('database requires evidence sources for maintenance rules and known issues', async (t) => {
  const db = await fixture(t)
  const brandId = (await db.query("SELECT id FROM brands WHERE name='Toyota'")).rows[0].id
  await db.query('INSERT INTO vehicles(brand_id,model,status) VALUES($1,$2,$3)', [brandId, 'Corolla', 'draft'])
  const vehicleId = (await db.query("SELECT id FROM vehicles WHERE model='Corolla'")).rows[0].id
  const itemId = (await db.query("SELECT id FROM maintenance_items WHERE code='engine-oil'")).rows[0].id
  await assert.rejects(db.query('INSERT INTO maintenance_schedules(vehicle_id,item_id) VALUES($1,$2)', [vehicleId, itemId]))
  await assert.rejects(db.query("INSERT INTO known_issues(vehicle_id,title,description,evidence_type) VALUES($1,$2,$3,$4)", [vehicleId, 'Falha', 'Descrição', 'community_report']))
})

test('migrates the legacy SQLite catalog once and preserves IDs and relationships', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lembracar-migration-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const file = path.join(directory, 'catalog.sqlite')
  const source = new DatabaseSync(file)
  source.exec(`
    CREATE TABLE sources(id INTEGER PRIMARY KEY,organization TEXT,title TEXT,url TEXT,source_type TEXT,accessed_on TEXT);
    CREATE TABLE brands(id INTEGER PRIMARY KEY,name TEXT,slug TEXT,roster_source_id INTEGER);
    CREATE TABLE vehicles(id INTEGER PRIMARY KEY,brand_id INTEGER,model TEXT,status TEXT);
    CREATE TABLE documents(id INTEGER PRIMARY KEY,brand_id INTEGER,source_id INTEGER,document_type TEXT,title TEXT,external_url TEXT,status TEXT);
    CREATE TABLE vehicle_manual_coverage(id INTEGER PRIMARY KEY,brand_id INTEGER,vehicle_id INTEGER,document_id INTEGER,model_year_from INTEGER);
    CREATE TABLE contributions(id TEXT PRIMARY KEY,kind TEXT,brand_id INTEGER,vehicle_id INTEGER,payload_json TEXT,submitted_at TEXT);
    INSERT INTO sources VALUES(4000,'Fiat','Fonte legada','https://example.test','manufacturer_manual','2026-11-16');
    INSERT INTO brands VALUES(4000,'Fiat','fiat',4000);
    INSERT INTO vehicles VALUES(4000,4000,'Uno Legado','published');
    INSERT INTO documents VALUES(4000,4000,4000,'owner_manual','Manual','https://example.test/manual.pdf','verified');
    INSERT INTO vehicle_manual_coverage VALUES(4000,4000,4000,4000,2006);
    INSERT INTO contributions VALUES('legacy','document_link',4000,4000,'{}','2026-11-16');
  `)
  source.close()

  const db = await fixture(t, file)
  const counts = await catalogCounts(db)
  assert.equal(counts.manuals, 838)
  assert.equal(counts.pendingContributions, 1)
  const [vehicle] = await searchVehicles(db, 'Fiat Uno Legado')
  assert.equal(vehicle.id, 4000)
  assert.equal(vehicle.manuals[0].id, 4000)
  assert.equal(vehicle.manuals[0].source_url, 'https://example.test')
  assert.equal(vehicle.manuals[0].model_year_from, 2006)
  assert.ok((await listBrands(db)).some((brand) => brand.id > 4000))
  await initializeCatalog(db, file)
  assert.deepEqual(await catalogCounts(db), counts)
  const legacy = new DatabaseSync(file, { readOnly: true })
  assert.equal(legacy.prepare('SELECT COUNT(*) AS count FROM documents').get().count, 1)
  legacy.close()
})
