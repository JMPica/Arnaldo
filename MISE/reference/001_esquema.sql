-- MISE reference schema (SQLite-compatible). VALIDAR/ADAPTAR en migraciones D1 reales.
-- Las cantidades monetarias se guardan en céntimos INTEGER.
-- Cantidades físicas como TEXT decimales en unidades canónicas para lectura por librería Decimal.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  access_subject TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner' CHECK(role IN ('owner','collaborator')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
  owner_id TEXT PRIMARY KEY REFERENCES app_users(id),
  locale TEXT NOT NULL DEFAULT 'es' CHECK(locale IN ('es','ca')),
  currency TEXT NOT NULL DEFAULT 'EUR',
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  brand_name TEXT NOT NULL DEFAULT 'MISE',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  website TEXT,
  notes TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_suppliers_owner ON suppliers(owner_id,name);
CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  name TEXT NOT NULL,
  category TEXT,
  base_unit TEXT NOT NULL CHECK(base_unit IN ('g','ml','ud')),
  waste_basis_points INTEGER NOT NULL DEFAULT 0 CHECK(waste_basis_points BETWEEN 0 AND 9999),
  allergens_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  preferred_supplier_id TEXT REFERENCES suppliers(id),
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_ing_owner_name ON ingredients(owner_id,name);
CREATE TABLE IF NOT EXISTS purchase_formats (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  supplier_id TEXT REFERENCES suppliers(id),
  label TEXT NOT NULL,
  pack_quantity_base TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  current_pack_price_cents INTEGER NOT NULL CHECK(current_pack_price_cents>=0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_formats_ing ON purchase_formats(ingredient_id,supplier_id);
CREATE TABLE IF NOT EXISTS price_history (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  format_id TEXT NOT NULL REFERENCES purchase_formats(id),
  effective_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pack_price_cents INTEGER NOT NULL CHECK(pack_price_cents>=0),
  pack_quantity_base TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK(source_type IN ('manual','purchase','document','import')),
  source_ref_id TEXT,
  note TEXT
);
CREATE INDEX IF NOT EXISTS ix_prices_format_date ON price_history(format_id,effective_at DESC,recorded_at DESC);
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  name TEXT NOT NULL,
  category TEXT,
  description_es TEXT,
  description_ca TEXT,
  instructions_es TEXT,
  instructions_ca TEXT,
  yield_quantity TEXT NOT NULL,
  yield_unit TEXT NOT NULL CHECK(yield_unit IN ('g','ml','ud','portion')),
  portions TEXT NOT NULL,
  preparation_minutes INTEGER NOT NULL DEFAULT 0 CHECK(preparation_minutes>=0),
  allergens_declared_json TEXT NOT NULL DEFAULT '[]',
  allergens_reviewed_at TEXT,
  allergens_reviewed_by TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_recipes_owner ON recipes(owner_id,name);
CREATE TABLE IF NOT EXISTS recipe_lines (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  ingredient_id TEXT REFERENCES ingredients(id),
  subrecipe_id TEXT REFERENCES recipes(id),
  quantity TEXT NOT NULL,
  unit TEXT NOT NULL CHECK(unit IN ('g','ml','ud','portion')),
  notes TEXT,
  CHECK((ingredient_id IS NOT NULL AND subrecipe_id IS NULL)
    OR (ingredient_id IS NULL AND subrecipe_id IS NOT NULL)),
  UNIQUE(recipe_id, position)
);
CREATE TABLE IF NOT EXISTS menus (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  name TEXT NOT NULL,
  description_es TEXT,
  description_ca TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS menu_lines (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  recipe_id TEXT NOT NULL REFERENCES recipes(id),
  position INTEGER NOT NULL,
  servings_per_guest TEXT NOT NULL DEFAULT '1',
  course_name_es TEXT,
  course_name_ca TEXT,
  dietary_variant TEXT,
  UNIQUE(menu_id, position, dietary_variant)
);
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  display_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes_private TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_clients_owner ON clients(owner_id,display_name);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  menu_id TEXT REFERENCES menus(id),
  title TEXT,
  event_date TEXT NOT NULL,
  event_time TEXT,
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  location_private TEXT,
  guest_count INTEGER NOT NULL CHECK(guest_count>0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','quoted','confirmed','completed','cancelled')),
  price_per_guest_cents INTEGER NOT NULL DEFAULT 0 CHECK(price_per_guest_cents>=0),
  additional_revenue_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK(discount_cents>=0),
  target_margin_basis_points INTEGER NOT NULL DEFAULT 3500 CHECK(target_margin_basis_points>=0 AND target_margin_basis_points<10000),
  notes_private TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_events_owner_date ON events(owner_id,event_date,status);
CREATE TABLE IF NOT EXISTS event_guests (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_reference TEXT,
  guest_count INTEGER NOT NULL DEFAULT 1 CHECK(guest_count>0),
  dietary_notes_private TEXT,
  assigned_menu_variant TEXT
);
CREATE TABLE IF NOT EXISTS event_costs (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK(category IN ('staff','chef_hours','travel','equipment','ingredient','overhead','other')),
  description TEXT,
  amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),
  cost_kind TEXT NOT NULL CHECK(cost_kind IN ('estimated','actual')),
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_event_costs ON event_costs(event_id,cost_kind);
CREATE TABLE IF NOT EXISTS event_snapshots (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  snapshot_kind TEXT NOT NULL CHECK(snapshot_kind IN ('quoted','confirmed','completed','requoted')),
  calculation_version TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_snapshots ON event_snapshots(event_id,created_at DESC);
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  supplier_id TEXT REFERENCES suppliers(id),
  external_reference TEXT,
  purchase_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','ordered','partial','received','cancelled')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS purchase_lines (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  format_id TEXT REFERENCES purchase_formats(id),
  ordered_packs TEXT NOT NULL,
  received_packs TEXT NOT NULL DEFAULT '0',
  pack_price_cents INTEGER NOT NULL CHECK(pack_price_cents>=0),
  line_total_cents INTEGER NOT NULL CHECK(line_total_cents>=0)
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  event_id TEXT REFERENCES events(id),
  purchase_line_id TEXT REFERENCES purchase_lines(id),
  kind TEXT NOT NULL CHECK(kind IN ('opening','receipt','consumption','waste','adjustment','reservation','reservation_release')),
  quantity_base TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS ix_stock_owner_ingredient ON stock_movements(owner_id,ingredient_id,created_at);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  purchase_id TEXT REFERENCES purchases(id),
  filename_original TEXT NOT NULL,
  object_key_private TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes>0),
  source_type TEXT NOT NULL CHECK(source_type IN ('invoice','delivery_note','recipe','other')),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','extracted','reviewed','rejected')),
  extraction_json TEXT,
  reviewed_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_docs_owner_hash ON documents(owner_id,sha256);
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  actor_user_id TEXT REFERENCES app_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_audit_owner_date ON audit_log(owner_id,created_at DESC);
