import { Hono } from 'hono';
import { serializeDecimals } from '../../shared/costing';
import { toCsv, type CsvColumn } from '../../shared/csv';
import { dec } from '../../shared/decimal';
import { parseLegacyJson, planLegacyImport } from '../../shared/legacy';
import { getDb, nowIso, todayMadrid, uuid, type Db, type Row } from '../db';
import type { AppEnv } from '../env';
import { ApiError, readJson } from '../http';
import { BACKUP_TABLES, blobGet, exportAll, restoreStatements, sha256Hex, storeBackup, validateBackup } from '../services/backup';
import { loadCatalog } from '../services/catalog';
import { buildSnapshot, loadEventBundles } from '../services/events';
import { profitabilityRows } from './insights';

export const data = new Hono<AppEnv>();
export const APP_VERSION = '2.0.0';

// ───────────── Copia de seguridad JSON (descarga autenticada) ─────────────
data.get('/exports/backup.json', async (c) => {
  const db = getDb(c);
  const includeFiles = c.req.query('files') === '1';
  const backup = await exportAll(db, { includeFiles, appVersion: APP_VERSION });
  await db.batch([db.audit('export_backup', 'backup', null, { includeFiles, counts: backup.counts })]);
  const name = `MISE_backup_${todayMadrid()}.json`;
  return new Response(JSON.stringify(backup), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' },
  });
});

data.get('/backups', async (c) => {
  const db = getDb(c);
  return c.json(await db.all('SELECT id, reason, sha256, size_bytes, record_count, created_at FROM backups WHERE owner_id = ? ORDER BY created_at DESC LIMIT 50', db.owner));
});
data.post('/backups', async (c) => {
  const db = getDb(c);
  const r = await storeBackup(db, 'manual');
  await db.batch([db.audit('backup_server', 'backup', r.id)]);
  return c.json(r, 201);
});
data.get('/backups/:id/download', async (c) => {
  const db = getDb(c);
  const b = await db.owned('backups', c.req.param('id'));
  const bytes = await blobGet(db, String(b.blob_key));
  if (!bytes) throw new ApiError(404, 'not_found');
  return new Response(bytes as Uint8Array<ArrayBuffer>, { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="MISE_backup_servidor_${String(b.created_at).slice(0, 10)}.json"`, 'cache-control': 'no-store' } });
});

// ───────────── Restauración (vista previa + confirmación explícita + backup previo) ─────────────
data.post('/restore/preview', async (c) => {
  const db = getDb(c);
  const raw = await readJson(c, 50_000_000);
  const v = await validateBackup(raw);
  const current: Record<string, number> = {};
  const res = await db.batch(Object.keys(BACKUP_TABLES).map((t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE owner_id = ?`, db.owner)));
  Object.keys(BACKUP_TABLES).forEach((t, i) => { current[t] = Number((res[i]!.results[0] as Row).n); });
  return c.json({ ...v, current_counts: current });
});

