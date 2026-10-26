import { ALLERGENS, type Allergen } from './allergens';
import { Decimal, DomainError, HUNDRED, ONE, ZERO, dec, pctFraction, sum } from './decimal';
import { type BaseUnit, type LineUnit, toBase } from './units';

// ─────────────────────────── Tipos de entrada (datos planos, decimales como string) ───────────────────────────

export interface IngredientData {
  id: string;
  name: string;
  base_unit: BaseUnit;
  waste_pct: string;
  allergens: Allergen[];
  preferred_format_id?: string | null;
}

export interface FormatData {
  id: string;
  ingredient_id: string;
  supplier_id: string | null;
  label: string;
  pack_quantity_base: string;
  whole_packs_only: boolean;
  is_active: boolean;
}

export interface PriceEntry {
  id: string;
  format_id: string;
  effective_at: string; // YYYY-MM-DD
  recorded_at: string;
  pack_price: string;
  pack_quantity_base: string;
}

export interface RecipeLineData {
  id?: string;
  ingredient_id: string | null;
  subrecipe_id: string | null;
  quantity: string;
  unit: LineUnit;
}

export interface RecipeData {
  id: string;
  name: string;
  portions: string;
  yield_quantity: string | null;
  yield_unit: BaseUnit | null;
  allergens_declared: Allergen[];
  lines: RecipeLineData[];
}

export interface MenuLineData {
  position: number;
  course_name_es?: string | null;
  course_name_ca?: string | null;
  recipe_id: string;
  servings_per_guest: string;
  variant: string;
}

export interface GuestGroupData {
  label: string;
  guest_count: number;
  variant: string;
}

export type CostCategory = 'staff' | 'chef_hours' | 'travel' | 'equipment' | 'food' | 'consumables' | 'overhead' | 'other';
export const COST_CATEGORIES: CostCategory[] = ['staff', 'chef_hours', 'travel', 'equipment', 'food', 'consumables', 'overhead', 'other'];

export interface EventCostData {
  category: CostCategory;
  description?: string | null;
  quantity: string;
  unit_amount: string;
  cost_kind: 'estimated' | 'actual';
}

// ─────────────────────────── A. Coste útil de ingrediente ───────────────────────────

/** Cútil = P / (Q × (1 − w/100)). Rechaza P<0, Q≤0 y w∉[0,100). Sin topes ocultos. */
export function usefulUnitCost(packPrice: string | Decimal, packQty: string | Decimal, wastePct: string | Decimal): Decimal {
  const p = dec(packPrice, 'pack_price');
  const q = dec(packQty, 'pack_quantity');
  if (p.isNegative()) throw new DomainError('negative_price', 'Precio negativo');
  if (q.lessThanOrEqualTo(0)) throw new DomainError('invalid_pack_quantity', 'Cantidad de envase debe ser > 0');
  const w = pctFraction(wastePct, 'waste_pct');
  return p.div(q.times(ONE.minus(w)));
}

/** Cantidad útil de un envase: Q × (1 − w/100). */
export function usefulQuantity(packQty: string | Decimal, wastePct: string | Decimal): Decimal {
  return dec(packQty).times(ONE.minus(pctFraction(wastePct, 'waste_pct')));
}

export interface CurrentPrice {
  ingredient_id: string;
  format_id: string;
  supplier_id: string | null;
  label: string;
  pack_price: Decimal;
  pack_quantity_base: Decimal;
  effective_at: string;
  price_id: string;
  unit_cost: Decimal; // coste por unidad base ÚTIL (ya incluye la merma)
}

function latestPrice(entries: PriceEntry[], asOf: string): PriceEntry | null {
  let best: PriceEntry | null = null;
  for (const e of entries) {
    if (e.effective_at > asOf) continue;
    if (!best || e.effective_at > best.effective_at || (e.effective_at === best.effective_at && e.recorded_at > best.recorded_at)) best = e;
  }
  return best;
}

