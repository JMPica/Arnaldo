import { Hono } from 'hono';
import { assertNoCycle, menuCostPerGuest, menuVariants, serializeDecimals, type RecipeLineData } from '../../shared/costing';
import { DomainError } from '../../shared/decimal';
import { MenuSchema, RecipeSchema } from '../../shared/schemas';
import type { LineUnit } from '../../shared/units';
import { getDb, nowIso, uuid, type Db } from '../db';
import type { AppEnv } from '../env';
import { ApiError, body } from '../http';
import { loadCatalog, menuAllergenFingerprint, menuAllergens, recipeAllergenFingerprint, recipeReviewState, type Catalog } from '../services/catalog';
import { updateStmt } from './catalog';

export const recipes = new Hono<AppEnv>();

const RECIPE_COLS = ['name', 'category', 'description_es', 'description_ca', 'instructions_es', 'instructions_ca', 'techniques', 'conservation', 'notes', 'portions', 'yield_quantity', 'yield_unit', 'preparation_minutes', 'cooking_minutes', 'allergens_declared_json'];

function recipeSummary(cat: Catalog, id: string) {
  const r = cat.recipes.get(id)!;
  let cost: ReturnType<Catalog['coster']['cost']> | null = null;
  let error: string | null = null;
  try { cost = cat.coster.cost(id); } catch (e) { error = e instanceof DomainError ? e.code : 'error'; }
  return serializeDecimals({
    id, name: r.name, category: r.category, portions: r.portions, yield_quantity: r.yield_quantity, yield_unit: r.yield_unit, archived_at: r.archived_at,
    lines_count: r.lines.length, uses_subrecipes: r.lines.some((l) => l.subrecipe_id),
    lot_cost: cost?.lot_cost ?? null, portion_cost: cost?.portion_cost ?? null, complete: cost?.complete ?? false, missing_prices: cost?.missing_prices.length ?? 0,
    allergens: cost?.allergens ?? [], allergen_review: recipeReviewState(cat, id), error,
  });
}

async function validateLines(db: Db, recipeId: string, lines: RecipeLineData[], cat: Catalog) {
  for (const l of lines) {
    if (l.ingredient_id) {
      const ing = cat.ingredients.get(l.ingredient_id);
      if (!ing) throw new ApiError(404, 'not_found', { entity: 'ingredient' });
      if (l.unit === 'portion') throw new DomainError('incompatible_units', `portion → ${ing.base_unit}`);
      const dim = { g: 'g', kg: 'g', ml: 'ml', l: 'ml', ud: 'ud' }[l.unit as Exclude<LineUnit, 'portion'>];
      if (dim !== ing.base_unit) throw new DomainError('incompatible_units', `${l.unit} → ${ing.base_unit} (${ing.name})`);
    } else if (l.subrecipe_id) {
      const sub = cat.recipes.get(l.subrecipe_id);
      if (!sub) throw new ApiError(404, 'not_found', { entity: 'recipe' });
      if (l.unit !== 'portion') {
        if (!sub.yield_unit) throw new DomainError('subrecipe_without_yield', `${sub.name} no tiene rendimiento medido; usa raciones`);
        const dim = { g: 'g', kg: 'g', ml: 'ml', l: 'ml', ud: 'ud' }[l.unit as Exclude<LineUnit, 'portion'>];
        if (dim !== sub.yield_unit) throw new DomainError('incompatible_units', `${l.unit} → ${sub.yield_unit} (${sub.name})`);
      }
    }
  }
  assertNoCycle(recipeId, lines, cat.recipes);
  void db;
}

function lineInserts(db: Db, recipeId: string, lines: (RecipeLineData & { notes?: string | null })[]) {
  return db.bulkInsert('recipe_lines', ['id', 'recipe_id', 'position', 'ingredient_id', 'subrecipe_id', 'quantity', 'unit', 'notes'],
    lines.map((l, i) => ({ id: uuid(), recipe_id: recipeId, position: i + 1, ingredient_id: l.ingredient_id ?? null, subrecipe_id: l.subrecipe_id ?? null, quantity: l.quantity, unit: l.unit, notes: l.notes ?? null })));
}

recipes.get('/recipes', async (c) => {
  const db = getDb(c);
  const cat = await loadCatalog(db);
  const archived = c.req.query('archived') === '1';
  return c.json([...cat.recipes.values()].filter((r) => (archived ? !!r.archived_at : !r.archived_at)).sort((a, b) => a.name.localeCompare(b.name, 'es')).map((r) => recipeSummary(cat, r.id)));
});

