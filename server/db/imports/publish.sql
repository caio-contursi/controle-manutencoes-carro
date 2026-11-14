DO $$
DECLARE
  row record;
  brand_key integer;
  source_key integer;
  vehicle_key integer;
  version_key integer;
  document_key integer;
  oil_key integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pilot_stage) THEN RAISE EXCEPTION 'CSV vazio'; END IF;
  SELECT id INTO STRICT oil_key FROM maintenance_items WHERE code = 'engine-oil';
  FOR row IN SELECT * FROM pilot_stage LOOP
    SELECT id INTO STRICT brand_key FROM brands WHERE slug = row.brand;
    IF NOT (
      (row.brand = 'fiat' AND row.manual_url LIKE 'https://servicos.fiat.com.br/%') OR
      (row.brand = 'volkswagen' AND row.manual_url LIKE 'https://www.vw.com.br/%')
    ) THEN RAISE EXCEPTION 'URL de manual fora das origens autorizadas para %', row.brand; END IF;

    INSERT INTO vehicles (brand_id, model, model_year_from, model_year_to, status)
    VALUES (brand_key, row.model, row.model_year, row.model_year, 'published')
    ON CONFLICT (brand_id, model, generation, model_year_from, model_year_to)
    DO UPDATE SET status = 'published' RETURNING id INTO vehicle_key;

    INSERT INTO powertrains (vehicle_id, trim, fuel, transmission, model_year_from, model_year_to)
    VALUES (vehicle_key, row.version, row.fuel, row.transmission, row.model_year, row.model_year)
    ON CONFLICT (vehicle_id, engine_code, fuel, transmission, trim, model_year_from)
    DO UPDATE SET model_year_to = EXCLUDED.model_year_to RETURNING id INTO version_key;

    SELECT id INTO source_key FROM sources WHERE url = row.manual_url AND source_type = 'manufacturer_manual' ORDER BY id LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO sources (organization, title, url, source_type, accessed_on)
      SELECT name, 'Manual ' || row.model || ' ' || row.model_year, row.manual_url, 'manufacturer_manual', CURRENT_DATE::text
      FROM brands WHERE id = brand_key RETURNING id INTO source_key;
    END IF;

    SELECT id INTO document_key FROM documents
    WHERE vehicle_id = vehicle_key AND external_url = row.manual_url AND document_type = 'owner_manual' ORDER BY id LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO documents (brand_id, vehicle_id, source_id, document_type, title, model_year_from, model_year_to, external_url, status, verified_at)
      VALUES (brand_key, vehicle_key, source_key, 'owner_manual', 'Manual ' || row.model || ' ' || row.model_year, row.model_year, row.model_year,
              row.manual_url, 'verified', CURRENT_TIMESTAMP::text) RETURNING id INTO document_key;
    END IF;

    INSERT INTO vehicle_manual_coverage (brand_id, vehicle_id, powertrain_id, document_id, model_year_from, model_year_to, edition, notes)
    SELECT brand_key, vehicle_key, version_key, document_key, row.model_year, row.model_year, row.edition, row.manual_condition
    WHERE NOT EXISTS (SELECT 1 FROM vehicle_manual_coverage WHERE powertrain_id = version_key AND document_id = document_key AND model_year_from = row.model_year);

    IF row.oil_km IS NOT NULL OR row.oil_months IS NOT NULL THEN
      INSERT INTO maintenance_schedules (vehicle_id, powertrain_id, document_id, source_id, item_id, interval_km, interval_months,
                                         conditions, valid_from_year, valid_to_year, review_status, reviewed_at, evidence_page)
      SELECT vehicle_key, version_key, document_key, source_key, oil_key, row.oil_km, row.oil_months,
             'Vale o limite que ocorrer primeiro. Para uso severo, consulte o capítulo D do manual.', row.model_year, row.model_year,
             'verified', CURRENT_TIMESTAMP::text, row.evidence_page
      WHERE NOT EXISTS (SELECT 1 FROM maintenance_schedules WHERE powertrain_id = version_key AND item_id = oil_key AND document_id = document_key);
    END IF;

    UPDATE brands SET coverage_status = 'partial' WHERE id = brand_key AND coverage_status = 'roster_only';
  END LOOP;
  INSERT INTO import_batches (started_at, completed_at, status, rows_read, rows_accepted)
  SELECT CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text, 'completed', count(*), count(*) FROM pilot_stage;
END $$;
