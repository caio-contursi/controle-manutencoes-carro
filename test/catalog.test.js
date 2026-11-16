import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
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
  assert.equal(counts.models, 163)
  assert.equal(counts.manuals, 837)
  assert.equal(f.database.prepare('SELECT COUNT(*) AS count FROM vehicle_manual_coverage').get().count, 880)
  assert.equal(counts.schedules, 0)
  assert.equal(counts.issues, 0)
  assert.equal(listBrands(f.database).filter((brand) => brand.coverage_status === 'partial').length, 11)
})

test('finds new Chevrolet and Fiat manuals and preserves Volkswagen coverage', (t) => {
  const f = fixture(); t.after(f.cleanup)
  const [celta] = searchVehicles(f.database, 'chevrolet celta')
  const celta2010 = celta.manuals.find((manual) => manual.model_year_from === 2010)
  assert.match(celta2010.external_url, /manual-celta-2010\.pdf$/)
  assert.match(celta2010.source_url, /anos-anteriores$/)

  const [argo] = searchVehicles(f.database, 'fiat argo')
  const argo2026 = argo.manuals.find((manual) => manual.model_year_from === 2026 && manual.edition.includes('Fabricação 2025'))
  assert.match(argo2026.edition, /DRIVE/)
  assert.equal(argo2026.source_url, 'https://servicos.fiat.com.br/manuais.html')

  const [gol] = searchVehicles(f.database, 'volkswagen gol')
  assert.ok(gol.manuals.some((manual) => manual.model_year_from === 2023))
  assert.equal(listBrands(f.database).find((brand) => brand.name === 'Volkswagen').verified_manuals, 187)
})

test('returns manuals with their model, year references and original sources', (t) => {
  const f = fixture(); t.after(f.cleanup)
  const [aircross] = searchVehicles(f.database, 'citroën c3 aircross')
  assert.equal(aircross.manuals.length, 1)
  const [manual] = aircross.manuals
  assert.equal(manual.model_year_from, 2024)
  assert.equal(manual.model_year_to, 2025)
  assert.match(manual.external_url, /c3-aircross-2024_2025\.pdf$/)
  assert.equal(manual.source_url, 'https://www.citroen.com.br/meu-citroen/manuais.html')
  assert.deepEqual(getVerifiedVehicle(f.database, aircross.id).manuals, aircross.manuals)
  const [hb20] = searchVehicles(f.database, 'hyundai hb20')
  assert.equal(hb20.manuals.length, 2)
  assert.equal(hb20.manuals.every((entry) => entry.model_year_from === null && entry.model_year_to === null), true)
  const [captur] = searchVehicles(f.database, 'renault captur')
  assert.equal(captur.manuals.some((entry) => entry.model_year_from === 2019), false)
  const [oroch] = searchVehicles(f.database, 'renault oroch')
  assert.equal(oroch.manuals.some((entry) => entry.model_year_from === 2015), false)
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

test('updates an existing version 1 catalog and keeps its records after reopening', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lembracar-migration-'))
  const filePath = path.join(directory, 'catalog.sqlite')
  let db = new DatabaseSync(filePath)
  t.after(() => {
    if (db.isOpen) db.close()
    fs.rmSync(directory, { recursive: true, force: true })
  })
  db.exec(fs.readFileSync(new URL('../server/db/schema.sql', import.meta.url), 'utf8'))
  db.exec('PRAGMA user_version = 1')
  submitContribution(db, { kind: 'document_link', payload: { url: 'https://example.test/source' } })
  db.close()

  db = createCatalog(filePath)
  const counts = catalogCounts(db)
  assert.equal(counts.manuals, 837)
  assert.equal(counts.pendingContributions, 1)
  const sources = db.prepare('SELECT COUNT(*) AS count FROM sources').get().count
  db.close()
  db = createCatalog(filePath)
  assert.deepEqual(catalogCounts(db), counts)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sources').get().count, sources)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM vehicle_manual_coverage').get().count, 880)
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3)
})
