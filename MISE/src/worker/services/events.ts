import { normalizeAllergens, type Allergen } from '../../shared/allergens';
import {
  actualFinancials, eventFinancials, groupCourses, serializeDecimals, sumCosts, type EventCostData, type Financials, type GuestGroupData, type MenuLineData,
} from '../../shared/costing';
import { CALCULATION_VERSION, Decimal, ZERO, dec, moneyStr } from '../../shared/decimal';
import { stableHash } from '../../shared/allergens';
import type { Db, Row } from '../db';
import { nowIso, uuid } from '../db';
import { ApiError } from '../http';
import { loadCatalog, menuAllergenFingerprint, menuAllergens, recipeReviewState, type Catalog } from './catalog';

export interface EventBundle {
  event: Row & { id: string; status: string; guest_count: number; menu_id: string | null; client_id: string };
  client: Row | null;
  menu: (Row & { id: string; name: string; allergen_review_hash: string | null }) | null;
  menuLines: (MenuLineData & { id: string })[];
  groups: (GuestGroupData & { id: string; dietary_notes_private: string | null })[];
  costs: (EventCostData & { id: string; created_at: string })[];
  snapshots: { id: string; snapshot_kind: string; version: number; created_at: string; sha256: string; calculation_version: string }[];
}

/**
 * Carga varios eventos con un número FIJO de consultas (json_each para la lista de ids), respetando el
 * límite de consultas por invocación del plan gratuito de D1/Workers.
 */
export async function loadEventBundles(db: Db, ids: string[]): Promise<Map<string, EventBundle>> {
  const out = new Map<string, EventBundle>();
  if (!ids.length) return out;
  const o = db.owner;
  const list = JSON.stringify([...new Set(ids)]);
  const [evs, clients, menus, lines, groups, costs, snaps] = await db.batch([
    db.prepare('SELECT * FROM events WHERE owner_id = ? AND id IN (SELECT value FROM json_each(?))', o, list),
    db.prepare('SELECT c.* FROM clients c WHERE c.owner_id = ? AND c.id IN (SELECT client_id FROM events WHERE owner_id = ? AND id IN (SELECT value FROM json_each(?)))', o, o, list),
    db.prepare('SELECT m.* FROM menus m WHERE m.owner_id = ? AND m.id IN (SELECT menu_id FROM events WHERE owner_id = ? AND id IN (SELECT value FROM json_each(?)))', o, o, list),
    db.prepare('SELECT id, menu_id, position, course_name_es, course_name_ca, recipe_id, servings_per_guest, variant FROM menu_lines WHERE owner_id = ? AND menu_id IN (SELECT menu_id FROM events WHERE owner_id = ? AND id IN (SELECT value FROM json_each(?))) ORDER BY position, variant', o, o, list),
    db.prepare('SELECT id, event_id, label, guest_count, variant, dietary_notes_private FROM event_guest_groups WHERE owner_id = ? AND event_id IN (SELECT value FROM json_each(?))', o, list),
    db.prepare('SELECT id, event_id, category, description, quantity, unit_amount, cost_kind, created_at FROM event_costs WHERE owner_id = ? AND event_id IN (SELECT value FROM json_each(?)) ORDER BY created_at', o, list),
    db.prepare('SELECT id, event_id, snapshot_kind, version, created_at, sha256, calculation_version FROM event_snapshots WHERE owner_id = ? AND event_id IN (SELECT value FROM json_each(?)) ORDER BY version DESC', o, list),
  ]);
  const by = <T extends Record<string, unknown>>(rows: T[], key: string) => {
    const m = new Map<string, T[]>();
    for (const r of rows) { const k = String(r[key]); m.set(k, [...(m.get(k) ?? []), r]); }
    return m;
  };
  const clientMap = new Map((clients!.results as Row[]).map((r) => [String(r.id), r]));
  const menuMap = new Map((menus!.results as Row[]).map((r) => [String(r.id), r]));
  const linesBy = by(lines!.results as Row[], 'menu_id');
  const groupsBy = by(groups!.results as Row[], 'event_id');
  const costsBy = by(costs!.results as Row[], 'event_id');
  const snapsBy = by(snaps!.results as Row[], 'event_id');
  for (const e of evs!.results as EventBundle['event'][]) {
    const id = String(e.id);
    out.set(id, {
      event: e,
      client: clientMap.get(String(e.client_id)) ?? null,
      menu: (e.menu_id ? (menuMap.get(e.menu_id) as EventBundle['menu']) : null) ?? null,
      menuLines: (e.menu_id ? linesBy.get(e.menu_id) ?? [] : []) as unknown as EventBundle['menuLines'],
      groups: (groupsBy.get(id) ?? []) as unknown as EventBundle['groups'],
      costs: (costsBy.get(id) ?? []) as unknown as EventBundle['costs'],
      snapshots: (snapsBy.get(id) ?? []) as unknown as EventBundle['snapshots'],
    });
  }
  return out;
}

