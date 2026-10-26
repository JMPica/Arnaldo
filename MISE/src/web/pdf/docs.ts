import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { ALLERGEN_LABELS, type Allergen } from '../../shared/allergens';
import { saveBlob } from '../lib/api';
import { translate, type Lang } from '../lib/i18n';

/**
 * PDFs generados en el navegador con pdf-lib (sin servicios externos).
 * La propuesta para el cliente se construye SOLO con el DTO filtrado por el servidor (/proposal),
 * que no contiene costes, márgenes ni escandallos.
 */

const FOREST = rgb(0.078, 0.157, 0.141);
const SAGE = rgb(0.192, 0.404, 0.31);
const INK2 = rgb(0.29, 0.36, 0.33);
const LINE = rgb(0.86, 0.9, 0.88);
const A4: [number, number] = [595.28, 841.89];
const M = 50;

type Ctx = { t: (k: string, v?: Record<string, string | number>) => string; money: (v: any, o?: { decimals?: number }) => string; num?: (v: any, d?: number) => string; pct?: (v: any) => string; date?: (v: any) => string; lang: Lang };

class Writer {
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];
  private cache = new Map<string, boolean>();
  constructor(public doc: PDFDocument, public regular: PDFFont, public bold: PDFFont, public serif: PDFFont, private footer: string) {
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage(A4);
    this.pages.push(this.page);
    this.y = A4[1] - M;
  }
  ensure(h: number) {
    if (this.y - h < M + 20) this.newPage();
  }
  /** Sustituye caracteres que la codificación WinAnsi de las fuentes estándar no admite. */
  clean(s: string, font: PDFFont) {
    const map: Record<string, string> = { '−': '-', '→': '->', '✓': 'OK', '⚠': '!', '•': '·', '↳': '-', '＋': '+', ' ': ' ', ' ': ' ' };
    let out = '';
    for (const ch of String(s ?? '').replace(/[\r\t]/g, ' ')) {
      const c = map[ch] ?? ch;
      const k = `${font.name}:${c}`;
      if (!this.cache.has(k)) {
        try { font.encodeText(c); this.cache.set(k, true); } catch { this.cache.set(k, false); }
      }
      out += this.cache.get(k) ? c : '?';
    }
    return out;
  }
  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    for (const para of this.clean(text, font).split('\n')) {
      let cur = '';
      for (const word of para.split(' ')) {
        const tryLine = cur ? `${cur} ${word}` : word;
        if (font.widthOfTextAtSize(tryLine, size) > width && cur) { lines.push(cur); cur = word; } else cur = tryLine;
      }
      lines.push(cur);
    }
    return lines;
  }
  text(s: string, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number; width?: number; gap?: number } = {}) {
    const size = o.size ?? 10;
    const font = o.font ?? this.regular;
    const x = o.x ?? M;
    const width = o.width ?? A4[0] - M - x;
    for (const l of this.wrap(s, font, size, width)) {
      this.ensure(size + 4);
      this.page.drawText(l, { x, y: this.y - size, size, font, color: o.color ?? FOREST });
      this.y -= size + (o.gap ?? 4);
    }
  }
  space(h: number) { this.y -= h; }
  rule() { this.ensure(10); this.page.drawLine({ start: { x: M, y: this.y }, end: { x: A4[0] - M, y: this.y }, thickness: 0.6, color: LINE }); this.y -= 10; }
  /** Fila de tabla: columnas con ancho relativo y alineación. */
  row(cells: string[], widths: number[], o: { bold?: boolean; size?: number; align?: ('l' | 'r')[]; fill?: boolean } = {}) {
    const size = o.size ?? 9.5;
    const font = o.bold ? this.bold : this.regular;
    const total = A4[0] - 2 * M;
    const ws = widths.map((w) => (w / widths.reduce((a, b) => a + b, 0)) * total);
    const wrapped = cells.map((c, i) => this.wrap(c, font, size, ws[i]! - 6));
    const h = Math.max(...wrapped.map((w) => w.length)) * (size + 3) + 4;
    this.ensure(h);
    if (o.fill) this.page.drawRectangle({ x: M, y: this.y - h + 2, width: total, height: h, color: rgb(0.95, 0.97, 0.96) });
    let x = M;
    wrapped.forEach((lines, i) => {
      lines.forEach((l, k) => {
        const tw = font.widthOfTextAtSize(l, size);
        const right = (o.align?.[i] ?? 'l') === 'r';
        this.page.drawText(l, { x: right ? x + ws[i]! - tw - 3 : x + 3, y: this.y - size - k * (size + 3), size, font, color: FOREST });
      });
      x += ws[i]!;
    });
    this.y -= h;
    this.page.drawLine({ start: { x: M, y: this.y + 1 }, end: { x: A4[0] - M, y: this.y + 1 }, thickness: 0.4, color: LINE });
  }
  finish() {
    this.pages.forEach((p, i) => {
      const s = this.clean(`${this.footer} · ${i + 1}/${this.pages.length}`, this.regular);
      p.drawText(s, { x: M, y: 28, size: 7.5, font: this.regular, color: INK2 });
    });
  }
}

