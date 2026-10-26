import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { apiGet, confirmDialog, expectToast, goSection, noHorizontalOverflow, uid } from './helpers';

/**
 * E2E-01: catálogo → receta + subreceta → menú de 8 pases → cliente → evento 10 comensales → propuesta PDF →
 * confirmar → compras → recepción → producción → costes reales → cierre → margen real.
 * Incluye E2E-04/CALC-06 (subida de precio tras confirmar no altera el presupuesto congelado)
 * y E2E-05 (la propuesta PDF no contiene costes, beneficio ni márgenes).
 */
test('E2E-01 evento completo desde la interfaz', async ({ page }, info) => {
  const u = uid(info);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tu cocina, bajo control' })).toBeVisible();
  await noHorizontalOverflow(page);

  // Proveedor
  await goSection(page, 'Proveedores');
  await page.getByRole('button', { name: /Nuevo proveedor/ }).click();
  await page.getByLabel(/^Nombre/).fill(`Huerta ${u}`);
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expectToast(page, 'Proveedor guardado');

  // Ingredientes con formato y precio
  const newIngredient = async (name: string, unit: 'g' | 'ml', waste: string, qty: string, price: string, allergen?: string) => {
    await goSection(page, 'Ingredientes');
    await page.getByRole('button', { name: /Nuevo ingrediente/ }).click();
    const d = page.getByRole('dialog');
    await d.getByLabel(/^Nombre/).fill(name);
    await d.getByLabel('Unidad base').selectOption(unit);
    await d.getByLabel('Merma / limpieza (%)').fill(waste);
    await d.getByLabel('Proveedor preferido').selectOption({ label: `Huerta ${u}` });
    await d.getByLabel('Formato de compra (opcional)').fill(`Envase ${qty} ${unit}`);
    await d.getByLabel(/^Cantidad del envase/).fill(qty);
    await d.getByLabel('Precio del envase sin IVA (€)').fill(price);
    if (allergen) await d.getByRole('button', { name: allergen }).click();
    await d.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
  };
  await newIngredient(`Calabaza ${u}`, 'g', '20', '1000', '2,40');
  await expect(page.getByText('3,00 €').first()).toBeVisible(); // coste útil 2,40/(1000×0,8) = 3,00 €/kg
  await newIngredient(`Nata ${u}`, 'ml', '0', '1000', '4,20', 'Lácteos');

  // Subreceta medida (800 g) y recetas
  const newRecipe = async (name: string, portions: string, lines: [string, string, string][], yieldG?: string) => {
    await page.goto('/recetas/nueva');
    await page.getByLabel(/^Nombre/).fill(name);
    await page.getByLabel(/^Raciones del lote/).fill(portions);
    if (yieldG) { await page.getByLabel('Rendimiento medido').fill(yieldG); await page.getByLabel('Unidad del rendimiento').selectOption('g'); }
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) await page.getByRole('button', { name: /Añadir línea/ }).click();
      await page.getByLabel('Ingrediente o subreceta').nth(i).selectOption({ label: lines[i]![0] });
      await page.getByLabel('Cantidad', { exact: true }).nth(i).fill(lines[i]![1]);
      await page.getByLabel('Unidad', { exact: true }).nth(i).selectOption(lines[i]![2]);
    }
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expectToast(page, 'Receta guardada');
    await expect(page).toHaveURL(/\/recetas\/[\w-]{36}$/);
  };
  await newRecipe(`Fondo ${u}`, '4', [[`Calabaza ${u} (g)`, '1000', 'g']], '800');
  await newRecipe(`Crema ${u}`, '4', [[`Calabaza ${u} (g)`, '500', 'g'], [`Nata ${u} (ml)`, '180', 'ml']]);
  // CALC: 500×0,003 + 180×0,0042 = 2,256 € → 0,564 €/ración
  await expect(page.locator('.kv').getByText('0,56 €')).toBeVisible();
  await newRecipe(`Plato ${u}`, '4', [[`↳ Subreceta: Fondo ${u}`, '200', 'g'], [`Nata ${u} (ml)`, '0,1', 'l']]);
  await expect(page.locator('.kv').getByText('1,17 €')).toBeVisible(); // 0,75 + 0,42

  const recipes = (await apiGet(page, '/recipes')) as { id: string; name: string }[];
  const rid = (n: string) => recipes.find((r) => r.name === n)!.id;
  // Revisión de alérgenos (subreceta primero)
  for (const n of [`Fondo ${u}`, `Crema ${u}`, `Plato ${u}`]) {
    await page.goto(`/recetas/${rid(n)}`);
    await page.getByRole('button', { name: 'Marcar alérgenos como revisados' }).click();
    await confirmDialog(page);
    await expectToast(page, 'Alérgenos revisados y aprobados');
  }

  // Menú degustación de 8 pases
  await page.goto('/menus/nuevo');
  await page.getByLabel(/^Nombre del menú/).fill(`Degustación ${u}`);
  for (let i = 1; i < 8; i++) await page.getByRole('button', { name: /Añadir pase/ }).click();
  for (let i = 0; i < 8; i++) {
    await page.getByLabel('Nombre del pase (ES)').nth(i).fill(`Pase ${i + 1}`);
    await page.getByLabel('Plato base').nth(i).selectOption(rid(i % 2 ? `Plato ${u}` : `Crema ${u}`));
  }
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expectToast(page, 'Menú guardado');
  await page.getByRole('button', { name: 'Marcar menú como revisado' }).click();
  await confirmDialog(page);
  await expectToast(page, 'Menú revisado');

  // Evento rápido con cliente nuevo
  await goSection(page, 'Eventos');
  await page.getByRole('link', { name: /Nuevo evento/ }).first().click();
  await page.getByLabel('Nombre del cliente nuevo').fill(`Cliente ${u}`);
  await page.getByLabel('Título del evento').fill(`Cena ${u}`);
  await page.getByLabel(/^Fecha/).first().fill('2031-06-20');
  await page.getByLabel(/^Comensales/).fill('10');
  await page.getByLabel('Menú', { exact: true }).selectOption({ index: (await page.getByLabel('Menú', { exact: true }).locator('option').allTextContents()).findIndex((o) => o.startsWith(`Degustación ${u}`)) });
  await page.getByLabel('Horas del chef').fill('6');
  await page.getByLabel('Tarifa hora (€)').fill('30');
  await page.getByLabel('Desplazamiento (€)').fill('20');
  await page.getByLabel('Precio por comensal sin IVA (€)').fill('120');
  await noHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Guardar presupuesto' }).click();
  await expect(page.getByRole('heading', { name: `Cena ${u}` })).toBeVisible();
  const eventId = page.url().split('/').pop()!;

  // E2E-05: propuesta PDF para el cliente sin datos internos
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Propuesta PDF (ES)' }).click()]);
  const pdfPath = info.outputPath('propuesta.pdf');
  await dl.saveAs(pdfPath);
  const text = execFileSync('pdftotext', ['-layout', pdfPath, '-']).toString();
  expect(text).toContain(`Cena ${u}`);
  expect(text).toContain(`Crema ${u}`);
  expect(text).toMatch(/1\.?320,00/); // 1.200 € + IVA 10 % (es-ES no agrupa 4 cifras)
  expect(text).toMatch(/Lácteos/);
  for (const secret of ['Coste', 'coste', 'Beneficio', 'Margen', 'margen', 'Escandallo', 'Food cost', '0,564', 'Horas del chef']) expect(text).not.toContain(secret);
  // Informe interno sí lleva márgenes
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Informe interno PDF' }).click()]);
  await dl2.saveAs(info.outputPath('interno.pdf'));
  const internal = execFileSync('pdftotext', [info.outputPath('interno.pdf'), '-']).toString();
  expect(internal).toContain('CONFIDENCIAL');
  expect(internal).toContain('Beneficio');

  // Confirmar → presupuesto congelado
  await page.getByRole('button', { name: 'Confirmar evento' }).click();
  await expectToast(page, 'Evento confirmado');
  await expect(page.locator('.pill.confirmed').first()).toBeVisible();
  const frozen = await apiGet(page, `/events/${eventId}`);
  const frozenFood = frozen.snapshot.financials.food_cost;

  // E2E-04 / CALC-06: subir precio después de confirmar no reescribe el presupuesto
  const ings = (await apiGet(page, '/ingredients')) as { id: string; name: string }[];
  await page.goto(`/ingredientes/${ings.find((i) => i.name === `Calabaza ${u}`)!.id}`);
  await page.getByRole('button', { name: 'Nuevo precio' }).click();
  await page.getByRole('dialog').getByLabel(/^Precio del envase sin IVA/).fill('3,60');
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar precio' }).click();
  await expectToast(page, 'Precio registrado');
  await page.goto(`/eventos/${eventId}`);
  await expect(page.getByText(/Han cambiado precios, menú o datos/)).toBeVisible();
  const after = await apiGet(page, `/events/${eventId}`);
  expect(after.snapshot.financials.food_cost).toBe(frozenFood);
  expect(after.live_financials.food_cost).not.toBe(frozenFood);

  // Compras: lista del evento → pedido → recepción
  await page.getByRole('tab', { name: 'Compras y producción' }).click();
  await page.getByRole('link', { name: 'Lista de compra de este evento' }).click();
  await expect(page.getByText(`Calabaza ${u}`).first()).toBeVisible();
  await page.getByRole('button', { name: 'Crear pedido' }).first().click();
  await expectToast(page, 'Pedido creado');
  await page.getByRole('button', { name: 'Rellenar todo lo pendiente' }).click();
  await page.getByRole('button', { name: 'Registrar recepción' }).click();
  await expectToast(page, 'Recepción registrada');
  await expect(page.locator('.pill.ok').filter({ hasText: 'Recibido' })).toBeVisible();

  // Producción: consumo de stock
  await page.goto(`/eventos/${eventId}`);
  await page.getByRole('tab', { name: 'Compras y producción' }).click();
  await expect(page.getByText('Plan de producción (mise en place)')).toBeVisible();
  await page.getByRole('button', { name: 'Registrar consumo de producción' }).click();
  await confirmDialog(page);
  await expectToast(page, 'Consumo de producción registrado');

  // Costes reales y cierre
  await page.getByRole('tab', { name: 'Costes' }).click();
  const addActual = async (category: string, qty: string, amount: string) => {
    await page.locator('section', { hasText: 'Costes reales' }).getByRole('button', { name: /Añadir/ }).click();
    const d = page.getByRole('dialog');
    await d.getByLabel('Categoría').selectOption(category);
    await d.getByLabel(/^(Cantidad|Horas)$/).fill(qty);
    await d.getByLabel(/^(Importe unitario sin IVA|Tarifa por hora)/).fill(amount);
    await d.getByRole('button', { name: 'Añadir' }).click();
    await expectToast(page, 'Coste añadido');
  };
  await addActual('food', '1', '80');
  await addActual('chef_hours', '7', '30');
  await page.getByRole('tab', { name: 'Cierre' }).click();
  await page.getByRole('button', { name: 'Cerrar y archivar resultado' }).click();
  await confirmDialog(page);
  await expectToast(page, 'Evento cerrado');
  // 1.200 − (80 + 210) = 910 € → margen 75,8 %
  await expect(page.locator('.kv').getByText('910,00 €')).toBeVisible();
  await expect(page.locator('.kv').getByText('75,8 %')).toBeVisible();
  await noHorizontalOverflow(page);
  await page.screenshot({ path: info.outputPath('cierre.png'), fullPage: true });
});
