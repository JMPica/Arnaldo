import legacyJson from '../../fixtures/legacy_backup_v1_ficticio.json';
import { beforeAll, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { call, installAccessMock, seedBasic } from './helpers';
import { verifyIdentity } from '../../src/worker/auth';

beforeAll(installAccessMock);
const key = () => `k-${crypto.randomUUID()}`;

describe('E2E-01 (API) flujo completo: catálogo → receta+subreceta → menú 8 pases → evento → propuesta → confirmar → compras → recepción → producción → cierre', () => {
  it('recorre el ciclo y produce margen real', async () => {
    const s = await seedBasic();
    // subreceta medida en gramos: fondo 800 g
    const fondo = await call('/api/v1/recipes', { body: { name: 'Fondo base', portions: '4', yield_quantity: '800', yield_unit: 'g', lines: [{ ingredient_id: s.cal.id, quantity: '1000', unit: 'g' }] } });
    expect(fondo.status).toBe(201);
    const plato = await call('/api/v1/recipes', { body: { name: 'Plato con fondo', portions: '4', lines: [{ subrecipe_id: fondo.data.id, quantity: '200', unit: 'g' }, { ingredient_id: s.nata.id, quantity: '0.1', unit: 'l' }] } });
    expect(plato.status).toBe(201);
    const pc = (await call(`/api/v1/recipes/${plato.data.id}`)).data;
    // fondo: 1000 g × 2.40/800 = 3.00 €/lote → 200/800 × 3 = 0.75 ; nata 100 ml × 0.0042 = 0.42
    expect(pc.cost.lot_cost).toBe('1.17');
    // ciclo prohibido: fondo → plato
    const cyc = await call(`/api/v1/recipes/${fondo.data.id}`, { method: 'PUT', body: { name: 'Fondo base', portions: '4', yield_quantity: '800', yield_unit: 'g', lines: [{ subrecipe_id: plato.data.id, quantity: '1', unit: 'portion' }] } });
    expect(cyc.status).toBe(422);
    expect(cyc.data.error).toBe('recipe_cycle');
    // g → ml prohibido
    expect((await call('/api/v1/recipes', { body: { name: 'Mal', portions: '1', lines: [{ ingredient_id: s.nata.id, quantity: '10', unit: 'g' }] } })).data.error).toBe('incompatible_units');
    // menú de 8 pases
    const lines = Array.from({ length: 8 }, (_, i) => ({ position: i + 1, course_name_es: `Pase ${i + 1}`, recipe_id: i % 2 ? plato.data.id : s.rec.id, servings_per_guest: '1', variant: '' }));
    const menu = await call('/api/v1/menus', { body: { name: 'Degustación 8 pases', kind: 'tasting', lines } });
    expect(menu.status).toBe(201);
    const ev = await call('/api/v1/events', { body: { client_id: s.client.id, menu_id: menu.data.id, title: 'Cena 10 pax', event_date: '2030-05-10', guest_count: 10, price_per_guest: '120', vat_rate: '10', target_margin_pct: '40' } });
    expect(ev.status).toBe(201);
    const eid = ev.data.id;
    await call(`/api/v1/events/${eid}/costs`, { body: { category: 'chef_hours', description: 'Mis horas', quantity: '8', unit_amount: '30', cost_kind: 'estimated' } });
    await call(`/api/v1/events/${eid}/costs`, { body: { category: 'travel', quantity: '1', unit_amount: '25', cost_kind: 'estimated' } });
    // E2E-07: la propuesta y la confirmación se bloquean hasta revisar alérgenos
    expect((await call(`/api/v1/events/${eid}/proposal`)).data.error).toBe('menu_allergens_not_reviewed');
    expect((await call(`/api/v1/menus/${menu.data.id}/allergen-review`, { method: 'POST' })).data.error).toBe('recipes_pending_allergen_review');
    const conf0 = await call(`/api/v1/events/${eid}/confirm`, { method: 'POST' });
    expect(conf0.status).toBe(422);
    expect(conf0.data.details.missing).toContain('menu_allergen_review');
    // subreceta antes que la receta que la usa
    expect((await call(`/api/v1/recipes/${plato.data.id}/allergen-review`, { method: 'POST' })).data.error).toBe('subrecipes_not_reviewed');
    for (const r of [s.rec.id, fondo.data.id, plato.data.id]) expect((await call(`/api/v1/recipes/${r}/allergen-review`, { method: 'POST' })).status).toBe(200);
    expect((await call(`/api/v1/menus/${menu.data.id}/allergen-review`, { method: 'POST' })).status).toBe(200);
    // propuesta cliente (E2E-05): sin costes ni márgenes
    const prop = await call(`/api/v1/events/${eid}/proposal`);
    expect(prop.status).toBe(200);
    const pj = JSON.stringify(prop.data);
    for (const leak of ['cost', 'profit', 'margin', 'food', 'notes_private', 'unit_cost', 'lot_cost', 'portion_cost', 'Mis horas']) expect(pj).not.toContain(leak);
    expect(prop.data.pricing.taxable_base).toBe('1200.00');
    expect(prop.data.pricing.total_with_vat).toBe('1320.00');
    expect(prop.data.menu.courses).toHaveLength(8);
    expect(prop.data.menu.courses[0].dish.allergens).toContain('milk');
    // informe interno SÍ incluye márgenes
    const internal = await call(`/api/v1/events/${eid}/internal-report`);
    expect(internal.data.event.live_financials.margin_pct).toBeTruthy();
    // presupuestar y confirmar → snapshots
    expect((await call(`/api/v1/events/${eid}/quote`, { method: 'POST' })).data.status).toBe('quoted');
    const conf = await call(`/api/v1/events/${eid}/confirm`, { method: 'POST' });
    expect(conf.status, JSON.stringify(conf.data).slice(0, 300)).toBe(200);
    expect(conf.data.status).toBe('confirmed');
    expect(conf.data.snapshot.version).toBe(2);
    const food = conf.data.snapshot.financials.food_cost;
    // compras: lista consolidada del evento
    const sl = await call(`/api/v1/shopping-list?events=${eid}`);
    expect(sl.status).toBe(200);
    const calRow = sl.data.rows.find((r: any) => r.name === 'Calabaza');
    expect(calRow.packs).toBeTruthy();
    // pedido + recepción parcial + total, idempotente
    const purchase = await call('/api/v1/purchases', { body: { supplier_id: s.sup.id, event_id: eid, external_reference: 'ALB-1', purchase_date: '2030-05-08', update_prices: true, lines: sl.data.rows.map((r: any) => ({ ingredient_id: r.ingredient_id, format_id: r.format.format_id, ordered_packs: r.packs, pack_quantity_base: r.format.pack_quantity_base, pack_price: r.format.pack_price })) } });
    expect(purchase.status).toBe(201);
    const pd = (await call(`/api/v1/purchases/${purchase.data.id}`)).data;
    const k = key();
    const first = pd.lines[0];
    const half = await call(`/api/v1/purchases/${purchase.data.id}/receive`, { body: { idempotency_key: k, received_at: '2030-05-08', lines: [{ line_id: first.id, packs: '1' }] } });
    expect(half.data.purchase.status).toBe(pd.lines.length === 1 && first.ordered_packs === '1' ? 'received' : 'partial');
    const replay = await call(`/api/v1/purchases/${purchase.data.id}/receive`, { body: { idempotency_key: k, received_at: '2030-05-08', lines: [{ line_id: first.id, packs: '1' }] } });
    expect(replay.data.idempotent_replay).toBe(true);
    const rest = pd.lines.map((l: any) => ({ line_id: l.id, packs: String(Number(l.ordered_packs) - (l.id === first.id ? 1 : 0)) })).filter((l: any) => Number(l.packs) > 0);
    if (rest.length) expect((await call(`/api/v1/purchases/${purchase.data.id}/receive`, { body: { idempotency_key: key(), received_at: '2030-05-08', lines: rest } })).data.purchase.status).toBe('received');
    // sobre-recepción rechazada
    expect((await call(`/api/v1/purchases/${purchase.data.id}/receive`, { body: { idempotency_key: key(), received_at: '2030-05-08', lines: [{ line_id: first.id, packs: '1' }] } })).data.error).toBe('over_receipt');
    // producción: reserva y consumo
    const reserve = await call(`/api/v1/events/${eid}/reserve-stock`, { body: { idempotency_key: key() } });
    expect(reserve.status).toBe(200);
    const prod = await call(`/api/v1/events/${eid}/production`);
    expect(prod.data.plan.length).toBeGreaterThan(0);
    const consume = await call(`/api/v1/events/${eid}/consume-stock`, { body: { idempotency_key: key() } });
    expect(consume.status).toBe(200);
    // cierre: exige costes reales
    expect((await call(`/api/v1/events/${eid}/complete`, { method: 'POST' })).data.error).toBe('actual_costs_required');
    await call(`/api/v1/events/${eid}/costs`, { body: { category: 'food', quantity: '1', unit_amount: '60', cost_kind: 'actual' } });
    await call(`/api/v1/events/${eid}/costs`, { body: { category: 'chef_hours', quantity: '9', unit_amount: '30', cost_kind: 'actual' } });
    const done = await call(`/api/v1/events/${eid}/complete`, { method: 'POST' });
    expect(done.status).toBe(200);
    expect(done.data.status).toBe('completed');
    expect(done.data.closing.actual_total_cost).toBe('330');
    expect(done.data.closing.actual_profit).toBe('870');
    expect(done.data.closing.actual_margin_pct).toBe('72.5');
    // snapshot confirmado intacto
    const v2 = await call(`/api/v1/events/${eid}/snapshots/2`);
    expect(v2.data.data.financials.food_cost).toBe(food);
    // evento cerrado: no editable
    expect((await call(`/api/v1/events/${eid}`, { method: 'PATCH', body: { guest_count: 12 } })).status).toBe(409);
    // dashboard e informe
    const dash = await call('/api/v1/dashboard');
    expect(dash.status).toBe(200);
    expect(dash.data.actual.events).toBeGreaterThanOrEqual(1);
    const rep = await call('/api/v1/reports/profitability');
    expect(rep.data.rows.find((r: any) => r.id === eid).actual_profit).toBe('870');
  });
});

describe('CALC-06 / E2E-04 precio nuevo no reescribe snapshot confirmado; re-presupuestar crea versión', () => {
  it('snapshot inmutable y versión nueva', async () => {
    const s = await seedBasic();
    await call(`/api/v1/recipes/${s.rec.id}/allergen-review`, { method: 'POST' });
    const menu = await call('/api/v1/menus', { body: { name: 'M', lines: [{ position: 1, recipe_id: s.rec.id, servings_per_guest: '2', variant: '' }] } });
    await call(`/api/v1/menus/${menu.data.id}/allergen-review`, { method: 'POST' });
    const ev = await call('/api/v1/events', { body: { client_id: s.client.id, menu_id: menu.data.id, title: 'Fixture', event_date: '2030-01-01', guest_count: 10, price_per_guest: '50', vat_rate: '10', target_margin_pct: '40' } });
    await call(`/api/v1/events/${ev.data.id}/costs`, { body: { category: 'staff', quantity: '1', unit_amount: '25', cost_kind: 'estimated' } });
    await call(`/api/v1/events/${ev.data.id}/costs`, { body: { category: 'travel', quantity: '1', unit_amount: '15', cost_kind: 'estimated' } });
    const c1 = await call(`/api/v1/events/${ev.data.id}/confirm`, { method: 'POST' });
    // cifras exactas del fixture
    expect(c1.data.snapshot.financials.food_cost).toBe('11.28');
    expect(c1.data.snapshot.financials.profit).toBe('448.72');
    expect(c1.data.snapshot.financials.margin_pct).toBe('89.744');
    // sube la calabaza
    expect((await call(`/api/v1/purchase-formats/${s.f1.id}/prices`, { body: { pack_price: '4.80', effective_at: '2026-10-20' } })).status).toBe(201);
    const after = (await call(`/api/v1/events/${ev.data.id}`)).data;
    expect(after.snapshot.financials.food_cost).toBe('11.28');
    expect(after.live_financials.food_cost).not.toBe('11.28');
    expect(after.changed_since_snapshot).toBe(true);
    // edición del menú después de confirmar no toca el snapshot
    await call(`/api/v1/menus/${menu.data.id}`, { method: 'PUT', body: { name: 'M', lines: [{ position: 1, recipe_id: s.rec.id, servings_per_guest: '3', variant: '' }] } });
    expect((await call(`/api/v1/events/${ev.data.id}/snapshots/1`)).data.data.financials.food_cost).toBe('11.28');
    // re-presupuestar requiere revisar de nuevo el menú modificado
    await call(`/api/v1/menus/${menu.data.id}/allergen-review`, { method: 'POST' });
    const rq = await call(`/api/v1/events/${ev.data.id}/requote`, { method: 'POST' });
    expect(rq.status).toBe(200);
    expect(rq.data.snapshot.version).toBe(2);
    expect(rq.data.snapshot.kind).toBe('requoted');
    expect((await call(`/api/v1/events/${ev.data.id}/snapshots/1`)).data.data.financials.food_cost).toBe('11.28');
    // la base de datos impide modificar un snapshot
    const DB = (env as any).DB as D1Database;
    await expect(DB.prepare("UPDATE event_snapshots SET snapshot_json = '{}' WHERE event_id = ?").bind(ev.data.id).run()).rejects.toThrow(/immutable_snapshot/);
    await expect(DB.prepare("UPDATE price_history SET pack_price = '0'").run()).rejects.toThrow(/immutable_price_history/);
    // historial de precios conservado
    const ing = (await call(`/api/v1/ingredients/${s.cal.id}`)).data;
    expect(ing.price_history.map((p: any) => p.pack_price)).toEqual(['4.8', '2.4']);
    // alerta de subida de precio
    const alerts = (await call('/api/v1/price-alerts')).data;
    expect(alerts.find((a: any) => a.ingredient_id === s.cal.id).change_pct).toBe('100');
  });
});

describe('E2E-02 / E2E-03 compras consolidadas, stock e idempotencia', () => {
  it('dos eventos comparten ingrediente: stock descontado una vez y envases redondeados una vez', async () => {
    const sup = (await call('/api/v1/suppliers', { body: { name: 'Huerta' } })).data;
    const z = (await call('/api/v1/ingredients', { body: { name: 'Zanahoria E2E', base_unit: 'g', waste_pct: '25', allergens: [] } })).data;
    await call('/api/v1/purchase-formats', { body: { ingredient_id: z.id, supplier_id: sup.id, label: '500 g', pack_quantity_base: '500', initial_price: '3.00', effective_at: '2026-01-01' } });
    const r1 = (await call('/api/v1/recipes', { body: { name: 'Zan 400', portions: '1', lines: [{ ingredient_id: z.id, quantity: '400', unit: 'g' }] } })).data;
    const r2 = (await call('/api/v1/recipes', { body: { name: 'Zan 350', portions: '1', lines: [{ ingredient_id: z.id, quantity: '350', unit: 'g' }] } })).data;
    const m1 = (await call('/api/v1/menus', { body: { name: 'Z1', lines: [{ position: 1, recipe_id: r1.id, servings_per_guest: '1', variant: '' }] } })).data;
    const m2 = (await call('/api/v1/menus', { body: { name: 'Z2', lines: [{ position: 1, recipe_id: r2.id, servings_per_guest: '1', variant: '' }] } })).data;
    const cl = (await call('/api/v1/clients', { body: { display_name: 'Z' } })).data;
    const e1 = (await call('/api/v1/events', { body: { client_id: cl.id, menu_id: m1.id, title: 'Z1', event_date: '2031-01-01', guest_count: 1, price_per_guest: '10', vat_rate: '10', target_margin_pct: '30' } })).data;
    const e2 = (await call('/api/v1/events', { body: { client_id: cl.id, menu_id: m2.id, title: 'Z2', event_date: '2031-01-02', guest_count: 1, price_per_guest: '10', vat_rate: '10', target_margin_pct: '30' } })).data;
    await call('/api/v1/stock/movements', { body: { ingredient_id: z.id, kind: 'opening', quantity_base: '100', occurred_at: '2026-10-01', idempotency_key: key() } });
    const sl = (await call(`/api/v1/shopping-list?events=${e1.id},${e2.id}`)).data;
    const row = sl.rows.find((r: any) => r.ingredient_id === z.id);
    expect(row.net).toBe('750');
    expect(row.gross).toBe('1000');
    expect(row.stock_available).toBe('100');
    expect(row.need).toBe('900');
    expect(row.packs).toBe('2');
    expect(row.expected_cost).toBe('6');
  });

  it('stock nunca negativo en silencio; reintento no duplica movimientos', async () => {
    const i = (await call('/api/v1/ingredients', { body: { name: 'Sal E2E', base_unit: 'g', waste_pct: '0', allergens: [] } })).data;
    const k = key();
    expect((await call('/api/v1/stock/movements', { body: { ingredient_id: i.id, kind: 'opening', quantity_base: '50', occurred_at: '2026-10-01', idempotency_key: k } })).status).toBe(201);
    expect((await call('/api/v1/stock/movements', { body: { ingredient_id: i.id, kind: 'opening', quantity_base: '50', occurred_at: '2026-10-01', idempotency_key: k } })).data.idempotent_replay).toBe(true);
    const neg = await call('/api/v1/stock/movements', { body: { ingredient_id: i.id, kind: 'waste', quantity_base: '60', occurred_at: '2026-10-02', idempotency_key: key() } });
    expect(neg.status).toBe(422);
    expect(neg.data.error).toBe('negative_stock');
    expect((await call('/api/v1/stock/movements', { body: { ingredient_id: i.id, kind: 'adjustment', quantity_base: '-20', occurred_at: '2026-10-02', idempotency_key: key() } })).status).toBe(201);
    const st = (await call('/api/v1/stock')).data.find((r: any) => r.ingredient_id === i.id);
    expect(st.on_hand).toBe('30');
    // archivar ingrediente (sin borrado físico) y conserva histórico
    expect((await call(`/api/v1/ingredients/${i.id}`, { method: 'DELETE' })).data.archived).toBe(true);
    expect((await call(`/api/v1/ingredients/${i.id}`)).data.movements.length).toBe(2);
  });

  it('referencia de compra duplicada exige confirmación explícita', async () => {
    const sup = (await call('/api/v1/suppliers', { body: { name: 'Dup SL' } })).data;
    const i = (await call('/api/v1/ingredients', { body: { name: 'Dup ing', base_unit: 'ud', waste_pct: '0', allergens: [] } })).data;
    const body = { supplier_id: sup.id, external_reference: 'F-77', purchase_date: '2026-10-10', lines: [{ ingredient_id: i.id, ordered_packs: '1', pack_quantity_base: '12', pack_price: '3' }] };
    expect((await call('/api/v1/purchases', { body })).status).toBe(201);
    expect((await call('/api/v1/purchases', { body })).data.error).toBe('duplicate_reference');
    expect((await call('/api/v1/purchases', { body: { ...body, allow_duplicate_reference: true } })).status).toBe(201);
  });

  it('variantes dietéticas por grupos de comensales', async () => {
    const s = await seedBasic();
    const veg = (await call('/api/v1/recipes', { body: { name: 'Alternativa vegana', portions: '1', lines: [{ ingredient_id: s.cal.id, quantity: '100', unit: 'g' }] } })).data;
    const menu = (await call('/api/v1/menus', { body: { name: 'Con alternativa', lines: [
      { position: 1, recipe_id: s.rec.id, servings_per_guest: '1', variant: '' },
      { position: 1, recipe_id: veg.id, servings_per_guest: '1', variant: 'vegano' },
    ] } })).data;
    const ev = (await call('/api/v1/events', { body: { client_id: s.client.id, menu_id: menu.id, title: 'Alt', event_date: '2031-02-02', guest_count: 10, price_per_guest: '0', vat_rate: '10', target_margin_pct: '30', guest_groups: [{ label: 'Veganos', guest_count: 3, variant: 'vegano' }] } })).data;
    const v = (await call(`/api/v1/events/${ev.id}`)).data;
    const portions = Object.fromEntries(v.live_financials.recipe_portions.map((r: any) => [r.recipe_id, r.portions]));
    expect(portions[s.rec.id]).toBe('7');
    expect(portions[veg.id]).toBe('3');
    expect(v.live_financials.margin_pct).toBeNull(); // ingreso 0 → indefinido
    expect((await call('/api/v1/events', { body: { client_id: s.client.id, menu_id: menu.id, title: 'X', event_date: '2031-02-02', guest_count: 2, price_per_guest: '0', vat_rate: '10', target_margin_pct: '30', guest_groups: [{ label: 'V', guest_count: 3, variant: 'vegano' }] } })).data.error).toBe('groups_exceed_guests');
  });
});

describe('SEC-05 configuración ausente → error seguro, nunca acceso público', () => {
  it('sin AUTH_MODE, sin AUD o modo dev fuera de loopback', async () => {
    const req = new Request('https://mise.example.com/api/v1/events');
    await expect(verifyIdentity(req, {} as any)).rejects.toMatchObject({ status: 500, code: 'auth_not_configured' });
    await expect(verifyIdentity(req, { AUTH_MODE: 'access', ACCESS_TEAM_DOMAIN: 'https://x.cloudflareaccess.com', OWNER_EMAILS: 'a@b.c' } as any)).rejects.toMatchObject({ status: 500 });
    await expect(verifyIdentity(req, { AUTH_MODE: 'access', ACCESS_AUD: 'x', ACCESS_TEAM_DOMAIN: 'https://x.cloudflareaccess.com' } as any)).rejects.toMatchObject({ status: 500 });
    await expect(verifyIdentity(req, { AUTH_MODE: 'dev', DEV_USER_EMAIL: 'a@b.c', OWNER_EMAILS: 'a@b.c' } as any)).rejects.toMatchObject({ status: 403 });
    await expect(verifyIdentity(new Request('http://localhost/x'), { AUTH_MODE: 'dev', DEV_USER_EMAIL: 'a@b.c', OWNER_EMAILS: 'a@b.c', APP_ENV: 'production' } as any)).rejects.toMatchObject({ status: 403 });
    await expect(verifyIdentity(new Request('http://localhost/x'), { AUTH_MODE: 'dev', DEV_USER_EMAIL: 'a@b.c', OWNER_EMAILS: 'a@b.c' } as any)).resolves.toMatchObject({ email: 'a@b.c' });
  });
});

describe('IMPORT v1 + BACKUP/RESTORE', () => {
  const legacy = JSON.stringify(legacyJson, null, 2);

  it('IMPORT-01/02/03: preview, commit con backup previo, conciliación, reimportación bloqueada', async () => {
    // IMPORT-02: inválido → preview con errores y sin cambios
    const before = (await call('/api/v1/ingredients')).data.length;
    const bad = JSON.parse(legacy);
    bad.menus[0].lines[0].recipeId = 'huérfana';
    const pb = await call('/api/v1/imports/legacy/preview', { body: { json: JSON.stringify(bad) } });
    expect(pb.data.ok).toBe(false);
    expect((await call('/api/v1/imports/legacy/commit', { body: { json: JSON.stringify(bad), confirm: true } })).status).toBe(422);
    expect((await call('/api/v1/imports/legacy/preview', { body: { json: '{"version":2}' } })).data.errors[0].message).toContain('unsupported_version');
    expect((await call('/api/v1/ingredients')).data.length).toBe(before);
    // preview correcta
    const p = await call('/api/v1/imports/legacy/preview', { body: { json: legacy } });
    expect(p.data.ok).toBe(true);
    expect(p.data.source_counts).toEqual({ ingredients: 2, recipes: 1, menus: 1, events: 1, purchases: 1 });
    // sin confirmación explícita → rechazado
    expect((await call('/api/v1/imports/legacy/commit', { body: { json: legacy } })).data.error).toBe('explicit_confirmation_required');
    const c = await call('/api/v1/imports/legacy/commit', { body: { json: legacy, confirm: true } });
    expect(c.status).toBe(200);
    expect(c.data.pre_import_backup).toBeTruthy();
    expect(c.data.reconciliation[0].equal).toBe(true);
    expect(c.data.snapshots_created).toBe(1);
    const ings = (await call('/api/v1/ingredients')).data.filter((i: any) => i.name.includes('demo sintética'));
    expect(ings).toHaveLength(2);
    expect(ings.find((i: any) => i.name.startsWith('Calabaza')).stock_on_hand).toBe('300');
    const evs = (await call('/api/v1/events')).data.filter((e: any) => e.client_name === 'Cliente DEMO sintético');
    expect(evs).toHaveLength(1);
    const evd = (await call(`/api/v1/events/${evs[0].id}`)).data;
    expect(evd.snapshot.financials.food_cost).toBe('5.64'); // 0.564 €/ración × 1 ración × 10 comensales
    // IMPORT-03: misma fuente → bloqueada salvo confirmación de merge; con merge no duplica
    expect((await call('/api/v1/imports/legacy/commit', { body: { json: legacy, confirm: true } })).data.error).toBe('already_imported');
    const again = await call('/api/v1/imports/legacy/commit', { body: { json: legacy, confirm: true, allow_reimport: true } });
    expect(again.data.counts.ingredients).toBe(0);
    expect(again.data.counts.stock_movements).toBe(0);
    expect((await call('/api/v1/ingredients')).data.filter((i: any) => i.name.includes('demo sintética'))).toHaveLength(2);
  });

  it('SEC-04 + BACKUP-01/02: exportación sin secretos, restauración completa tras borrado, confirmación obligatoria', async () => {
    const s = await seedBasic();
    const up = await call('/api/v1/documents', { method: 'POST', raw: (() => { const f = new FormData(); f.append('file', new File([new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')], 'albaran.pdf', { type: 'application/pdf' })); return f; })() });
    expect(up.status).toBe(201);
    const exp = await call('/api/v1/exports/backup.json?files=1');
    expect(exp.status).toBe(200);
    const text = JSON.stringify(exp.data);
    for (const secret of ['CF_Authorization', 'cf-access-jwt', 'eyJhbGci', 'ACCESS_AUD', 'test-aud-123', 'password', 'access_subject']) expect(text).not.toContain(secret);
    expect(exp.data.format).toBe('mise-backup');
    expect(exp.data.counts.ingredients).toBeGreaterThan(0);
    expect(Object.keys(exp.data.files).length).toBe(exp.data.counts.documents);
    // descarga solo autenticada
    expect((await call('/api/v1/exports/backup.json', { token: null })).status).toBe(401);
    // simulación de pérdida: borrar datos del propietario directamente
    const DB = (env as any).DB as D1Database;
    const owner = (await DB.prepare("SELECT owner_id FROM app_users WHERE email = 'chef@example.com'").first<{ owner_id: string }>())!.owner_id;
    await DB.batch(['stock_movements', 'purchase_lines', 'purchases', 'event_snapshots', 'event_costs', 'event_guest_groups', 'events', 'documents', 'menu_lines', 'menus', 'recipe_lines', 'recipes', 'price_history', 'purchase_formats', 'ingredients', 'clients', 'suppliers'].map((t) => DB.prepare(`DELETE FROM ${t} WHERE owner_id = ?`).bind(owner)));
    await DB.prepare("DELETE FROM blob_chunks WHERE owner_id = ? AND blob_key LIKE 'doc/%'").bind(owner).run();
    expect((await call('/api/v1/ingredients')).data).toHaveLength(0);
    // preview + sin confirmación → rechazo
    const pv = await call('/api/v1/restore/preview', { body: exp.data });
    expect(pv.data.ok).toBe(true);
    expect(pv.data.checksum_ok).toBe(true);
    expect((await call('/api/v1/restore/commit', { body: { backup: exp.data } })).data.error).toBe('explicit_confirmation_required');
    // backup manipulado → checksum falla
    const tampered = JSON.parse(JSON.stringify(exp.data));
    tampered.tables.ingredients[0].name = 'manipulado';
    expect((await call('/api/v1/restore/commit', { body: { backup: tampered, confirm: 'RESTAURAR' } })).data.details).toContain('checksum_mismatch');
    const t0 = Date.now();
    const rs = await call('/api/v1/restore/commit', { body: { backup: exp.data, confirm: 'RESTAURAR' } });
    const ms = Date.now() - t0;
    expect(rs.status).toBe(200);
    expect(rs.data.mismatches).toEqual([]);
    expect(rs.data.pre_restore_backup).toBeTruthy();
    for (const [t, n] of Object.entries(exp.data.counts)) if (t !== 'audit_log') expect(rs.data.counts[t]).toBe(n);
    // snapshots y documentos (con fichero) recuperados
    const docs = (await call('/api/v1/documents')).data;
    const f = await call(`/api/v1/documents/${docs[0].id}/file`);
    expect(String(f.data)).toContain('%PDF-1.4');
    expect((await call(`/api/v1/recipes/${s.rec.id}`)).data.cost.lot_cost).toBe('2.256');
    // la restauración previa queda guardada en servidor (BACKUP-02)
    const backups = (await call('/api/v1/backups')).data;
    expect(backups.some((b: any) => b.reason === 'pre_restore')).toBe(true);
    console.log(`restore_ms=${ms}`);
  });
});