export async function loadEventBundle(db: Db, eventId: string): Promise<EventBundle> {
  await db.owned('events', eventId, { allowArchived: true });
  return (await loadEventBundles(db, [eventId])).get(eventId)!;
}

export function computeFinancials(b: EventBundle, cat: Catalog): Financials {
  const e = b.event;
  return eventFinancials({
    guest_count: Number(e.guest_count),
    price_per_guest: String(e.price_per_guest),
    additional_revenue: String(e.additional_revenue),
    discount: String(e.discount),
    vat_rate: String(e.vat_rate),
    target_margin_pct: String(e.target_margin_pct),
    groups: b.groups,
    menu_lines: b.menuLines,
    costs: b.costs,
  }, b.menuLines.length ? cat.coster : null);
}

/** Huella de las ENTRADAS del presupuesto: si cambia respecto al snapshot, hay que re-presupuestar. */
export function inputsFingerprint(b: EventBundle, cat: Catalog): string {
  const e = b.event;
  const prices = [...new Set(b.menuLines.map((l) => l.recipe_id))].flatMap((rid) => {
    try { return [[rid, cat.coster.cost(rid).portion_cost.toFixed()]]; } catch { return [[rid, 'err']]; }
  });
  return stableHash({
    g: e.guest_count, p: e.price_per_guest, a: e.additional_revenue, d: e.discount, v: e.vat_rate, m: e.target_margin_pct, menu: e.menu_id,
    lines: b.menuLines.map((l) => [l.position, l.variant, l.recipe_id, l.servings_per_guest]),
    groups: b.groups.map((g) => [g.variant, g.guest_count]),
    costs: b.costs.filter((c) => c.cost_kind === 'estimated').map((c) => [c.category, c.quantity, c.unit_amount]),
    prices,
  });
}

