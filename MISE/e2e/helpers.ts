import { expect, type Page, type TestInfo } from '@playwright/test';

export const uid = (info: TestInfo) => `${info.project.name.slice(0, 3)}${Date.now().toString(36).slice(-5)}`;

/** Llamadas API autenticadas (dev loopback) para preparar datos de prueba. */
export async function apiPost(page: Page, path: string, data: unknown) {
  const r = await page.request.post(`/api/v1${path}`, { data, headers: { 'x-mise-csrf': '1' } });
  expect(r.status(), `${path}: ${await r.text()}`).toBeLessThan(300);
  return r.json();
}
export async function apiGet(page: Page, path: string) {
  const r = await page.request.get(`/api/v1${path}`);
  expect(r.ok()).toBeTruthy();
  return r.json();
}

/** Acepta el diálogo de confirmación propio de MISE. */
export async function confirmDialog(page: Page) {
  const dlg = page.getByRole('dialog', { name: 'Confirmar' });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: 'Confirmar' }).click();
  await expect(dlg).toBeHidden();
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator('.toast').filter({ hasText: text })).toBeVisible();
}

/** Navegación que funciona igual en iPhone (barra inferior / «Más») y escritorio (barra lateral). */
export async function goSection(page: Page, label: string) {
  const isMobile = (page.viewportSize()?.width ?? 1000) < 960;
  if (!isMobile) return page.locator('aside.sidebar').getByRole('link', { name: label }).click();
  const tab = page.locator('nav.tabbar').getByRole('link', { name: label });
  if (await tab.count()) return tab.click();
  await page.locator('nav.tabbar').getByRole('button', { name: /Más|Més/ }).click();
  await page.getByRole('dialog').getByRole('link', { name: label }).click();
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow, 'sin scroll horizontal').toBe(false);
}

/** Texto de un PDF con pdf.js (dependencia del proyecto): sin utilidades del sistema como pdftotext. */
export async function pdfToText(path: string): Promise<string> {
  const { readFileSync } = await import('node:fs');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    pages.push((content.items as { str?: string }[]).map((i) => i.str ?? '').join('\n'));
  }
  return pages.join('\n');
}
