import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Decimal, DomainError, dec, money2, moneyStr } from '../../src/shared/decimal';
import {
  RecipeCoster, assertNoCycle, eventFinancials, menuCostPerGuest, planPortions, resolveCurrentPrices, usefulUnitCost,
  type IngredientData, type RecipeData, type FormatData, type PriceEntry, type MenuLineData,
} from '../../src/shared/costing';
import { buildShoppingList, availableForSelection, stockBalances, formatOptions, assertNotNegative, priceAlerts } from '../../src/shared/shopping';
import { toBase } from '../../src/shared/units';

const fixtures = JSON.parse(readFileSync(new URL('../../fixtures/calculos.json', import.meta.url), 'utf8'));
const D = (s: string | number) => new Decimal(String(s));

// CALC-01: cada caso de fixtures/calculos.json se calcula con el MOTOR de la app (no con la fórmula del fixture).
describe('CALC-01 fixtures/calculos.json con el motor de cálculo', () => {
  const cases: Record<string, { inputs: Record<string, string>; expected: string | null; compare?: string }> = Object.fromEntries(fixtures.cases.map((c: any) => [c.id, c]));
  const eq = (id: string, got: Decimal | null) => {
    const c = cases[id]!;
    if (c.expected === null) return expect(got).toBeNull();
    if (c.compare) return expect(got!.minus(D(c.expected)).abs().lessThanOrEqualTo('1e-20')).toBe(true);
    expect(got!.equals(D(c.expected))).toBe(true);
  };

  it('ingredient_merma_20 y ingredient_zero_waste', () => {
    for (const id of ['ingredient_merma_20', 'ingredient_zero_waste']) {
      const i = cases[id]!.inputs;
      eq(id, usefulUnitCost(i.pack_price!, i.pack_qty!, i.waste_pct!));
    }
  });

  // Escenario completo que reproduce la cadena de fixtures: calabaza (merma 20) + nata, receta 4 raciones,
  // menú con 2 raciones por invitado, 10 invitados, personal 25 y transporte 15, ingreso 500.
  const ingredients: IngredientData[] = [
    { id: 'cal', name: 'Calabaza', base_unit: 'g', waste_pct: '20', allergens: [] },
    { id: 'nata', name: 'Nata', base_unit: 'ml', waste_pct: '0', allergens: ['milk'] },
  ];
  const formats: FormatData[] = [
    { id: 'f1', ingredient_id: 'cal', supplier_id: null, label: '1 kg', pack_quantity_base: '1000', whole_packs_only: true, is_active: true },
    { id: 'f2', ingredient_id: 'nata', supplier_id: null, label: '1 L', pack_quantity_base: '1000', whole_packs_only: true, is_active: true },
  ];
  const prices: PriceEntry[] = [
    { id: 'p1', format_id: 'f1', effective_at: '2026-10-01', recorded_at: '2026-10-01T00:00:00Z', pack_price: '2.40', pack_quantity_base: '1000' },
    { id: 'p2', format_id: 'f2', effective_at: '2026-10-01', recorded_at: '2026-10-01T00:00:00Z', pack_price: '4.20', pack_quantity_base: '1000' },
  ];
  const recipe: RecipeData = { id: 'crema', name: 'Crema', portions: '4', yield_quantity: null, yield_unit: null, allergens_declared: [], lines: [
    { ingredient_id: 'cal', subrecipe_id: null, quantity: '500', unit: 'g' },
    { ingredient_id: 'nata', subrecipe_id: null, quantity: '180', unit: 'ml' },
  ] };
  const ctx = () => ({
    recipes: new Map([[recipe.id, recipe]]),
    ingredients: new Map(ingredients.map((i) => [i.id, i])),
    prices: resolveCurrentPrices(ingredients, formats, prices, '2026-10-26'),
  });

  it('recipe_lot_example / recipe_serving_example', () => {
    const rc = new RecipeCoster(ctx()).cost('crema');
    eq('recipe_lot_example', rc.lot_cost);
    eq('recipe_serving_example', rc.portion_cost);
    expect(rc.allergens).toEqual(['milk']);
  });

  const menu: MenuLineData[] = [{ position: 1, recipe_id: 'crema', servings_per_guest: '2', variant: '' }];
  it('menu_guest_example / event_food_example / profit / margin / target', () => {
    const coster = new RecipeCoster(ctx());
    eq('menu_guest_example', menuCostPerGuest(menu, coster).per_guest);
    const f = eventFinancials({ guest_count: 10, price_per_guest: '50', additional_revenue: '0', discount: '0', vat_rate: '10', target_margin_pct: '40', groups: [], menu_lines: menu,
      costs: [{ category: 'staff', quantity: '1', unit_amount: '25.00', cost_kind: 'estimated' }, { category: 'travel', quantity: '1', unit_amount: '15.00', cost_kind: 'estimated' }] }, coster);
    eq('event_food_example', f.food_cost);
    eq('event_profit_example', f.profit);
    eq('event_margin_example', f.margin_pct);
    expect(f.total_cost.toFixed()).toBe('51.28');
    eq('target_revenue_40pct', f.suggested_total);
    expect(f.suggested_per_guest.minus(D('85.46666666666666666666666667').div(10)).abs().lessThan('1e-20')).toBe(true);
  });

  it('subrecipe_200g', () => {
    const base: RecipeData = { id: 'fondo', name: 'Fondo', portions: '1', yield_quantity: '800', yield_unit: 'g', allergens_declared: [], lines: [{ ingredient_id: 'x', subrecipe_id: null, quantity: '1', unit: 'ud' }] };
    const plato: RecipeData = { id: 'plato', name: 'Plato', portions: '1', yield_quantity: null, yield_unit: null, allergens_declared: [], lines: [{ ingredient_id: null, subrecipe_id: 'fondo', quantity: '200', unit: 'g' }] };
    const ings: IngredientData[] = [{ id: 'x', name: 'X', base_unit: 'ud', waste_pct: '0', allergens: [] }];
    const prices = resolveCurrentPrices(ings, [{ id: 'fx', ingredient_id: 'x', supplier_id: null, label: '1', pack_quantity_base: '1', whole_packs_only: true, is_active: true }],
      [{ id: 'px', format_id: 'fx', effective_at: '2026-01-01', recorded_at: 'a', pack_price: '16.00', pack_quantity_base: '1' }], '2026-10-26');
    const coster = new RecipeCoster({ recipes: new Map([[base.id, base], [plato.id, plato]]), ingredients: new Map(ings.map((i) => [i.id, i])), prices });
    eq('subrecipe_200g', coster.cost('plato').lot_cost);
  });

  it('shopping_consolidation y shopping_pack_cost (dos eventos, merma 25, stock 100, envase 500)', () => {
    const i = cases.shopping_consolidation!.inputs;
    const ing: IngredientData = { id: 'z', name: 'Zanahoria', base_unit: 'g', waste_pct: i.waste_pct!, allergens: [] };
    const fmt: FormatData = { id: 'fz', ingredient_id: 'z', supplier_id: null, label: '500 g', pack_quantity_base: i.pack_qty!, whole_packs_only: true, is_active: true };
    const pr: PriceEntry = { id: 'pz', format_id: 'fz', effective_at: '2026-01-01', recorded_at: 'a', pack_price: cases.shopping_pack_cost!.inputs.pack_price!, pack_quantity_base: i.pack_qty! };
    // demanda consolidada ANTES de redondear
    const demand = new Map([['z', D(i.event_1_net!).plus(D(i.event_2_net!))]]);
    const rows = buildShoppingList(demand, new Map([['z', ing]]), new Map([['z', D(i.stock_gross!)]]), formatOptions([fmt], [pr], '2026-10-26'), resolveCurrentPrices([ing], [fmt], [pr], '2026-10-26'));
    eq('shopping_consolidation', rows[0]!.packs);
    eq('shopping_pack_cost', rows[0]!.expected_cost);
    expect(rows[0]!.gross.toFixed()).toBe('1000');
    expect(rows[0]!.need.toFixed()).toBe('900');
  });

  it('zero_revenue_margin → indefinido (null), nunca 0 %', () => {
    const f = eventFinancials({ guest_count: 5, price_per_guest: '0', additional_revenue: '0', discount: '0', vat_rate: '10', target_margin_pct: '35', groups: [], menu_lines: [],
      costs: [{ category: 'staff', quantity: '1', unit_amount: '25', cost_kind: 'estimated' }] }, null);
    eq('zero_revenue_margin', f.margin_pct);
    expect(f.food_cost_pct).toBeNull();
    expect(f.profit.toFixed()).toBe('-25');
  });
});