export function menuReviewState(b: EventBundle, cat: Catalog): 'reviewed' | 'pending' | 'stale' | 'no_menu' {
  if (!b.menu) return 'no_menu';
  if (!b.menu.allergen_review_hash) return 'pending';
  return b.menu.allergen_review_hash === menuAllergenFingerprint(cat, b.menuLines) ? 'reviewed' : 'stale';
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Construye el snapshot inmutable: entradas + costes calculados + precios usados + fecha + versión del motor. */
export async function buildSnapshot(db: Db, b: EventBundle, cat: Catalog, kind: 'quoted' | 'confirmed' | 'requoted' | 'completed', extra: Record<string, unknown> = {}) {
  const fin = computeFinancials(b, cat);
  const recipeIds = [...new Set(b.menuLines.map((l) => l.recipe_id))];
  const recipe_costs = Object.fromEntries(recipeIds.map((rid) => {
    const rc = cat.coster.cost(rid);
    return [rid, {
      name: cat.recipes.get(rid)?.name,
      portions: rc.portions, lot_cost: rc.lot_cost, portion_cost: rc.portion_cost, allergens: rc.allergens, complete: rc.complete,
      lines: rc.lines.map((l) => ({ kind: l.kind, ref_id: l.ref_id, name: l.name, quantity: l.quantity, unit: l.unit, unit_cost: l.unit_cost, cost: l.cost, error: l.error })),
    }];
  }));
  const usedIngredients = new Set<string>();
  for (const rid of recipeIds) cat.coster.ingredientDemand(rid, new Decimal(1)).forEach((_, k) => usedIngredients.add(k));
  const prices_used = [...usedIngredients].map((iid) => {
    const p = cat.current.get(iid);
    return { ingredient_id: iid, name: cat.ingredients.get(iid)?.name, format_id: p?.format_id ?? null, label: p?.label ?? null, pack_price: p?.pack_price ?? null, pack_quantity_base: p?.pack_quantity_base ?? null, effective_at: p?.effective_at ?? null, price_id: p?.price_id ?? null, unit_cost: p?.unit_cost ?? null };
  });
  const content = serializeDecimals({
    kind,
    calculation_version: CALCULATION_VERSION,
    created_at: nowIso(),
    prices_as_of: cat.asOf,
    inputs_fingerprint: inputsFingerprint(b, cat),
    event: { ...b.event },
    client: b.client ? { id: b.client.id, display_name: b.client.display_name } : null,
    menu: b.menu ? { id: b.menu.id, name: b.menu.name, version: b.menu.version } : null,
    menu_lines: b.menuLines.map((l) => ({ ...l, recipe_name: cat.recipes.get(l.recipe_id)?.name })),
    guest_groups: b.groups,
    costs: b.costs,
    financials: fin,
    recipe_costs,
    prices_used,
    ...extra,
  });
  const json = JSON.stringify(content);
  const version = (b.snapshots[0]?.version ?? 0) + 1;
  return {
    stmt: db.prepare('INSERT INTO event_snapshots (id, owner_id, event_id, snapshot_kind, version, calculation_version, snapshot_json, sha256) VALUES (?,?,?,?,?,?,?,?)',
      uuid(), db.owner, String(b.event.id), kind, version, CALCULATION_VERSION, json, await sha256Hex(json)),
    content,
    version,
  };
}

export async function latestSnapshot(db: Db, eventId: string, kinds: string[] = ['quoted', 'confirmed', 'requoted', 'completed']) {
  const placeholders = kinds.map(() => '?').join(',');
  const row = await db.first<{ snapshot_json: string; snapshot_kind: string; version: number; sha256: string; created_at: string }>(
    `SELECT snapshot_json, snapshot_kind, version, sha256, created_at FROM event_snapshots WHERE event_id = ? AND owner_id = ? AND snapshot_kind IN (${placeholders}) ORDER BY version DESC LIMIT 1`,
    eventId, db.owner, ...kinds,
  );
  return row ? { ...row, data: JSON.parse(row.snapshot_json) as Record<string, any> } : null;
}

export function confirmRequirements(b: EventBundle, cat: Catalog): string[] {
  const missing: string[] = [];
  if (!b.client) missing.push('client');
  if (!b.event.event_date) missing.push('event_date');
  if (!b.menu || !b.menuLines.length) missing.push('menu');
  if (!(Number(b.event.guest_count) > 0)) missing.push('guest_count');
  if (dec(String(b.event.price_per_guest)).lessThanOrEqualTo(0) && dec(String(b.event.additional_revenue)).lessThanOrEqualTo(0)) missing.push('price');
  if (b.menu && menuReviewState(b, cat) !== 'reviewed') missing.push('menu_allergen_review');
  return missing;
}

/** Comparación previsto (snapshot confirmado/re-presupuestado) vs real, sin reescribir el snapshot. */
export function closingComparison(snapshot: Record<string, any> | null, b: EventBundle, fin: Financials) {
  const estimated = snapshot?.financials ?? serializeDecimals(fin);
  const revenue = dec(estimated.revenue_net);
  const actual = actualFinancials(revenue, b.costs);
  const estOp: Record<string, string> = estimated.operating ?? {};
  const rows = Object.keys(actual.by_category).map((cat) => {
    const est = cat === 'food' ? dec(estimated.food_cost) : dec(estOp[cat] ?? '0');
    const act = actual.by_category[cat as keyof typeof actual.by_category];
    return { category: cat, estimated: est, actual: act, variance: act.minus(est) };
  });
  return serializeDecimals({
    snapshot_version: snapshot?.version ?? null,
    revenue_net: revenue,
    estimated_total_cost: dec(estimated.total_cost),
    estimated_profit: dec(estimated.profit),
    estimated_margin_pct: estimated.margin_pct === null ? null : dec(estimated.margin_pct),
    actual_total_cost: actual.total_cost,
    actual_profit: actual.profit,
    actual_margin_pct: actual.margin_pct,
    actual_food_cost_pct: actual.food_cost_pct,
    variance_total_cost: actual.total_cost.minus(dec(estimated.total_cost)),
    rows,
    has_actual_food: !actual.by_category.food.isZero(),
  });
}

/** DTO para el cliente: SIN costes, escandallos, beneficio, márgenes ni notas privadas. */
export function proposalDto(b: EventBundle, cat: Catalog, settings: Row, lang: 'es' | 'ca') {
  const e = b.event;
  const fin = computeFinancials(b, cat);
  const allergensByVariant = menuAllergens(cat, b.menuLines);
  const courses = groupCourses(b.menuLines).map((c) => {
    const base = c.base;
    const dish = (l: MenuLineData | null) => {
      if (!l) return null;
      const r = cat.recipes.get(l.recipe_id);
      let al: Allergen[] = [];
      try { al = cat.coster.cost(l.recipe_id).allergens; } catch { al = []; }
      return {
        name: r?.name ?? '',
        description: '',
        allergens: al,
      };
    };
    const courseName = (base ?? [...c.variants.values()][0]) as MenuLineData & { course_name_es?: string; course_name_ca?: string };
    return {
      position: c.position,
      course_name: (lang === 'ca' ? courseName.course_name_ca : courseName.course_name_es) || courseName.course_name_es || '',
      dish: dish(base),
      variants: [...c.variants.entries()].map(([variant, l]) => ({ variant, dish: dish(l) })),
    };
  });
  void allergensByVariant;
  return {
    kind: 'client_proposal',
    lang,
    brand: { name: settings.brand_name, tagline: settings.brand_tagline, contact_line: settings.contact_line },
    issued_on: new Date().toISOString().slice(0, 10),
    validity_days: settings.proposal_validity_days,
    terms: settings.proposal_terms,
    reference: `P-${String(e.event_date).replace(/-/g, '')}-${String(e.id).slice(0, 4).toUpperCase()}`,
    event: {
      title: e.title, date: e.event_date, time: e.event_time ?? null, guest_count: e.guest_count, service_type: e.service_type,
      location: e.location_private ?? null, client_name: b.client?.display_name ?? '',
    },
    menu: b.menu ? { name: b.menu.name, description: (lang === 'ca' ? b.menu.description_ca : b.menu.description_es) ?? b.menu.description_es ?? '', courses } : null,
    dietary_groups: b.groups.map((g) => ({ label: g.label, guest_count: g.guest_count, variant: g.variant })),
    pricing: {
      price_per_guest: moneyStr(dec(String(e.price_per_guest))),
      guest_count: e.guest_count,
      services_total: moneyStr(fin.revenue_services),
      additional_revenue: moneyStr(fin.additional_revenue),
      discount: moneyStr(fin.discount),
      taxable_base: moneyStr(fin.revenue_net),
      vat_rate: fin.vat_rate.toFixed(),
      vat_amount: moneyStr(fin.vat_amount),
      total_with_vat: moneyStr(fin.total_with_vat),
      vat_note: settings.vat_note,
    },
    allergen_notice: true,
  };
}

/** Recalcula food cost real sugerido a partir de compras vinculadas al evento. */
export async function linkedPurchasesTotal(db: Db, eventId: string): Promise<Decimal> {
  const rows = await db.all<{ ordered_packs: string; pack_price: string }>(
    "SELECT pl.ordered_packs, pl.pack_price FROM purchase_lines pl JOIN purchases p ON p.id = pl.purchase_id WHERE p.event_id = ? AND p.owner_id = ? AND p.status <> 'cancelled'",
    eventId, db.owner,
  );
  return rows.reduce((a, r) => a.plus(dec(r.ordered_packs).times(dec(r.pack_price))), ZERO);
}

export function estimatedOperating(b: EventBundle) {
  return serializeDecimals(sumCosts(b.costs, 'estimated'));
}

export { loadCatalog, recipeReviewState, normalizeAllergens, ApiError };
