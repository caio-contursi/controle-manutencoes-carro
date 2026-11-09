import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createCatalog, catalogCounts, listBrands, searchVehicles, getVerifiedVehicle, submitContribution } from '../server/db/catalog.js'

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lembracar-test-'))
  const database = createCatalog(path.join(directory, 'catalog.sqlite'))
  return { database, cleanup() { database.close(); fs.rmSync(directory, { recursive: true, force: true }) } }
}

test('seeds 30 Brazilian-market brands and zero unsourced technical claims', (t) => {
  const f = fixture(); t.after(f.cleanup)
  const counts = catalogCounts(f.database)
  assert.equal(counts.brands, 30)
  assert.equal(counts.models, 0)
  assert.equal(counts.schedules, 0)
  assert.equal(counts.issues, 0)
  assert.equal(listBrands(f.database).every((brand) => brand.coverage_status === 'roster_only'), true)
})

test('keeps unpublished or draft vehicles out of catalog search', (t) => {
  const f = fixture(); t.after(f.cleanup)
  const brandId = f.database.prepare("SELECT id FROM brands WHERE name='Toyota'").get().id
  f.database.prepare('INSERT INTO vehicles(brand_id,model,model_year_from,status) VALUES(?,?,?,?)').run(brandId, 'Corolla Draft', 2025, 'draft')
  assert.deepEqual(searchVehicles(f.database, 'Corolla'), [])
  f.database.prepare("UPDATE vehicles SET status='published' WHERE model='Corolla Draft'").run()
  assert.equal(searchVehicles(f.database, 'Corolla').length, 1)
  assert.equal(searchVehicles(f.database, 'toyota corolla').length, 1)
  assert.deepEqual(searchVehicles(f.database, 'Honda Corolla'), [])
  assert.deepEqual(searchVehicles(f.database, '%'), [])
  const vehicleId = f.database.prepare("SELECT id FROM vehicles WHERE model='Corolla Draft'").get().id
  assert.equal(getVerifiedVehicle(f.database, vehicleId).eligibility.result, 'needs_dealer_confirmation')
})

test('accepts bounded catalog contributions as pending review records', (t) => {
  const f = fixture(); t.after(f.cleanup)
  const contribution = submitContribution(f.database, { kind: 'document_link', payload: { url: 'https://example.test/manual.pdf' }, contributorLabel: 'Caio' })
  assert.equal(contribution.status, 'pending')
  assert.equal(catalogCounts(f.database).pendingContributions, 1)
  assert.throws(() => submitContribution(f.database, { kind: 'unknown', payload: {} }), /invalid_contribution/)
  assert.throws(() => submitContribution(f.database, { kind: 'other', payload: { text: 'x'.repeat(25000) } }), /contribution_too_large/)
})

test('database requires evidence sources for maintenance rules and known issues', (t) => {
  const f = fixture(); t.after(f.cleanup)
  const brandId = f.database.prepare("SELECT id FROM brands WHERE name='Toyota'").get().id
  f.database.prepare('INSERT INTO vehicles(brand_id,model,status) VALUES(?,?,?)').run(brandId, 'Corolla', 'draft')
  const vehicleId = f.database.prepare("SELECT id FROM vehicles WHERE model='Corolla'").get().id
  const itemId = f.database.prepare("SELECT id FROM maintenance_items WHERE code='engine-oil'").get().id
  assert.throws(() => f.database.prepare('INSERT INTO maintenance_schedules(vehicle_id,item_id) VALUES(?,?)').run(vehicleId, itemId))
  assert.throws(() => f.database.prepare("INSERT INTO known_issues(vehicle_id,title,description,evidence_type) VALUES(?,?,?,?)").run(vehicleId, 'Falha', 'Descrição', 'community_report'))
})

test('catalog initialization can be repeated without duplicating brands or sources', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lembracar-migration-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  let db = createCatalog(path.join(directory, 'catalog.sqlite'))
  assert.equal(catalogCounts(db).brands, 30)
  db.close()
  db = createCatalog(path.join(directory, 'catalog.sqlite'))
  assert.equal(catalogCounts(db).brands, 30)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sources').get().count, 3)
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1)
  db.close()
})