/**
 * Resuelve el precio vigente por ingrediente a fecha `asOf` (YYYY-MM-DD):
 * formato preferido si tiene precio; si no, el precio efectivo más reciente entre formatos activos.
 */
export function resolveCurrentPrices(
  ingredients: IngredientData[],
  formats: FormatData[],
  prices: PriceEntry[],
  asOf: string,
): Map<string, CurrentPrice> {
  const byFormat = new Map<string, PriceEntry[]>();
  for (const p of prices) {
    const arr = byFormat.get(p.format_id) ?? [];
    arr.push(p);
    byFormat.set(p.format_id, arr);
  }
  const formatsByIng = new Map<string, FormatData[]>();
  for (const f of formats) {
    if (!f.is_active) continue;
    const arr = formatsByIng.get(f.ingredient_id) ?? [];
    arr.push(f);
    formatsByIng.set(f.ingredient_id, arr);
  }
  const out = new Map<string, CurrentPrice>();
  for (const ing of ingredients) {
    const fs = formatsByIng.get(ing.id) ?? [];
    let chosen: { f: FormatData; p: PriceEntry } | null = null;
    const pref = fs.find((f) => f.id === ing.preferred_format_id);
    if (pref) {
      const p = latestPrice(byFormat.get(pref.id) ?? [], asOf);
      if (p) chosen = { f: pref, p };
    }
    if (!chosen) {
      for (const f of fs) {
        const p = latestPrice(byFormat.get(f.id) ?? [], asOf);
        if (!p) continue;
        if (!chosen || p.effective_at > chosen.p.effective_at || (p.effective_at === chosen.p.effective_at && p.recorded_at > chosen.p.recorded_at)) chosen = { f, p };
      }
    }
    if (!chosen) continue;
    out.set(ing.id, {
      ingredient_id: ing.id,
      format_id: chosen.f.id,
      supplier_id: chosen.f.supplier_id,
      label: chosen.f.label,
      pack_price: dec(chosen.p.pack_price),
      pack_quantity_base: dec(chosen.p.pack_quantity_base),
      effective_at: chosen.p.effective_at,
      price_id: chosen.p.id,
      unit_cost: usefulUnitCost(chosen.p.pack_price, chosen.p.pack_quantity_base, ing.waste_pct),
    });
  }
  return out;
}

// ─────────────────────────── B. Recetas y subrecetas ───────────────────────────

export interface LineCost {
  index: number;
  kind: 'ingredient' | 'subrecipe';
  ref_id: string;
  name: string;
  quantity: string;
  unit: LineUnit;
  quantity_base: Decimal | null;
  unit_cost: Decimal | null;
  cost: Decimal | null;
  error: string | null;
}

export interface RecipeCost {
  recipe_id: string;
  lot_cost: Decimal;
  portion_cost: Decimal;
  portions: Decimal;
  lines: LineCost[];
  missing_prices: string[];
  errors: string[];
  allergens: Allergen[]; // derivados (ingredientes + subrecetas) ∪ declarados
  derived_allergens: Allergen[];
  complete: boolean;
}

export interface CostingContext {
  recipes: Map<string, RecipeData>;
  ingredients: Map<string, IngredientData>;
  prices: Map<string, CurrentPrice>;
}

/** Calculadora con memoización y detección de ciclos (directos e indirectos). */
export class RecipeCoster {
  private memo = new Map<string, RecipeCost>();
  constructor(private ctx: CostingContext) {}

  cost(recipeId: string): RecipeCost {
    return this.costInner(recipeId, []);
  }

