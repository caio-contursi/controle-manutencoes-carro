import fs from 'node:fs'

export function importOwnerManuals(db, filename = 'owner-manuals.json') {
  const rows = JSON.parse(fs.readFileSync(new URL(filename, import.meta.url), 'utf8'))
  const startedAt = new Date().toISOString()
  const brand = db.prepare('SELECT id FROM brands WHERE name=?')
  const setPartial = db.prepare("UPDATE brands SET coverage_status='partial' WHERE id=? AND coverage_status='roster_only'")
  const source = db.prepare("SELECT id FROM sources WHERE url=? AND source_type='manufacturer_manual' ORDER BY id LIMIT 1")
  const addSource = db.prepare(`INSERT INTO sources(organization,title,url,source_type,accessed_on)
    VALUES(?, 'Manuais do proprietário', ?, 'manufacturer_manual', ?)`)
  const vehicle = db.prepare(`SELECT id FROM vehicles WHERE brand_id=? AND model=? AND market='BR'
    AND generation IS NULL AND model_year_from IS NULL AND model_year_to IS NULL AND status='published'
    ORDER BY id LIMIT 1`)
  const addVehicle = db.prepare("INSERT INTO vehicles(brand_id,model,status) VALUES(?,?,'published')")
  const document = db.prepare(`SELECT id FROM documents WHERE brand_id=? AND external_url=?
    AND document_type='owner_manual' ORDER BY id LIMIT 1`)
  const addDocument = db.prepare(`INSERT INTO documents(brand_id,source_id,document_type,title,external_url,status,verified_at)
    VALUES(?,?,'owner_manual','Manual do proprietário',?,'verified',?)`)
  const coverage = db.prepare(`SELECT id FROM vehicle_manual_coverage WHERE vehicle_id=? AND document_id=?
    AND model_year_from IS ? AND model_year_to IS ? AND powertrain_id IS NULL AND region='BR'`)
  const addCoverage = db.prepare(`INSERT INTO vehicle_manual_coverage
    (brand_id,vehicle_id,document_id,source_id,model_year_from,model_year_to,edition,notes) VALUES(?,?,?,?,?,?,?,?)`)
  let accepted = 0

  for (const row of rows) {
    const { id: brandId } = brand.get(row.marca)
    const sourceId = source.get(row.url_fonte)?.id ?? addSource.run(row.marca, row.url_fonte, row.verificado_em).lastInsertRowid
    const vehicleId = vehicle.get(brandId, row.modelo)?.id ?? addVehicle.run(brandId, row.modelo).lastInsertRowid
    const documentId = document.get(brandId, row.url_manual)?.id ?? addDocument.run(brandId, sourceId, row.url_manual, row.verificado_em).lastInsertRowid
    const years = /^\d{4}(?:\/\d{4})?$/.test(row.ano_referencia) ? row.ano_referencia.split('/').map(Number) : []
    const firstYear = years[0] ?? null
    const lastYear = years.at(-1) ?? null
    if (coverage.get(vehicleId, documentId, firstYear, lastYear)) continue
    addCoverage.run(brandId, vehicleId, documentId, sourceId, firstYear, lastYear,
      row.edicao_aplicabilidade || null, row.ano_referencia === 'Todos' ? 'Todos os anos na fonte' : null)
    setPartial.run(brandId)
    accepted++
  }
  db.prepare(`INSERT INTO import_batches(started_at,completed_at,status,rows_read,rows_accepted)
    VALUES(?,?,'completed',?,?)`).run(startedAt, new Date().toISOString(), rows.length, accepted)
}
