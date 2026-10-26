import { Hono } from 'hono';
import { serializeDecimals } from '../../shared/costing';
import { dec } from '../../shared/decimal';
import { parseCsv } from '../../shared/csv';
import { priceAlerts } from '../../shared/shopping';
import { FormatSchema, IngredientSchema, PriceSchema, SupplierSchema } from '../../shared/schemas';
import { getDb, nowIso, todayMadrid, uuid, type Bind, type Db } from '../db';
import type { AppEnv } from '../env';
import { ApiError, body, readJson } from '../http';
import { loadCatalog } from '../services/catalog';

export const catalog = new Hono<AppEnv>();

/** UPDATE parcial con columnas en lista blanca (claves ya validadas por zod). */
export function updateStmt(db: Db, table: string, id: string, data: Record<string, unknown>, allowed: string[]) {
  const cols = Object.keys(data).filter((k) => allowed.includes(k) && data[k] !== undefined);
  if (!cols.length) return null;
  const sets = cols.map((c) => `${c} = ?`).join(', ');
  const vals = cols.map((c) => {
    const v = data[c];
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (Array.isArray(v)) return JSON.stringify(v);
    return (v ?? null) as Bind;
  });
  const hasUpdated = !['purchase_formats_noupd'].includes(table);
  return db.prepare(`UPDATE ${table} SET ${sets}${hasUpdated ? ', updated_at = ?' : ''} WHERE id = ? AND owner_id = ?`, ...vals, ...(hasUpdated ? [nowIso()] : []), id, db.owner);
}

// ───────────── Proveedores ─────────────
const SUPPLIER_COLS = ['name', 'contact_name', 'email', 'phone', 'website', 'tax_id', 'notes'];

catalog.get('/suppliers', async (c) => {
  const db = getDb(c);
  const archived = c.req.query('archived') === '1';
  return c.json(await db.all(`SELECT * FROM suppliers WHERE owner_id = ? AND ${archived ? 'archived_at IS NOT NULL' : 'archived_at IS NULL'} ORDER BY name COLLATE NOCASE`, db.owner));
});
catalog.post('/suppliers', async (c) => {
  const db = getDb(c);
  const d = await body(c, SupplierSchema);
  const id = uuid();
  await db.batch([
    db.prepare('INSERT INTO suppliers (id, owner_id, name, contact_name, email, phone, website, tax_id, notes) VALUES (?,?,?,?,?,?,?,?,?)', id, db.owner, d.name, d.contact_name ?? null, d.email ?? null, d.phone ?? null, d.website ?? null, d.tax_id ?? null, d.notes ?? null),
    db.audit('create', 'supplier', id),
  ]);
  return c.json(await db.owned('suppliers', id), 201);
});
catalog.get('/suppliers/:id', async (c) => {
  const db = getDb(c);
  const s = await db.owned('suppliers', c.req.param('id'), { allowArchived: true });
  const formats = await db.all('SELECT f.*, i.name AS ingredient_name, i.base_unit FROM purchase_formats f JOIN ingredients i ON i.id = f.ingredient_id WHERE f.supplier_id = ? AND f.owner_id = ? ORDER BY i.name', s.id as string, db.owner);
  return c.json({ ...s, formats });
});
catalog.patch('/suppliers/:id', async (c) => {
  const db = getDb(c);
  await db.owned('suppliers', c.req.param('id'));
  const d = await body(c, SupplierSchema.partial());
  const st = updateStmt(db, 'suppliers', c.req.param('id'), d, SUPPLIER_COLS);
  if (st) await db.batch([st, db.audit('update', 'supplier', c.req.param('id'))]);
  return c.json(await db.owned('suppliers', c.req.param('id')));
});
catalog.delete('/suppliers/:id', async (c) => {
  const db = getDb(c);
  await db.owned('suppliers', c.req.param('id'), { allowArchived: true });
  await db.batch([db.prepare('UPDATE suppliers SET archived_at = ? WHERE id = ? AND owner_id = ?', nowIso(), c.req.param('id'), db.owner), db.audit('archive', 'supplier', c.req.param('id'))]);
  return c.json({ archived: true });
});

// ───────────── Ingredientes ─────────────
const ING_COLS = ['name', 'category', 'base_unit', 'waste_pct', 'notes', 'preferred_supplier_id', 'preferred_format_id'];