async function writer(footer: string) {
  const doc = await PDFDocument.create();
  doc.setProducer('MISE Private Chef OS');
  doc.setCreator('MISE');
  const w = new Writer(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold), await doc.embedFont(StandardFonts.TimesRoman), footer);
  return w;
}

async function save(w: Writer, name: string) {
  w.finish();
  const bytes = await w.doc.save();
  const file = name.replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '_');
  saveBlob(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), file);
  return bytes;
}

function fmtMoney(lang: Lang, v: string | number) {
  return new Intl.NumberFormat(lang === 'ca' ? 'ca-ES' : 'es-ES', { style: 'currency', currency: 'EUR' }).format(Number(v));
}
function fmtDate(lang: Lang, iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(lang === 'ca' ? 'ca-ES' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y!, m! - 1, d!)));
}

/** Propuesta comercial para el cliente (sin datos internos). */
export async function proposalPdf(p: any, lang: Lang) {
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  const w = await writer(`${p.brand.name} · ${t('Propuesta')} ${p.reference} · ${t('Presupuesto: no es una factura')}`);
  w.page.drawRectangle({ x: 0, y: A4[1] - 120, width: A4[0], height: 120, color: FOREST });
  w.page.drawText(w.clean(p.brand.name, w.serif), { x: M, y: A4[1] - 70, size: 30, font: w.serif, color: rgb(1, 1, 1) });
  if (p.brand.tagline) w.page.drawText(w.clean(String(p.brand.tagline).toUpperCase(), w.regular), { x: M, y: A4[1] - 92, size: 8.5, font: w.regular, color: rgb(0.64, 0.76, 0.68) });
  w.y = A4[1] - 150;
  w.text(t('Propuesta gastronómica'), { size: 9, font: w.bold, color: SAGE });
  w.text(p.event.title, { size: 22, font: w.serif, gap: 8 });
  w.text(`${p.event.client_name} · ${fmtDate(lang, p.event.date)}${p.event.time ? ` · ${p.event.time} h` : ''} · ${t('{n} comensales', { n: p.event.guest_count })}`, { size: 10.5, color: INK2 });
  if (p.event.location) w.text(p.event.location, { size: 10, color: INK2 });
  w.space(10);
  if (p.menu) {
    w.rule();
    w.text(p.menu.name, { size: 16, font: w.serif, gap: 6 });
    if (p.menu.description) w.text(p.menu.description, { size: 10, color: INK2 });
    w.space(6);
    for (const c of p.menu.courses) {
      w.ensure(50);
      w.text((c.course_name || t('Pase {n}', { n: c.position })).toUpperCase(), { size: 8, font: w.bold, color: SAGE, gap: 3 });
      if (c.dish) {
        w.text(c.dish.name, { size: 12.5, font: w.serif, gap: 3 });
        if (c.dish.description) w.text(c.dish.description, { size: 9.5, color: INK2, gap: 3 });
        w.text(`${t('Alérgenos')}: ${c.dish.allergens.length ? c.dish.allergens.map((a: Allergen) => ALLERGEN_LABELS[lang][a]).join(', ') : t('ninguno declarado')}`, { size: 8, color: INK2, gap: 3 });
      }
      for (const v of c.variants) {
        if (!v.dish) continue;
        w.text(`${t('Alternativa')} (${v.variant}): ${v.dish.name}`, { size: 10, gap: 3, x: M + 12 });
        w.text(`${t('Alérgenos')}: ${v.dish.allergens.length ? v.dish.allergens.map((a: Allergen) => ALLERGEN_LABELS[lang][a]).join(', ') : t('ninguno declarado')}`, { size: 8, color: INK2, x: M + 12, gap: 3 });
      }
      w.space(6);
    }
    if (p.dietary_groups.length) w.text(`${t('Adaptaciones')}: ${p.dietary_groups.map((g: any) => `${g.label} (${g.guest_count})`).join(' · ')}`, { size: 9.5, color: INK2 });
  }
  w.space(8);
  w.rule();
  w.text(t('Presupuesto'), { size: 14, font: w.serif, gap: 8 });
  const pr = p.pricing;
  const widths = [3, 1];
  w.row([t('{n} comensales × {p}', { n: pr.guest_count, p: fmtMoney(lang, pr.price_per_guest) }), fmtMoney(lang, pr.services_total)], widths, { align: ['l', 'r'] });
  if (Number(pr.additional_revenue)) w.row([t('Servicios adicionales'), fmtMoney(lang, pr.additional_revenue)], widths, { align: ['l', 'r'] });
  if (Number(pr.discount)) w.row([t('Descuento'), `-${fmtMoney(lang, pr.discount)}`], widths, { align: ['l', 'r'] });
  w.row([t('Base imponible (sin IVA)'), fmtMoney(lang, pr.taxable_base)], widths, { align: ['l', 'r'], bold: true });
  w.row([t('IVA ({r} %)', { r: pr.vat_rate }), fmtMoney(lang, pr.vat_amount)], widths, { align: ['l', 'r'] });
  w.row([t('Total con IVA'), fmtMoney(lang, pr.total_with_vat)], widths, { align: ['l', 'r'], bold: true, fill: true });
  if (pr.vat_note) w.text(pr.vat_note, { size: 8, color: INK2 });
  w.space(10);
  w.text(t('Propuesta válida {n} días desde el {d}.', { n: p.validity_days, d: fmtDate(lang, p.issued_on) }), { size: 9.5 });
  if (p.terms) { w.space(4); w.text(p.terms, { size: 9, color: INK2 }); }
  w.space(8);
  w.text(t('Información sobre alérgenos verificada manualmente para este menú. Comunícanos cualquier alergia o intolerancia antes del servicio.'), { size: 8.5, color: INK2 });
  if (p.brand.contact_line) { w.space(6); w.text(p.brand.contact_line, { size: 9, font: w.bold }); }
  return save(w, `${t('Propuesta')}_${p.event.title}_${p.event.date}.pdf`);
}

