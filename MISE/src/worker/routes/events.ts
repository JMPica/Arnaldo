import { Hono } from 'hono';
import { serializeDecimals } from '../../shared/costing';
import { Decimal, DomainError, ZERO, dec } from '../../shared/decimal';
import { ClientSchema, EventCostSchema, EventSchema, EventStockSchema, GuestGroupSchema } from '../../shared/schemas';
import { assertNotNegative, stockBalances, type MovementData } from '../../shared/shopping';
import { getDb, nowIso, todayMadrid, uuid, type Db } from '../db';
import type { AppEnv } from '../env';
import { ApiError, body } from '../http';
import { loadCatalog } from '../services/catalog';
import {
  buildSnapshot, closingComparison, computeFinancials, confirmRequirements, inputsFingerprint, latestSnapshot, linkedPurchasesTotal, loadEventBundle, menuReviewState, proposalDto,
} from '../services/events';
import { updateStmt } from './catalog';
import { z } from 'zod';

export const events = new Hono<AppEnv>();

// ───────────── Clientes ─────────────
const CLIENT_COLS = ['display_name', 'email', 'phone', 'address_private', 'dietary_preferences', 'notes_private', 'legal_basis'];

events.get('/clients', async (c) => {
  const db = getDb(c);
  const archived = c.req.query('archived') === '1';
  return c.json(await db.all(`SELECT c.*, (SELECT COUNT(*) FROM events e WHERE e.client_id = c.id AND e.owner_id = c.owner_id) AS events_count,
    (SELECT MAX(event_date) FROM events e WHERE e.client_id = c.id AND e.owner_id = c.owner_id) AS last_event_date
    FROM clients c WHERE c.owner_id = ? AND ${archived ? 'c.archived_at IS NOT NULL' : 'c.archived_at IS NULL'} ORDER BY c.display_name COLLATE NOCASE`, db.owner));
});
events.post('/clients', async (c) => {
  const db = getDb(c);
  const d = await body(c, ClientSchema);
  const id = uuid();
  await db.batch([
    db.prepare('INSERT INTO clients (id, owner_id, display_name, email, phone, address_private, dietary_preferences, notes_private, legal_basis) VALUES (?,?,?,?,?,?,?,?,?)',
      id, db.owner, d.display_name, d.email ?? null, d.phone ?? null, d.address_private ?? null, d.dietary_preferences ?? null, d.notes_private ?? null, d.legal_basis),
    db.audit('create', 'client', id),
  ]);
  return c.json(await db.owned('clients', id), 201);
});
events.get('/clients/:id', async (c) => {
  const db = getDb(c);
  const cl = await db.owned('clients', c.req.param('id'), { allowArchived: true });
  const evs = await db.all('SELECT id, title, event_date, status, guest_count FROM events WHERE client_id = ? AND owner_id = ? ORDER BY event_date DESC', cl.id as string, db.owner);
  return c.json({ ...cl, events: evs });
});
events.patch('/clients/:id', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  await db.owned('clients', id);
  const d = await body(c, ClientSchema.partial());
  const st = updateStmt(db, 'clients', id, d, CLIENT_COLS);
  if (st) await db.batch([st, db.audit('update', 'client', id)]);
  return c.json(await db.owned('clients', id));
});
/** Archivar; con ?anonymize=1 se eliminan datos personales conservando la trazabilidad económica (RGPD). */
events.delete('/clients/:id', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  await db.owned('clients', id, { allowArchived: true });
  const anonymize = c.req.query('anonymize') === '1';
  const stmts = [db.prepare('UPDATE clients SET archived_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?', nowIso(), nowIso(), id, db.owner)];
  if (anonymize) {
    stmts.push(db.prepare("UPDATE clients SET display_name = 'Cliente anonimizado', email = NULL, phone = NULL, address_private = NULL, dietary_preferences = NULL, notes_private = NULL WHERE id = ? AND owner_id = ?", id, db.owner));
    stmts.push(db.prepare('UPDATE events SET location_private = NULL WHERE client_id = ? AND owner_id = ?', id, db.owner));
    stmts.push(db.prepare('UPDATE event_guest_groups SET dietary_notes_private = NULL WHERE owner_id = ? AND event_id IN (SELECT id FROM events WHERE client_id = ? AND owner_id = ?)', db.owner, id, db.owner));
  }
  stmts.push(db.audit(anonymize ? 'anonymize' : 'archive', 'client', id));
  await db.batch(stmts);
  return c.json({ archived: true, anonymized: anonymize });
});