catalog.get('/ingredients', async (c) => {
  const db = getDb(c);
  const cat = await loadCatalog(db);
  const archived = c.req.query('archived') === '1';
  const suppliers = new Map((await db.all<{ id: string; name: string }>('SELECT id, name FROM suppliers WHERE owner_id = ?', db.owner)).map((s) => [s.id, s.name]));
  const usage = new Map<string, number>();
  for (const r of cat.recipes.values()) for (const l of r.lines) if (l.ingredient_id) usage.set(l.ingredient_id, (usage.get(l.ingredient_id) ?? 0) + 1);
  const stock = await db.all<{ ingredient_id: string; kind: string; quantity_base: string }>("SELECT ingredient_id, kind, quantity_base FROM stock_movements WHERE owner_id = ? AND kind IN ('opening','receipt','consumption','waste','adjustment')", db.owner);
  const onHand = new Map<string, ReturnType<typeof dec>>();
  for (const m of stock) {
    const q = dec(m.quantity_base);
    const delta = m.kind === 'consumption' || m.kind === 'waste' ? q.negated() : q;
    onHand.set(m.ingredient_id, (onHand.get(m.ingredient_id) ?? dec(0)).plus(delta));
  }
  const list = [...cat.ingredients.values()].filter((i) => (archived ? !!i.archived_at : !i.archived_at)).sort((a, b) => a.name.localeCompare(b.name, 'es')).map((i) => {
    const p = cat.current.get(i.id);
    return serializeDecimals({
      ...i,
      supplier_name: (p?.supplier_id && suppliers.get(p.supplier_id)) || (i.preferred_supplier_id && suppliers.get(i.preferred_supplier_id)) || null,
      current_price: p ? { format_id: p.format_id, label: p.label, pack_price: p.pack_price, pack_quantity_base: p.pack_quantity_base, effective_at: p.effective_at, unit_cost: p.unit_cost } : null,
      used_in_recipes: usage.get(i.id) ?? 0,
      stock_on_hand: onHand.get(i.id) ?? dec(0),
    });
  });
  return c.json(list);
});

catalog.post('/ingredients', async (c) => {
  const db = getDb(c);
  const d = await body(c, IngredientSchema);
  if (d.preferred_supplier_id) await db.owned('suppliers', d.preferred_supplier_id);
  const id = uuid();
  await db.batch([
    db.prepare('INSERT INTO ingredients (id, owner_id, name, category, base_unit, waste_pct, allergens_json, notes, preferred_supplier_id) VALUES (?,?,?,?,?,?,?,?,?)',
      id, db.owner, d.name, d.category ?? null, d.base_unit, d.waste_pct, JSON.stringify(d.allergens), d.notes ?? null, d.preferred_supplier_id ?? null),
    db.audit('create', 'ingredient', id),
  ]);
  return c.json(await db.owned('ingredients', id), 201);
});

catalog.get('/ingredients/:id', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const ing = await db.owned('ingredients', id, { allowArchived: true });
  const [formats, prices, usedIn, movements] = await db.batch([
    db.prepare('SELECT f.*, s.name AS supplier_name FROM purchase_formats f LEFT JOIN suppliers s ON s.id = f.supplier_id WHERE f.ingredient_id = ? AND f.owner_id = ? ORDER BY f.created_at', id, db.owner),
    db.prepare('SELECT ph.*, f.label, f.supplier_id FROM price_history ph JOIN purchase_formats f ON f.id = ph.format_id WHERE f.ingredient_id = ? AND ph.owner_id = ? ORDER BY ph.effective_at DESC, ph.recorded_at DESC LIMIT 200', id, db.owner),
    db.prepare('SELECT DISTINCT r.id, r.name FROM recipe_lines l JOIN recipes r ON r.id = l.recipe_id WHERE l.ingredient_id = ? AND l.owner_id = ?', id, db.owner),
    db.prepare('SELECT * FROM stock_movements WHERE ingredient_id = ? AND owner_id = ? ORDER BY occurred_at DESC, created_at DESC LIMIT 100', id, db.owner),
  ]);
  const cat = await loadCatalog(db);
  const cur = cat.current.get(id);
  const all = await db.all<{ kind: string; quantity_base: string }>('SELECT kind, quantity_base FROM stock_movements WHERE ingredient_id = ? AND owner_id = ?', id, db.owner);
  const stock = all.reduce((a, m) => (['reservation', 'reservation_release'].includes(m.kind) ? a : a.plus(['consumption', 'waste'].includes(m.kind) ? dec(m.quantity_base).negated() : dec(m.quantity_base))), dec(0));
  return c.json({
    stock_on_hand: stock.toFixed(),
    ...ing,
    allergens: JSON.parse(String(ing.allergens_json)),
    formats: formats!.results,
    price_history: (prices!.results as Record<string, string>[]).map((p) => ({ ...p, unit_price_base: dec(p.pack_price!).div(dec(p.pack_quantity_base!)).toFixed() })),
    used_in: usedIn!.results,
    movements: movements!.results,
    current_price: cur ? serializeDecimals(cur) : null,
  });
});

