import { z } from 'zod';
import { parseAllergenText } from './allergens';
import { Decimal, dec } from './decimal';

/**
 * Importación segura del backup JSON de MISE v1 (`MISE_copia_YYYY-MM-DD.json`).
 * Función pura: valida y produce un plan de filas a insertar. El servicio lo ejecuta en una transacción.
 */

const str = (max: number) => z.string().max(max);
const optStr = (max: number) => z.union([z.string().max(max), z.null(), z.undefined()]).transform((v) => (v ?? '').trim());
const nonNeg = z.number().finite().min(0).max(1e9);

const V1Ingredient = z.object({
  id: str(200).min(1),
  name: str(200).trim().min(1),
  category: optStr(200),
  unit: z.enum(['g', 'ml', 'ud']),
  packQty: z.number().finite().positive().max(1e9),
  packPrice: nonNeg,
  waste: z.number().finite().min(0).lt(100),
  stockQty: nonNeg.optional().default(0),
  supplier: optStr(200),
  allergens: optStr(500),
});
const V1Recipe = z.object({
  id: str(200).min(1),
  name: str(200).trim().min(1),
  category: optStr(200),
  portions: z.number().finite().positive().max(1e6),
  minutes: z.number().finite().min(0).max(100000).optional().default(0),
  notes: optStr(10000),
  allergens: optStr(500),
  lines: z.array(z.object({ ingredientId: str(200).min(1), qty: z.number().finite().positive().max(1e9) })).max(500),
});
const V1Menu = z.object({
  id: str(200).min(1),
  name: str(200).trim().min(1),
  description: optStr(5000),
  lines: z.array(z.object({ recipeId: str(200).min(1), servings: z.number().finite().positive().max(1000) })).max(200),
});
const V1Event = z.object({
  id: str(200).min(1),
  client: str(200).trim().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location: optStr(500),
  guests: z.number().int().positive().max(10000),
  menuId: optStr(200),
  pricePerGuest: nonNeg.optional().default(0),
  extraIncome: nonNeg.optional().default(0),
  staffCost: nonNeg.optional().default(0),
  travelCost: nonNeg.optional().default(0),
  rentalCost: nonNeg.optional().default(0),
  otherCost: nonNeg.optional().default(0),
  targetMargin: z.number().finite().min(0).lt(100).optional().default(35),
  status: optStr(40),
  notes: optStr(10000),
});
const V1Purchase = z.object({
  id: str(200).min(1),
  ingredientId: str(200).min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: optStr(200),
  packQty: z.number().finite().positive().max(1e9),
  packPrice: nonNeg,
  supplier: optStr(200),
});

export const LegacyBackupSchema = z.object({
  version: z.literal(1),
  brand: optStr(200),
  demo: z.boolean().optional().default(false),
  ingredients: z.array(V1Ingredient).max(5000),
  recipes: z.array(V1Recipe).max(5000),
  menus: z.array(V1Menu).max(2000),
  events: z.array(V1Event).max(5000),
  purchases: z.array(V1Purchase).max(20000),
});
export type LegacyBackup = z.infer<typeof LegacyBackupSchema>;

export interface ExistingCatalog {
  suppliers: { id: string; name: string }[];
  ingredients: { id: string; name: string }[];
  clients: { id: string; display_name: string }[];
  recipes: { id: string; name: string }[];
  menus: { id: string; name: string }[];
}

export type Row = Record<string, string | number | null>;

export interface ImportPlan {
  tables: Record<string, Row[]>;
  counts: Record<string, number>;
  reused: Record<string, number>;
  warnings: string[];
  legacy_portion_costs: Record<string, string>; // recipe new id → coste ración calculado con la fórmula v1 (para conciliar)
  confirmed_event_ids: string[];
}

export interface PreviewResult {
  ok: boolean;
  errors: { path: string; message: string }[];
  warnings: string[];
  demo: boolean;
  source_counts: Record<string, number>;
  plan: ImportPlan | null;
}

const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
const n = (x: number) => dec(x).toFixed();