// ───────────── Eventos ─────────────
const EVENT_COLS = ['client_id', 'menu_id', 'title', 'service_type', 'event_date', 'event_time', 'location_private', 'guest_count', 'price_per_guest', 'additional_revenue', 'discount', 'vat_rate', 'target_margin_pct', 'purchase_date', 'production_date', 'instructions', 'restrictions', 'notes_private'];

function groupInserts(db: Db, eventId: string, groups: z.infer<typeof GuestGroupSchema>[]) {
  return db.bulkInsert('event_guest_groups', ['id', 'event_id', 'label', 'guest_count', 'variant', 'dietary_notes_private'],
    groups.map((g) => ({ id: uuid(), event_id: eventId, label: g.label, guest_count: g.guest_count, variant: g.variant, dietary_notes_private: g.dietary_notes_private ?? null })));
}

function checkGroups(guests: number, groups: z.infer<typeof GuestGroupSchema>[] | undefined) {
  if (!groups) return;
  const n = groups.filter((g) => g.variant).reduce((a, g) => a + g.guest_count, 0);
  if (n > guests) throw new DomainError('groups_exceed_guests', 'Los grupos dietéticos superan el total de comensales');
}

events.get('/events', async (c) => {
  const db = getDb(c);
  const status = c.req.query('status');
  const from = c.req.query('from');
  const params: string[] = [db.owner];
  let where = 'e.owner_id = ? AND e.archived_at IS NULL';
  if (status && /^[a-z,]+$/.test(status)) {
    const list = status.split(',');
    where += ` AND e.status IN (${list.map(() => '?').join(',')})`;
    params.push(...list);
  }
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) { where += ' AND e.event_date >= ?'; params.push(from); }
  const rows = await db.all(`SELECT e.id, e.title, e.event_date, e.event_time, e.status, e.guest_count, e.price_per_guest, e.additional_revenue, e.discount, e.service_type, e.menu_id,
    c.display_name AS client_name, m.name AS menu_name FROM events e JOIN clients c ON c.id = e.client_id LEFT JOIN menus m ON m.id = e.menu_id
    WHERE ${where} ORDER BY e.event_date DESC LIMIT 500`, ...params);
  return c.json(rows);
});