catalog.patch('/ingredients/:id', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  await db.owned('ingredients', id);
  const d = await body(c, IngredientSchema.partial());
  if (d.preferred_supplier_id) await db.owned('suppliers', d.preferred_supplier_id);
  if (d.preferred_format_id) {
    const f = await db.owned('purchase_formats', d.preferred_format_id);
    if (f.ingredient_id !== id) throw new ApiError(422, 'format_not_for_ingredient');
  }
  if (d.base_unit) {
    const cur = await db.owned('ingredients', id);
    if (cur.base_unit !== d.base_unit) {
      const used = await db.first('SELECT 1 FROM recipe_lines WHERE ingredient_id = ? AND owner_id = ? UNION SELECT 1 FROM purchase_formats WHERE ingredient_id = ? AND owner_id = ? LIMIT 1', id, db.owner, id, db.owner);
      if (used) throw new ApiError(409, 'base_unit_locked');
    }
  }
  const data: Record<string, unknown> = { ...d };
  if (d.allergens) data.allergens_json = d.allergens;
  const st = updateStmt(db, 'ingredients', id, data, [...ING_COLS, 'allergens_json']);
  if (st) await db.batch([st, db.audit('update', 'ingredient', id, d.waste_pct ? { waste_pct: d.waste_pct } : undefined)]);
  return c.json(await db.owned('ingredients', id));
});

/** Nunca se borra físicamente: se archiva (los escandallos y presupuestos históricos se conservan). */
catalog.delete('/ingredients/:id', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  await db.owned('ingredients', id, { allowArchived: true });
  await db.batch([db.prepare('UPDATE ingredients SET archived_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?', nowIso(), nowIso(), id, db.owner), db.audit('archive', 'ingredient', id)]);
  return c.json({ archived: true });
});
catalog.post('/ingredients/:id/restore', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  await db.owned('ingredients', id, { allowArchived: true });
  await db.batch([db.prepare('UPDATE ingredients SET archived_at = NULL, updated_at = ? WHERE id = ? AND owner_id = ?', nowIso(), id, db.owner), db.audit('restore', 'ingredient', id)]);
  return c.json({ restored: true });
});

// ───────────── Formatos de compra y precios (historial inmutable) ─────────────
catalog.post('/purchase-formats', async (c) => {
  const db = getDb(c);
  const d = await body(c, FormatSchema);
  await db.owned('ingredients', d.ingredient_id);
  if (d.supplier_id) await db.owned('suppliers', d.supplier_id);
  const id = uuid();
  const stmts = [
    db.prepare('INSERT INTO purchase_formats (id, owner_id, ingredient_id, supplier_id, label, supplier_ref, pack_quantity_base, whole_packs_only, is_active) VALUES (?,?,?,?,?,?,?,?,?)',
      id, db.owner, d.ingredient_id, d.supplier_id ?? null, d.label, d.supplier_ref ?? null, d.pack_quantity_base, d.whole_packs_only ? 1 : 0, d.is_active ? 1 : 0),
    db.audit('create', 'purchase_format', id),
  ];
  if (d.initial_price !== undefined) {
    stmts.push(db.prepare('INSERT INTO price_history (id, owner_id, format_id, effective_at, pack_price, pack_quantity_base, source_type) VALUES (?,?,?,?,?,?,?)',
      uuid(), db.owner, id, d.effective_at ?? todayMadrid(), d.initial_price, d.pack_quantity_base, 'manual'));
  }
  const hasPref = await db.first<{ preferred_format_id: string | null }>('SELECT preferred_format_id FROM ingredients WHERE id = ? AND owner_id = ?', d.ingredient_id, db.owner);
  if (!hasPref?.preferred_format_id) stmts.push(db.prepare('UPDATE ingredients SET preferred_format_id = ? WHERE id = ? AND owner_id = ?', id, d.ingredient_id, db.owner));
  await db.batch(stmts);
  return c.json(await db.owned('purchase_formats', id), 201);
});

