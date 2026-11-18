CREATE TABLE IF NOT EXISTS fipe_owner_manuals (
  brand_code TEXT NOT NULL,
  model TEXT NOT NULL,
  model_year INTEGER NOT NULL CHECK (model_year BETWEEN 1900 AND 2199),
  title TEXT NOT NULL,
  external_url TEXT NOT NULL,
  source TEXT NOT NULL,
  notes TEXT NOT NULL,
  fipe_variants TEXT[] NOT NULL CHECK (cardinality(fipe_variants) > 0),
  PRIMARY KEY (brand_code, model, model_year, external_url)
);