  private costInner(recipeId: string, stack: string[]): RecipeCost {
    const cached = this.memo.get(recipeId);
    if (cached) return cached;
    if (stack.includes(recipeId)) throw new DomainError('recipe_cycle', 'Ciclo de subrecetas', { path: [...stack, recipeId] });
    const r = this.ctx.recipes.get(recipeId);
    if (!r) throw new DomainError('recipe_not_found', recipeId);
    const portions = dec(r.portions, 'portions');
    if (portions.lessThanOrEqualTo(0)) throw new DomainError('invalid_portions', 'Raciones deben ser > 0');
    const lines: LineCost[] = [];
    const missing = new Set<string>();
    const errors: string[] = [];
    const derived = new Set<Allergen>();
    r.lines.forEach((l, index) => {
      const base: LineCost = { index, kind: l.ingredient_id ? 'ingredient' : 'subrecipe', ref_id: (l.ingredient_id ?? l.subrecipe_id)!, name: '', quantity: l.quantity, unit: l.unit, quantity_base: null, unit_cost: null, cost: null, error: null };
      try {
        const qty = dec(l.quantity, 'quantity');
        if (qty.lessThanOrEqualTo(0)) throw new DomainError('invalid_quantity', 'Cantidad debe ser > 0');
        if (l.ingredient_id) {
          const ing = this.ctx.ingredients.get(l.ingredient_id);
          if (!ing) throw new DomainError('ingredient_not_found');
          base.name = ing.name;
          ing.allergens.forEach((a) => derived.add(a));
          base.quantity_base = toBase(qty, l.unit, ing.base_unit);
          const price = this.ctx.prices.get(ing.id);
          if (!price) {
            missing.add(ing.id);
            base.error = 'missing_price';
          } else {
            base.unit_cost = price.unit_cost;
            base.cost = base.quantity_base.times(price.unit_cost);
          }
        } else if (l.subrecipe_id) {
          const sub = this.costInner(l.subrecipe_id, [...stack, recipeId]);
          const subR = this.ctx.recipes.get(l.subrecipe_id)!;
          base.name = subR.name;
          sub.allergens.forEach((a) => derived.add(a));
          sub.missing_prices.forEach((m) => missing.add(m));
          if (sub.errors.length) errors.push(...sub.errors.map((e) => `${subR.name}: ${e}`));
          let factor: Decimal;
          if (l.unit === 'portion') {
            factor = qty.div(sub.portions);
            base.quantity_base = qty;
          } else {
            if (!subR.yield_unit || !subR.yield_quantity) throw new DomainError('subrecipe_without_yield', 'La subreceta no tiene rendimiento medido');
            const y = dec(subR.yield_quantity, 'yield_quantity');
            if (y.lessThanOrEqualTo(0)) throw new DomainError('subrecipe_without_yield');
            base.quantity_base = toBase(qty, l.unit, subR.yield_unit);
            factor = base.quantity_base.div(y);
          }
          base.unit_cost = sub.lot_cost;
          base.cost = sub.lot_cost.times(factor);
        } else {
          throw new DomainError('invalid_line');
        }
      } catch (e) {
        if (e instanceof DomainError && e.code === 'recipe_cycle') throw e;
        base.error = e instanceof DomainError ? e.code : 'error';
        errors.push(`${base.name || base.ref_id}: ${base.error}`);
      }
      lines.push(base);
    });
    const lot = sum(lines.filter((l) => l.cost).map((l) => l.cost!));
    const declared = new Set(r.allergens_declared);
    const all = ALLERGENS.filter((a) => derived.has(a) || declared.has(a));
    const result: RecipeCost = {
      recipe_id: recipeId,
      lot_cost: lot,
      portion_cost: lot.div(portions),
      portions,
      lines,
      missing_prices: [...missing],
      errors,
      allergens: all,
      derived_allergens: ALLERGENS.filter((a) => derived.has(a)),
      complete: missing.size === 0 && errors.length === 0,
    };
    this.memo.set(recipeId, result);
    return result;
  }