catalog.get('/purchase-formats', async (c) => {
  const db = getDb(c);
  const rows = await db.all(`SELECT f.id, f.ingredient_id, f.supplier_id, f.label, f.supplier_ref, f.pack_quantity_base, f.whole_packs_only, f.is_active, s.name AS supplier_name,
      (SELECT ph.pack_price FROM price_history ph WHERE ph.format_id = f.id ORDER BY ph.effective_at DESC, ph.recorded_at DESC LIMIT 1) AS last_price
    FROM purchase_formats f LEFT JOIN suppliers s ON s.id = f.supplier_id WHERE f.owner_id = ? AND f.is_active = 1 ORDER BY f.label`, db.owner);
  return c.json(rows);
});

catalog.patch('/purchase-formats/:id', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  await db.owned('purchase_formats', id);
  const d = await body(c, FormatSchema.pick({ label: true, supplier_ref: true, whole_packs_only: true, is_active: true, supplier_id: true }).partial());
  if (d.supplier_id) await db.owned('suppliers', d.supplier_id);
  const st = updateStmt(db, 'purchase_formats', id, d, ['label', 'supplier_ref', 'whole_packs_only', 'is_active', 'supplier_id']);
  if (st) await db.batch([st, db.audit('update', 'purchase_format', id)]);
  return c.json(await db.owned('purchase_formats', id));
});

catalog.post('/purchase-formats/:id/prices', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const f = await db.owned('purchase_formats', id);
  const d = await body(c, PriceSchema);
  const pid = uuid();
  const qty = d.pack_quantity_base ?? String(f.pack_quantity_base);
  const stmts = [
    db.prepare('INSERT INTO price_history (id, owner_id, format_id, effective_at, pack_price, pack_quantity_base, source_type, note) VALUES (?,?,?,?,?,?,?,?)', pid, db.owner, id, d.effective_at, d.pack_price, qty, 'manual', d.note ?? null),
    db.audit('price_change', 'purchase_format', id, { pack_price: d.pack_price, pack_quantity_base: qty, effective_at: d.effective_at }),
  ];
  if (qty !== String(f.pack_quantity_base)) stmts.push(db.prepare('UPDATE purchase_formats SET pack_quantity_base = ?, updated_at = ? WHERE id = ? AND owner_id = ?', qty, nowIso(), id, db.owner));
  await db.batch(stmts);
  return c.json({ id: pid, format_changed: qty !== String(f.pack_quantity_base) }, 201);
});

catalog.get('/price-history', async (c) => {
  const db = getDb(c);
  const rows = await db.all(`SELECT ph.*, f.label, f.ingredient_id, i.name AS ingredient_name, i.base_unit, s.name AS supplier_name
    FROM price_history ph JOIN purchase_formats f ON f.id = ph.format_id JOIN ingredients i ON i.id = f.ingredient_id LEFT JOIN suppliers s ON s.id = f.supplier_id
    WHERE ph.owner_id = ? ORDER BY ph.effective_at DESC, ph.recorded_at DESC LIMIT 300`, db.owner);
  return c.json(rows);
});

catalog.get('/price-alerts', async (c) => {
  const db = getDb(c);
  const cat = await loadCatalog(db);
  const s = await db.first<{ price_alert_threshold_pct: string }>('SELECT price_alert_threshold_pct FROM settings WHERE owner_id = ?', db.owner);
  const alerts = priceAlerts(cat.formats, cat.prices, dec(s?.price_alert_threshold_pct ?? '5')).slice(0, 50);
  return c.json(alerts.map((a) => serializeDecimals({ ...a, ingredient_name: cat.ingredients.get(a.ingredient_id)?.name, base_unit: cat.ingredients.get(a.ingredient_id)?.base_unit })));
});

// ───────────── Importación CSV de ingredientes (vista previa + confirmación) ─────────────
const CSV_HEADERS = ['nombre', 'categoria', 'unidad', 'merma', 'alergenos', 'proveedor', 'formato', 'cantidad_envase', 'precio_envase', 'fecha'];