describe('Pruebas negativas (fixtures.negative_tests)', () => {
  it('waste_100: merma 100 % (o más) rechazada, sin tope oculto', () => {
    expect(() => usefulUnitCost('10', '1000', '100')).toThrow(DomainError);
    expect(() => usefulUnitCost('10', '1000', '120')).toThrow(DomainError);
    // 99 % se calcula exacto (v1 lo topaba en 95 % → 200 €/kg)
    expect(usefulUnitCost('10', '1000', '99').times(1000).toFixed()).toBe('1000');
  });
  it('negative_qty y precios negativos rechazados', () => {
    expect(() => usefulUnitCost('-1', '1000', '0')).toThrow(/negativo/);
    expect(() => usefulUnitCost('1', '0', '0')).toThrow();
    const coster = new RecipeCoster({ recipes: new Map([['r', { id: 'r', name: 'R', portions: '1', yield_quantity: null, yield_unit: null, allergens_declared: [], lines: [{ ingredient_id: 'i', subrecipe_id: null, quantity: '-5', unit: 'g' }] }]]),
      ingredients: new Map([['i', { id: 'i', name: 'I', base_unit: 'g', waste_pct: '0', allergens: [] }]]), prices: new Map() });
    expect(coster.cost('r').errors[0]).toContain('invalid_quantity');
  });
  it('unit_g_to_ml_no_density: incompatibilidad dimensional', () => {
    expect(() => toBase('100', 'g', 'ml')).toThrow(/g → ml/);
    expect(() => toBase('1', 'l', 'g')).toThrow();
    expect(toBase('0.75', 'l', 'ml').toFixed()).toBe('750');
    expect(toBase('1', 'kg', 'g').toFixed()).toBe('1000');
  });
  it('recipe_cycle: directo, indirecto y autorreferencia', () => {
    const mk = (id: string, sub: string | null): RecipeData => ({ id, name: id, portions: '1', yield_quantity: null, yield_unit: null, allergens_declared: [], lines: sub ? [{ ingredient_id: null, subrecipe_id: sub, quantity: '1', unit: 'portion' }] : [] });
    const recipes = new Map([['A', mk('A', 'B')], ['B', mk('B', 'C')], ['C', mk('C', null)]]);
    expect(() => assertNoCycle('C', [{ ingredient_id: null, subrecipe_id: 'A', quantity: '1', unit: 'portion' }], recipes)).toThrow(/Ciclo/);
    expect(() => assertNoCycle('A', [{ ingredient_id: null, subrecipe_id: 'A', quantity: '1', unit: 'portion' }], recipes)).toThrow(/Ciclo/);
    expect(() => assertNoCycle('C', [], recipes)).not.toThrow();
    recipes.set('C', mk('C', 'A'));
    expect(() => new RecipeCoster({ recipes, ingredients: new Map(), prices: new Map() }).cost('A')).toThrow(/Ciclo/);
  });
});