events.post('/events', async (c) => {
  const db = getDb(c);
  const d = await body(c, EventSchema);
  await db.owned('clients', d.client_id);
  if (d.menu_id) await db.owned('menus', d.menu_id);
  checkGroups(d.guest_count, d.guest_groups);
  const id = uuid();
  await db.batch([
    db.prepare(`INSERT INTO events (id, owner_id, client_id, menu_id, title, service_type, event_date, event_time, location_private, guest_count, price_per_guest, additional_revenue, discount, vat_rate, target_margin_pct, purchase_date, production_date, instructions, restrictions, notes_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, db.owner, d.client_id, d.menu_id ?? null, d.title, d.service_type, d.event_date, d.event_time ?? null, d.location_private ?? null, d.guest_count,
      d.price_per_guest, d.additional_revenue, d.discount, d.vat_rate, d.target_margin_pct, d.purchase_date ?? null, d.production_date ?? null, d.instructions ?? null, d.restrictions ?? null, d.notes_private ?? null),
    ...groupInserts(db, id, d.guest_groups ?? []),
    db.audit('create', 'event', id),
  ]);
  return c.json({ id }, 201);
});

async function eventView(db: Db, id: string) {
  const b = await loadEventBundle(db, id);
  const cat = await loadCatalog(db);
  let financials = null;
  let error = null;
  try { financials = serializeDecimals(computeFinancials(b, cat)); } catch (e) { error = e instanceof DomainError ? e.code : 'error'; }
  const snap = await latestSnapshot(db, id, ['quoted', 'confirmed', 'requoted']);
  const completed = await latestSnapshot(db, id, ['completed']);
  const fp = (() => { try { return inputsFingerprint(b, cat); } catch { return null; } })();
  return {
    ...b.event,
    client: b.client,
    menu: b.menu ? { id: b.menu.id, name: b.menu.name, version: b.menu.version } : null,
    menu_lines: b.menuLines.map((l) => ({ ...l, recipe_name: cat.recipes.get(l.recipe_id)?.name })),
    guest_groups: b.groups,
    costs: b.costs,
    snapshots: b.snapshots,
    live_financials: financials,
    financials_error: error,
    snapshot: snap ? { version: snap.version, kind: snap.snapshot_kind, created_at: snap.created_at, sha256: snap.sha256, financials: snap.data.financials, prices_as_of: snap.data.prices_as_of } : null,
    changed_since_snapshot: snap ? snap.data.inputs_fingerprint !== fp : false,
    menu_allergen_review: menuReviewState(b, cat),
    confirm_missing: confirmRequirements(b, cat),
    closing: completed ? completed.data.closing : (b.event.status === 'confirmed' || b.event.status === 'completed') && financials ? closingComparison(snap?.data ?? null, b, computeFinancials(b, cat), snap?.version ?? null) : null,
    linked_purchases_total: (await linkedPurchasesTotal(db, id)).toFixed(),
  };
}

events.get('/events/:id', async (c) => c.json(await eventView(getDb(c), c.req.param('id'))));

events.patch('/events/:id', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const ev = await db.owned('events', id);
  if (ev.status === 'completed' || ev.status === 'cancelled') throw new ApiError(409, 'event_closed');
  const d = await body(c, EventSchema.partial());
  if (d.client_id) await db.owned('clients', d.client_id);
  if (d.menu_id) await db.owned('menus', d.menu_id);
  const guests = d.guest_count ?? Number(ev.guest_count);
  if (d.guest_groups) checkGroups(guests, d.guest_groups);
  else if (d.guest_count) {
    const groups = await db.all<{ guest_count: number; variant: string }>('SELECT guest_count, variant FROM event_guest_groups WHERE event_id = ? AND owner_id = ?', id, db.owner);
    checkGroups(guests, groups as z.infer<typeof GuestGroupSchema>[]);
  }
  const stmts = [];
  const st = updateStmt(db, 'events', id, d, EVENT_COLS);
  if (st) stmts.push(st);
  if (d.guest_groups) {
    stmts.push(db.prepare('DELETE FROM event_guest_groups WHERE event_id = ? AND owner_id = ?', id, db.owner));
    stmts.push(...groupInserts(db, id, d.guest_groups));
  }
  stmts.push(db.audit('update', 'event', id));
  await db.batch(stmts);
  return c.json(await eventView(db, id));
});

events.delete('/events/:id', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const ev = await db.owned('events', id, { allowArchived: true });
  if (ev.status === 'confirmed') throw new ApiError(409, 'cancel_before_archive');
  await db.batch([db.prepare('UPDATE events SET archived_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?', nowIso(), nowIso(), id, db.owner), db.audit('archive', 'event', id)]);
  return c.json({ archived: true });
});

// Costes del evento (previstos y reales)
events.post('/events/:id/costs', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const ev = await db.owned('events', id);
  if (ev.status === 'completed' || ev.status === 'cancelled') throw new ApiError(409, 'event_closed');
  const d = await body(c, EventCostSchema);
  if (d.category === 'food' && d.cost_kind === 'estimated') throw new DomainError('food_estimated_from_menu', 'El coste previsto de comida se calcula desde el menú');
  const cid = uuid();
  await db.batch([
    db.prepare('INSERT INTO event_costs (id, owner_id, event_id, category, description, quantity, unit_amount, cost_kind) VALUES (?,?,?,?,?,?,?,?)', cid, db.owner, id, d.category, d.description ?? null, d.quantity, d.unit_amount, d.cost_kind),
    db.audit('add_cost', 'event', id, { category: d.category, kind: d.cost_kind }),
  ]);
  return c.json({ id: cid }, 201);
});
events.delete('/events/:id/costs/:costId', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const ev = await db.owned('events', id);
  if (ev.status === 'completed' || ev.status === 'cancelled') throw new ApiError(409, 'event_closed');
  const r = await db.run('DELETE FROM event_costs WHERE id = ? AND event_id = ? AND owner_id = ?', c.req.param('costId'), id, db.owner);
  if (!r.meta.changes) throw new ApiError(404, 'not_found');
  return c.json({ deleted: true });
});

// ───────────── Ciclo de vida (snapshots inmutables) ─────────────
events.post('/events/:id/quote', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const b = await loadEventBundle(db, id);
  if (!['draft', 'quoted'].includes(b.event.status)) throw new ApiError(409, 'invalid_transition');
  if (!b.menuLines.length) throw new ApiError(409, 'menu_required');
  const cat = await loadCatalog(db);
  const snap = await buildSnapshot(db, b, cat, 'quoted');
  await db.batch([snap.stmt, db.prepare("UPDATE events SET status = 'quoted', quoted_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?", nowIso(), nowIso(), id, db.owner), db.audit('quote', 'event', id, { version: snap.version })]);
  return c.json(await eventView(db, id));
});

events.post('/events/:id/confirm', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const b = await loadEventBundle(db, id);
  if (!['draft', 'quoted'].includes(b.event.status)) throw new ApiError(409, 'invalid_transition');
  const cat = await loadCatalog(db);
  const missing = confirmRequirements(b, cat);
  if (missing.length) throw new ApiError(422, 'confirm_requirements', { missing });
  const snap = await buildSnapshot(db, b, cat, 'confirmed');
  await db.batch([snap.stmt, db.prepare("UPDATE events SET status = 'confirmed', confirmed_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?", nowIso(), nowIso(), id, db.owner), db.audit('confirm', 'event', id, { version: snap.version })]);
  return c.json(await eventView(db, id));
});

/** Re-presupuestar un evento confirmado: crea una versión nueva; las anteriores no cambian. */
events.post('/events/:id/requote', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const b = await loadEventBundle(db, id);
  if (b.event.status !== 'confirmed') throw new ApiError(409, 'invalid_transition');
  const cat = await loadCatalog(db);
  const missing = confirmRequirements(b, cat);
  if (missing.length) throw new ApiError(422, 'confirm_requirements', { missing });
  const snap = await buildSnapshot(db, b, cat, 'requoted');
  await db.batch([snap.stmt, db.audit('requote', 'event', id, { version: snap.version })]);
  return c.json(await eventView(db, id));
});

events.post('/events/:id/complete', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const b = await loadEventBundle(db, id);
  if (b.event.status !== 'confirmed') throw new ApiError(409, 'invalid_transition');
  if (!b.costs.some((x) => x.cost_kind === 'actual')) throw new ApiError(422, 'actual_costs_required');
  const cat = await loadCatalog(db);
  const prev = await latestSnapshot(db, id, ['confirmed', 'requoted']);
  const closing = closingComparison(prev?.data ?? null, b, computeFinancials(b, cat), prev?.version ?? null);
  const snap = await buildSnapshot(db, b, cat, 'completed', { closing, closed_against_version: prev?.version ?? null });
  // Libera reservas pendientes del evento
  const releases = await reservationReleases(db, id, 'complete');
  await db.batch([snap.stmt, ...releases, db.prepare("UPDATE events SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?", nowIso(), nowIso(), id, db.owner), db.audit('complete', 'event', id, { version: snap.version })]);
  return c.json(await eventView(db, id));
});

events.post('/events/:id/cancel', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const ev = await db.owned('events', id);
  if (ev.status === 'completed' || ev.status === 'cancelled') throw new ApiError(409, 'invalid_transition');
  const releases = await reservationReleases(db, id, 'cancel');
  await db.batch([...releases, db.prepare("UPDATE events SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?", nowIso(), nowIso(), id, db.owner), db.audit('cancel', 'event', id)]);
  return c.json(await eventView(db, id));
});

events.get('/events/:id/snapshots/:version', async (c) => {
  const db = getDb(c);
  await db.owned('events', c.req.param('id'), { allowArchived: true });
  const row = await db.first<{ snapshot_json: string; sha256: string; snapshot_kind: string; version: number; created_at: string }>('SELECT snapshot_json, sha256, snapshot_kind, version, created_at FROM event_snapshots WHERE event_id = ? AND owner_id = ? AND version = ?', c.req.param('id'), db.owner, Number(c.req.param('version')));
  if (!row) throw new ApiError(404, 'not_found');
  return c.json({ ...row, snapshot_json: undefined, data: JSON.parse(row.snapshot_json) });
});

// ───────────── Documentos del evento ─────────────
/** Propuesta para el cliente: DTO filtrado en servidor (sin costes, márgenes, escandallos ni notas privadas). */
events.get('/events/:id/proposal', async (c) => {
  const db = getDb(c);
  const lang = c.req.query('lang') === 'ca' ? 'ca' : 'es';
  const b = await loadEventBundle(db, c.req.param('id'));
  const cat = await loadCatalog(db);
  if (!b.menu || !b.menuLines.length) throw new ApiError(409, 'menu_required');
  if (menuReviewState(b, cat) !== 'reviewed') throw new ApiError(409, 'menu_allergens_not_reviewed');
  const settings = (await db.first('SELECT * FROM settings WHERE owner_id = ?', db.owner))!;
  const descs = new Map((await db.all<{ id: string; description_es: string | null; description_ca: string | null }>('SELECT id, description_es, description_ca FROM recipes WHERE owner_id = ?', db.owner)).map((r) => [r.id, r]));
  const dto = proposalDto(b, cat, settings, lang);
  // descripciones de plato (texto comercial de la receta, nunca instrucciones ni escandallo)
  const byName = new Map(b.menuLines.map((l) => [cat.recipes.get(l.recipe_id)?.name ?? '', l.recipe_id]));
  for (const course of dto.menu?.courses ?? []) {
    for (const d of [course.dish, ...course.variants.map((v) => v.dish)]) {
      if (!d) continue;
      const r = descs.get(byName.get(d.name) ?? '');
      d.description = (lang === 'ca' ? r?.description_ca || r?.description_es : r?.description_es) ?? '';
    }
  }
  await db.run('INSERT INTO audit_log (id, owner_id, actor_user_id, action, entity_type, entity_id) VALUES (?,?,?,?,?,?)', uuid(), db.owner, db.user.id, 'export_proposal', 'event', String(b.event.id));
  return c.json(dto);
});

/** Informe interno: incluye costes, márgenes, escandallos, comparación y notas privadas. */
events.get('/events/:id/internal-report', async (c) => {
  const db = getDb(c);
  const view = await eventView(db, c.req.param('id'));
  const cat = await loadCatalog(db);
  const recipeIds = [...new Set((view.menu_lines as { recipe_id: string }[]).map((l) => l.recipe_id))];
  const recipe_costs = recipeIds.map((rid) => { try { return serializeDecimals({ id: rid, name: cat.recipes.get(rid)?.name, ...cat.coster.cost(rid) }); } catch { return { id: rid, name: cat.recipes.get(rid)?.name, error: true }; } });
  const settings = await db.first('SELECT brand_name, brand_tagline FROM settings WHERE owner_id = ?', db.owner);
  return c.json({ kind: 'internal_report', settings, event: view, recipe_costs });
});

// ───────────── Producción: reservas y consumo de stock ─────────────
async function eventDemandGross(db: Db, eventId: string) {
  const b = await loadEventBundle(db, eventId);
  const cat = await loadCatalog(db);
  const fin = computeFinancials(b, cat);
  const demand = new Map<string, Decimal>();
  for (const rp of fin.recipe_portions) {
    const r = cat.recipes.get(rp.recipe_id)!;
    cat.coster.ingredientDemand(rp.recipe_id, rp.portions.div(dec(r.portions)), demand);
  }
  const gross = new Map<string, Decimal>();
  for (const [iid, net] of demand) {
    const ing = cat.ingredients.get(iid)!;
    gross.set(iid, net.div(new Decimal(1).minus(dec(ing.waste_pct).div(100))));
  }
  return { gross, cat, b };
}

const MOV_COLS = ['id', 'ingredient_id', 'event_id', 'kind', 'quantity_base', 'idempotency_key', 'occurred_at', 'notes'];

async function reservationReleases(db: Db, eventId: string, tag: string) {
  const existing = await db.all<MovementData>('SELECT ingredient_id, event_id, kind, quantity_base FROM stock_movements WHERE owner_id = ? AND event_id = ? AND kind IN (\'reservation\',\'reservation_release\')', db.owner, eventId);
  const bal = stockBalances(existing);
  const rows: Record<string, unknown>[] = [];
  for (const [iid, b] of bal) {
    const r = b.reserved_by_event.get(eventId) ?? ZERO;
    if (r.greaterThan(0)) rows.push({ id: uuid(), ingredient_id: iid, event_id: eventId, kind: 'reservation_release', quantity_base: r.toFixed(), idempotency_key: `release:${tag}:${eventId}:${iid}:${r.toFixed()}`, occurred_at: todayMadrid(), notes: `Liberación (${tag})` });
  }
  return db.bulkInsert('stock_movements', MOV_COLS, rows);
}

events.get('/events/:id/production', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const { gross, cat, b } = await eventDemandGross(db, id);
  const movs = await db.all<MovementData>('SELECT ingredient_id, event_id, kind, quantity_base FROM stock_movements WHERE owner_id = ?', db.owner);
  const bal = stockBalances(movs);
  const consumed = await db.all<{ ingredient_id: string; q: string }>("SELECT ingredient_id, quantity_base AS q FROM stock_movements WHERE owner_id = ? AND event_id = ? AND kind = 'consumption'", db.owner, id);
  const consumedBy = new Map<string, Decimal>();
  for (const r of consumed) consumedBy.set(r.ingredient_id, (consumedBy.get(r.ingredient_id) ?? ZERO).plus(dec(r.q)));
  const rows = [...gross.entries()].map(([iid, g]) => {
    const ing = cat.ingredients.get(iid)!;
    const bl = bal.get(iid);
    return serializeDecimals({ ingredient_id: iid, name: ing.name, base_unit: ing.base_unit, gross_needed: g, on_hand: bl?.on_hand ?? ZERO, reserved_total: bl?.reserved ?? ZERO, reserved_this_event: bl?.reserved_by_event.get(id) ?? ZERO, consumed: consumedBy.get(iid) ?? ZERO });
  }).sort((a: any, z: any) => String(a.name).localeCompare(String(z.name), 'es'));
  // Plan de producción: recetas, raciones, tiempos y subrecetas
  const fin = computeFinancials(b, cat);
  const plan = fin.recipe_portions.map((rp) => {
    const r = cat.recipes.get(rp.recipe_id)!;
    return serializeDecimals({ recipe_id: rp.recipe_id, name: r.name, portions: rp.portions, lots: rp.portions.div(dec(r.portions)), subrecipes: r.lines.filter((l) => l.subrecipe_id).map((l) => cat.recipes.get(l.subrecipe_id!)?.name) });
  });
  return c.json({ ingredients: rows, plan, event: { id, title: b.event.title, event_date: b.event.event_date, production_date: b.event.production_date, purchase_date: b.event.purchase_date, status: b.event.status } });
});

/** Reserva el stock disponible para el evento (idempotente). Nunca reserva más de lo disponible. */
events.post('/events/:id/reserve-stock', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const ev = await db.owned('events', id);
  if (ev.status !== 'confirmed') throw new ApiError(409, 'event_not_confirmed');
  const d = await body(c, EventStockSchema);
  const { gross, cat } = await eventDemandGross(db, id);
  const movs = await db.all<MovementData>('SELECT ingredient_id, event_id, kind, quantity_base FROM stock_movements WHERE owner_id = ?', db.owner);
  const bal = stockBalances(movs);
  const rows: Record<string, unknown>[] = [];
  const result: { ingredient: string; reserved: string }[] = [];
  for (const [iid, need] of gross) {
    const b = bal.get(iid);
    if (!b) continue;
    const already = b.reserved_by_event.get(id) ?? ZERO;
    const freeStock = b.on_hand.minus(b.reserved);
    const toReserve = Decimal.min(need.minus(already), freeStock);
    if (toReserve.lessThanOrEqualTo(0)) continue;
    rows.push({ id: uuid(), ingredient_id: iid, event_id: id, kind: 'reservation', quantity_base: toReserve.toFixed(), idempotency_key: `${d.idempotency_key}:reserve:${iid}`, occurred_at: todayMadrid(), notes: 'Reserva para evento' });
    result.push({ ingredient: cat.ingredients.get(iid)!.name, reserved: toReserve.toFixed() });
  }
  const replay = await db.first('SELECT 1 FROM stock_movements WHERE owner_id = ? AND idempotency_key LIKE ? LIMIT 1', db.owner, `${d.idempotency_key}:reserve:%`);
  if (replay) return c.json({ reserved: [], idempotent_replay: true });
  if (rows.length) await db.batch([...db.bulkInsert('stock_movements', MOV_COLS, rows), db.audit('reserve_stock', 'event', id, { lines: result.length })]);
  return c.json({ reserved: result });
});

/** Registra el consumo real de producción: descuenta existencias y libera la reserva del evento. */
events.post('/events/:id/consume-stock', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const ev = await db.owned('events', id);
  if (ev.status !== 'confirmed') throw new ApiError(409, 'event_not_confirmed');
  const d = await body(c, EventStockSchema);
  const already = await db.first("SELECT 1 FROM stock_movements WHERE owner_id = ? AND idempotency_key LIKE ? LIMIT 1", db.owner, `${d.idempotency_key}:consume:%`);
  if (already) return c.json({ consumed: [], idempotent_replay: true });
  const { gross, cat } = await eventDemandGross(db, id);
  const lines = d.lines?.length ? new Map(d.lines.map((l) => [l.ingredient_id, dec(l.quantity_base)])) : gross;
  const movs = await db.all<MovementData>('SELECT ingredient_id, event_id, kind, quantity_base FROM stock_movements WHERE owner_id = ?', db.owner);
  const bal = stockBalances(movs);
  const shortages: unknown[] = [];
  const rows: Record<string, unknown>[] = [];
  for (const [iid, q] of lines) {
    const ing = cat.ingredients.get(iid);
    if (!ing) throw new ApiError(404, 'not_found', { entity: 'ingredient' });
    try { assertNotNegative(bal.get(iid), 'consumption', q, ing.name); } catch (e) { shortages.push((e as DomainError).details); continue; }
    rows.push({ id: uuid(), ingredient_id: iid, event_id: id, kind: 'consumption', quantity_base: q.toFixed(), idempotency_key: `${d.idempotency_key}:consume:${iid}`, occurred_at: todayMadrid(), notes: 'Consumo de producción' });
    const reserved = bal.get(iid)?.reserved_by_event.get(id) ?? ZERO;
    if (reserved.greaterThan(0)) {
      rows.push({ id: uuid(), ingredient_id: iid, event_id: id, kind: 'reservation_release', quantity_base: Decimal.min(reserved, q).toFixed(), idempotency_key: `${d.idempotency_key}:release:${iid}`, occurred_at: todayMadrid(), notes: 'Liberación por consumo' });
    }
  }
  if (shortages.length) throw new ApiError(409, 'negative_stock', { shortages });
  await db.batch([...db.bulkInsert('stock_movements', MOV_COLS, rows), db.audit('consume_stock', 'event', id)]);
  return c.json({ consumed: [...lines.entries()].map(([iid, q]) => ({ ingredient_id: iid, quantity_base: q.toFixed() })) });
});
