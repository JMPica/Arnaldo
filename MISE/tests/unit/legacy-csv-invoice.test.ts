import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planLegacyImport, parseLegacyJson } from '../../src/shared/legacy';
import { csvCell, parseCsv, toCsv } from '../../src/shared/csv';
import { extractFromText, matchIngredient, parseEsNumber, parseDate, parseLine } from '../../src/shared/invoice';
import { parseAllergenText, stableHash } from '../../src/shared/allergens';

const legacyText = readFileSync(new URL('../../fixtures/legacy_backup_v1_ficticio.json', import.meta.url), 'utf8');
let n = 0;
const newId = () => `id-${++n}`;
const empty = { suppliers: [], ingredients: [], clients: [], recipes: [], menus: [] };

describe('IMPORT v1 (plan puro)', () => {
  it('IMPORT-01 mapea recuentos, relaciones, precios y stock sin duplicar', () => {
    const { data } = parseLegacyJson(legacyText);
    const r = planLegacyImport(data, empty, { newId, today: '2026-10-26', strategy: 'merge' });
    expect(r.ok).toBe(true);
    const t = r.plan!.tables;
    expect(t.ingredients).toHaveLength(2);
    expect(t.suppliers).toHaveLength(1); // "Proveedor ficticio" deduplicado
    expect(t.recipes).toHaveLength(1);
    expect(t.recipe_lines).toHaveLength(2);
    expect(t.menus).toHaveLength(1);
    expect(t.events).toHaveLength(1);
    expect(t.clients).toHaveLength(1);
    expect(t.event_costs!.map((c) => c.category).sort()).toEqual(['staff', 'travel']);
    // calabaza: la compra coincide con el precio vigente → 1 entrada fechada 2026-10-01; nata → 1 entrada a fecha de importación
    expect(t.price_history).toHaveLength(2);
    expect(t.price_history!.find((p) => p.effective_at === '2026-10-01')!.note).toContain('FAC-DEMO-1');
    expect(t.stock_movements!.map((m) => m.quantity_base).sort()).toEqual(['100', '300']);
    expect(t.stock_movements!.every((m) => m.kind === 'opening')).toBe(true);
    const ing = t.ingredients!.find((i) => i.name === 'Nata demo sintética')!;
    expect(ing.allergens_json).toBe('["milk"]');
    expect(r.plan!.confirmed_event_ids).toHaveLength(1);
    // coste ración v1 = (500×2.4/800 + 180×0.0042)/4 = 0.564
    expect(Object.values(r.plan!.legacy_portion_costs)[0]).toBe('0.564');
  });

  it('IMPORT-03 una segunda importación sobre el mismo catálogo reutiliza entidades (merge) sin duplicar', () => {
    const { data } = parseLegacyJson(legacyText);
    const first = planLegacyImport(data, empty, { newId, today: '2026-10-26', strategy: 'merge' }).plan!.tables;
    const existing = {
      suppliers: first.suppliers!.map((s) => ({ id: String(s.id), name: String(s.name) })),
      ingredients: first.ingredients!.map((s) => ({ id: String(s.id), name: String(s.name) })),
      clients: first.clients!.map((s) => ({ id: String(s.id), display_name: String(s.display_name) })),
      recipes: first.recipes!.map((s) => ({ id: String(s.id), name: String(s.name) })),
      menus: first.menus!.map((s) => ({ id: String(s.id), name: String(s.name) })),
    };
    const second = planLegacyImport(data, existing, { newId, today: '2026-10-26', strategy: 'merge' }).plan!;
    expect(second.tables.ingredients).toHaveLength(0);
    expect(second.tables.stock_movements).toHaveLength(0);
    expect(second.tables.recipes).toHaveLength(0);
    expect(second.tables.clients).toHaveLength(0);
    expect(second.reused.ingredients).toBe(2);
  });

  it('IMPORT-02 inválidos, huérfanos, versión desconocida y JSON malformado → error sin plan', () => {
    expect(parseLegacyJson('{bad').error).toBe('malformed_json');
    const v2 = planLegacyImport({ version: 2 }, empty, { newId, today: 'x', strategy: 'merge' });
    expect(v2.ok).toBe(false);
    expect(v2.errors[0]!.message).toContain('unsupported_version');
    const d = JSON.parse(legacyText);
    d.recipes[0].lines[0].ingredientId = 'no-existe';
    const orphan = planLegacyImport(d, empty, { newId, today: 'x', strategy: 'merge' });
    expect(orphan.ok).toBe(false);
    expect(orphan.plan).toBeNull();
    expect(orphan.errors.some((e) => e.message === 'orphan_reference')).toBe(true);
    const d2 = JSON.parse(legacyText);
    d2.ingredients[0].waste = 100;
    expect(planLegacyImport(d2, empty, { newId, today: 'x', strategy: 'merge' }).ok).toBe(false);
    const d3 = JSON.parse(legacyText);
    d3.ingredients[0].packQty = -1;
    expect(planLegacyImport(d3, empty, { newId, today: 'x', strategy: 'merge' }).ok).toBe(false);
    expect(parseLegacyJson('x'.repeat(10), 5).error).toBe('too_large');
  });

  it('demo:true se marca como advertencia', () => {
    const d = JSON.parse(legacyText);
    d.demo = true;
    expect(planLegacyImport(d, empty, { newId, today: 'x', strategy: 'merge' }).warnings).toContain('demo_data');
  });
});

