import type { Context } from 'hono';
import type { AppEnv, AuthUser } from './env';
import { ApiError } from './http';

export type Bind = string | number | null | ArrayBuffer;
export type Row = Record<string, unknown>;

export const uuid = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
/** Fecha local Europe/Madrid YYYY-MM-DD */
export const todayMadrid = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export class Db {
  constructor(public d1: D1Database, public user: AuthUser) {}
  get owner() {
    return this.user.owner_id;
  }
  prepare(sql: string, ...params: Bind[]) {
    return this.d1.prepare(sql).bind(...params);
  }
  async all<T = Row>(sql: string, ...params: Bind[]): Promise<T[]> {
    return (await this.prepare(sql, ...params).all<T>()).results;
  }
  async first<T = Row>(sql: string, ...params: Bind[]): Promise<T | null> {
    return (await this.prepare(sql, ...params).first<T>()) ?? null;
  }
  async run(sql: string, ...params: Bind[]) {
    return this.prepare(sql, ...params).run();
  }
  /** Ejecuta sentencias de forma atómica (D1 batch = transacción). */
  async batch(stmts: D1PreparedStatement[]) {
    if (!stmts.length) return [];
    return this.d1.batch(stmts);
  }
  /** Comprueba que una entidad existe y pertenece al propietario autenticado (anti-IDOR). */
  async owned(table: OwnedTable, id: string | null | undefined, opts: { allowArchived?: boolean } = {}): Promise<Row> {
    if (!id) throw new ApiError(404, 'not_found');
    const row = await this.first(`SELECT * FROM ${table} WHERE id = ? AND owner_id = ?`, id, this.owner);
    if (!row) throw new ApiError(404, 'not_found', { entity: table });
    if (!opts.allowArchived && 'archived_at' in row && row.archived_at) throw new ApiError(409, 'archived', { entity: table });
    return row;
  }
  audit(action: string, entity_type: string, entity_id: string | null, metadata?: Record<string, unknown>) {
    return this.prepare(
      'INSERT INTO audit_log (id, owner_id, actor_user_id, action, entity_type, entity_id, metadata_json) VALUES (?,?,?,?,?,?,?)',
      uuid(), this.owner, this.user.id, action, entity_type, entity_id, metadata ? JSON.stringify(metadata).slice(0, 4000) : null,
    );
  }
  /**
   * Inserción masiva parametrizada en UNA sentencia vía json_each (evita el límite de consultas por invocación
   * y nunca interpola valores). owner_id se fuerza desde la identidad del servidor.
   */
  bulkInsert(table: OwnedTable | 'blob_chunks', columns: string[], rows: Row[]): D1PreparedStatement[] {
    const stmts: D1PreparedStatement[] = [];
    const cols = ['owner_id', ...columns.filter((c) => c !== 'owner_id')];
    for (const c of cols) if (!/^[a-z][a-z0-9_]*$/.test(c)) throw new Error('invalid column');
    const select = cols.map((c) => `json_extract(value, '$.${c}')`).join(', ');
    const sql = `INSERT INTO ${table} (${cols.join(', ')}) SELECT ${select} FROM json_each(?)`;
    let chunk: Row[] = [];
    let size = 0;
    const flush = () => {
      if (chunk.length) stmts.push(this.prepare(sql, JSON.stringify(chunk)));
      chunk = [];
      size = 0;
    };
    for (const r of rows) {
      const obj: Row = { owner_id: this.owner };
      for (const c of columns) if (c !== 'owner_id') obj[c] = r[c] ?? null;
      const s = JSON.stringify(obj).length;
      if (size + s > 900_000) flush();
      chunk.push(obj);
      size += s;
    }
    flush();
    return stmts;
  }
}

export const OWNED_TABLES = [
  'suppliers', 'ingredients', 'purchase_formats', 'price_history', 'recipes', 'recipe_lines', 'menus', 'menu_lines',
  'clients', 'events', 'event_guest_groups', 'event_costs', 'event_snapshots', 'documents', 'purchases', 'purchase_lines',
  'stock_movements', 'backups', 'import_runs', 'audit_log',
] as const;
export type OwnedTable = (typeof OWNED_TABLES)[number];

export function getDb(c: Context<AppEnv>) {
  return new Db(c.env.DB, c.get('user'));
}
