import type { Db, Row } from '../db';
import { uuid } from '../db';
import { ApiError } from '../http';

/** Columnas exportables por tabla (orden = orden de inserción respetando claves foráneas). */
export const BACKUP_TABLES: Record<string, string[]> = {
  suppliers: ['id', 'name', 'contact_name', 'email', 'phone', 'website', 'tax_id', 'notes', 'archived_at', 'created_at', 'updated_at'],
  ingredients: ['id', 'name', 'category', 'base_unit', 'waste_pct', 'allergens_json', 'notes', 'preferred_supplier_id', 'preferred_format_id', 'archived_at', 'created_at', 'updated_at'],
  purchase_formats: ['id', 'ingredient_id', 'supplier_id', 'label', 'supplier_ref', 'pack_quantity_base', 'whole_packs_only', 'is_active', 'created_at', 'updated_at'],
  price_history: ['id', 'format_id', 'effective_at', 'recorded_at', 'pack_price', 'pack_quantity_base', 'source_type', 'source_ref_id', 'note'],
  recipes: ['id', 'name', 'category', 'description_es', 'description_ca', 'instructions_es', 'instructions_ca', 'techniques', 'conservation', 'notes', 'portions', 'yield_quantity', 'yield_unit', 'preparation_minutes', 'cooking_minutes', 'allergens_declared_json', 'allergen_review_hash', 'allergens_reviewed_at', 'version', 'archived_at', 'created_at', 'updated_at'],
  recipe_lines: ['id', 'recipe_id', 'position', 'ingredient_id', 'subrecipe_id', 'quantity', 'unit', 'notes'],
  menus: ['id', 'name', 'kind', 'description_es', 'description_ca', 'notes', 'allergen_review_hash', 'allergens_reviewed_at', 'version', 'archived_at', 'created_at', 'updated_at'],
  menu_lines: ['id', 'menu_id', 'position', 'course_name_es', 'course_name_ca', 'recipe_id', 'servings_per_guest', 'variant'],
  clients: ['id', 'display_name', 'email', 'phone', 'address_private', 'dietary_preferences', 'notes_private', 'legal_basis', 'archived_at', 'created_at', 'updated_at'],
  events: ['id', 'client_id', 'menu_id', 'title', 'service_type', 'event_date', 'event_time', 'timezone', 'location_private', 'guest_count', 'status', 'price_per_guest', 'additional_revenue', 'discount', 'vat_rate', 'target_margin_pct', 'purchase_date', 'production_date', 'instructions', 'restrictions', 'notes_private', 'quoted_at', 'confirmed_at', 'completed_at', 'cancelled_at', 'archived_at', 'created_at', 'updated_at'],
  event_guest_groups: ['id', 'event_id', 'label', 'guest_count', 'variant', 'dietary_notes_private'],
  event_costs: ['id', 'event_id', 'category', 'description', 'quantity', 'unit_amount', 'cost_kind', 'created_at'],
  event_snapshots: ['id', 'event_id', 'snapshot_kind', 'version', 'calculation_version', 'snapshot_json', 'sha256', 'created_at'],
  documents: ['id', 'supplier_id', 'filename_original', 'blob_key', 'storage', 'sha256', 'mime_type', 'size_bytes', 'source_type', 'review_status', 'doc_date', 'doc_reference', 'extraction_method', 'extraction_json', 'purchase_id', 'reviewed_at', 'reviewed_by', 'created_at'],
  purchases: ['id', 'supplier_id', 'document_id', 'event_id', 'external_reference', 'purchase_date', 'status', 'notes', 'created_at', 'updated_at'],
  purchase_lines: ['id', 'purchase_id', 'position', 'ingredient_id', 'format_id', 'description', 'ordered_packs', 'received_packs', 'pack_quantity_base', 'pack_price', 'price_history_id'],
  stock_movements: ['id', 'ingredient_id', 'event_id', 'purchase_line_id', 'kind', 'quantity_base', 'idempotency_key', 'occurred_at', 'notes', 'created_at'],
  audit_log: ['id', 'actor_user_id', 'action', 'entity_type', 'entity_id', 'metadata_json', 'created_at'],
};
export const SETTINGS_COLS = ['locale', 'brand_name', 'brand_tagline', 'contact_line', 'default_vat_rate', 'vat_note', 'default_target_margin_pct', 'chef_hourly_rate', 'price_alert_threshold_pct', 'proposal_validity_days', 'proposal_terms'];