/** Informe interno con costes, márgenes, escandallos y cierre. NO entregar al cliente. */
export async function internalReportPdf(r: any, c: Ctx & { brand: string }) {
  const { t, money } = c;
  const pct = c.pct ?? ((v: any) => String(v));
  const e = r.event;
  const w = await writer(`${c.brand} · ${t('INFORME INTERNO — CONFIDENCIAL')} · ${e.title}`);
  w.text(t('INFORME INTERNO — CONFIDENCIAL'), { size: 9, font: w.bold, color: rgb(0.64, 0.23, 0.16) });
  w.text(e.title, { size: 20, font: w.serif, gap: 6 });
  w.text(`${e.client?.display_name ?? ''} · ${e.event_date} · ${t('{n} comensales', { n: e.guest_count })} · ${e.status}`, { size: 10, color: INK2 });
  if (e.location_private) w.text(e.location_private, { size: 9.5, color: INK2 });
  w.space(6);
  const fin = e.snapshot?.financials ?? e.live_financials;
  if (fin) {
    w.rule();
    w.text(e.snapshot ? t('Presupuesto congelado v{v}', { v: e.snapshot.version }) : t('Presupuesto (precios actuales)'), { size: 13, font: w.serif, gap: 6 });
    const W = [3, 1];
    const R: ['l', 'r'] = ['l', 'r'];
    w.row([t('Ingreso neto (base imponible)'), money(fin.revenue_net)], W, { align: R, bold: true });
    w.row([t('Comida'), money(fin.food_cost)], W, { align: R });
    for (const [k, v] of Object.entries(fin.operating as Record<string, string>)) if (Number(v)) w.row([k, money(v)], W, { align: R });
    w.row([t('Coste total'), money(fin.total_cost)], W, { align: R, bold: true });
    w.row([t('Beneficio'), money(fin.profit)], W, { align: R, bold: true, fill: true });
    w.row([t('Margen'), pct(fin.margin_pct)], W, { align: R });
    w.row([t('Food cost'), pct(fin.food_cost_pct)], W, { align: R });
    w.row([t('Precio recomendado por comensal'), money(e.live_financials?.suggested_per_guest)], W, { align: R });
  }
  if (r.recipe_costs?.length) {
    w.space(8);
    w.text(t('Escandallos'), { size: 13, font: w.serif, gap: 6 });
    for (const rc of r.recipe_costs) {
      w.ensure(40);
      w.row([rc.name, `${t('ración')} ${money(rc.portion_cost, { decimals: 3 })}`, `${t('lote')} ${money(rc.lot_cost)}`], [3, 1.3, 1.3], { bold: true, fill: true, align: ['l', 'r', 'r'] });
      for (const l of rc.lines ?? []) w.row([`  ${l.name}`, `${l.quantity} ${l.unit}`, l.cost ? money(l.cost, { decimals: 3 }) : (l.error ?? '—')], [3, 1.3, 1.3], { size: 8.5, align: ['l', 'r', 'r'] });
    }
  }
  if (e.costs?.length) {
    w.space(8);
    w.text(t('Partidas de coste'), { size: 13, font: w.serif, gap: 6 });
    for (const k of e.costs) w.row([`${k.cost_kind === 'actual' ? t('Real') : t('Previsto')} · ${k.category}`, k.description ?? '', money(Number(k.quantity) * Number(k.unit_amount))], [1.6, 2.4, 1], { align: ['l', 'l', 'r'] });
  }
  if (e.closing) {
    w.space(8);
    w.text(t('Cierre: previsto vs real'), { size: 13, font: w.serif, gap: 6 });
    w.row([t('Partida'), t('Previsto'), t('Real'), t('Desviación')], [2, 1, 1, 1], { bold: true, fill: true, align: ['l', 'r', 'r', 'r'] });
    for (const row of e.closing.rows) if (Number(row.estimated) || Number(row.actual)) w.row([row.category, money(row.estimated), money(row.actual), money(row.variance)], [2, 1, 1, 1], { align: ['l', 'r', 'r', 'r'] });
    w.row([t('Beneficio real'), '', money(e.closing.actual_profit), pct(e.closing.actual_margin_pct)], [2, 1, 1, 1], { bold: true, align: ['l', 'r', 'r', 'r'] });
  }
  if (e.restrictions || e.instructions || e.notes_private) {
    w.space(8);
    w.text(t('Notas'), { size: 13, font: w.serif, gap: 6 });
    for (const s of [e.restrictions, e.instructions, e.notes_private]) if (s) w.text(s, { size: 9.5 });
  }
  return save(w, `Interno_${e.title}_${e.event_date}.pdf`);
}