export function parseLegacyJson(text: string, maxBytes = 5_000_000): { data?: unknown; error?: string } {
  if (text.length > maxBytes) return { error: 'too_large' };
  try {
    return { data: JSON.parse(text) };
  } catch {
    return { error: 'malformed_json' };
  }
}

export function planLegacyImport(raw: unknown, existing: ExistingCatalog, opts: { newId: () => string; today: string; strategy: 'merge' }): PreviewResult {
  const errors: PreviewResult['errors'] = [];
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object') return { ok: false, errors: [{ path: '', message: 'not_an_object' }], warnings, demo: false, source_counts: {}, plan: null };
  const v = (raw as { version?: unknown }).version;
  if (v !== 1) return { ok: false, errors: [{ path: 'version', message: `unsupported_version:${String(v)}` }], warnings, demo: false, source_counts: {}, plan: null };
  const parsed = LegacyBackupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, 50).map((i) => ({ path: i.path.join('.'), message: i.message })),
      warnings,
      demo: false,
      source_counts: {},
      plan: null,
    };
  }
  const d = parsed.data;
  const source_counts = { ingredients: d.ingredients.length, recipes: d.recipes.length, menus: d.menus.length, events: d.events.length, purchases: d.purchases.length };

  // Integridad referencial y duplicados de id
  const dupCheck = (arr: { id: string }[], name: string) => {
    const seen = new Set<string>();
    arr.forEach((x, i) => {
      if (seen.has(x.id)) errors.push({ path: `${name}.${i}.id`, message: 'duplicate_id' });
      seen.add(x.id);
    });
    return seen;
  };
  const ingIds = dupCheck(d.ingredients, 'ingredients');
  const recIds = dupCheck(d.recipes, 'recipes');
  const menuIds = dupCheck(d.menus, 'menus');
  dupCheck(d.events, 'events');
  dupCheck(d.purchases, 'purchases');
  d.recipes.forEach((r, i) => r.lines.forEach((l, j) => { if (!ingIds.has(l.ingredientId)) errors.push({ path: `recipes.${i}.lines.${j}.ingredientId`, message: 'orphan_reference' }); }));
  d.menus.forEach((m, i) => m.lines.forEach((l, j) => { if (!recIds.has(l.recipeId)) errors.push({ path: `menus.${i}.lines.${j}.recipeId`, message: 'orphan_reference' }); }));
  d.events.forEach((e, i) => { if (e.menuId && !menuIds.has(e.menuId)) errors.push({ path: `events.${i}.menuId`, message: 'orphan_reference' }); });
  d.purchases.forEach((p, i) => { if (!ingIds.has(p.ingredientId)) errors.push({ path: `purchases.${i}.ingredientId`, message: 'orphan_reference' }); });
  if (errors.length) return { ok: false, errors, warnings, demo: d.demo, source_counts, plan: null };
  if (d.demo) warnings.push('demo_data');

  const tables: Record<string, Row[]> = { suppliers: [], ingredients: [], purchase_formats: [], price_history: [], recipes: [], recipe_lines: [], menus: [], menu_lines: [], clients: [], events: [], event_costs: [], stock_movements: [] };
  const reused: Record<string, number> = { suppliers: 0, ingredients: 0, clients: 0, recipes: 0, menus: 0 };

  // Proveedores (deduplicados por texto)
  const supplierByNorm = new Map<string, string>(existing.suppliers.map((s) => [norm(s.name), s.id]));
  const supplierId = (name: string): string | null => {
    if (!name) return null;
    const k = norm(name);
    const hit = supplierByNorm.get(k);
    if (hit) return hit;
    const id = opts.newId();
    supplierByNorm.set(k, id);
    tables.suppliers!.push({ id, name: name.trim(), notes: 'Importado de MISE v1' });
    return id;
  };

  // Ingredientes + formatos + historial
  const ingMap = new Map<string, string>();
  const ingUnit = new Map<string, string>();
  const ingByNorm = new Map(existing.ingredients.map((x) => [norm(x.name), x.id]));
  const formatKey = new Map<string, string>(); // ingId|supplier|packQty → format id
  const priceKey = new Set<string>();
  const ensureFormat = (ingNewId: string, unit: string, supplier: string, packQty: number) => {
    const sid = supplierId(supplier);
    const key = `${ingNewId}|${sid ?? ''}|${n(packQty)}`;
    let fid = formatKey.get(key);
    if (!fid) {
      fid = opts.newId();
      formatKey.set(key, fid);
      tables.purchase_formats!.push({ id: fid, ingredient_id: ingNewId, supplier_id: sid, label: `${n(packQty)} ${unit}`, pack_quantity_base: n(packQty), whole_packs_only: 1, is_active: 1 });
    }
    return fid;
  };
  const addPrice = (fid: string, date: string, price: number, packQty: number, note: string) => {
    const k = `${fid}|${date}|${n(price)}`;
    if (priceKey.has(k)) return;
    priceKey.add(k);
    tables.price_history!.push({ id: opts.newId(), format_id: fid, effective_at: date, pack_price: n(price), pack_quantity_base: n(packQty), source_type: 'import', note });
  };

  for (const i of d.ingredients) {
    const existingId = ingByNorm.get(norm(i.name));
    if (existingId) {
      ingMap.set(i.id, existingId);
      reused.ingredients!++;
      warnings.push(`ingredient_reused:${i.name}`);
      continue;
    }
    const id = opts.newId();
    ingMap.set(i.id, id);
    ingUnit.set(i.id, i.unit);
    ingByNorm.set(norm(i.name), id);
    const al = parseAllergenText(i.allergens);
    if (al.unknown.length) warnings.push(`allergen_unrecognized:${i.name}:${al.unknown.join('|')}`);
    const fid = ensureFormat(id, i.unit, i.supplier, i.packQty);
    const sid = supplierId(i.supplier);
    tables.ingredients!.push({
      id, name: i.name, category: i.category || null, base_unit: i.unit, waste_pct: n(i.waste),
      allergens_json: JSON.stringify(al.codes), notes: al.unknown.length ? `Alérgenos v1 sin reconocer: ${al.unknown.join(', ')}` : null,
      preferred_supplier_id: sid, preferred_format_id: fid,
    });
    // Compras históricas del ingrediente (precio por fecha real); el precio vigente de v1 se registra si no coincide
    const purchases = d.purchases.filter((p) => p.ingredientId === i.id).sort((a, b) => a.date.localeCompare(b.date));
    for (const p of purchases) {
      const pf = ensureFormat(id, i.unit, p.supplier, p.packQty);
      addPrice(pf, p.date, p.packPrice, p.packQty, p.reference ? `v1 ref. ${p.reference}` : 'v1 compra');
    }
    const last = purchases[purchases.length - 1];
    const matchesLast = last && last.packPrice === i.packPrice && last.packQty === i.packQty && norm(last.supplier) === norm(i.supplier);
    if (!matchesLast) addPrice(fid, opts.today, i.packPrice, i.packQty, 'Precio vigente en v1');
    if (i.stockQty > 0) {
      tables.stock_movements!.push({ id: opts.newId(), ingredient_id: id, event_id: null, purchase_line_id: null, kind: 'opening', quantity_base: n(i.stockQty), idempotency_key: `legacy-opening:${norm(i.name)}`, occurred_at: opts.today, notes: 'Stock inicial importado de v1' });
    }
  }

  // Recetas
  const recMap = new Map<string, string>();
  const recByNorm = new Map(existing.recipes.map((x) => [norm(x.name), x.id]));
  const legacyCosts: Record<string, string> = {};
  for (const r of d.recipes) {
    const existingId = recByNorm.get(norm(r.name));
    if (existingId) {
      recMap.set(r.id, existingId);
      reused.recipes!++;
      warnings.push(`recipe_reused:${r.name}`);
      continue;
    }
    const id = opts.newId();
    recMap.set(r.id, id);
    const al = parseAllergenText(r.allergens);
    tables.recipes!.push({ id, name: r.name, category: r.category || null, notes: r.notes || null, portions: n(r.portions), preparation_minutes: Math.round(r.minutes), allergens_declared_json: JSON.stringify(al.codes) });
    let legacy = new Decimal(0);
    r.lines.forEach((l, idx) => {
      const ingV1 = d.ingredients.find((x) => x.id === l.ingredientId)!;
      tables.recipe_lines!.push({ id: opts.newId(), recipe_id: id, position: idx + 1, ingredient_id: ingMap.get(l.ingredientId)!, subrecipe_id: null, quantity: n(l.qty), unit: ingV1.unit, notes: null });
      legacy = legacy.plus(dec(ingV1.packPrice).div(dec(ingV1.packQty)).div(new Decimal(1).minus(dec(ingV1.waste).div(100))).times(dec(l.qty)));
    });
    legacyCosts[id] = legacy.div(dec(r.portions)).toFixed();
  }

  // Menús
  const menuMap = new Map<string, string>();
  const menuByNorm = new Map(existing.menus.map((x) => [norm(x.name), x.id]));
  for (const m of d.menus) {
    const existingId = menuByNorm.get(norm(m.name));
    if (existingId) {
      menuMap.set(m.id, existingId);
      reused.menus!++;
      warnings.push(`menu_reused:${m.name}`);
      continue;
    }
    const id = opts.newId();
    menuMap.set(m.id, id);
    tables.menus!.push({ id, name: m.name, kind: 'courses', description_es: m.description || null });
    m.lines.forEach((l, idx) => {
      tables.menu_lines!.push({ id: opts.newId(), menu_id: id, position: idx + 1, recipe_id: recMap.get(l.recipeId)!, servings_per_guest: n(l.servings), variant: '' });
    });
  }

  // Clientes (deduplicados por texto, sin asumir persona distinta) y eventos
  const clientByNorm = new Map(existing.clients.map((c) => [norm(c.display_name), c.id]));
  const statusMap: Record<string, string> = { draft: 'draft', quoted: 'quoted', confirmed: 'confirmed', completed: 'completed', cancelled: 'cancelled' };
  const confirmed: string[] = [];
  for (const e of d.events) {
    let cid = clientByNorm.get(norm(e.client));
    if (!cid) {
      cid = opts.newId();
      clientByNorm.set(norm(e.client), cid);
      tables.clients!.push({ id: cid, display_name: e.client, notes_private: 'Cliente provisional importado de v1 (revisar datos)', legal_basis: 'precontractual' });
    } else reused.clients!++;
    const id = opts.newId();
    const status = statusMap[e.status] ?? 'draft';
    if (!statusMap[e.status]) warnings.push(`event_status_unknown:${e.status}`);
    if ((status === 'confirmed' || status === 'completed') && !e.menuId) warnings.push(`event_without_menu:${e.client}`);
    tables.events!.push({
      id, client_id: cid, menu_id: e.menuId ? menuMap.get(e.menuId)! : null, title: e.client, event_date: e.date, location_private: e.location || null,
      guest_count: e.guests, status, price_per_guest: n(e.pricePerGuest), additional_revenue: n(e.extraIncome), discount: '0', vat_rate: '10',
      target_margin_pct: n(e.targetMargin), notes_private: e.notes || null,
    });
    if (status === 'confirmed' || status === 'completed') confirmed.push(id);
    const costs: [string, number][] = [['staff', e.staffCost], ['travel', e.travelCost], ['equipment', e.rentalCost], ['other', e.otherCost]];
    for (const [category, amount] of costs) {
      if (amount > 0) tables.event_costs!.push({ id: opts.newId(), event_id: id, category, description: 'Importado de v1', quantity: '1', unit_amount: n(amount), cost_kind: 'estimated' });
    }
  }

  const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
  return { ok: true, errors: [], warnings, demo: d.demo, source_counts, plan: { tables, counts, reused, warnings, legacy_portion_costs: legacyCosts, confirmed_event_ids: confirmed } };
}
