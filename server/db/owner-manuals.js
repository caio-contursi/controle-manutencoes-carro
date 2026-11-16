import fs from 'node:fs'

export async function importOwnerManuals(client) {
  const files = ['owner-manuals.json', 'owner-manuals-chevrolet-fiat.json']
  const rows = files.flatMap((file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8')))
  const startedAt = new Date().toISOString()

  await client.query(`CREATE TEMP TABLE catalog_seed_manuals ON COMMIT DROP AS
    SELECT seed.*, b.id AS brand_id,
      CASE WHEN ano_referencia ~ '^[0-9]{4}(/[0-9]{4})?$' THEN left(ano_referencia,4)::integer END AS first_year,
      CASE WHEN ano_referencia ~ '^[0-9]{4}(/[0-9]{4})?$' THEN right(ano_referencia,4)::integer END AS last_year
    FROM json_to_recordset($1::json) AS seed(
      marca text, modelo text, ano_referencia text, edicao_aplicabilidade text,
      url_fonte text, url_manual text, verificado_em text)
    JOIN brands b ON b.name=seed.marca`, [JSON.stringify(rows)])

  await client.query(`INSERT INTO sources(organization,title,url,source_type,accessed_on)
    SELECT DISTINCT ON (p.url_fonte) p.marca,'Manuais do proprietário',p.url_fonte,'manufacturer_manual',p.verificado_em
    FROM catalog_seed_manuals p
    WHERE NOT EXISTS (SELECT FROM sources s WHERE s.url=p.url_fonte AND s.source_type='manufacturer_manual')
    ORDER BY p.url_fonte,p.marca,p.verificado_em`)
  await client.query(`INSERT INTO vehicles(brand_id,model,status)
    SELECT DISTINCT p.brand_id,p.modelo,'published' FROM catalog_seed_manuals p
    WHERE NOT EXISTS (SELECT FROM vehicles v WHERE v.brand_id=p.brand_id AND v.model=p.modelo AND v.market='BR'
      AND v.generation IS NULL AND v.model_year_from IS NULL AND v.model_year_to IS NULL AND v.status='published')
    ORDER BY p.brand_id,p.modelo`)
  await client.query(`INSERT INTO documents(brand_id,source_id,document_type,title,external_url,status,verified_at)
    SELECT DISTINCT ON (p.brand_id,p.url_manual) p.brand_id,s.id,'owner_manual','Manual do proprietário',p.url_manual,'verified',p.verificado_em
    FROM catalog_seed_manuals p
    JOIN LATERAL (SELECT id FROM sources WHERE url=p.url_fonte AND source_type='manufacturer_manual' ORDER BY id LIMIT 1) s ON true
    WHERE NOT EXISTS (SELECT FROM documents d WHERE d.brand_id=p.brand_id AND d.external_url=p.url_manual AND d.document_type='owner_manual')
    ORDER BY p.brand_id,p.url_manual,p.url_fonte`)

  const { rowCount } = await client.query(`INSERT INTO vehicle_manual_coverage
    (brand_id,vehicle_id,document_id,source_id,model_year_from,model_year_to,edition,notes)
    SELECT DISTINCT ON (v.id,d.id,p.first_year,p.last_year) p.brand_id,v.id,d.id,s.id,p.first_year,p.last_year,
      NULLIF(p.edicao_aplicabilidade,''),CASE WHEN p.ano_referencia='Todos' THEN 'Todos os anos na fonte' END
    FROM catalog_seed_manuals p
    JOIN LATERAL (SELECT id FROM sources WHERE url=p.url_fonte AND source_type='manufacturer_manual' ORDER BY id LIMIT 1) s ON true
    JOIN LATERAL (SELECT id FROM vehicles WHERE brand_id=p.brand_id AND model=p.modelo AND market='BR'
      AND generation IS NULL AND model_year_from IS NULL AND model_year_to IS NULL AND status='published' ORDER BY id LIMIT 1) v ON true
    JOIN LATERAL (SELECT id FROM documents WHERE brand_id=p.brand_id AND external_url=p.url_manual AND document_type='owner_manual' ORDER BY id LIMIT 1) d ON true
    WHERE NOT EXISTS (SELECT FROM vehicle_manual_coverage c WHERE c.vehicle_id=v.id AND c.document_id=d.id
      AND c.model_year_from IS NOT DISTINCT FROM p.first_year AND c.model_year_to IS NOT DISTINCT FROM p.last_year
      AND c.powertrain_id IS NULL AND c.region='BR')
    ORDER BY v.id,d.id,p.first_year,p.last_year,p.url_fonte`)

  await client.query(`UPDATE brands b SET coverage_status='partial' WHERE b.coverage_status='roster_only'
    AND EXISTS (SELECT FROM catalog_seed_manuals p WHERE p.brand_id=b.id)`)
  if (rowCount) await client.query(`INSERT INTO import_batches(started_at,completed_at,status,rows_read,rows_accepted)
    VALUES($1,$2,'completed',$3,$4)`, [startedAt, new Date().toISOString(), rows.length, rowCount])
}
