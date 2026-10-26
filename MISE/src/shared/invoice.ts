/**
 * Extracción heurística de facturas/albaranes a partir de TEXTO (PDF con texto embebido u OCR local).
 * El resultado es siempre una PROPUESTA: nunca modifica precios ni stock sin confirmación humana.
 * El texto de entrada se trata como dato no confiable.
 */

export interface ExtractedLine {
  raw: string;
  description: string;
  quantity: string | null;
  unit: string | null;
  unit_price: string | null;
  total: string | null;
  arithmetic_ok: boolean;
  confidence: number; // 0..1 de la lectura de la línea
}

export interface Extraction {
  supplier_guess: string | null;
  supplier_id_guess: string | null;
  date: string | null; // YYYY-MM-DD
  reference: string | null;
  tax_id: string | null;
  lines: ExtractedLine[];
  totals: { base: string | null; vat: string | null; total: string | null };
  warnings: string[];
}

const NUM = String.raw`-?\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?|-?\d+(?:[.,]\d+)?`;
const NUM_RE = new RegExp(`(?<![\\w])(${NUM})(?![\\w])`, 'g');
const UNIT_RE = /\b(kg|kgs|kilos?|g|gr|grs|gramos|l|lt|lts|litros?|ml|cl|ud|uds|u|un|unid|unidades|caja|cajas|cj|bot|botella|botellas|paq|paquete|manojo|docena|bandeja)\b\.?/i;
const SKIP_RE = /\b(factura|albar[aá]n|fecha|pedido|cliente|total|subtotal|base\s*imponible|iva|i\.v\.a|recargo|irpf|forma\s+de\s+pago|vencimiento|iban|cuota|importe\s+total|a\s+pagar|cambio|efectivo|tarjeta|entregado|p[aá]gina|cif|nif|tel[eé]fono|tlf|email|www\.|c\/|calle|avda|c\.p\.)\b/i;

/** "1.234,56" → "1234.56"; "6,5" → "6.5"; "6.50" → "6.50" */
export function parseEsNumber(token: string): string | null {
  let t = token.trim().replace(/\s/g, '');
  if (!t) return null;
  const neg = t.startsWith('-');
  if (neg) t = t.slice(1);
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d+,\d+$/.test(t)) t = t.replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return (neg ? '-' : '') + t.replace(/^0+(?=\d)/, '');
}

export function parseDate(text: string): string | null {
  const m = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  let yy = Number(m[3]);
  if (yy < 100) yy += 2000;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yy < 2000 || yy > 2100) return null;
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

function approxEqual(a: number, b: number, tol = 0.021) {
  return Math.abs(a - b) <= tol + Math.abs(b) * 0.001;
}

export function parseLine(raw: string): ExtractedLine | null {
  const line = raw.replace(/\s+/g, ' ').trim();
  if (line.length < 4 || SKIP_RE.test(line)) return null;
  const nums: { value: string; index: number }[] = [];
  for (const m of line.matchAll(NUM_RE)) {
    const v = parseEsNumber(m[1]!);
    if (v !== null) nums.push({ value: v, index: m.index ?? 0 });
  }
  if (nums.length < 2) return null;
  const firstNumIdx = nums[0]!.index;
  let description = line.slice(0, firstNumIdx).replace(/[€*|]/g, ' ').trim();
  // Código de artículo al principio ("12345 Tomate pera ...")
  if (!description && nums.length >= 3) {
    const rest = line.slice(nums[0]!.index + 1);
    const t = rest.match(/^\S*\s+([^\d€]+)/);
    if (t) {
      description = t[1]!.trim();
      nums.shift();
    }
  }
  description = description.replace(UNIT_RE, '').replace(/\s{2,}/g, ' ').trim();
  if (!/[a-záéíóúñç]{3,}/i.test(description)) return null;
  const unitMatch = line.slice(firstNumIdx).match(UNIT_RE) ?? line.match(UNIT_RE);
  const tail = nums.slice(-3).map((x) => Number(x.value));
  let quantity: string | null = null;
  let unit_price: string | null = null;
  let total: string | null = null;
  let ok = false;
  if (tail.length === 3) {
    const [q, p, t] = tail as [number, number, number];
    if (approxEqual(q * p, t)) { quantity = String(q); unit_price = String(p); total = String(t); ok = true; }
    else if (approxEqual(p * t, q)) { quantity = String(p); unit_price = String(t); total = String(q); ok = true; }
    else { quantity = String(q); unit_price = String(p); total = String(t); }
  } else {
    const [a, b] = tail as [number, number];
    // Dos números: cantidad y total (precio derivado) — baja confianza
    quantity = String(a);
    total = String(b);
    unit_price = a > 0 ? String(Math.round((b / a) * 10000) / 10000) : null;
  }
  const confidence = Math.min(1, (ok ? 0.6 : 0.25) + (unitMatch ? 0.2 : 0) + (description.length > 5 ? 0.2 : 0.1));
  return { raw: line, description, quantity, unit: unitMatch ? normalizeUnit(unitMatch[1]!) : null, unit_price, total, arithmetic_ok: ok, confidence };
}

export function normalizeUnit(u: string): string {
  const x = u.toLowerCase().replace('.', '');
  if (/^(kg|kgs|kilo|kilos)$/.test(x)) return 'kg';
  if (/^(g|gr|grs|gramos)$/.test(x)) return 'g';
  if (/^(l|lt|lts|litro|litros)$/.test(x)) return 'l';
  if (x === 'ml') return 'ml';
  if (x === 'cl') return 'cl';
  return 'ud';
}