function planIngredientCsv(text: string, existing: Set<string>) {
  const rows = parseCsv(text);
  const errors: { row: number; message: string }[] = [];
  const items: { name: string; category: string | null; base_unit: string; waste_pct: string; allergens: string[]; supplier: string | null; label: string; qty: string; price: string; date: string }[] = [];
  if (!rows.length) return { errors: [{ row: 0, message: 'empty' }], items };
  const header = rows[0]!.map((h) => h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const idx = (k: string) => header.indexOf(k);
  if (idx('nombre') < 0 || idx('unidad') < 0) return { errors: [{ row: 1, message: `cabeceras requeridas: ${CSV_HEADERS.join(';')}` }], items };
  rows.slice(1, 2001).forEach((r, i) => {
    const get = (k: string) => (idx(k) >= 0 ? (r[idx(k)] ?? '').trim() : '');
    const rowNo = i + 2;
    const name = get('nombre').replace(/^'/, '');
    const unit = get('unidad').toLowerCase();
    if (!name) return errors.push({ row: rowNo, message: 'nombre vacío' });
    if (!['g', 'ml', 'ud'].includes(unit)) return errors.push({ row: rowNo, message: 'unidad debe ser g, ml o ud' });
    const waste = (get('merma') || '0').replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(waste) || Number(waste) >= 100) return errors.push({ row: rowNo, message: 'merma inválida (0–99,99)' });
    const qty = get('cantidad_envase').replace(',', '.');
    const price = get('precio_envase').replace(',', '.');
    if ((qty || price) && (!/^\d+(\.\d+)?$/.test(qty) || Number(qty) <= 0 || !/^\d+(\.\d+)?$/.test(price))) return errors.push({ row: rowNo, message: 'envase/precio inválido' });
    if (existing.has(name.toLowerCase())) return errors.push({ row: rowNo, message: 'ya existe (se omitirá)' });
    items.push({ name: name.slice(0, 160), category: get('categoria') || null, base_unit: unit, waste_pct: waste, allergens: [], supplier: get('proveedor') || null, label: get('formato') || (qty ? `${qty} ${unit}` : ''), qty, price, date: /^\d{4}-\d{2}-\d{2}$/.test(get('fecha')) ? get('fecha') : todayMadrid() });
  });
  return { errors, items };
}

catalog.post('/ingredients/import-csv', async (c) => {
  const db = getDb(c);
  const raw = (await readJson(c, 2_000_000)) as { csv?: string; commit?: boolean };
  if (typeof raw.csv !== 'string') throw new ApiError(422, 'csv_required');
  const existing = new Set((await db.all<{ name: string }>('SELECT name FROM ingredients WHERE owner_id = ?', db.owner)).map((r) => r.name.toLowerCase()));
  const plan = planIngredientCsv(raw.csv, existing);
  if (!raw.commit) return c.json({ preview: plan.items.slice(0, 200), count: plan.items.length, errors: plan.errors });
  if (plan.errors.some((e) => !e.message.includes('se omitirá'))) throw new ApiError(422, 'csv_has_errors', plan.errors);
  const suppliers = new Map((await db.all<{ id: string; name: string }>('SELECT id, name FROM suppliers WHERE owner_id = ?', db.owner)).map((s) => [s.name.toLowerCase(), s.id]));
  const sup: Record<string, unknown>[] = [];
  const ings: Record<string, unknown>[] = [];
  const fmts: Record<string, unknown>[] = [];
  const prices: Record<string, unknown>[] = [];
  for (const it of plan.items) {
    let sid: string | null = null;
    if (it.supplier) {
      sid = suppliers.get(it.supplier.toLowerCase()) ?? null;
      if (!sid) { sid = uuid(); suppliers.set(it.supplier.toLowerCase(), sid); sup.push({ id: sid, name: it.supplier }); }
    }
    const iid = uuid();
    let fid: string | null = null;
    if (it.qty) {
      fid = uuid();
      fmts.push({ id: fid, ingredient_id: iid, supplier_id: sid, label: it.label, pack_quantity_base: it.qty, whole_packs_only: 1, is_active: 1 });
      prices.push({ id: uuid(), format_id: fid, effective_at: it.date, pack_price: it.price, pack_quantity_base: it.qty, source_type: 'import', note: 'CSV' });
    }
    ings.push({ id: iid, name: it.name, category: it.category, base_unit: it.base_unit, waste_pct: it.waste_pct, allergens_json: '[]', preferred_supplier_id: sid, preferred_format_id: fid });
  }
  await db.batch([
    ...db.bulkInsert('suppliers', ['id', 'name'], sup),
    ...db.bulkInsert('ingredients', ['id', 'name', 'category', 'base_unit', 'waste_pct', 'allergens_json', 'preferred_supplier_id', 'preferred_format_id'], ings),
    ...db.bulkInsert('purchase_formats', ['id', 'ingredient_id', 'supplier_id', 'label', 'pack_quantity_base', 'whole_packs_only', 'is_active'], fmts),
    ...db.bulkInsert('price_history', ['id', 'format_id', 'effective_at', 'pack_price', 'pack_quantity_base', 'source_type', 'note'], prices),
    db.audit('import_csv', 'ingredient', null, { count: ings.length }),
  ]);
  return c.json({ imported: ings.length });
});
