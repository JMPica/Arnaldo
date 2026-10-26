import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { apiGet, apiPost, confirmDialog, expectToast, goSection, noHorizontalOverflow, uid } from './helpers';

const key = () => `k${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

async function seedCatalog(page: import('@playwright/test').Page, u: string) {
  const sup = await apiPost(page, '/suppliers', { name: `Verduras ${u}` });
  const z = await apiPost(page, '/ingredients', { name: `Zanahoria ${u}`, base_unit: 'g', waste_pct: '25', allergens: [], preferred_supplier_id: sup.id });
  await apiPost(page, '/purchase-formats', { ingredient_id: z.id, supplier_id: sup.id, label: 'Malla 500 g', pack_quantity_base: '500', initial_price: '3.00', effective_at: '2026-01-01' });
  return { sup, z };
}

test('E2E-02 dos eventos comparten ingrediente: stock una vez y envases redondeados una vez', async ({ page }, info) => {
  const u = uid(info);
  const { z } = await seedCatalog(page, u);
  const r1 = await apiPost(page, '/recipes', { name: `Z400 ${u}`, portions: '1', lines: [{ ingredient_id: z.id, quantity: '400', unit: 'g' }] });
  const r2 = await apiPost(page, '/recipes', { name: `Z350 ${u}`, portions: '1', lines: [{ ingredient_id: z.id, quantity: '350', unit: 'g' }] });
  const m1 = await apiPost(page, '/menus', { name: `M1 ${u}`, lines: [{ position: 1, recipe_id: r1.id, servings_per_guest: '1', variant: '' }] });
  const m2 = await apiPost(page, '/menus', { name: `M2 ${u}`, lines: [{ position: 1, recipe_id: r2.id, servings_per_guest: '1', variant: '' }] });
  const cl = await apiPost(page, '/clients', { display_name: `Cliente ${u}` });
  const ev = (menu: string, d: string) => apiPost(page, '/events', { client_id: cl.id, menu_id: menu, title: `Ev ${u} ${d}`, event_date: d, guest_count: 1, price_per_guest: '50', vat_rate: '10', target_margin_pct: '30' });
  const e1 = await ev(m1.id, '2032-03-01');
  const e2 = await ev(m2.id, '2032-03-02');
  await apiPost(page, '/stock/movements', { ingredient_id: z.id, kind: 'opening', quantity_base: '100', occurred_at: '2026-10-01', idempotency_key: key() });
  await page.goto(`/compras?events=${e1.id},${e2.id}`);
  const row = page.locator('tr', { hasText: `Zanahoria ${u}` });
  await expect(row).toBeVisible();
  // neto 750 → bruto 1000 (merma 25 %) − stock 100 = 900 → ceil(900/500) = 2 envases → 6,00 €
  await expect(row.locator('td').nth(1)).toHaveText('750 g');
  await expect(row.locator('td').nth(2)).toHaveText('1000');
  await expect(row.locator('td').nth(4)).toHaveText('900');
  await expect(row.locator('td').nth(5)).toContainText('2 × Malla 500 g');
  await expect(row.locator('td').nth(6)).toHaveText('6,00 €');
  await noHorizontalOverflow(page);
});

test('E2E-03 stock no negativo en silencio y reintento sin duplicar', async ({ page }, info) => {
  const u = uid(info);
  const { z } = await seedCatalog(page, u);
  await page.goto(`/ingredientes/${z.id}`);
  await page.getByRole('button', { name: 'Ajustar stock' }).click();
  let d = page.getByRole('dialog');
  await d.getByLabel('Tipo').selectOption('opening');
  await d.getByLabel(/^Cantidad/).fill('300');
  await d.getByRole('button', { name: 'Registrar' }).click();
  await expectToast(page, 'Movimiento registrado');
  await page.getByRole('button', { name: 'Ajustar stock' }).click();
  d = page.getByRole('dialog');
  await d.getByLabel('Tipo').selectOption('waste');
  await d.getByLabel(/^Cantidad/).fill('500');
  await d.getByRole('button', { name: 'Registrar' }).click();
  await expectToast(page, 'Stock insuficiente');
  await d.getByRole('button', { name: 'Cancelar' }).click();
  // reintento con la misma clave de idempotencia (doble envío) → un único movimiento
  const k = key();
  for (let i = 0; i < 2; i++) await apiPost(page, '/stock/movements', { ingredient_id: z.id, kind: 'adjustment', quantity_base: '-50', occurred_at: '2026-10-02', idempotency_key: k });
  const det = await apiGet(page, `/ingredients/${z.id}`);
  expect(det.stock_on_hand).toBe('250');
  expect(det.movements).toHaveLength(2);
});

test('E2E-06 idiomas ES/CA, teclado y errores de formulario', async ({ page }) => {
  await page.goto('/ingredientes');
  // error de validación visible (nombre vacío)
  await page.getByRole('button', { name: /Nuevo ingrediente/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
  await expectToast(page, 'Revisa los campos marcados.');
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  // teclado: Tab llega a enlaces/botones accesibles
  await page.keyboard.press('Tab');
  const tag = await page.evaluate(() => document.activeElement?.tagName);
  expect(['A', 'BUTTON', 'INPUT']).toContain(tag);
  // cambio a catalán
  await page.goto('/ajustes');
  await page.getByLabel('Idioma de la aplicación').selectOption('ca');
  await page.getByRole('button', { name: 'Guardar ajustes' }).click();
  await expect(page.getByRole('heading', { name: 'Configuració i dades' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'La teva cuina, sota control' })).toBeVisible();
  await goSection(page, 'Receptes');
  await expect(page.getByRole('heading', { name: 'Receptes i fitxes tècniques' })).toBeVisible();
  const body = await page.locator('body').innerText();
  for (const es of ['Recetas y fichas técnicas', 'Nueva receta', 'Buscar receta']) expect(body).not.toContain(es);
  await noHorizontalOverflow(page);
  // volver a castellano
  await page.goto('/ajustes');
  await page.getByLabel('Idioma de l’aplicació').selectOption('es');
  await page.getByRole('button', { name: 'Desar configuració' }).click();
  await expect(page.getByRole('heading', { name: 'Ajustes y datos' })).toBeVisible();
});

test('E2E-07 alérgeno pendiente bloquea la revisión del menú y la propuesta', async ({ page }, info) => {
  const u = uid(info);
  const ing = await apiPost(page, '/ingredients', { name: `Harina ${u}`, base_unit: 'g', waste_pct: '0', allergens: ['gluten'] });
  const r = await apiPost(page, '/recipes', { name: `Pan ${u}`, portions: '4', lines: [{ ingredient_id: ing.id, quantity: '300', unit: 'g' }] });
  const m = await apiPost(page, '/menus', { name: `Menú pan ${u}`, lines: [{ position: 1, recipe_id: r.id, servings_per_guest: '1', variant: '' }] });
  await page.goto(`/menus/${m.id}`);
  await expect(page.getByText('Gluten').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marcar menú como revisado' })).toBeDisabled();
  await expect(page.getByText(/Recetas pendientes de revisión/)).toContainText(`Pan ${u}`);
  const cl = await apiPost(page, '/clients', { display_name: `Cl ${u}` });
  const ev = await apiPost(page, '/events', { client_id: cl.id, menu_id: m.id, title: `Ev pan ${u}`, event_date: '2032-01-10', guest_count: 4, price_per_guest: '40', vat_rate: '10', target_margin_pct: '30' });
  await page.goto(`/eventos/${ev.id}`);
  await page.getByRole('button', { name: 'Propuesta PDF (ES)' }).click();
  await expectToast(page, 'Revisa y aprueba los alérgenos del menú');
  await page.getByRole('button', { name: 'Confirmar evento' }).click();
  await expectToast(page, 'Faltan datos para confirmar');
  // tras revisar receta y menú se desbloquea
  await page.goto(`/recetas/${r.id}`);
  await page.getByRole('button', { name: 'Marcar alérgenos como revisados' }).click();
  await confirmDialog(page);
  await page.goto(`/menus/${m.id}`);
  await page.getByRole('button', { name: 'Marcar menú como revisado' }).click();
  await confirmDialog(page);
  await expect(page.locator('.pill.ok').filter({ hasText: 'Alérgenos revisados' }).first()).toBeVisible();
});

async function invoicePdf(lines: string[]) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  lines.forEach((l, i) => page.drawText(l, { x: 50, y: 790 - i * 18, size: 11, font }));
  return Buffer.from(await doc.save());
}

test('DOC-01/02 factura PDF: subida privada, extracción local, revisión y actualización de precios', async ({ page }, info) => {
  const u = uid(info);
  const { sup, z } = await seedCatalog(page, u);
  const pdf = await invoicePdf([
    `Verduras ${u} SL`, 'CIF B12345678', `FACTURA Nº F-${u}-7`, 'Fecha: 15/10/2026', 'Descripción Cant. Precio Importe',
    `Zanahoria ${u} malla 4 3,20 12,80`, 'Base imponible 12,80', 'IVA 10% 1,28', 'TOTAL FACTURA 14,08 €',
  ]);
  await page.goto('/documentos');
  await page.getByTestId('doc-file').setInputFiles({ name: `factura-${u}.pdf`, mimeType: 'application/pdf', buffer: pdf });
  await expect(page.getByText('Revisión de documento')).toBeVisible();
  await expect(page.locator('img.preview-img').first()).toBeVisible();
  await page.getByRole('button', { name: 'Extraer datos' }).click();
  await expectToast(page, 'Propuesta extraída');
  // la extracción NO cambia precios
  expect((await apiGet(page, `/ingredients/${z.id}`)).current_price.pack_price).toBe('3');
  await expect(page.getByLabel('Nº documento')).toHaveValue(`F-${u}-7`);
  await expect(page.getByLabel(/^Fecha/)).toHaveValue('2026-10-15');
  await expect(page.getByLabel('Proveedor', { exact: true })).toHaveValue(sup.id);
  await expect(page.getByLabel('Ingrediente del catálogo').first()).toHaveValue(z.id);
  await expect(page.getByLabel('Envases / cantidad').first()).toHaveValue('4');
  await expect(page.getByLabel('Precio por envase (€)').first()).toHaveValue('3.2');
  await page.getByRole('button', { name: 'Confirmar y actualizar precios' }).click();
  await confirmDialog(page);
  await expectToast(page, 'Compra creada y precios actualizados');
  const after = await apiGet(page, `/ingredients/${z.id}`);
  expect(after.current_price.pack_price).toBe('3.2');
  expect(after.price_history[0].source_type).toBe('document');
  expect(after.stock_on_hand).toBe('2000');
  // DOC-03: misma factura otra vez → duplicado detectado
  await page.goto('/documentos');
  await page.getByTestId('doc-file').setInputFiles({ name: `copia-${u}.pdf`, mimeType: 'application/pdf', buffer: pdf });
  await expectToast(page, 'Este documento ya se había subido.');
  // fichero sin sesión → bloqueado (la petición sin cookies de Access en dev sigue siendo loopback, se comprueba en integración/smoke)
});

test('Captura por foto: OCR local en el navegador (Tesseract auto-alojado)', async ({ page, browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'OCR pesado: se ejecuta una vez (escritorio)');
  const u = uid(info);
  const { z } = await seedCatalog(page, u);
  // genera una "foto" de un ticket
  const p2 = await browser.newPage({ viewport: { width: 900, height: 500 } });
  await p2.setContent(`<body style="font:28px Arial;padding:30px;background:#fff;color:#000"><div>MERCADO CENTRAL</div><div>Fecha: 16/10/2026</div><div>Albaran N 77${u.slice(-3)}</div><div>Zanahoria ${u} malla 2 3,40 6,80</div><div>TOTAL 6,80</div></body>`);
  const png = await p2.screenshot();
  await p2.close();
  await page.goto('/documentos');
  await page.getByTestId('doc-camera').setInputFiles({ name: 'ticket.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('Revisión de documento')).toBeVisible();
  await page.getByRole('button', { name: 'Extraer datos' }).click();
  await expectToast(page, 'Propuesta extraída');
  await expect(page.getByLabel(/^Fecha/)).toHaveValue('2026-10-16', { timeout: 60_000 });
  await expect(page.getByLabel('Ingrediente del catálogo').first()).toHaveValue(z.id);
  await expect(page.getByLabel('Precio por envase (€)').first()).toHaveValue('3.4');
});

test('BACKUP-01/02 copia JSON desde Ajustes y restauración con confirmación', async ({ page }, info) => {
  const u = uid(info);
  await apiPost(page, '/clients', { display_name: `Backup ${u}` });
  await page.goto('/ajustes');
  await page.getByRole('tab', { name: 'Copias y exportación' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar copia' }).click()]);
  const path = info.outputPath('backup.json');
  await dl.saveAs(path);
  const backup = JSON.parse(readFileSync(path, 'utf8'));
  expect(backup.format).toBe('mise-backup');
  expect(JSON.stringify(backup)).not.toMatch(/CF_Authorization|eyJhbGci|access_subject/);
  // cambio posterior que la restauración debe revertir
  await apiPost(page, '/clients', { display_name: `Posterior ${u}` });
  // buffer en vez de ruta: la ruta de salida contiene tildes («restauración»)
  await page.getByLabel('Archivo de copia').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: readFileSync(path) });
  await expect(page.getByText('Copia válida · suma de verificación correcta')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restaurar ahora' })).toBeDisabled();
  await page.getByLabel('Escribe RESTAURAR para confirmar').fill('RESTAURAR');
  await page.getByRole('button', { name: 'Restaurar ahora' }).click();
  await expectToast(page, 'Restauración completada y verificada');
  const clients = (await apiGet(page, '/clients')) as { display_name: string }[];
  expect(clients.some((c) => c.display_name === `Backup ${u}`)).toBe(true);
  expect(clients.some((c) => c.display_name === `Posterior ${u}`)).toBe(false);
  await expect(page.getByText('antes de restaurar').first()).toBeVisible();
});

test('IMPORT-01 importación del backup v1 desde la interfaz con conciliación', async ({ page }) => {
  await page.goto('/ajustes');
  await page.getByRole('tab', { name: 'Importar MISE v1' }).click();
  await page.getByLabel('Archivo v1').setInputFiles('fixtures/legacy_backup_v1_ficticio.json');
  await expect(page.getByText('Se crearán')).toBeVisible();
  const merge = page.getByText(/Esta copia ya se importó/);
  if (await merge.count()) await merge.click();
  await page.getByRole('button', { name: 'Importar ahora' }).click();
  await expectToast(page, 'Importación completada');
  await expect(page.locator('.notice').filter({ hasText: 'Importación completada' })).toBeVisible();
  await goSection(page, 'Eventos');
  await page.getByRole('button', { name: 'Todos' }).click();
  await expect(page.getByText('Cliente DEMO sintético').first()).toBeVisible();
});