/** Ficha técnica de receta (uso interno, con escandallo). */
export async function recipeSheetPdf(r: any, c: Ctx & { brand: string; scaleTo: string | null }) {
  const { t, money, lang } = c;
  const w = await writer(`${c.brand} · ${t('Ficha técnica')} · ${r.name}`);
  w.text(t('Ficha técnica'), { size: 9, font: w.bold, color: SAGE });
  w.text(r.name, { size: 22, font: w.serif, gap: 6 });
  w.text(`${r.category ?? ''} · ${t('{n} raciones', { n: r.portions })}${r.yield_quantity ? ` · ${t('rinde')} ${r.yield_quantity} ${r.yield_unit}` : ''} · ${t('Preparación (min)')}: ${r.preparation_minutes} · ${t('Cocción (min)')}: ${r.cooking_minutes}`, { size: 10, color: INK2 });
  const factor = c.scaleTo ? Number(c.scaleTo) / Number(r.portions) : 1;
  if (c.scaleTo) w.text(t('Cantidades escaladas a {n} raciones (factor {f}).', { n: c.scaleTo, f: factor.toFixed(3) }), { size: 9.5, font: w.bold });
  w.space(6);
  w.row([t('Ingrediente / subreceta'), t('Cantidad'), t('Coste')], [3, 1.2, 1.2], { bold: true, fill: true, align: ['l', 'r', 'r'] });
  for (const l of r.cost?.lines ?? []) w.row([l.name + (l.kind === 'subrecipe' ? ` (${t('subreceta')})` : ''), `${(Number(l.quantity) * factor).toLocaleString(lang === 'ca' ? 'ca-ES' : 'es-ES', { maximumFractionDigits: 3 })} ${l.unit === 'portion' ? t('ración') : l.unit}`, l.cost ? money(Number(l.cost) * factor, { decimals: 3 }) : (l.error ?? '—')], [3, 1.2, 1.2], { align: ['l', 'r', 'r'] });
  if (r.cost) {
    w.row([t('Coste del lote'), '', money(Number(r.cost.lot_cost) * factor)], [3, 1.2, 1.2], { bold: true, align: ['l', 'r', 'r'] });
    w.row([t('Coste por ración'), '', money(r.cost.portion_cost, { decimals: 3 })], [3, 1.2, 1.2], { bold: true, align: ['l', 'r', 'r'] });
    w.space(6);
    w.text(`${t('Alérgenos')}: ${r.cost.allergens.length ? r.cost.allergens.map((a: Allergen) => ALLERGEN_LABELS[lang][a]).join(', ') : t('ninguno declarado')} · ${r.allergen_review === 'reviewed' ? t('Alérgenos revisados') : t('Alérgenos pendientes de revisión')}`, { size: 9.5, font: w.bold });
  }
  const instr = lang === 'ca' ? r.instructions_ca || r.instructions_es : r.instructions_es;
  for (const [title, val] of [[t('Elaboración'), instr], [t('Técnicas'), r.techniques], [t('Conservación'), r.conservation], [t('Notas'), r.notes]] as [string, string][]) {
    if (!val) continue;
    w.space(6);
    w.text(title, { size: 12, font: w.serif, gap: 4 });
    w.text(val, { size: 9.5 });
  }
  return save(w, `Ficha_${r.name}.pdf`);
}