export const BACKUP_FORMAT = 'mise-backup';
export const BACKUP_SCHEMA_VERSION = 1;

export async function sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const h = await crypto.subtle.digest('SHA-256', buf as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// ───────────── Almacén privado de binarios (D1 troceado) ─────────────
export const CHUNK = 1_500_000;

export function blobPutStmts(db: Db, key: string, bytes: Uint8Array): D1PreparedStatement[] {
  const stmts: D1PreparedStatement[] = [];
  for (let i = 0, idx = 0; i < bytes.length; i += CHUNK, idx++) {
    const part = bytes.slice(i, i + CHUNK);
    stmts.push(db.prepare('INSERT INTO blob_chunks (blob_key, owner_id, idx, data) VALUES (?,?,?,?)', key, db.owner, idx, part.buffer as ArrayBuffer));
  }
  return stmts;
}

export async function blobGet(db: Db, key: string): Promise<Uint8Array | null> {
  const rows = await db.all<{ data: ArrayBuffer | number[] }>('SELECT data FROM blob_chunks WHERE blob_key = ? AND owner_id = ? ORDER BY idx', key, db.owner);
  if (!rows.length) return null;
  const parts = rows.map((r) => (r.data instanceof ArrayBuffer ? new Uint8Array(r.data) : new Uint8Array(r.data as number[])));
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// ───────────── Exportación ─────────────
export async function exportAll(db: Db, opts: { includeFiles: boolean; appVersion: string }) {
  const names = Object.keys(BACKUP_TABLES);
  const results = await db.batch([
    ...names.map((t) => db.prepare(`SELECT ${BACKUP_TABLES[t]!.join(', ')} FROM ${t} WHERE owner_id = ?`, db.owner)),
    db.prepare(`SELECT ${SETTINGS_COLS.join(', ')} FROM settings WHERE owner_id = ?`, db.owner),
  ]);
  const tables: Record<string, Row[]> = {};
  names.forEach((t, i) => { tables[t] = results[i]!.results as Row[]; });
  const settings = (results[names.length]!.results[0] as Row) ?? null;
  const files: Record<string, string> = {};
  const missing: string[] = [];
  if (opts.includeFiles) {
    for (const d of tables.documents ?? []) {
      const bytes = await blobGet(db, String(d.blob_key));
      if (bytes) files[String(d.blob_key)] = toB64(bytes);
      else missing.push(String(d.id));
    }
  }
  const payload = { tables, settings };
  const checksum = await sha256Hex(JSON.stringify(payload));
  return {
    format: BACKUP_FORMAT,
    schema_version: BACKUP_SCHEMA_VERSION,
    app_version: opts.appVersion,
    exported_at: new Date().toISOString(),
    counts: Object.fromEntries(names.map((t) => [t, tables[t]!.length])),
    checksum_sha256: checksum,
    files_included: opts.includeFiles,
    files_missing: missing,
    ...payload,
    files: opts.includeFiles ? files : undefined,
  };
}

export async function storeBackup(db: Db, reason: 'pre_import' | 'pre_restore' | 'manual') {
  const data = await exportAll(db, { includeFiles: false, appVersion: 'server' });
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  const id = uuid();
  const key = `backup/${id}`;
  const count = Object.values(data.counts).reduce((a, b) => a + b, 0);
  await db.batch([
    ...blobPutStmts(db, key, bytes),
    db.prepare('INSERT INTO backups (id, owner_id, reason, blob_key, sha256, size_bytes, record_count) VALUES (?,?,?,?,?,?,?)', id, db.owner, reason, key, await sha256Hex(bytes), bytes.length, count),
  ]);
  return { id, record_count: count, sha256: data.checksum_sha256 };
}

// ───────────── Restauración ─────────────
export interface BackupValidation {
  ok: boolean;
  errors: string[];
  counts: Record<string, number>;
  checksum_ok: boolean;
  files: { included: number; missing_documents: number };
}

export async function validateBackup(raw: unknown): Promise<BackupValidation> {
  const errors: string[] = [];
  const b = raw as Record<string, any>;
  if (!b || typeof b !== 'object') return { ok: false, errors: ['not_an_object'], counts: {}, checksum_ok: false, files: { included: 0, missing_documents: 0 } };
  if (b.format !== BACKUP_FORMAT) errors.push('unknown_format');
  if (b.schema_version !== BACKUP_SCHEMA_VERSION) errors.push(`unsupported_schema_version:${String(b.schema_version)}`);
  if (!b.tables || typeof b.tables !== 'object') errors.push('missing_tables');
  const counts: Record<string, number> = {};
  if (!errors.length) {
    for (const t of Object.keys(BACKUP_TABLES)) {
      const arr = b.tables[t];
      if (arr === undefined) { counts[t] = 0; continue; }
      if (!Array.isArray(arr) || arr.length > 50_000) { errors.push(`invalid_table:${t}`); continue; }
      if (arr.some((r: unknown) => !r || typeof r !== 'object' || typeof (r as Row).id !== 'string')) errors.push(`invalid_rows:${t}`);
      counts[t] = arr.length;
    }
    for (const t of Object.keys(b.tables)) if (!BACKUP_TABLES[t]) errors.push(`unknown_table:${t}`);
  }
  let checksum_ok = false;
  if (!errors.length) checksum_ok = (await sha256Hex(JSON.stringify({ tables: b.tables, settings: b.settings ?? null }))) === b.checksum_sha256;
  if (!errors.length && !checksum_ok) errors.push('checksum_mismatch');
  const files = b.files && typeof b.files === 'object' ? Object.keys(b.files).length : 0;
  const docs = Array.isArray(b.tables?.documents) ? b.tables.documents.length : 0;
  return { ok: errors.length === 0, errors, counts, checksum_ok, files: { included: files, missing_documents: Math.max(0, docs - files) } };
}

/** Sustituye TODOS los datos del propietario por los del backup en una única transacción (batch). */
/**
 * `knownUsers`: usuarios de esta instalación. Una copia hecha en otra instalación (otro ordenador, o local → Cloudflare)
 * trae ids de usuario que aquí no existen: owner_id lo fuerza bulkInsert y el autor de la auditoría pasa a null.
 */
export function restoreStatements(db: Db, b: Record<string, any>, knownUsers: ReadonlySet<string>): D1PreparedStatement[] {
  const order = Object.keys(BACKUP_TABLES);
  const stmts: D1PreparedStatement[] = [];
  // borrado en orden inverso de dependencias
  stmts.push(db.prepare("DELETE FROM blob_chunks WHERE owner_id = ? AND blob_key NOT LIKE 'backup/%'", db.owner));
  for (const t of [...order].reverse()) stmts.push(db.prepare(`DELETE FROM ${t} WHERE owner_id = ?`, db.owner));
  for (const t of order) {
    let rows = (b.tables[t] ?? []) as Row[];
    if (t === 'audit_log') rows = rows.map((r) => (r.actor_user_id && !knownUsers.has(String(r.actor_user_id)) ? { ...r, actor_user_id: null } : r));
    stmts.push(...db.bulkInsert(t as never, BACKUP_TABLES[t]!, rows));
  }
  if (b.settings && typeof b.settings === 'object') {
    const s = b.settings as Row;
    const cols = SETTINGS_COLS.filter((c) => s[c] !== undefined && s[c] !== null);
    if (cols.length) stmts.push(db.prepare(`UPDATE settings SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE owner_id = ?`, ...cols.map((c) => s[c] as string | number), db.owner));
  }
  for (const [key, b64] of Object.entries((b.files ?? {}) as Record<string, string>)) {
    if (typeof b64 !== 'string' || !/^[\w/.-]+$/.test(key)) throw new ApiError(422, 'invalid_file_entry');
    stmts.push(...blobPutStmts(db, key, fromB64(b64)));
  }
  return stmts;
}
