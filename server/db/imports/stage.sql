CREATE TEMP TABLE pilot_stage (
  brand text NOT NULL, model text NOT NULL, model_year integer NOT NULL CHECK (model_year BETWEEN 1900 AND 2100),
  version text NOT NULL, fuel text NOT NULL, transmission text NOT NULL,
  edition text NOT NULL, manual_url text NOT NULL, manual_condition text,
  oil_km integer CHECK (oil_km > 0), oil_months integer CHECK (oil_months > 0), evidence_page text,
  PRIMARY KEY (brand, model, model_year, version, fuel, transmission),
  CHECK (btrim(model) <> '' AND btrim(version) <> '' AND btrim(edition) <> ''),
  CHECK ((oil_km IS NULL AND oil_months IS NULL) OR nullif(btrim(evidence_page), '') IS NOT NULL)
) ON COMMIT DROP;