  /**
   * Demanda neta de ingredientes (unidad base útil) para producir `lotFactor` lotes de la receta,
   * expandiendo subrecetas. La merma NO se aplica aquí (se aplica una sola vez al comprar).
   */
  ingredientDemand(recipeId: string, lotFactor: Decimal, into = new Map<string, Decimal>(), stack: string[] = []): Map<string, Decimal> {
    if (stack.includes(recipeId)) throw new DomainError('recipe_cycle', 'Ciclo de subrecetas', { path: [...stack, recipeId] });
    const r = this.ctx.recipes.get(recipeId);
    if (!r) throw new DomainError('recipe_not_found', recipeId);
    for (const l of r.lines) {
      const qty = dec(l.quantity);
      if (l.ingredient_id) {
        const ing = this.ctx.ingredients.get(l.ingredient_id);
        if (!ing) continue;
        let q: Decimal;
        try { q = toBase(qty, l.unit, ing.base_unit); } catch { continue; }
        into.set(ing.id, (into.get(ing.id) ?? ZERO).plus(q.times(lotFactor)));
      } else if (l.subrecipe_id) {
        const sub = this.ctx.recipes.get(l.subrecipe_id);
        if (!sub) continue;
        let f: Decimal;
        if (l.unit === 'portion') f = qty.div(dec(sub.portions));
        else {
          if (!sub.yield_unit || !sub.yield_quantity) continue;
          try { f = toBase(qty, l.unit, sub.yield_unit).div(dec(sub.yield_quantity)); } catch { continue; }
        }
        this.ingredientDemand(sub.id, lotFactor.times(f), into, [...stack, recipeId]);
      }
    }
    return into;
  }
}

/** Comprueba que asignar `lines` a `recipeId` no crea ciclos (incluye autorreferencia e indirectos). */
export function assertNoCycle(recipeId: string, lines: RecipeLineData[], recipes: Map<string, RecipeData>): void {
  const visit = (id: string, path: string[]) => {
    if (id === recipeId) throw new DomainError('recipe_cycle', 'Ciclo de subrecetas', { path: [...path, id] });
    if (path.includes(id)) return;
    const r = recipes.get(id);
    if (!r) return;
    for (const l of r.lines) if (l.subrecipe_id) visit(l.subrecipe_id, [...path, id]);
  };
  for (const l of lines) if (l.subrecipe_id) visit(l.subrecipe_id, [recipeId]);
}

// ─────────────────────────── C. Menús y eventos ───────────────────────────

interface Course {
  position: number;
  base: MenuLineData | null;
  variants: Map<string, MenuLineData>;
}

export function groupCourses(lines: MenuLineData[]): Course[] {
  const map = new Map<number, Course>();
  for (const l of lines) {
    const c = map.get(l.position) ?? { position: l.position, base: null, variants: new Map() };
    if (!l.variant) c.base = l;
    else c.variants.set(l.variant, l);
    map.set(l.position, c);
  }
  return [...map.values()].sort((a, b) => a.position - b.position);
}

export function menuVariants(lines: MenuLineData[]): string[] {
  return [...new Set(lines.map((l) => l.variant).filter(Boolean))].sort();
}

/** Línea que toma un comensal de la variante `variant` en un pase: la alternativa si existe, si no la base. */
function lineFor(course: Course, variant: string): MenuLineData | null {
  return (variant && course.variants.get(variant)) || course.base;
}

export interface MenuCost {
  per_guest: Decimal;
  courses: { position: number; recipe_id: string; servings: Decimal; cost: Decimal }[];
  complete: boolean;
}

export function menuCostPerGuest(lines: MenuLineData[], coster: RecipeCoster, variant = ''): MenuCost {
  const courses: MenuCost['courses'] = [];
  let complete = true;
  for (const c of groupCourses(lines)) {
    const l = lineFor(c, variant);
    if (!l) continue;
    const rc = coster.cost(l.recipe_id);
    if (!rc.complete) complete = false;
    const servings = dec(l.servings_per_guest, 'servings_per_guest');
    courses.push({ position: c.position, recipe_id: l.recipe_id, servings, cost: rc.portion_cost.times(servings) });
  }
  return { per_guest: sum(courses.map((c) => c.cost)), courses, complete };
}

export interface PortionPlan {
  /** raciones totales por receta para el evento */
  recipe_portions: Map<string, Decimal>;
  /** comensales por variante ('' = base) */
  population: { variant: string; label: string; guest_count: number }[];
}