describe('Reglas de cálculo adicionales', () => {
  const ings: IngredientData[] = [{ id: 'i', name: 'Pollo', base_unit: 'g', waste_pct: '25', allergens: [] }, { id: 'v', name: 'Tofu', base_unit: 'g', waste_pct: '0', allergens: ['soy'] }];
  const fm: FormatData[] = [{ id: 'fi', ingredient_id: 'i', supplier_id: 's1', label: '1 kg', pack_quantity_base: '1000', whole_packs_only: true, is_active: true }, { id: 'fv', ingredient_id: 'v', supplier_id: null, label: '400 g', pack_quantity_base: '400', whole_packs_only: true, is_active: true }];
  const pr: PriceEntry[] = [
    { id: 'a', format_id: 'fi', effective_at: '2026-09-01', recorded_at: '1', pack_price: '9', pack_quantity_base: '1000' },
    { id: 'b', format_id: 'fi', effective_at: '2026-10-10', recorded_at: '2', pack_price: '12', pack_quantity_base: '1000' },
    { id: 'c', format_id: 'fv', effective_at: '2026-09-01', recorded_at: '1', pack_price: '3', pack_quantity_base: '400' },
  ];
  const recipes = new Map<string, RecipeData>([
    ['pollo', { id: 'pollo', name: 'Pollo', portions: '4', yield_quantity: null, yield_unit: null, allergens_declared: [], lines: [{ ingredient_id: 'i', subrecipe_id: null, quantity: '600', unit: 'g' }] }],
    ['tofu', { id: 'tofu', name: 'Tofu', portions: '4', yield_quantity: null, yield_unit: null, allergens_declared: [], lines: [{ ingredient_id: 'v', subrecipe_id: null, quantity: '400', unit: 'g' }] }],
  ]);
  const coster = (asOf: string) => new RecipeCoster({ recipes, ingredients: new Map(ings.map((x) => [x.id, x])), prices: resolveCurrentPrices(ings, fm, pr, asOf) });

  it('CALC-02 merma aplicada una sola vez: escandallo usa coste útil; compra usa bruto = neto/(1−w)', () => {
    const rc = coster('2026-10-26').cost('pollo');
    expect(rc.lot_cost.toFixed()).toBe('9.6'); // 600 × 12/(1000×0.75)
    const demand = rc && coster('2026-10-26').ingredientDemand('pollo', D(1));
    expect(demand.get('i')!.toFixed()).toBe('600'); // neto, sin merma
    const rows = buildShoppingList(demand, new Map(ings.map((x) => [x.id, x])), new Map(), formatOptions(fm, pr, '2026-10-26'), resolveCurrentPrices(ings, fm, pr, '2026-10-26'));
    expect(rows[0]!.gross.toFixed()).toBe('800');
    expect(rows[0]!.packs.toFixed()).toBe('1');
  });

  it('CALC-03 escalado lineal 4 vs 10 comensales sin tocar la receta maestra', () => {
    const menu: MenuLineData[] = [{ position: 1, recipe_id: 'pollo', servings_per_guest: '1', variant: '' }];
    const base = { price_per_guest: '0', additional_revenue: '0', discount: '0', vat_rate: '10', target_margin_pct: '35', groups: [], menu_lines: menu, costs: [] };
    const f4 = eventFinancials({ ...base, guest_count: 4 }, coster('2026-10-26'));
    const f10 = eventFinancials({ ...base, guest_count: 10 }, coster('2026-10-26'));
    expect(f10.food_cost.div(f4.food_cost).toFixed()).toBe('2.5');
    expect(recipes.get('pollo')!.lines[0]!.quantity).toBe('600');
  });

  it('variantes dietéticas no se cuentan dos veces', () => {
    const menu: MenuLineData[] = [
      { position: 1, recipe_id: 'pollo', servings_per_guest: '1', variant: '' },
      { position: 1, recipe_id: 'tofu', servings_per_guest: '1', variant: 'vegano' },
    ];
    const plan = planPortions(10, [{ label: 'Veganos', guest_count: 2, variant: 'vegano' }], menu);
    expect(plan.recipe_portions.get('pollo')!.toFixed()).toBe('8');
    expect(plan.recipe_portions.get('tofu')!.toFixed()).toBe('2');
    const c = coster('2026-10-26');
    const f = eventFinancials({ guest_count: 10, price_per_guest: '0', additional_revenue: '0', discount: '0', vat_rate: '10', target_margin_pct: '35', groups: [{ label: 'Veganos', guest_count: 2, variant: 'vegano' }], menu_lines: menu, costs: [] }, c);
    expect(f.food_cost.toFixed()).toBe(c.cost('pollo').portion_cost.times(8).plus(c.cost('tofu').portion_cost.times(2)).toFixed());
    expect(() => planPortions(3, [{ label: 'V', guest_count: 4, variant: 'vegano' }], menu)).toThrow(/superan/);
  });

  it('CALC-05 beneficio con descuento, horas chef y costes; food estimado manual rechazado', () => {
    const menu: MenuLineData[] = [{ position: 1, recipe_id: 'pollo', servings_per_guest: '1', variant: '' }];
    const f = eventFinancials({ guest_count: 4, price_per_guest: '100', additional_revenue: '50', discount: '30', vat_rate: '10', target_margin_pct: '35', groups: [], menu_lines: menu,
      costs: [{ category: 'chef_hours', quantity: '6', unit_amount: '35', cost_kind: 'estimated' }, { category: 'travel', quantity: '40', unit_amount: '0.26', cost_kind: 'estimated' }, { category: 'other', quantity: '1', unit_amount: '999', cost_kind: 'actual' }] }, coster('2026-10-26'));
    expect(f.revenue_net.toFixed()).toBe('420');
    expect(f.operating_total.toFixed()).toBe('220.4');
    expect(f.food_cost.toFixed()).toBe('9.6');
    expect(f.profit.toFixed()).toBe('190');
    expect(moneyStr(f.margin_pct!)).toBe('45.24');
    expect(f.vat_amount.toFixed()).toBe('42');
    expect(() => eventFinancials({ guest_count: 4, price_per_guest: '1', additional_revenue: '0', discount: '0', vat_rate: '10', target_margin_pct: '35', groups: [], menu_lines: menu, costs: [{ category: 'food', quantity: '1', unit_amount: '5', cost_kind: 'estimated' }] }, coster('2026-10-26'))).toThrow(DomainError);
  });

  it('CALC-06 el precio vigente cambia por fecha; histórico conservado', () => {
    expect(coster('2026-09-15').cost('pollo').lot_cost.toFixed()).toBe('7.2');
    expect(coster('2026-10-26').cost('pollo').lot_cost.toFixed()).toBe('9.6');
  });

  it('CALC-07 sin acumulación de redondeo por línea; total redondeado HALF_UP a 2 decimales', () => {
    // 3 líneas de 0.004 € → suma exacta 0.012 → 0.01; redondear por línea daría 0.00
    const parts = [D('0.004'), D('0.004'), D('0.004')];
    const exact = parts.reduce((a, b) => a.plus(b));
    expect(money2(exact).toFixed(2)).toBe('0.01');
    expect(parts.map((p) => money2(p)).reduce((a, b) => a.plus(b)).toFixed(2)).toBe('0.00');
    expect(moneyStr(D('2.345'))).toBe('2.35');
    expect(moneyStr(D('0.1').plus(D('0.2')))).toBe('0.30');
  });

  it('stock: reservas por evento se descuentan una sola vez y no hay negativos silenciosos', () => {
    const bal = stockBalances([
      { ingredient_id: 'i', event_id: null, kind: 'receipt', quantity_base: '1000' },
      { ingredient_id: 'i', event_id: 'e1', kind: 'reservation', quantity_base: '300' },
      { ingredient_id: 'i', event_id: 'e2', kind: 'reservation', quantity_base: '200' },
      { ingredient_id: 'i', event_id: 'e2', kind: 'reservation_release', quantity_base: '50' },
      { ingredient_id: 'i', event_id: null, kind: 'waste', quantity_base: '100' },
    ]);
    expect(bal.get('i')!.on_hand.toFixed()).toBe('900');
    expect(bal.get('i')!.reserved.toFixed()).toBe('450');
    expect(availableForSelection(bal, ['e1']).get('i')!.toFixed()).toBe('750'); // 900 − 150 (e2)
    expect(availableForSelection(bal, ['e1', 'e2']).get('i')!.toFixed()).toBe('900');
    expect(() => assertNotNegative(bal.get('i'), 'consumption', D(901), 'Pollo')).toThrow(/insuficiente/);
    expect(() => assertNotNegative(bal.get('i'), 'consumption', D(900), 'Pollo')).not.toThrow();
  });

  it('alertas de precio y formato cambiado', () => {
    const alerts = priceAlerts(fm, [...pr, { id: 'd', format_id: 'fv', effective_at: '2026-10-01', recorded_at: '3', pack_price: '3.2', pack_quantity_base: '500' }], D(5));
    const pollo = alerts.find((a) => a.format_id === 'fi')!;
    expect(pollo.change_pct.toFixed()).toBe('33.33333333333333333333333333333333333333');
    const tofu = alerts.find((a) => a.format_id === 'fv')!;
    expect(tofu.format_changed).toBe(true);
  });

  it('dec() valida entradas', () => {
    expect(dec('12,5').toFixed()).toBe('12.5');
    expect(() => dec('1e5')).toThrow();
    expect(() => dec('abc')).toThrow();
    expect(() => dec(Number.NaN)).toThrow();
  });
});
