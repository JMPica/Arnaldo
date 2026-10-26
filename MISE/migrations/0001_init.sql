-- MISE v2 · migración 0001 · esquema inicial de producción (Cloudflare D1 / SQLite)
-- Evoluciona reference/001_esquema.sql. Decisiones (docs/DECISIONES.md ADR-007..ADR-010):
--  * Importes y cantidades se guardan como TEXT decimal canónico ("12.3456") y se operan con Decimal
--    en el dominio; nunca REAL/float. Importes finales se redondean HALF_UP a 2 decimales al presentar.
--  * Todas las tablas de negocio llevan owner_id; el servidor lo deriva de la identidad verificada.
--  * Triggers impiden enlazar entidades de distinto propietario y modificar snapshots confirmados.
PRAGMA foreign_keys = ON;

CREATE TABLE app_users (
  id TEXT PRIMARY KEY,
  access_subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','collaborator')),
  owner_id TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT
);

CREATE TABLE settings (
  owner_id TEXT PRIMARY KEY REFERENCES app_users(id),
  locale TEXT NOT NULL DEFAULT 'es' CHECK (locale IN ('es','ca')),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  brand_name TEXT NOT NULL DEFAULT 'MISE',
  brand_tagline TEXT NOT NULL DEFAULT 'Private Chef',
  contact_line TEXT NOT NULL DEFAULT '',
  default_vat_rate TEXT NOT NULL DEFAULT '10',
  vat_note TEXT NOT NULL DEFAULT 'Tipo de IVA a verificar con asesoría según el servicio.',
  default_target_margin_pct TEXT NOT NULL DEFAULT '35',
  chef_hourly_rate TEXT NOT NULL DEFAULT '0',
  price_alert_threshold_pct TEXT NOT NULL DEFAULT '5',
  proposal_validity_days INTEGER NOT NULL DEFAULT 15,
  proposal_terms TEXT NOT NULL DEFAULT '',
  ai_provider TEXT NOT NULL DEFAULT 'none' CHECK (ai_provider IN ('none')),
  ai_monthly_budget_eur TEXT NOT NULL DEFAULT '0',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  tax_id TEXT,
  notes TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_suppliers_owner ON suppliers(owner_id, name);

CREATE TABLE ingredients (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  name TEXT NOT NULL,
  category TEXT,
  base_unit TEXT NOT NULL CHECK (base_unit IN ('g','ml','ud')),
  waste_pct TEXT NOT NULL DEFAULT '0',
  allergens_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  preferred_supplier_id TEXT REFERENCES suppliers(id),
  preferred_format_id TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_ing_owner_name ON ingredients(owner_id, name);

CREATE TABLE purchase_formats (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  supplier_id TEXT REFERENCES suppliers(id),
  label TEXT NOT NULL,
  supplier_ref TEXT,
  pack_quantity_base TEXT NOT NULL,
  whole_packs_only INTEGER NOT NULL DEFAULT 1 CHECK (whole_packs_only IN (0,1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_formats_ing ON purchase_formats(owner_id, ingredient_id, supplier_id);

-- Historial inmutable: nunca UPDATE; las correcciones son nuevas filas.
CREATE TABLE price_history (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  format_id TEXT NOT NULL REFERENCES purchase_formats(id),
  effective_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  pack_price TEXT NOT NULL,
  pack_quantity_base TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual','purchase','document','import')),
  source_ref_id TEXT,
  note TEXT
);
CREATE INDEX ix_prices_format_date ON price_history(owner_id, format_id, effective_at DESC, recorded_at DESC);

CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  name TEXT NOT NULL,
  category TEXT,
  description_es TEXT,
  description_ca TEXT,
  instructions_es TEXT,
  instructions_ca TEXT,
  techniques TEXT,
  conservation TEXT,
  notes TEXT,
  portions TEXT NOT NULL,
  yield_quantity TEXT,
  yield_unit TEXT CHECK (yield_unit IS NULL OR yield_unit IN ('g','ml','ud')),
  preparation_minutes INTEGER NOT NULL DEFAULT 0 CHECK (preparation_minutes >= 0),
  cooking_minutes INTEGER NOT NULL DEFAULT 0 CHECK (cooking_minutes >= 0),
  allergens_declared_json TEXT NOT NULL DEFAULT '[]',
  allergen_review_hash TEXT,
  allergens_reviewed_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_recipes_owner ON recipes(owner_id, name);

CREATE TABLE recipe_lines (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  ingredient_id TEXT REFERENCES ingredients(id),
  subrecipe_id TEXT REFERENCES recipes(id),
  quantity TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('g','kg','ml','l','ud','portion')),
  notes TEXT,
  CHECK ((ingredient_id IS NOT NULL AND subrecipe_id IS NULL) OR (ingredient_id IS NULL AND subrecipe_id IS NOT NULL)),
  CHECK (subrecipe_id IS NULL OR subrecipe_id <> recipe_id),
  UNIQUE (recipe_id, position)
);
CREATE INDEX ix_recipe_lines_ing ON recipe_lines(owner_id, ingredient_id);
CREATE INDEX ix_recipe_lines_sub ON recipe_lines(owner_id, subrecipe_id);

CREATE TABLE menus (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'tasting' CHECK (kind IN ('tasting','courses')),
  description_es TEXT,
  description_ca TEXT,
  notes TEXT,
  allergen_review_hash TEXT,
  allergens_reviewed_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_menus_owner ON menus(owner_id, name);

-- variant = '' es el plato base del pase; otra variante (p.ej. 'vegetariano') sustituye al base
-- solo para los comensales de ese grupo, de modo que nunca se cuentan dos veces.
CREATE TABLE menu_lines (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 1),
  course_name_es TEXT,
  course_name_ca TEXT,
  recipe_id TEXT NOT NULL REFERENCES recipes(id),
  servings_per_guest TEXT NOT NULL DEFAULT '1',
  variant TEXT NOT NULL DEFAULT '',
  UNIQUE (menu_id, position, variant)
);
CREATE INDEX ix_menu_lines_recipe ON menu_lines(owner_id, recipe_id);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  display_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address_private TEXT,
  dietary_preferences TEXT,
  notes_private TEXT,
  legal_basis TEXT NOT NULL DEFAULT 'precontractual' CHECK (legal_basis IN ('precontractual','contract','consent','legitimate_interest')),
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_clients_owner ON clients(owner_id, display_name);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  menu_id TEXT REFERENCES menus(id),
  title TEXT NOT NULL,
  service_type TEXT NOT NULL DEFAULT 'private_dinner' CHECK (service_type IN ('private_dinner','tasting','celebration','corporate','class','other')),
  event_date TEXT NOT NULL,
  event_time TEXT,
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  location_private TEXT,
  guest_count INTEGER NOT NULL CHECK (guest_count > 0 AND guest_count <= 10000),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','quoted','confirmed','completed','cancelled')),
  price_per_guest TEXT NOT NULL DEFAULT '0',
  additional_revenue TEXT NOT NULL DEFAULT '0',
  discount TEXT NOT NULL DEFAULT '0',
  vat_rate TEXT NOT NULL DEFAULT '10',
  target_margin_pct TEXT NOT NULL DEFAULT '35',
  purchase_date TEXT,
  production_date TEXT,
  instructions TEXT,
  restrictions TEXT,
  notes_private TEXT,
  quoted_at TEXT,
  confirmed_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_events_owner_date ON events(owner_id, event_date, status);
CREATE INDEX ix_events_client ON events(owner_id, client_id);

CREATE TABLE event_guest_groups (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  guest_count INTEGER NOT NULL CHECK (guest_count > 0),
  variant TEXT NOT NULL DEFAULT '',
  dietary_notes_private TEXT
);
CREATE INDEX ix_guest_groups_event ON event_guest_groups(owner_id, event_id);

CREATE TABLE event_costs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('staff','chef_hours','travel','equipment','food','consumables','overhead','other')),
  description TEXT,
  quantity TEXT NOT NULL DEFAULT '1',
  unit_amount TEXT NOT NULL,
  cost_kind TEXT NOT NULL CHECK (cost_kind IN ('estimated','actual')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_event_costs ON event_costs(owner_id, event_id, cost_kind);

CREATE TABLE event_snapshots (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  event_id TEXT NOT NULL REFERENCES events(id),
  snapshot_kind TEXT NOT NULL CHECK (snapshot_kind IN ('quoted','confirmed','requoted','completed')),
  version INTEGER NOT NULL,
  calculation_version TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (event_id, version)
);
CREATE INDEX ix_snapshots ON event_snapshots(owner_id, event_id, version DESC);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  supplier_id TEXT REFERENCES suppliers(id),
  filename_original TEXT NOT NULL,
  blob_key TEXT NOT NULL UNIQUE,
  storage TEXT NOT NULL DEFAULT 'd1' CHECK (storage IN ('d1','r2')),
  sha256 TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  source_type TEXT NOT NULL DEFAULT 'invoice' CHECK (source_type IN ('invoice','delivery_note','receipt','other')),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','extracted','reviewed','rejected')),
  doc_date TEXT,
  doc_reference TEXT,
  extraction_method TEXT CHECK (extraction_method IS NULL OR extraction_method IN ('pdf_text','ocr_local','manual')),
  extraction_json TEXT,
  purchase_id TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (owner_id, sha256)
);
CREATE INDEX ix_docs_owner ON documents(owner_id, created_at DESC);

CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  supplier_id TEXT REFERENCES suppliers(id),
  document_id TEXT REFERENCES documents(id),
  event_id TEXT REFERENCES events(id),
  external_reference TEXT,
  purchase_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('draft','ordered','partial','received','cancelled')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_purchases_owner ON purchases(owner_id, purchase_date DESC);
CREATE INDEX ix_purchases_ref ON purchases(owner_id, supplier_id, external_reference);

CREATE TABLE purchase_lines (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 1,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  format_id TEXT REFERENCES purchase_formats(id),
  description TEXT,
  ordered_packs TEXT NOT NULL,
  received_packs TEXT NOT NULL DEFAULT '0',
  pack_quantity_base TEXT NOT NULL,
  pack_price TEXT NOT NULL,
  price_history_id TEXT REFERENCES price_history(id)
);
CREATE INDEX ix_purchase_lines ON purchase_lines(owner_id, purchase_id);

-- Libro de movimientos append-only. quantity_base siempre positivo salvo 'adjustment' (con signo).
-- Existencias físicas = opening + receipt + adjustment − consumption − waste.
-- Reservado = reservation − reservation_release (no altera existencias físicas).
CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  event_id TEXT REFERENCES events(id),
  purchase_line_id TEXT REFERENCES purchase_lines(id),
  kind TEXT NOT NULL CHECK (kind IN ('opening','receipt','consumption','waste','adjustment','reservation','reservation_release')),
  quantity_base TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (owner_id, idempotency_key)
);
CREATE INDEX ix_stock_owner_ingredient ON stock_movements(owner_id, ingredient_id, occurred_at);
CREATE INDEX ix_stock_event ON stock_movements(owner_id, event_id);

-- Almacén privado de binarios en D1 (troceado < 2 MB por fila). Ver ADR-009.
CREATE TABLE blob_chunks (
  blob_key TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  idx INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (blob_key, idx)
);

CREATE TABLE backups (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  reason TEXT NOT NULL CHECK (reason IN ('pre_import','pre_restore','manual')),
  blob_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  record_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE import_runs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  kind TEXT NOT NULL CHECK (kind IN ('legacy_v1','restore')),
  source_sha256 TEXT NOT NULL,
  backup_id TEXT REFERENCES backups(id),
  summary_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_import_runs ON import_runs(owner_id, source_sha256);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  actor_user_id TEXT REFERENCES app_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_audit_owner_date ON audit_log(owner_id, created_at DESC);

-- ===== Invariantes de propietario (defensa en profundidad además de las comprobaciones del servicio) =====
CREATE TRIGGER trg_recipe_lines_owner BEFORE INSERT ON recipe_lines
BEGIN
  SELECT RAISE(ABORT, 'owner_mismatch') WHERE
    (SELECT owner_id FROM recipes WHERE id = NEW.recipe_id) IS NOT NEW.owner_id
    OR (NEW.ingredient_id IS NOT NULL AND (SELECT owner_id FROM ingredients WHERE id = NEW.ingredient_id) IS NOT NEW.owner_id)
    OR (NEW.subrecipe_id IS NOT NULL AND (SELECT owner_id FROM recipes WHERE id = NEW.subrecipe_id) IS NOT NEW.owner_id);
END;

CREATE TRIGGER trg_menu_lines_owner BEFORE INSERT ON menu_lines
BEGIN
  SELECT RAISE(ABORT, 'owner_mismatch') WHERE
    (SELECT owner_id FROM menus WHERE id = NEW.menu_id) IS NOT NEW.owner_id
    OR (SELECT owner_id FROM recipes WHERE id = NEW.recipe_id) IS NOT NEW.owner_id;
END;

CREATE TRIGGER trg_events_owner_ins BEFORE INSERT ON events
BEGIN
  SELECT RAISE(ABORT, 'owner_mismatch') WHERE
    (SELECT owner_id FROM clients WHERE id = NEW.client_id) IS NOT NEW.owner_id
    OR (NEW.menu_id IS NOT NULL AND (SELECT owner_id FROM menus WHERE id = NEW.menu_id) IS NOT NEW.owner_id);
END;

CREATE TRIGGER trg_events_owner_upd BEFORE UPDATE OF client_id, menu_id, owner_id ON events
BEGIN
  SELECT RAISE(ABORT, 'owner_mismatch') WHERE
    (SELECT owner_id FROM clients WHERE id = NEW.client_id) IS NOT NEW.owner_id
    OR (NEW.menu_id IS NOT NULL AND (SELECT owner_id FROM menus WHERE id = NEW.menu_id) IS NOT NEW.owner_id);
END;

CREATE TRIGGER trg_formats_owner BEFORE INSERT ON purchase_formats
BEGIN
  SELECT RAISE(ABORT, 'owner_mismatch') WHERE
    (SELECT owner_id FROM ingredients WHERE id = NEW.ingredient_id) IS NOT NEW.owner_id
    OR (NEW.supplier_id IS NOT NULL AND (SELECT owner_id FROM suppliers WHERE id = NEW.supplier_id) IS NOT NEW.owner_id);
END;

CREATE TRIGGER trg_purchase_lines_owner BEFORE INSERT ON purchase_lines
BEGIN
  SELECT RAISE(ABORT, 'owner_mismatch') WHERE
    (SELECT owner_id FROM purchases WHERE id = NEW.purchase_id) IS NOT NEW.owner_id
    OR (SELECT owner_id FROM ingredients WHERE id = NEW.ingredient_id) IS NOT NEW.owner_id;
END;

CREATE TRIGGER trg_stock_owner BEFORE INSERT ON stock_movements
BEGIN
  SELECT RAISE(ABORT, 'owner_mismatch') WHERE
    (SELECT owner_id FROM ingredients WHERE id = NEW.ingredient_id) IS NOT NEW.owner_id
    OR (NEW.event_id IS NOT NULL AND (SELECT owner_id FROM events WHERE id = NEW.event_id) IS NOT NEW.owner_id);
END;

-- Historial de precios, movimientos de stock y snapshots son inmutables.
CREATE TRIGGER trg_price_history_immutable BEFORE UPDATE ON price_history
BEGIN SELECT RAISE(ABORT, 'immutable_price_history'); END;

CREATE TRIGGER trg_stock_immutable BEFORE UPDATE ON stock_movements
BEGIN SELECT RAISE(ABORT, 'immutable_stock_movement'); END;

CREATE TRIGGER trg_snapshots_immutable BEFORE UPDATE ON event_snapshots
BEGIN SELECT RAISE(ABORT, 'immutable_snapshot'); END;