/**
 * Reparte a los comensales entre variantes: los grupos con variante toman su alternativa en los pases
 * donde exista; el resto toma el plato base. Nunca se cuentan dos veces.
 */
export function planPortions(guestCount: number, groups: GuestGroupData[], lines: MenuLineData[]): PortionPlan {
  if (!Number.isInteger(guestCount) || guestCount <= 0) throw new DomainError('invalid_guest_count');
  const special = groups.filter((g) => g.variant);
  const specialCount = special.reduce((a, g) => a + g.guest_count, 0);
  if (specialCount > guestCount) throw new DomainError('groups_exceed_guests', 'Los grupos dietéticos superan el total de comensales');
  const population = [{ variant: '', label: 'base', guest_count: guestCount - specialCount }, ...special.map((g) => ({ variant: g.variant, label: g.label, guest_count: g.guest_count }))];
  const recipe_portions = new Map<string, Decimal>();
  const courses = groupCourses(lines);
  for (const p of population) {
    if (p.guest_count === 0) continue;
    for (const c of courses) {
      const l = lineFor(c, p.variant);
      if (!l) continue;
      const add = dec(l.servings_per_guest).times(p.guest_count);
      recipe_portions.set(l.recipe_id, (recipe_portions.get(l.recipe_id) ?? ZERO).plus(add));
    }
  }
  return { recipe_portions, population };
}

export interface EventInput {
  guest_count: number;
  price_per_guest: string;
  additional_revenue: string;
  discount: string;
  vat_rate: string;
  target_margin_pct: string;
  groups: GuestGroupData[];
  menu_lines: MenuLineData[];
  costs: EventCostData[];
}

export interface Financials {
  calculation_version: string;
  guest_count: number;
  revenue_services: Decimal; // precio × comensales
  additional_revenue: Decimal;
  discount: Decimal;
  revenue_net: Decimal; // base imponible
  vat_rate: Decimal;
  vat_amount: Decimal;
  total_with_vat: Decimal;
  food_cost: Decimal;
  food_cost_per_guest: Decimal;
  operating: Record<CostCategory, Decimal>;
  operating_total: Decimal;
  total_cost: Decimal;
  profit: Decimal;
  margin_pct: Decimal | null;
  food_cost_pct: Decimal | null;
  cost_per_guest: Decimal;
  target_margin_pct: Decimal;
  suggested_total: Decimal;
  suggested_per_guest: Decimal;
  recipe_portions: { recipe_id: string; portions: Decimal; portion_cost: Decimal; cost: Decimal }[];
  population: PortionPlan['population'];
  warnings: string[];
}

function costAmount(c: EventCostData): Decimal {
  const q = dec(c.quantity, 'quantity');
  const a = dec(c.unit_amount, 'unit_amount');
  if (q.isNegative() || a.isNegative()) throw new DomainError('negative_cost');
  return q.times(a);
}

export function emptyCategories(): Record<CostCategory, Decimal> {
  return Object.fromEntries(COST_CATEGORIES.map((c) => [c, ZERO])) as Record<CostCategory, Decimal>;
}

export function sumCosts(costs: EventCostData[], kind: 'estimated' | 'actual'): Record<CostCategory, Decimal> {
  const out = emptyCategories();
  for (const c of costs) if (c.cost_kind === kind) out[c.category] = out[c.category].plus(costAmount(c));
  return out;
}

