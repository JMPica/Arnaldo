import { Hono } from 'hono';
import { serializeDecimals } from '../../shared/costing';
import { Decimal, DomainError, ZERO, dec } from '../../shared/decimal';
import { PurchaseSchema, ReceiveSchema, StockMovementSchema } from '../../shared/schemas';
import { assertNotNegative, availableForSelection, buildShoppingList, formatOptions, stockBalances, type MovementData } from '../../shared/shopping';
import { getDb, nowIso, todayMadrid, uuid, type Db } from '../db';
import type { AppEnv } from '../env';
import { ApiError, body } from '../http';
import { loadCatalog } from '../services/catalog';
import { computeFinancials, loadEventBundles } from '../services/events';

export const purchasing = new Hono<AppEnv>();

// ───────────── Lista de compra consolidada ─────────────
purchasing.get('/shopping-list', async (c) => {
  const db = getDb(c);
  const ids = (c.req.query('events') ?? '').split(',').map((s) => s.trim()).filter((s) => /^[\w-]{1,64}$/.test(s)).slice(0, 50);
  let eventIds = ids;
  if (!eventIds.length) {
    eventIds = (await db.all<{ id: string }>("SELECT id FROM events WHERE owner_id = ? AND status = 'confirmed' AND event_date >= ? AND archived_at IS NULL ORDER BY event_date", db.owner, todayMadrid())).map((r) => r.id);
  }
  const cat = await loadCatalog(db);
  const demand = new Map<string, Decimal>();
  const byEvent: { id: string; title: string; event_date: string; guest_count: number; warnings: string[] }[] = [];
  const bundles = await loadEventBundles(db, eventIds);
  eventIds = eventIds.filter((id) => bundles.has(id));
  for (const id of eventIds) {
    const b = bundles.get(id)!;
    if (b.event.status === 'cancelled') continue;
    const fin = computeFinancials(b, cat);
    for (const rp of fin.recipe_portions) cat.coster.ingredientDemand(rp.recipe_id, rp.portions.div(dec(cat.recipes.get(rp.recipe_id)!.portions)), demand);
    byEvent.push({ id, title: String(b.event.title), event_date: String(b.event.event_date), guest_count: Number(b.event.guest_count), warnings: fin.warnings });
  }
  const movs = await db.all<MovementData>('SELECT ingredient_id, event_id, kind, quantity_base FROM stock_movements WHERE owner_id = ?', db.owner);
  const available = availableForSelection(stockBalances(movs), eventIds);
  const rows = buildShoppingList(demand, cat.ingredients, available, formatOptions(cat.formats, cat.prices, cat.asOf), cat.current);
  const suppliers = new Map((await db.all<{ id: string; name: string }>('SELECT id, name FROM suppliers WHERE owner_id = ?', db.owner)).map((s) => [s.id, s.name]));
  const total = rows.reduce((a, r) => a.plus(r.expected_cost ?? ZERO), ZERO);
  return c.json(serializeDecimals({
    events: byEvent,
    rows: rows.map((r) => ({ ...r, supplier_name: r.format?.supplier_id ? suppliers.get(r.format.supplier_id) ?? null : null, alternatives: r.alternatives.map((a) => ({ ...a, supplier_name: a.format.supplier_id ? suppliers.get(a.format.supplier_id) ?? null : null })) })),
    total_expected: total,
    missing_formats: rows.filter((r) => !r.format).map((r) => r.name),
  }));
});

// ───────────── Compras (pedidos / recepciones parciales) ─────────────
purchasing.get('/purchases', async (c) => {
  const db = getDb(c);
  const rows = await db.all(`SELECT p.*, s.name AS supplier_name, e.title AS event_title,
      (SELECT COUNT(*) FROM purchase_lines l WHERE l.purchase_id = p.id) AS lines_count,
      (SELECT GROUP_CONCAT(l.ordered_packs || '|' || l.pack_price, ';') FROM purchase_lines l WHERE l.purchase_id = p.id) AS totals_raw
    FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id LEFT JOIN events e ON e.id = p.event_id
    WHERE p.owner_id = ? ORDER BY p.purchase_date DESC, p.created_at DESC LIMIT 300`, db.owner);
  return c.json(rows.map((r) => {
    const total = String(r.totals_raw ?? '').split(';').filter(Boolean).reduce((a, x) => { const [q, p] = x.split('|'); return a.plus(dec(q!).times(dec(p!))); }, ZERO);
    return { ...r, totals_raw: undefined, total: total.toFixed() };
  }));
});