data.post('/restore/commit', async (c) => {
  const db = getDb(c);
  const raw = (await readJson(c, 50_000_000)) as { backup?: unknown; confirm?: string };
  if (raw.confirm !== 'RESTAURAR') throw new ApiError(422, 'explicit_confirmation_required');
  const v = await validateBackup(raw.backup);
  if (!v.ok) throw new ApiError(422, 'invalid_backup', v.errors);
  const pre = await storeBackup(db, 'pre_restore');
  const stmts = restoreStatements(db, raw.backup as Record<string, any>);
  try {
    await db.batch([...stmts, db.audit('restore', 'backup', pre.id, { counts: v.counts })]);
  } catch (e) {
    // La transacción se revierte entera; los datos previos siguen intactos.
    throw new ApiError(422, 'restore_failed_rolled_back', { reason: e instanceof Error ? e.message.slice(0, 200) : 'unknown', pre_restore_backup: pre.id });
  }
  const res = await db.batch(Object.keys(BACKUP_TABLES).map((t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE owner_id = ?`, db.owner)));
  const after: Record<string, number> = {};
  Object.keys(BACKUP_TABLES).forEach((t, i) => { after[t] = Number((res[i]!.results[0] as Row).n); });
  const mismatches = Object.keys(BACKUP_TABLES).filter((t) => t !== 'audit_log' && after[t] !== v.counts[t]);
  await db.run('INSERT INTO import_runs (id, owner_id, kind, source_sha256, backup_id, summary_json) VALUES (?,?,?,?,?,?)', uuid(), db.owner, 'restore', String((raw.backup as Row).checksum_sha256), pre.id, JSON.stringify({ counts: after }));
  return c.json({ restored: true, pre_restore_backup: pre.id, counts: after, mismatches, files_missing_documents: v.files.missing_documents });
});

// ───────────── Importación segura del backup v1 ─────────────
async function existingCatalog(db: Db) {
  const [s, i, cl, r, m] = await db.batch([
    db.prepare('SELECT id, name FROM suppliers WHERE owner_id = ?', db.owner),
    db.prepare('SELECT id, name FROM ingredients WHERE owner_id = ?', db.owner),
    db.prepare('SELECT id, display_name FROM clients WHERE owner_id = ?', db.owner),
    db.prepare('SELECT id, name FROM recipes WHERE owner_id = ?', db.owner),
    db.prepare('SELECT id, name FROM menus WHERE owner_id = ?', db.owner),
  ]);
  return { suppliers: s!.results as any[], ingredients: i!.results as any[], clients: cl!.results as any[], recipes: r!.results as any[], menus: m!.results as any[] };
}

async function legacyPlan(db: Db, text: string) {
  const parsed = parseLegacyJson(text);
  if (parsed.error) return { result: { ok: false, errors: [{ path: '', message: parsed.error }], warnings: [], demo: false, source_counts: {}, plan: null }, sha: '' };
  const result = planLegacyImport(parsed.data, await existingCatalog(db), { newId: uuid, today: todayMadrid(), strategy: 'merge' });
  return { result, sha: await sha256Hex(text) };
}

data.post('/imports/legacy/preview', async (c) => {
  const db = getDb(c);
  const raw = (await readJson(c, 6_000_000)) as { json?: string };
  if (typeof raw.json !== 'string') throw new ApiError(422, 'json_text_required');
  const { result, sha } = await legacyPlan(db, raw.json);
  const previous = sha ? await db.first('SELECT id, created_at FROM import_runs WHERE owner_id = ? AND kind = ? AND source_sha256 = ?', db.owner, 'legacy_v1', sha) : null;
  return c.json({ ok: result.ok, errors: result.errors, warnings: result.warnings, demo: result.demo, source_counts: result.source_counts, to_create: result.plan?.counts ?? null, reused: result.plan?.reused ?? null, already_imported: previous, source_sha256: sha });
});

data.post('/imports/legacy/commit', async (c) => {
  const db = getDb(c);
  const raw = (await readJson(c, 6_000_000)) as { json?: string; confirm?: boolean; accept_demo?: boolean; allow_reimport?: boolean };
  if (typeof raw.json !== 'string') throw new ApiError(422, 'json_text_required');
  if (raw.confirm !== true) throw new ApiError(422, 'explicit_confirmation_required');
  const { result, sha } = await legacyPlan(db, raw.json);
  if (!result.ok || !result.plan) throw new ApiError(422, 'invalid_legacy_backup', result.errors);
  if (result.demo && !raw.accept_demo) throw new ApiError(422, 'demo_data_requires_acceptance');
  const previous = await db.first('SELECT id FROM import_runs WHERE owner_id = ? AND kind = ? AND source_sha256 = ?', db.owner, 'legacy_v1', sha);
  if (previous && !raw.allow_reimport) throw new ApiError(409, 'already_imported', { import_run: previous.id });
  const pre = await storeBackup(db, 'pre_import');
  const t = result.plan.tables;
  const cols = (name: string) => [...new Set((t[name] ?? []).flatMap((r) => Object.keys(r)))];
  const order = ['suppliers', 'ingredients', 'purchase_formats', 'price_history', 'recipes', 'recipe_lines', 'menus', 'menu_lines', 'clients', 'events', 'event_costs', 'stock_movements'];
  const stmts: D1PreparedStatement[] = [];
  for (const name of order) if ((t[name] ?? []).length) stmts.push(...db.bulkInsert(name as never, cols(name), t[name]!));
  const runId = uuid();
  stmts.push(db.prepare('INSERT INTO import_runs (id, owner_id, kind, source_sha256, backup_id, summary_json) VALUES (?,?,?,?,?,?)', runId, db.owner, 'legacy_v1', sha, pre.id, JSON.stringify({ counts: result.plan.counts, reused: result.plan.reused, warnings: result.warnings.slice(0, 100) })));
  stmts.push(db.audit('import_legacy_v1', 'import', runId, { counts: result.plan.counts }));
  try {
    await db.batch(stmts);
  } catch (e) {
    throw new ApiError(422, 'import_failed_rolled_back', { reason: e instanceof Error ? e.message.slice(0, 200) : 'unknown', pre_import_backup: pre.id });
  }
  // Conciliación de costes: fórmula v1 vs motor v2 (difieren solo si v1 topaba la merma al 95 %)
  const cat = await loadCatalog(db);
  const reconciliation = Object.entries(result.plan.legacy_portion_costs).map(([rid, legacy]) => {
    let v2: string | null = null;
    try { v2 = cat.coster.cost(rid).portion_cost.toFixed(); } catch { v2 = null; }
    return { recipe: cat.recipes.get(rid)?.name, legacy_portion_cost: legacy, v2_portion_cost: v2, equal: v2 !== null && dec(legacy).minus(dec(v2)).abs().lessThan('1e-9') };
  });
  // Snapshots de eventos confirmados/realizados importados (precio vigente en la importación, marcado como importado)
  const bundles = await loadEventBundles(db, result.plan.confirmed_event_ids);
  const snaps: D1PreparedStatement[] = [];
  for (const b of bundles.values()) {
    if (!b.menuLines.length) continue;
    snaps.push((await buildSnapshot(db, b, cat, 'confirmed', { imported_from_v1: true })).stmt);
  }
  if (snaps.length) await db.batch(snaps);
  return c.json({ imported: true, import_run: runId, pre_import_backup: pre.id, counts: result.plan.counts, reused: result.plan.reused, warnings: result.warnings, reconciliation, snapshots_created: snaps.length });
});

// ───────────── CSV ─────────────
function csvResponse(name: string, body: string) {
  return new Response(body, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}_${todayMadrid()}.csv"`, 'cache-control': 'no-store' } });
}

data.get('/exports/csv/:entity', async (c) => {
  const db = getDb(c);
  const entity = c.req.param('entity');
  const cat = await loadCatalog(db);
  const suppliers = new Map((await db.all<{ id: string; name: string }>('SELECT id, name FROM suppliers WHERE owner_id = ?', db.owner)).map((s) => [s.id, s.name]));
  let out: string;
  if (entity === 'ingredients') {
    const rows = [...cat.ingredients.values()];
    const cols: CsvColumn<(typeof rows)[number]>[] = [
      { header: 'nombre', value: (r) => r.name }, { header: 'categoria', value: (r) => r.category }, { header: 'unidad', value: (r) => r.base_unit },
      { header: 'merma', value: (r) => r.waste_pct, numeric: true }, { header: 'alergenos', value: (r) => r.allergens.join(',') },
      { header: 'proveedor', value: (r) => { const p = cat.current.get(r.id); return p?.supplier_id ? suppliers.get(p.supplier_id) : ''; } },
      { header: 'formato', value: (r) => cat.current.get(r.id)?.label }, { header: 'cantidad_envase', value: (r) => cat.current.get(r.id)?.pack_quantity_base.toFixed(), numeric: true },
      { header: 'precio_envase', value: (r) => cat.current.get(r.id)?.pack_price.toFixed(), numeric: true }, { header: 'fecha', value: (r) => cat.current.get(r.id)?.effective_at },
      { header: 'coste_util_unidad_base', value: (r) => cat.current.get(r.id)?.unit_cost.toDecimalPlaces(6).toFixed(), numeric: true },
      { header: 'archivado', value: (r) => (r.archived_at ? 'sí' : 'no') },
    ];
    out = toCsv(rows, cols);
  } else if (entity === 'prices') {
    const rows = await db.all<Record<string, string>>(`SELECT ph.effective_at, ph.recorded_at, ph.pack_price, ph.pack_quantity_base, ph.source_type, ph.note, f.label, i.name AS ingredient, i.base_unit, s.name AS supplier
      FROM price_history ph JOIN purchase_formats f ON f.id = ph.format_id JOIN ingredients i ON i.id = f.ingredient_id LEFT JOIN suppliers s ON s.id = f.supplier_id WHERE ph.owner_id = ? ORDER BY i.name, ph.effective_at`, db.owner);
    out = toCsv(rows, [
      { header: 'ingrediente', value: (r) => r.ingredient }, { header: 'proveedor', value: (r) => r.supplier }, { header: 'formato', value: (r) => r.label },
      { header: 'fecha_efectiva', value: (r) => r.effective_at }, { header: 'registrado', value: (r) => r.recorded_at }, { header: 'precio_envase_sin_iva', value: (r) => r.pack_price, numeric: true },
      { header: 'cantidad_envase', value: (r) => r.pack_quantity_base, numeric: true }, { header: 'unidad', value: (r) => r.base_unit }, { header: 'origen', value: (r) => r.source_type }, { header: 'nota', value: (r) => r.note },
    ]);
  } else if (entity === 'recipes') {
    const rows = [...cat.recipes.values()].map((r) => { let cost = null; try { cost = cat.coster.cost(r.id); } catch { /* ciclo */ } return { r, cost }; });
    out = toCsv(rows, [
      { header: 'receta', value: (x) => x.r.name }, { header: 'categoria', value: (x) => x.r.category }, { header: 'raciones', value: (x) => x.r.portions, numeric: true },
      { header: 'coste_lote', value: (x) => x.cost?.lot_cost.toDecimalPlaces(4).toFixed(), numeric: true }, { header: 'coste_racion', value: (x) => x.cost?.portion_cost.toDecimalPlaces(4).toFixed(), numeric: true },
      { header: 'alergenos', value: (x) => x.cost?.allergens.join(',') }, { header: 'completo', value: (x) => !!x.cost?.complete },
    ]);
  } else if (entity === 'clients') {
    const rows = await db.all<Record<string, string>>('SELECT display_name, email, phone, dietary_preferences, legal_basis, created_at FROM clients WHERE owner_id = ? AND archived_at IS NULL ORDER BY display_name', db.owner);
    out = toCsv(rows, [{ header: 'cliente', value: (r) => r.display_name }, { header: 'email', value: (r) => r.email }, { header: 'telefono', value: (r) => r.phone }, { header: 'preferencias', value: (r) => r.dietary_preferences }, { header: 'base_legal', value: (r) => r.legal_basis }, { header: 'alta', value: (r) => r.created_at }]);
  } else if (entity === 'events' || entity === 'profitability') {
    const rows = await profitabilityRows(db, cat, null, null);
    out = toCsv(rows, [
      { header: 'fecha', value: (r) => r.event_date }, { header: 'evento', value: (r) => r.title }, { header: 'cliente', value: (r) => r.client_name }, { header: 'estado', value: (r) => r.status },
      { header: 'comensales', value: (r) => r.guest_count, numeric: true }, { header: 'ingreso_neto_sin_iva', value: (r) => r.revenue_net, numeric: true },
      { header: 'coste_comida_previsto', value: (r) => r.food_cost, numeric: true }, { header: 'coste_total_previsto', value: (r) => r.total_cost, numeric: true },
      { header: 'beneficio_previsto', value: (r) => r.profit, numeric: true }, { header: 'margen_previsto_pct', value: (r) => r.margin_pct, numeric: true },
      { header: 'coste_total_real', value: (r) => r.actual_total_cost, numeric: true }, { header: 'beneficio_real', value: (r) => r.actual_profit, numeric: true },
      { header: 'margen_real_pct', value: (r) => r.actual_margin_pct, numeric: true }, { header: 'origen_cifras', value: (r) => r.source },
    ]);
  } else if (entity === 'purchases') {
    const rows = await db.all<Record<string, string>>(`SELECT p.purchase_date, p.external_reference, p.status, s.name AS supplier, i.name AS ingredient, l.ordered_packs, l.received_packs, l.pack_quantity_base, l.pack_price
      FROM purchase_lines l JOIN purchases p ON p.id = l.purchase_id JOIN ingredients i ON i.id = l.ingredient_id LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE l.owner_id = ? ORDER BY p.purchase_date DESC`, db.owner);
    out = toCsv(rows, [
      { header: 'fecha', value: (r) => r.purchase_date }, { header: 'referencia', value: (r) => r.external_reference }, { header: 'estado', value: (r) => r.status }, { header: 'proveedor', value: (r) => r.supplier },
      { header: 'ingrediente', value: (r) => r.ingredient }, { header: 'envases_pedidos', value: (r) => r.ordered_packs, numeric: true }, { header: 'envases_recibidos', value: (r) => r.received_packs, numeric: true },
      { header: 'cantidad_envase', value: (r) => r.pack_quantity_base, numeric: true }, { header: 'precio_envase_sin_iva', value: (r) => r.pack_price, numeric: true },
      { header: 'total_linea', value: (r) => dec(r.ordered_packs!).times(dec(r.pack_price!)).toDecimalPlaces(2).toFixed(2), numeric: true },
    ]);
  } else if (entity === 'stock') {
    const rows = await db.all<Record<string, string>>('SELECT m.occurred_at, m.kind, m.quantity_base, m.notes, i.name AS ingredient, i.base_unit FROM stock_movements m JOIN ingredients i ON i.id = m.ingredient_id WHERE m.owner_id = ? ORDER BY m.occurred_at, m.created_at', db.owner);
    out = toCsv(rows, [{ header: 'fecha', value: (r) => r.occurred_at }, { header: 'ingrediente', value: (r) => r.ingredient }, { header: 'tipo', value: (r) => r.kind }, { header: 'cantidad', value: (r) => r.quantity_base, numeric: true }, { header: 'unidad', value: (r) => r.base_unit }, { header: 'nota', value: (r) => r.notes }]);
  } else if (entity === 'shopping') {
    throw new ApiError(404, 'use_client_export');
  } else {
    throw new ApiError(404, 'not_found');
  }
  await db.batch([db.audit('export_csv', entity, null)]);
  return csvResponse(entity, out);
});

export { serializeDecimals, nowIso };