/** Lista de compra para el mercado (agrupada por proveedor). */
export async function shoppingListPdf(data: any, c: Ctx) {
  const { t, money } = c;
  const num = c.num ?? ((v: any) => String(v));
  const w = await writer(`MISE · ${t('Lista de compra')} · ${new Date().toISOString().slice(0, 10)}`);
  w.text(t('Lista de compra'), { size: 20, font: w.serif, gap: 6 });
  w.text(data.events.map((e: any) => `${e.event_date} ${e.title} (${e.guest_count})`).join(' · '), { size: 9.5, color: INK2 });
  const groups = new Map<string, any[]>();
  for (const r of data.rows) { const k = r.supplier_name ?? t('Sin proveedor'); groups.set(k, [...(groups.get(k) ?? []), r]); }
  for (const [sup, rows] of groups) {
    w.space(8);
    w.text(sup, { size: 13, font: w.serif, gap: 4 });
    w.row([t('Ingrediente'), t('A comprar'), t('Envases'), t('Coste')], [2.6, 1.2, 1.8, 1], { bold: true, fill: true, align: ['l', 'r', 'l', 'r'] });
    for (const r of rows) w.row([`[  ] ${r.name}`, `${num(r.need, 1)} ${r.base_unit}`, r.format ? `${num(r.packs, 2)} × ${r.format.label}` : t('Sin formato con precio'), r.expected_cost ? money(r.expected_cost) : '—'], [2.6, 1.2, 1.8, 1], { align: ['l', 'r', 'l', 'r'] });
  }
  w.space(8);
  w.text(`${t('Compra prevista')}: ${money(data.total_expected)} (${t('sin IVA, envases completos')})`, { size: 11, font: w.bold });
  return save(w, `Lista_compra_${new Date().toISOString().slice(0, 10)}.pdf`);
}