purchasing.get('/purchases/:id', async (c) => {
  const db = getDb(c);
  const p = await db.owned('purchases', c.req.param('id'));
  const lines = await db.all('SELECT l.*, i.name AS ingredient_name, i.base_unit, f.label AS format_label FROM purchase_lines l JOIN ingredients i ON i.id = l.ingredient_id LEFT JOIN purchase_formats f ON f.id = l.format_id WHERE l.purchase_id = ? AND l.owner_id = ? ORDER BY l.position', p.id as string, db.owner);
  const supplier = p.supplier_id ? await db.first('SELECT id, name FROM suppliers WHERE id = ? AND owner_id = ?', p.supplier_id as string, db.owner) : null;
  return c.json({ ...p, supplier, lines });
});

export async function createPurchase(db: Db, d: ReturnType<typeof PurchaseSchema.parse>, source: { type: 'purchase' | 'document'; document_id?: string }) {
  if (d.supplier_id) await db.owned('suppliers', d.supplier_id);
  if (d.event_id) await db.owned('events', d.event_id);
  if (d.external_reference && !d.allow_duplicate_reference) {
    const dup = await db.first('SELECT id FROM purchases WHERE owner_id = ? AND external_reference = ? AND IFNULL(supplier_id, \'\') = IFNULL(?, \'\') AND status <> \'cancelled\'', db.owner, d.external_reference, d.supplier_id ?? null);
    if (dup) throw new ApiError(409, 'duplicate_reference', { purchase_id: dup.id });
  }
  const pid = uuid();
  const stmts: D1PreparedStatement[] = [
    db.prepare('INSERT INTO purchases (id, owner_id, supplier_id, document_id, event_id, external_reference, purchase_date, status, notes) VALUES (?,?,?,?,?,?,?,?,?)',
      pid, db.owner, d.supplier_id ?? null, source.document_id ?? null, d.event_id ?? null, d.external_reference ?? null, d.purchase_date, d.status, d.notes ?? null),
  ];
  const ingIds = new Set((await db.all<{ id: string }>('SELECT id FROM ingredients WHERE owner_id = ?', db.owner)).map((r) => r.id));
  const fmtMap = new Map((await db.all<{ id: string; ingredient_id: string }>('SELECT id, ingredient_id FROM purchase_formats WHERE owner_id = ?', db.owner)).map((r) => [r.id, r.ingredient_id]));
  let pos = 0;
  const priceRows: Record<string, unknown>[] = [];
  const lineRows: Record<string, unknown>[] = [];
  const formatQty: { id: string; q: string }[] = [];
  for (const l of d.lines) {
    if (!ingIds.has(l.ingredient_id)) throw new ApiError(404, 'not_found', { entity: 'ingredient' });
    const formatId = l.format_id ?? null;
    if (formatId) {
      if (!fmtMap.has(formatId)) throw new ApiError(404, 'not_found', { entity: 'purchase_format' });
      if (fmtMap.get(formatId) !== l.ingredient_id) throw new ApiError(422, 'format_not_for_ingredient');
    }
    let priceId: string | null = null;
    if (d.update_prices && formatId) {
      priceId = uuid();
      priceRows.push({ id: priceId, format_id: formatId, effective_at: d.purchase_date, pack_price: l.pack_price, pack_quantity_base: l.pack_quantity_base, source_type: source.type, source_ref_id: pid, note: d.external_reference ? `Ref. ${d.external_reference}` : null });
      formatQty.push({ id: formatId, q: l.pack_quantity_base });
    }
    lineRows.push({ id: uuid(), purchase_id: pid, position: ++pos, ingredient_id: l.ingredient_id, format_id: formatId, description: l.description ?? null, ordered_packs: l.ordered_packs, pack_quantity_base: l.pack_quantity_base, pack_price: l.pack_price, price_history_id: priceId });
  }
  stmts.push(...db.bulkInsert('price_history', ['id', 'format_id', 'effective_at', 'pack_price', 'pack_quantity_base', 'source_type', 'source_ref_id', 'note'], priceRows));
  stmts.push(...db.bulkInsert('purchase_lines', ['id', 'purchase_id', 'position', 'ingredient_id', 'format_id', 'description', 'ordered_packs', 'pack_quantity_base', 'pack_price', 'price_history_id'], lineRows));
  if (formatQty.length) {
    stmts.push(db.prepare(`UPDATE purchase_formats SET pack_quantity_base = (SELECT json_extract(value, '$.q') FROM json_each(?1) WHERE json_extract(value, '$.id') = purchase_formats.id), updated_at = ?2
      WHERE owner_id = ?3 AND id IN (SELECT json_extract(value, '$.id') FROM json_each(?1))`, JSON.stringify(formatQty), nowIso(), db.owner));
  }
  stmts.push(db.audit('create', 'purchase', pid, { lines: d.lines.length, prices_updated: d.update_prices, source: source.type }));
  return { pid, stmts };
}

