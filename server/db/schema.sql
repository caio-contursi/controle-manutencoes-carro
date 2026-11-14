PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  country TEXT,
  market_scope TEXT NOT NULL DEFAULT 'brazil',
  coverage_status TEXT NOT NULL DEFAULT 'roster_only' CHECK (coverage_status IN ('roster_only','partial','verified')),
  roster_source_id INTEGER REFERENCES sources(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY,
  organization TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('market_report','manufacturer_manual','manufacturer_service','recall_registry','official_notice','technical_bulletin','community_report','other')),
  jurisdiction TEXT NOT NULL DEFAULT 'BR',
  published_on TEXT,
  accessed_on TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id),
  model TEXT NOT NULL,
  generation TEXT,
  body_style TEXT,
  model_year_from INTEGER,
  model_year_to INTEGER,
  market TEXT NOT NULL DEFAULT 'BR',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','published','archived')),
  UNIQUE (brand_id, model, generation, model_year_from, model_year_to)
);
CREATE TABLE IF NOT EXISTS powertrains (
  id INTEGER PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  engine_code TEXT,
  displacement_cc INTEGER,
  fuel TEXT,
  transmission TEXT,
  drivetrain TEXT,
  trim TEXT,
  model_year_from INTEGER,
  model_year_to INTEGER,
  UNIQUE (vehicle_id, engine_code, fuel, transmission, trim, model_year_from)
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  source_id INTEGER NOT NULL REFERENCES sources(id),
  document_type TEXT NOT NULL CHECK (document_type IN ('owner_manual','maintenance_schedule','warranty_terms','recall_notice','technical_bulletin','other')),
  title TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  model_year_from INTEGER,
  model_year_to INTEGER,
  external_url TEXT NOT NULL,
  content_hash TEXT,
  status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified','verified','superseded','broken_link')),
  verified_at TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS maintenance_items (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT
);
CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id INTEGER PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  powertrain_id INTEGER REFERENCES powertrains(id),
  document_id INTEGER NOT NULL REFERENCES documents(id),
  source_id INTEGER NOT NULL REFERENCES sources(id),
  item_id INTEGER NOT NULL REFERENCES maintenance_items(id),
  interval_km INTEGER,
  interval_months INTEGER,
  applicability TEXT NOT NULL DEFAULT 'normal' CHECK (applicability IN ('normal','severe','both','conditional')),
  conditions TEXT,
  valid_from_year INTEGER,
  valid_to_year INTEGER,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','verified','rejected','outdated')),
  reviewed_at TEXT,
  UNIQUE (vehicle_id, powertrain_id, item_id, interval_km, interval_months, applicability, valid_from_year)
);
CREATE TABLE IF NOT EXISTS known_issues (
  id INTEGER PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  powertrain_id INTEGER REFERENCES powertrains(id),
  title TEXT NOT NULL,
  component TEXT,
  description TEXT NOT NULL,
  symptom TEXT,
  severity TEXT NOT NULL DEFAULT 'unknown' CHECK (severity IN ('low','moderate','high','safety','unknown')),
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('recall','manufacturer_bulletin','official_notice','independent_study','community_report')),
  source_id INTEGER NOT NULL REFERENCES sources(id),
  model_year_from INTEGER,
  model_year_to INTEGER,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','verified','rejected','outdated')),
  reviewed_at TEXT
);
CREATE TABLE IF NOT EXISTS recall_campaigns (
  id INTEGER PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  source_id INTEGER NOT NULL REFERENCES sources(id),
  campaign_code TEXT,
  title TEXT NOT NULL,
  announced_on TEXT,
  affected_years TEXT,
  component TEXT,
  risk TEXT,
  repair_instructions_url TEXT,
  status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified','verified','closed','superseded')),
  UNIQUE (brand_id, campaign_code)
);
CREATE TABLE IF NOT EXISTS warranty_policies (
  id INTEGER PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  powertrain_id INTEGER REFERENCES powertrains(id),
  source_id INTEGER NOT NULL REFERENCES sources(id),
  document_id INTEGER REFERENCES documents(id),
  policy_name TEXT NOT NULL,
  model_year_from INTEGER,
  model_year_to INTEGER,
  duration_months INTEGER,
  distance_km INTEGER,
  conditions TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','verified','rejected','outdated')),
  verified_at TEXT
);
CREATE TABLE IF NOT EXISTS dealer_eligibility_rules (
  id INTEGER PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  source_id INTEGER NOT NULL REFERENCES sources(id),
  service_type TEXT NOT NULL,
  model_year_from INTEGER,
  model_year_to INTEGER,
  rule_text TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','verified','rejected','outdated'))
);
CREATE TABLE IF NOT EXISTS dealer_services (
  id INTEGER PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id),
  dealer_name TEXT NOT NULL,
  dealer_code TEXT,
  city TEXT,
  state TEXT,
  service_types TEXT NOT NULL DEFAULT '[]',
  source_id INTEGER REFERENCES sources(id),
  verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified','verified','closed'))
);
CREATE TABLE IF NOT EXISTS vehicle_manual_coverage (
  id INTEGER PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  powertrain_id INTEGER REFERENCES powertrains(id),
  document_id INTEGER NOT NULL REFERENCES documents(id),
  model_year_from INTEGER,
  model_year_to INTEGER,
  edition TEXT,
  region TEXT NOT NULL DEFAULT 'BR',
  notes TEXT
);
CREATE TABLE IF NOT EXISTS user_vehicles (
  id TEXT PRIMARY KEY,
  local_ref TEXT NOT NULL UNIQUE,
  brand_id INTEGER REFERENCES brands(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  powertrain_id INTEGER REFERENCES powertrains(id),
  model_year INTEGER,
  registration_region TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vehicle_service_records (
  id TEXT PRIMARY KEY,
  user_vehicle_id TEXT NOT NULL REFERENCES user_vehicles(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES maintenance_items(id),
  title TEXT NOT NULL,
  performed_at TEXT,
  odometer_km INTEGER,
  amount_cents INTEGER,
  invoice_attached INTEGER NOT NULL DEFAULT 0 CHECK (invoice_attached IN (0,1)),
  notes TEXT,
  source_id INTEGER REFERENCES sources(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vehicle_expenses (
  id TEXT PRIMARY KEY,
  user_vehicle_id TEXT NOT NULL REFERENCES user_vehicles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  occurred_at TEXT NOT NULL,
  odometer_km INTEGER,
  quantity_liters REAL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vehicle_reminders (
  id TEXT PRIMARY KEY,
  user_vehicle_id TEXT NOT NULL REFERENCES user_vehicles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_on TEXT,
  due_odometer_km INTEGER,
  notification_state TEXT NOT NULL DEFAULT 'in_app_only' CHECK (notification_state IN ('in_app_only','scheduled','sent','cancelled')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS eligibility_checks (
  id TEXT PRIMARY KEY,
  user_vehicle_ref TEXT NOT NULL,
  rule_id INTEGER REFERENCES dealer_eligibility_rules(id),
  checked_at TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'needs_dealer_confirmation' CHECK (result IN ('needs_dealer_confirmation','likely_eligible','likely_ineligible','confirmed_by_dealer')),
  dealer_name TEXT,
  outcome_note TEXT,
  source_id INTEGER REFERENCES sources(id)
);
CREATE TABLE IF NOT EXISTS contributions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('document_link','maintenance_fact','known_issue','recall','warranty','dealer_eligibility','other')),
  brand_id INTEGER REFERENCES brands(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  payload_json TEXT NOT NULL,
  contributor_label TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','accepted','rejected')),
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewer_note TEXT
);
CREATE TABLE IF NOT EXISTS data_reviews (
  id INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('verified','rejected','outdated')),
  reviewer TEXT NOT NULL,
  reviewed_at TEXT NOT NULL,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS import_batches (
  id INTEGER PRIMARY KEY,
  source_id INTEGER REFERENCES sources(id),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running','completed','failed')),
  rows_read INTEGER NOT NULL DEFAULT 0,
  rows_accepted INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT
);
CREATE INDEX IF NOT EXISTS idx_vehicle_brand_year ON vehicles(brand_id, model_year_from, model_year_to);
CREATE INDEX IF NOT EXISTS idx_schedules_vehicle ON maintenance_schedules(vehicle_id, review_status);
CREATE INDEX IF NOT EXISTS idx_issues_vehicle ON known_issues(vehicle_id, review_status);
CREATE INDEX IF NOT EXISTS idx_recalls_brand ON recall_campaigns(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_brand ON documents(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status, submitted_at);