/** Cálculo financiero previsto de un evento (sección C de REGLAS_CALCULO). */
export function eventFinancials(input: EventInput, coster: RecipeCoster | null): Financials {
  const warnings: string[] = [];
  const guests = input.guest_count;
  const price = dec(input.price_per_guest, 'price_per_guest');
  const additional = dec(input.additional_revenue, 'additional_revenue');
  const discount = dec(input.discount, 'discount');
  if (price.isNegative() || additional.isNegative() || discount.isNegative()) throw new DomainError('negative_amount');
  const revenue_services = price.times(guests);
  const revenue_net = revenue_services.plus(additional).minus(discount);
  if (revenue_net.isNegative()) warnings.push('negative_revenue');
  const vat_rate = dec(input.vat_rate, 'vat_rate');
  if (vat_rate.isNegative() || vat_rate.greaterThan(100)) throw new DomainError('out_of_range', 'IVA fuera de rango');
  const vat_amount = revenue_net.times(vat_rate).div(HUNDRED);

  let food = ZERO;
  const recipe_portions: Financials['recipe_portions'] = [];
  let population: PortionPlan['population'] = [{ variant: '', label: 'base', guest_count: guests }];
  if (!input.menu_lines.length || !coster) {
    warnings.push('no_menu');
  } else {
    const plan = planPortions(guests, input.groups, input.menu_lines);
    population = plan.population;
    for (const [rid, portions] of plan.recipe_portions) {
      const rc = coster.cost(rid);
      if (!rc.complete) warnings.push(rc.missing_prices.length ? 'missing_prices' : 'incomplete_recipe');
      const cost = rc.portion_cost.times(portions);
      food = food.plus(cost);
      recipe_portions.push({ recipe_id: rid, portions, portion_cost: rc.portion_cost, cost });
    }
  }
  const estimated = input.costs.filter((c) => c.cost_kind === 'estimated');
  if (estimated.some((c) => c.category === 'food')) throw new DomainError('food_estimated_from_menu', 'El coste de comida previsto se calcula desde el menú; no se admite como partida manual');
  const operating = sumCosts(input.costs, 'estimated');
  const operating_total = sum(Object.values(operating));
  const total_cost = food.plus(operating_total);
  const profit = revenue_net.minus(total_cost);
  const positive = revenue_net.greaterThan(0);
  const m = pctFraction(input.target_margin_pct, 'target_margin_pct');
  const suggested_total = total_cost.div(ONE.minus(m));
  let suggested_per_guest = suggested_total.minus(additional).plus(discount).div(guests);
  if (suggested_per_guest.isNegative()) suggested_per_guest = ZERO;
  return {
    calculation_version: 'mise-calc-2.0.0',
    guest_count: guests,
    revenue_services,
    additional_revenue: additional,
    discount,
    revenue_net,
    vat_rate,
    vat_amount,
    total_with_vat: revenue_net.plus(vat_amount),
    food_cost: food,
    food_cost_per_guest: food.div(guests),
    operating,
    operating_total,
    total_cost,
    profit,
    margin_pct: positive ? profit.div(revenue_net).times(HUNDRED) : null,
    food_cost_pct: positive ? food.div(revenue_net).times(HUNDRED) : null,
    cost_per_guest: total_cost.div(guests),
    target_margin_pct: dec(input.target_margin_pct),
    suggested_total,
    suggested_per_guest,
    recipe_portions,
    population,
    warnings: [...new Set(warnings)],
  };
}

/** Resultado real al cierre a partir de costes reales registrados. */
export function actualFinancials(revenueNet: Decimal, costs: EventCostData[]) {
  const by = sumCosts(costs, 'actual');
  const total = sum(Object.values(by));
  const profit = revenueNet.minus(total);
  return {
    by_category: by,
    total_cost: total,
    profit,
    margin_pct: revenueNet.greaterThan(0) ? profit.div(revenueNet).times(HUNDRED) : null,
    food_cost_pct: revenueNet.greaterThan(0) ? by.food.div(revenueNet).times(HUNDRED) : null,
  };
}

/** Serializa Decimals recursivamente a strings (para snapshots y respuestas JSON). */
export function serializeDecimals<T>(value: T): unknown {
  if (value instanceof Decimal) return value.toFixed();
  if (value instanceof Map) return Object.fromEntries([...value.entries()].map(([k, v]) => [k, serializeDecimals(v)]));
  if (Array.isArray(value)) return value.map((v) => serializeDecimals(v));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serializeDecimals(v)]));
  return value;
}