describe('CSV Excel ES', () => {
  it('protege contra inyección de fórmulas y usa ; y coma decimal', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+34 600')).toBe("'+34 600");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@SUM')).toBe("'@SUM");
    expect(csvCell('12.50', { numeric: true })).toBe('12,50');
    expect(csvCell('a;b')).toBe('"a;b"');
    const out = toCsv([{ a: 'x', b: '1.5' }], [{ header: 'A', value: (r) => r.a }, { header: 'B', value: (r) => r.b, numeric: true }]);
    expect(out.startsWith('﻿A;B\r\nx;1,5')).toBe(true);
    expect(parseCsv(out)).toEqual([['A', 'B'], ['x', '1,5']]);
    expect(parseCsv('n,"a, b"\n1,"x""y"')).toEqual([['n', 'a, b'], ['1', 'x"y']]);
  });
});

describe('Extractor de facturas (texto local)', () => {
  const sample = `HORTALIZAS DEL VALLÈS SL
CIF B12345678
FACTURA Nº FV-2026/0142
Fecha: 14/10/2026
Código Descripción Cant. Precio Importe
Tomate pera extra kg 5,000 1,20 6,00
Calabaza butternut kg 3,5 2,10 7,35
Nata para cocinar 35% 1 l 6 4,15 24,90
Huevos camperos docena 2 3,30 6,60
Base imponible 44,85
IVA 10% 4,49
TOTAL FACTURA 49,34 €`;
  it('detecta fecha, referencia, líneas y totales', () => {
    const x = extractFromText(sample, [{ id: 's1', name: 'Hortalizas del Vallès', tax_id: 'B12345678' }]);
    expect(x.date).toBe('2026-10-14');
    expect(x.reference).toBe('FV-2026/0142');
    expect(x.supplier_id_guess).toBe('s1');
    expect(x.tax_id).toBe('B12345678');
    expect(x.totals.total).toBe('49.34');
    expect(x.totals.base).toBe('44.85');
    const tomate = x.lines.find((l) => l.description.toLowerCase().startsWith('tomate'))!;
    expect(tomate).toMatchObject({ quantity: '5', unit: 'kg', unit_price: '1.2', total: '6', arithmetic_ok: true });
    const nata = x.lines.find((l) => l.description.toLowerCase().startsWith('nata'))!;
    expect(nata.quantity).toBe('6');
    expect(nata.unit_price).toBe('4.15');
    expect(nata.arithmetic_ok).toBe(true);
    expect(x.lines).toHaveLength(4);
  });
  it('números y fechas en formato español', () => {
    expect(parseEsNumber('1.234,56')).toBe('1234.56');
    expect(parseEsNumber('6,00')).toBe('6.00');
    expect(parseEsNumber('12')).toBe('12');
    expect(parseDate('14-10-26')).toBe('2026-10-14');
    expect(parseDate('31/13/2026')).toBeNull();
    expect(parseLine('TOTAL 45,00 49,00')).toBeNull();
  });
  it('correspondencia con catálogo con puntuación y ambigüedad', () => {
    const catalog = [{ id: 'a', name: 'Tomate pera' }, { id: 'b', name: 'Tomate cherry' }, { id: 'c', name: 'Calabaza' }];
    const m = matchIngredient('Tomate pera extra', catalog);
    expect(m.best!.ingredient_id).toBe('a');
    expect(['high', 'medium']).toContain(m.level);
    expect(matchIngredient('Calabaza butternut', catalog).best!.ingredient_id).toBe('c');
    expect(matchIngredient('Servilletas papel', catalog).level).toBe('none');
    const byRef = matchIngredient('REF778 algo', catalog, [{ id: 'f', ingredient_id: 'b', supplier_ref: 'REF778', label: '' }]);
    expect(byRef.best).toMatchObject({ ingredient_id: 'b', score: 1, format_id: 'f' });
  });
});

describe('Alérgenos', () => {
  it('parsea texto v1 sin inferir por nombre de ingrediente', () => {
    expect(parseAllergenText('Gluten, Huevos, Lácteos').codes).toEqual(['gluten', 'eggs', 'milk']);
    expect(parseAllergenText('Leche; cosa rara').unknown).toEqual(['cosa rara']);
    expect(parseAllergenText('').codes).toEqual([]);
    expect(stableHash({ a: 1 })).toBe(stableHash({ a: 1 }));
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
  });
});