function findAmountAfter(text: string, label: RegExp): string | null {
  const lines = text.split(/\r?\n/);
  for (const l of lines) {
    if (!label.test(l)) continue;
    const nums = [...l.matchAll(NUM_RE)].map((m) => parseEsNumber(m[1]!)).filter((x): x is string => !!x);
    if (nums.length) return nums[nums.length - 1]!;
  }
  return null;
}

export function extractFromText(text: string, suppliers: { id: string; name: string; tax_id?: string | null }[] = []): Extraction {
  const warnings: string[] = [];
  const clean = text.replace(/\u0000/g, '').slice(0, 200_000);
  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const dateLine = lines.find((l) => /fecha/i.test(l) && parseDate(l)) ?? lines.find((l) => parseDate(l));
  const date = dateLine ? parseDate(dateLine) : null;
  const refMatch = clean.match(/(?:factura|fra\.?|albar[aá]n|n[º°o]\.?\s*(?:de\s*)?(?:factura|documento|doc\.?)?|n[uú]mero)\s*[:#]?\s*([A-Z]{0,4}[-/ ]?\d[\w\-/]{1,24})/i);
  const taxMatch = clean.match(/\b([A-HJ-NP-SUVW]\d{7}[0-9A-J]|\d{8}[A-Z])\b/);
  let supplier_id_guess: string | null = null;
  let supplier_guess: string | null = null;
  const normText = normalize(clean);
  for (const s of suppliers) {
    if ((s.tax_id && clean.includes(s.tax_id)) || (s.name.length >= 3 && normText.includes(normalize(s.name)))) {
      supplier_id_guess = s.id;
      supplier_guess = s.name;
      break;
    }
  }
  if (!supplier_guess) supplier_guess = lines.find((l) => /[a-z]{3,}/i.test(l) && !/factura|albar/i.test(l))?.slice(0, 80) ?? null;
  const parsed = lines.map(parseLine).filter((x): x is ExtractedLine => !!x).slice(0, 200);
  if (!parsed.length) warnings.push('no_lines_detected');
  if (!date) warnings.push('no_date_detected');
  const totals = {
    base: findAmountAfter(clean, /base\s*imponible|subtotal/i),
    vat: findAmountAfter(clean, /\b(iva|i\.v\.a)\b/i),
    total: findAmountAfter(clean, /total\s*(factura|a\s*pagar|eur|€)?|importe\s*total/i),
  };
  return { supplier_guess, supplier_id_guess, date, reference: refMatch ? refMatch[1]!.trim() : null, tax_id: taxMatch ? taxMatch[1]! : null, lines: parsed, totals, warnings };
}

// ─────────────────────────── Correspondencia con el catálogo ───────────────────────────

const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'en', 'al', 'a', 'kg', 'g', 'ud', 'uds', 'caja', 'extra', 'fresco', 'fresca']);

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñç ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(' ').filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t));
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  const x = normalize(s).replace(/ /g, '');
  for (let i = 0; i < x.length - 1; i++) out.add(x.slice(i, i + 2));
  return out;
}

/** Similitud combinada (tokens + bigramas de Dice), 0..1. */
export function similarity(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  let common = 0;
  for (const t of ta) if (tb.has(t) || [...tb].some((u) => u.length > 3 && (u.startsWith(t) || t.startsWith(u)))) common++;
  const tokenScore = ta.size && tb.size ? (2 * common) / (ta.size + tb.size) : 0;
  const ba = bigrams(a);
  const bb = bigrams(b);
  let inter = 0;
  for (const g of ba) if (bb.has(g)) inter++;
  const dice = ba.size && bb.size ? (2 * inter) / (ba.size + bb.size) : 0;
  return Math.round(Math.max(tokenScore, 0.6 * tokenScore + 0.4 * dice) * 1000) / 1000;
}

export interface MatchCandidate {
  ingredient_id: string;
  name: string;
  score: number;
  format_id?: string | null;
}

export function matchIngredient(
  description: string,
  catalog: { id: string; name: string }[],
  formats: { id: string; ingredient_id: string; supplier_ref: string | null; label: string }[] = [],
): { best: MatchCandidate | null; candidates: MatchCandidate[]; level: 'high' | 'medium' | 'low' | 'none' } {
  const normDesc = normalize(description);
  const refHit = formats.find((f) => f.supplier_ref && normDesc.split(' ').includes(normalize(f.supplier_ref)));
  const scored: MatchCandidate[] = catalog.map((c) => ({ ingredient_id: c.id, name: c.name, score: similarity(description, c.name) }));
  if (refHit) {
    const c = scored.find((x) => x.ingredient_id === refHit.ingredient_id);
    if (c) { c.score = 1; c.format_id = refHit.id; }
  }
  const candidates = scored.filter((x) => x.score > 0.2).sort((a, b) => b.score - a.score).slice(0, 3);
  const best = candidates[0] ?? null;
  const second = candidates[1];
  let level: 'high' | 'medium' | 'low' | 'none' = 'none';
  if (best) {
    level = best.score >= 0.75 ? 'high' : best.score >= 0.45 ? 'medium' : 'low';
    if (second && best.score - second.score < 0.1 && level === 'high') level = 'medium'; // ambigüedad
  }
  return { best, candidates, level };
}
