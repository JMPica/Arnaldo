import { normalizeAllergens, stableHash, type Allergen } from '../../shared/allergens';
import {
  RecipeCoster, resolveCurrentPrices, type CurrentPrice, type FormatData, type IngredientData, type MenuLineData, type PriceEntry, type RecipeData,
} from '../../shared/costing';
import type { BaseUnit, LineUnit } from '../../shared/units';
import type { Db } from '../db';
import { todayMadrid } from '../db';

export interface Catalog {
  ingredients: Map<string, IngredientData & { category: string | null; archived_at: string | null; preferred_supplier_id: string | null; notes: string | null }>;
  formats: FormatData[];
  prices: PriceEntry[];
  recipes: Map<string, RecipeData & { category: string | null; archived_at: string | null; allergen_review_hash: string | null; allergens_reviewed_at: string | null; updated_at: string }>;
  current: Map<string, CurrentPrice>;
  coster: RecipeCoster;
  asOf: string;
}

/** Carga en ~5 consultas todo lo necesario para escandallos (escala de un chef privado: cientos de filas). */
export async function loadCatalog(db: Db, asOf = todayMadrid()): Promise<Catalog> {
  const o = db.owner;
  const [ings, fmts, prices, recipes, lines] = await db.batch([
    db.prepare('SELECT id, name, category, base_unit, waste_pct, allergens_json, preferred_format_id, preferred_supplier_id, notes, archived_at FROM ingredients WHERE owner_id = ?', o),
    db.prepare('SELECT id, ingredient_id, supplier_id, label, pack_quantity_base, whole_packs_only, is_active FROM purchase_formats WHERE owner_id = ?', o),
    db.prepare('SELECT id, format_id, effective_at, recorded_at, pack_price, pack_quantity_base FROM price_history WHERE owner_id = ?', o),
    db.prepare('SELECT id, name, category, portions, yield_quantity, yield_unit, allergens_declared_json, allergen_review_hash, allergens_reviewed_at, archived_at, updated_at FROM recipes WHERE owner_id = ?', o),
    db.prepare('SELECT recipe_id, ingredient_id, subrecipe_id, quantity, unit, id FROM recipe_lines WHERE owner_id = ? ORDER BY recipe_id, position', o),
  ]);
  const ingredients = new Map<string, Catalog['ingredients'] extends Map<string, infer V> ? V : never>();
  for (const r of ings!.results as Record<string, string | null>[]) {
    ingredients.set(r.id!, {
      id: r.id!, name: r.name!, category: r.category ?? null, base_unit: r.base_unit as BaseUnit, waste_pct: r.waste_pct!,
      allergens: normalizeAllergens(JSON.parse(r.allergens_json ?? '[]')), preferred_format_id: r.preferred_format_id ?? null,
      preferred_supplier_id: r.preferred_supplier_id ?? null, notes: r.notes ?? null, archived_at: r.archived_at ?? null,
    });
  }
  const formats: FormatData[] = (fmts!.results as Record<string, unknown>[]).map((f) => ({
    id: String(f.id), ingredient_id: String(f.ingredient_id), supplier_id: (f.supplier_id as string) ?? null, label: String(f.label),
    pack_quantity_base: String(f.pack_quantity_base), whole_packs_only: !!f.whole_packs_only, is_active: !!f.is_active,
  }));
  const priceEntries = prices!.results as unknown as PriceEntry[];
  const recipeMap: Catalog['recipes'] = new Map();
  for (const r of recipes!.results as Record<string, string | null>[]) {
    recipeMap.set(r.id!, {
      id: r.id!, name: r.name!, category: r.category ?? null, portions: r.portions!, yield_quantity: r.yield_quantity ?? null, yield_unit: (r.yield_unit as BaseUnit) ?? null,
      allergens_declared: normalizeAllergens(JSON.parse(r.allergens_declared_json ?? '[]')), lines: [], archived_at: r.archived_at ?? null,
      allergen_review_hash: r.allergen_review_hash ?? null, allergens_reviewed_at: r.allergens_reviewed_at ?? null, updated_at: r.updated_at!,
    });
  }
  for (const l of lines!.results as Record<string, string | null>[]) {
    recipeMap.get(l.recipe_id!)?.lines.push({ id: l.id!, ingredient_id: l.ingredient_id ?? null, subrecipe_id: l.subrecipe_id ?? null, quantity: l.quantity!, unit: l.unit as LineUnit });
  }
  const current = resolveCurrentPrices([...ingredients.values()], formats, priceEntries, asOf);
  const coster = new RecipeCoster({ recipes: recipeMap, ingredients, prices: current });
  return { ingredients, formats, prices: priceEntries, recipes: recipeMap, current, coster, asOf };
}

// ─────────────── Revisión de alérgenos (estado derivado por hash; la aprobación siempre es humana) ───────────────

/** Huella de lo que el humano revisa en una receta: líneas + alérgenos derivados + declarados. */
export function recipeAllergenFingerprint(cat: Catalog, recipeId: string): string {
  const r = cat.recipes.get(recipeId)!;
  let derived: Allergen[] = [];
  try {
    derived = cat.coster.cost(recipeId).derived_allergens;
  } catch {
    derived = [];
  }
  return stableHash({ lines: r.lines.map((l) => [l.ingredient_id, l.subrecipe_id]), derived, declared: r.allergens_declared });
}

export type ReviewState = 'reviewed' | 'pending' | 'stale';

export function recipeReviewState(cat: Catalog, recipeId: string): ReviewState {
  const r = cat.recipes.get(recipeId);
  if (!r || !r.allergen_review_hash) return 'pending';
  return r.allergen_review_hash === recipeAllergenFingerprint(cat, recipeId) ? 'reviewed' : 'stale';
}

export function menuAllergenFingerprint(cat: Catalog, lines: MenuLineData[]): string {
  return stableHash(lines.map((l) => [l.position, l.variant, l.recipe_id, cat.recipes.get(l.recipe_id)?.allergen_review_hash ?? null]));
}

export function menuAllergens(cat: Catalog, lines: MenuLineData[]) {
  const byVariant = new Map<string, Set<Allergen>>();
  for (const l of lines) {
    let al: Allergen[] = [];
    try { al = cat.coster.cost(l.recipe_id).allergens; } catch { al = []; }
    const s = byVariant.get(l.variant) ?? new Set();
    al.forEach((a) => s.add(a));
    byVariant.set(l.variant, s);
  }
  return byVariant;
}