recipes.post('/recipes', async (c) => {
  const db = getDb(c);
  const d = await body(c, RecipeSchema);
  const cat = await loadCatalog(db);
  const id = uuid();
  await validateLines(db, id, d.lines as RecipeLineData[], cat);
  await db.batch([
    db.prepare(`INSERT INTO recipes (id, owner_id, name, category, description_es, description_ca, instructions_es, instructions_ca, techniques, conservation, notes, portions, yield_quantity, yield_unit, preparation_minutes, cooking_minutes, allergens_declared_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, db.owner, d.name, d.category ?? null, d.description_es ?? null, d.description_ca ?? null, d.instructions_es ?? null, d.instructions_ca ?? null,
      d.techniques ?? null, d.conservation ?? null, d.notes ?? null, d.portions, d.yield_quantity ?? null, d.yield_unit ?? null, d.preparation_minutes, d.cooking_minutes, JSON.stringify(d.allergens_declared)),
    ...lineInserts(db, id, d.lines as RecipeLineData[]),
    db.audit('create', 'recipe', id),
  ]);
  return c.json({ id }, 201);
});

recipes.get('/recipes/:id', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const row = await db.owned('recipes', id, { allowArchived: true });
  const cat = await loadCatalog(db);
  const lines = await db.all('SELECT * FROM recipe_lines WHERE recipe_id = ? AND owner_id = ? ORDER BY position', id, db.owner);
  let cost = null;
  let error = null;
  try { cost = serializeDecimals(cat.coster.cost(id)); } catch (e) { error = e instanceof DomainError ? e.code : 'error'; }
  const usedIn = await db.all('SELECT DISTINCT r.id, r.name FROM recipe_lines l JOIN recipes r ON r.id = l.recipe_id WHERE l.subrecipe_id = ? AND l.owner_id = ? UNION SELECT DISTINCT m.id, m.name FROM menu_lines ml JOIN menus m ON m.id = ml.menu_id WHERE ml.recipe_id = ? AND ml.owner_id = ?', id, db.owner, id, db.owner);
  return c.json({ ...row, allergens_declared: JSON.parse(String(row.allergens_declared_json)), lines, cost, error, allergen_review: recipeReviewState(cat, id), used_in: usedIn });
});

recipes.put('/recipes/:id', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  await db.owned('recipes', id);
  const d = await body(c, RecipeSchema);
  const cat = await loadCatalog(db);
  await validateLines(db, id, d.lines as RecipeLineData[], cat);
  const st = updateStmt(db, 'recipes', id, { ...d, allergens_declared_json: d.allergens_declared, yield_quantity: d.yield_quantity ?? null, yield_unit: d.yield_unit ?? null }, RECIPE_COLS)!;
  await db.batch([
    st,
    db.prepare('UPDATE recipes SET version = version + 1 WHERE id = ? AND owner_id = ?', id, db.owner),
    db.prepare('DELETE FROM recipe_lines WHERE recipe_id = ? AND owner_id = ?', id, db.owner),
    ...lineInserts(db, id, d.lines as RecipeLineData[]),
    db.audit('update', 'recipe', id),
  ]);
  return c.json({ id });
});

recipes.post('/recipes/:id/duplicate', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  const r = await db.owned('recipes', id, { allowArchived: true });
  const nid = uuid();
  const lines = await db.all<RecipeLineData & { notes: string | null }>('SELECT ingredient_id, subrecipe_id, quantity, unit, notes FROM recipe_lines WHERE recipe_id = ? AND owner_id = ? ORDER BY position', id, db.owner);
  await db.batch([
    db.prepare(`INSERT INTO recipes (id, owner_id, name, category, description_es, description_ca, instructions_es, instructions_ca, techniques, conservation, notes, portions, yield_quantity, yield_unit, preparation_minutes, cooking_minutes, allergens_declared_json)
      SELECT ?, owner_id, name || ' (copia)', category, description_es, description_ca, instructions_es, instructions_ca, techniques, conservation, notes, portions, yield_quantity, yield_unit, preparation_minutes, cooking_minutes, allergens_declared_json FROM recipes WHERE id = ? AND owner_id = ?`, nid, id, db.owner),
    ...lineInserts(db, nid, lines),
    db.audit('duplicate', 'recipe', nid, { from: r.id }),
  ]);
  return c.json({ id: nid }, 201);
});

recipes.delete('/recipes/:id', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  await db.owned('recipes', id, { allowArchived: true });
  await db.batch([db.prepare('UPDATE recipes SET archived_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?', nowIso(), nowIso(), id, db.owner), db.audit('archive', 'recipe', id)]);
  return c.json({ archived: true });
});
recipes.post('/recipes/:id/restore', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  await db.owned('recipes', id, { allowArchived: true });
  await db.run('UPDATE recipes SET archived_at = NULL WHERE id = ? AND owner_id = ?', id, db.owner);
  return c.json({ restored: true });
});

/** El humano confirma los alérgenos (derivados + declarados). Queda obsoleto si cambian líneas o alérgenos. */
recipes.post('/recipes/:id/allergen-review', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  await db.owned('recipes', id);
  const cat = await loadCatalog(db);
  const cost = cat.coster.cost(id);
  // Las subrecetas deben estar revisadas antes
  const pendingSubs = cat.recipes.get(id)!.lines.filter((l) => l.subrecipe_id && recipeReviewState(cat, l.subrecipe_id) !== 'reviewed').map((l) => cat.recipes.get(l.subrecipe_id!)?.name);
  if (pendingSubs.length) throw new ApiError(409, 'subrecipes_not_reviewed', { recipes: pendingSubs });
  const hash = recipeAllergenFingerprint(cat, id);
  await db.batch([
    db.prepare('UPDATE recipes SET allergen_review_hash = ?, allergens_reviewed_at = ? WHERE id = ? AND owner_id = ?', hash, nowIso(), id, db.owner),
    db.audit('allergen_review', 'recipe', id, { allergens: cost.allergens }),
  ]);
  return c.json({ allergen_review: 'reviewed', allergens: cost.allergens });
});

// ───────────── Menús ─────────────
type MenuLineRow = { id: string; menu_id?: string; position: number; course_name_es: string | null; course_name_ca: string | null; recipe_id: string; servings_per_guest: string; variant: string };

function menuDetailFrom(m: Record<string, unknown>, lines: MenuLineRow[], cat: Catalog) {
  const variants = menuVariants(lines);
  const costs: Record<string, unknown> = {};
  let error: string | null = null;
  try {
    for (const v of ['', ...variants]) costs[v || 'base'] = serializeDecimals(menuCostPerGuest(lines, cat.coster, v));
  } catch (e) { error = e instanceof DomainError ? e.code : 'error'; }
  const pendingRecipes = [...new Set(lines.map((l) => l.recipe_id))].filter((rid) => recipeReviewState(cat, rid) !== 'reviewed').map((rid) => ({ id: rid, name: cat.recipes.get(rid)?.name }));
  const review = !m.allergen_review_hash ? 'pending' : m.allergen_review_hash === menuAllergenFingerprint(cat, lines) ? 'reviewed' : 'stale';
  const allergens = Object.fromEntries([...menuAllergens(cat, lines).entries()].map(([k, v]) => [k || 'base', [...v]]));
  return { ...m, lines: lines.map((l) => ({ ...l, recipe_name: cat.recipes.get(l.recipe_id)?.name ?? '?' })), variants, cost_per_guest: costs, error, allergen_review: review, pending_recipe_reviews: pendingRecipes, allergens };
}

async function menuDetail(db: Db, id: string, cat: Catalog) {
  const m = await db.owned('menus', id, { allowArchived: true });
  const lines = await db.all<MenuLineRow>('SELECT id, position, course_name_es, course_name_ca, recipe_id, servings_per_guest, variant FROM menu_lines WHERE menu_id = ? AND owner_id = ? ORDER BY position, variant', id, db.owner);
  return menuDetailFrom(m, lines, cat);
}

async function validateMenuLines(db: Db, lines: { recipe_id: string }[], cat: Catalog) {
  for (const l of lines) if (!cat.recipes.get(l.recipe_id)) throw new ApiError(404, 'not_found', { entity: 'recipe' });
  void db;
}

function menuLineInserts(db: Db, menuId: string, lines: { position: number; course_name_es?: string | null; course_name_ca?: string | null; recipe_id: string; servings_per_guest: string; variant: string }[]) {
  return db.bulkInsert('menu_lines', ['id', 'menu_id', 'position', 'course_name_es', 'course_name_ca', 'recipe_id', 'servings_per_guest', 'variant'],
    lines.map((l) => ({ id: uuid(), menu_id: menuId, position: l.position, course_name_es: l.course_name_es ?? null, course_name_ca: l.course_name_ca ?? null, recipe_id: l.recipe_id, servings_per_guest: l.servings_per_guest, variant: l.variant ?? '' })));
}

recipes.get('/menus', async (c) => {
  const db = getDb(c);
  const cat = await loadCatalog(db);
  const archived = c.req.query('archived') === '1';
  const menus = await db.all<{ id: string }>(`SELECT * FROM menus WHERE owner_id = ? AND ${archived ? 'archived_at IS NOT NULL' : 'archived_at IS NULL'} ORDER BY name COLLATE NOCASE`, db.owner);
  const lines = await db.all<MenuLineRow>('SELECT id, menu_id, position, course_name_es, course_name_ca, recipe_id, servings_per_guest, variant FROM menu_lines WHERE owner_id = ? ORDER BY position, variant', db.owner);
  return c.json(menus.map((m) => menuDetailFrom(m, lines.filter((l) => l.menu_id === m.id), cat)));
});

recipes.post('/menus', async (c) => {
  const db = getDb(c);
  const d = await body(c, MenuSchema);
  const cat = await loadCatalog(db);
  await validateMenuLines(db, d.lines, cat);
  const id = uuid();
  await db.batch([
    db.prepare('INSERT INTO menus (id, owner_id, name, kind, description_es, description_ca, notes) VALUES (?,?,?,?,?,?,?)', id, db.owner, d.name, d.kind, d.description_es ?? null, d.description_ca ?? null, d.notes ?? null),
    ...menuLineInserts(db, id, d.lines),
    db.audit('create', 'menu', id),
  ]);
  return c.json({ id }, 201);
});

recipes.get('/menus/:id', async (c) => {
  const db = getDb(c);
  return c.json(await menuDetail(db, c.req.param('id'), await loadCatalog(db)));
});

/** Editar un menú nunca altera snapshots de eventos ya presupuestados/confirmados (estos guardan su copia). */
recipes.put('/menus/:id', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  await db.owned('menus', id);
  const d = await body(c, MenuSchema);
  const cat = await loadCatalog(db);
  await validateMenuLines(db, d.lines, cat);
  await db.batch([
    db.prepare('UPDATE menus SET name = ?, kind = ?, description_es = ?, description_ca = ?, notes = ?, version = version + 1, updated_at = ? WHERE id = ? AND owner_id = ?', d.name, d.kind, d.description_es ?? null, d.description_ca ?? null, d.notes ?? null, nowIso(), id, db.owner),
    db.prepare('DELETE FROM menu_lines WHERE menu_id = ? AND owner_id = ?', id, db.owner),
    ...menuLineInserts(db, id, d.lines),
    db.audit('update', 'menu', id),
  ]);
  return c.json({ id });
});

recipes.post('/menus/:id/duplicate', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  await db.owned('menus', id, { allowArchived: true });
  const nid = uuid();
  await db.batch([
    db.prepare("INSERT INTO menus (id, owner_id, name, kind, description_es, description_ca, notes) SELECT ?, owner_id, name || ' (copia)', kind, description_es, description_ca, notes FROM menus WHERE id = ? AND owner_id = ?", nid, id, db.owner),
    db.prepare('INSERT INTO menu_lines (id, owner_id, menu_id, position, course_name_es, course_name_ca, recipe_id, servings_per_guest, variant) SELECT lower(hex(randomblob(16))), owner_id, ?, position, course_name_es, course_name_ca, recipe_id, servings_per_guest, variant FROM menu_lines WHERE menu_id = ? AND owner_id = ?', nid, id, db.owner),
    db.audit('duplicate', 'menu', nid, { from: id }),
  ]);
  return c.json({ id: nid }, 201);
});

recipes.delete('/menus/:id', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  await db.owned('menus', id, { allowArchived: true });
  await db.batch([db.prepare('UPDATE menus SET archived_at = ? WHERE id = ? AND owner_id = ?', nowIso(), id, db.owner), db.audit('archive', 'menu', id)]);
  return c.json({ archived: true });
});

/** E2E-07: bloqueado si alguna receta del menú tiene alérgenos pendientes de revisión. */
recipes.post('/menus/:id/allergen-review', async (c) => {
  const db = getDb(c);
  const id = c.req.param('id');
  await db.owned('menus', id);
  const cat = await loadCatalog(db);
  const detail = await menuDetail(db, id, cat);
  if (!detail.lines.length) throw new ApiError(409, 'menu_empty');
  if (detail.pending_recipe_reviews.length) throw new ApiError(409, 'recipes_pending_allergen_review', { recipes: detail.pending_recipe_reviews });
  const hash = menuAllergenFingerprint(cat, detail.lines);
  await db.batch([
    db.prepare('UPDATE menus SET allergen_review_hash = ?, allergens_reviewed_at = ? WHERE id = ? AND owner_id = ?', hash, nowIso(), id, db.owner),
    db.audit('allergen_review', 'menu', id, { allergens: detail.allergens }),
  ]);
  return c.json({ allergen_review: 'reviewed' });
});