purchasing.post('/purchases', async (c) => {
  const db = getDb(c);
  const d = await body(c, PurchaseSchema);
  const { pid, stmts } = await createPurchase(db, d, { type: 'purchase' });
  await db.batch(stmts);
  return c.json({ id: pid }, 201);
});

/** Recepción (total o parcial). Idempotente por clave: reintentos no duplican stock. */
purchasing.post('/purchases/:id/receive', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const p = await db.owned('purchases', id);
  if (p.status === 'cancelled' || p.status === 'draft') throw new ApiError(409, 'invalid_transition');
  const d = await body(c, ReceiveSchema);
  const replay = await db.first('SELECT 1 FROM stock_movements WHERE owner_id = ? AND idempotency_key = ?', db.owner, `${d.idempotency_key}:${d.lines[0]!.line_id}`);
  if (replay) return c.json({ idempotent_replay: true, purchase: await db.owned('purchases', id) });
  const lines = await db.all<{ id: string; ingredient_id: string; ordered_packs: string; received_packs: string; pack_quantity_base: string }>('SELECT id, ingredient_id, ordered_packs, received_packs, pack_quantity_base FROM purchase_lines WHERE purchase_id = ? AND owner_id = ?', id, db.owner);
  const byId = new Map(lines.map((l) => [l.id, l]));
  const stmts: D1PreparedStatement[] = [];
  const newReceived = new Map(lines.map((l) => [l.id, dec(l.received_packs)]));
  const movRows: Record<string, unknown>[] = [];
  for (const r of d.lines) {
    const l = byId.get(r.line_id);
    if (!l) throw new ApiError(404, 'not_found', { entity: 'purchase_line' });
    const packs = dec(r.packs);
    const after = newReceived.get(l.id)!.plus(packs);
    if (after.greaterThan(dec(l.ordered_packs))) throw new ApiError(422, 'over_receipt', { line_id: l.id });
    newReceived.set(l.id, after);
    movRows.push({ id: uuid(), ingredient_id: l.ingredient_id, purchase_line_id: l.id, kind: 'receipt', quantity_base: packs.times(dec(l.pack_quantity_base)).toFixed(), idempotency_key: `${d.idempotency_key}:${l.id}`, occurred_at: d.received_at, notes: 'Recepción de compra' });
  }
  stmts.push(...db.bulkInsert('stock_movements', ['id', 'ingredient_id', 'purchase_line_id', 'kind', 'quantity_base', 'idempotency_key', 'occurred_at', 'notes'], movRows));
  const recv = [...newReceived.entries()].map(([id, q]) => ({ id, q: q.toFixed() }));
  stmts.push(db.prepare(`UPDATE purchase_lines SET received_packs = (SELECT json_extract(value, '$.q') FROM json_each(?1) WHERE json_extract(value, '$.id') = purchase_lines.id)
    WHERE owner_id = ?2 AND purchase_id = ?3 AND id IN (SELECT json_extract(value, '$.id') FROM json_each(?1))`, JSON.stringify(recv), db.owner, id));
  const complete = lines.every((l) => newReceived.get(l.id)!.greaterThanOrEqualTo(dec(l.ordered_packs)));
  stmts.push(db.prepare('UPDATE purchases SET status = ?, updated_at = ? WHERE id = ? AND owner_id = ?', complete ? 'received' : 'partial', nowIso(), id, db.owner));
  stmts.push(db.audit('receive', 'purchase', id, { lines: d.lines.length, complete }));
  await db.batch(stmts);
  return c.json({ purchase: await db.owned('purchases', id) });
});

purchasing.post('/purchases/:id/cancel', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const p = await db.owned('purchases', id);
  if (p.status === 'received' || p.status === 'partial') throw new ApiError(409, 'already_received');
  await db.batch([db.prepare("UPDATE purchases SET status = 'cancelled', updated_at = ? WHERE id = ? AND owner_id = ?", nowIso(), id, db.owner), db.audit('cancel', 'purchase', id)]);
  return c.json({ cancelled: true });
});

// ───────────── Inventario ─────────────
purchasing.get('/stock', async (c) => {
  const db = getDb(c);
  const cat = await loadCatalog(db);
  const movs = await db.all<MovementData>('SELECT ingredient_id, event_id, kind, quantity_base FROM stock_movements WHERE owner_id = ?', db.owner);
  const bal = stockBalances(movs);
  const rows = [...cat.ingredients.values()].filter((i) => !i.archived_at || bal.has(i.id)).map((i) => {
    const b = bal.get(i.id);
    const p = cat.current.get(i.id);
    const onHand = b?.on_hand ?? ZERO;
    // valoración a coste por unidad bruta (precio/cantidad envase)
    const value = p ? onHand.times(p.pack_price.div(p.pack_quantity_base)) : null;
    return serializeDecimals({ ingredient_id: i.id, name: i.name, category: i.category, base_unit: i.base_unit, on_hand: onHand, reserved: b?.reserved ?? ZERO, available: onHand.minus(b?.reserved ?? ZERO), value });
  }).sort((a: any, z: any) => String(a.name).localeCompare(String(z.name), 'es'));
  return c.json(rows);
});

purchasing.get('/stock/movements', async (c) => {
  const db = getDb(c);
  const ing = c.req.query('ingredient');
  const rows = ing
    ? await db.all('SELECT m.*, i.name AS ingredient_name, i.base_unit FROM stock_movements m JOIN ingredients i ON i.id = m.ingredient_id WHERE m.owner_id = ? AND m.ingredient_id = ? ORDER BY m.occurred_at DESC, m.created_at DESC LIMIT 300', db.owner, ing)
    : await db.all('SELECT m.*, i.name AS ingredient_name, i.base_unit FROM stock_movements m JOIN ingredients i ON i.id = m.ingredient_id WHERE m.owner_id = ? ORDER BY m.occurred_at DESC, m.created_at DESC LIMIT 300', db.owner);
  return c.json(rows);
});

/** Ajustes, mermas y aperturas manuales. Nunca dejan existencias negativas en silencio. */
purchasing.post('/stock/movements', async (c) => {
  const db = getDb(c);
  const d = await body(c, StockMovementSchema);
  const ing = await db.owned('ingredients', d.ingredient_id, { allowArchived: true });
  const q = dec(d.quantity_base);
  if (d.kind !== 'adjustment' && q.lessThanOrEqualTo(0)) throw new DomainError('invalid_quantity', 'Cantidad debe ser > 0');
  if (q.isZero()) throw new DomainError('invalid_quantity');
  const replay = await db.first('SELECT id FROM stock_movements WHERE owner_id = ? AND idempotency_key = ?', db.owner, d.idempotency_key);
  if (replay) return c.json({ id: replay.id, idempotent_replay: true });
  const movs = await db.all<MovementData>('SELECT ingredient_id, event_id, kind, quantity_base FROM stock_movements WHERE owner_id = ? AND ingredient_id = ?', db.owner, d.ingredient_id);
  assertNotNegative(stockBalances(movs).get(d.ingredient_id), d.kind, q, String(ing.name));
  const id = uuid();
  await db.batch([
    db.prepare('INSERT INTO stock_movements (id, owner_id, ingredient_id, kind, quantity_base, idempotency_key, occurred_at, notes) VALUES (?,?,?,?,?,?,?,?)', id, db.owner, d.ingredient_id, d.kind, q.toFixed(), d.idempotency_key, d.occurred_at, d.notes ?? null),
    db.audit('stock_' + d.kind, 'ingredient', d.ingredient_id, { quantity_base: q.toFixed() }),
  ]);
  return c.json({ id }, 201);
});

export { Decimal };
