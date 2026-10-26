import type { CurrentPrice, FormatData, IngredientData, PriceEntry } from './costing';
import { Decimal, DomainError, ONE, ZERO, dec, pctFraction } from './decimal';

// ─────────────────────────── Libro de stock ───────────────────────────

export type MovementKind = 'opening' | 'receipt' | 'consumption' | 'waste' | 'adjustment' | 'reservation' | 'reservation_release';

export interface MovementData {
  ingredient_id: string;
  event_id: string | null;
  kind: MovementKind;
  quantity_base: string;
}

export interface StockBalance {
  on_hand: Decimal; // existencias físicas brutas
  reserved: Decimal; // total comprometido por eventos
  reserved_by_event: Map<string, Decimal>;
}

export function physicalDelta(kind: MovementKind, qty: Decimal): Decimal {
  switch (kind) {
    case 'opening':
    case 'receipt':
      return qty;
    case 'consumption':
    case 'waste':
      return qty.negated();
    case 'adjustment':
      return qty; // con signo
    default:
      return ZERO;
  }
}

export function stockBalances(movements: MovementData[]): Map<string, StockBalance> {
  const out = new Map<string, StockBalance>();
  for (const m of movements) {
    const b = out.get(m.ingredient_id) ?? { on_hand: ZERO, reserved: ZERO, reserved_by_event: new Map() };
    const q = dec(m.quantity_base);
    b.on_hand = b.on_hand.plus(physicalDelta(m.kind, q));
    if (m.kind === 'reservation' || m.kind === 'reservation_release') {
      const signed = m.kind === 'reservation' ? q : q.negated();
      b.reserved = b.reserved.plus(signed);
      if (m.event_id) b.reserved_by_event.set(m.event_id, (b.reserved_by_event.get(m.event_id) ?? ZERO).plus(signed));
    }
    out.set(m.ingredient_id, b);
  }
  return out;
}

/** Valida que un movimiento de salida no deje existencias negativas (nunca en silencio). */
export function assertNotNegative(balance: StockBalance | undefined, kind: MovementKind, qty: Decimal, ingredientName: string) {
  const current = balance?.on_hand ?? ZERO;
  const next = current.plus(physicalDelta(kind, qty));
  if (next.isNegative()) {
    throw new DomainError('negative_stock', `Stock insuficiente de ${ingredientName}`, { ingredient: ingredientName, on_hand: current.toFixed(), requested: qty.toFixed() });
  }
}

// ─────────────────────────── D. Lista de compra ───────────────────────────

export interface FormatOption {
  format_id: string;
  supplier_id: string | null;
  label: string;
  pack_price: Decimal;
  pack_quantity_base: Decimal;
  whole_packs_only: boolean;
  effective_at: string;
}

export interface ShoppingRow {
  ingredient_id: string;
  name: string;
  base_unit: string;
  waste_pct: Decimal;
  net: Decimal; // demanda útil consolidada N
  gross: Decimal; // B = N / (1 − w)
  stock_available: Decimal; // S
  need: Decimal; // max(0, B − S)
  format: FormatOption | null;
  packs: Decimal; // ceil(need/Q) si solo envases completos
  expected_cost: Decimal | null;
  surplus: Decimal; // packs×Q − need
  alternatives: { format: FormatOption; packs: Decimal; cost: Decimal }[];
}

export function formatOptions(formats: FormatData[], prices: PriceEntry[], asOf: string): Map<string, FormatOption[]> {
  const latest = new Map<string, PriceEntry>();
  for (const p of prices) {
    if (p.effective_at > asOf) continue;
    const cur = latest.get(p.format_id);
    if (!cur || p.effective_at > cur.effective_at || (p.effective_at === cur.effective_at && p.recorded_at > cur.recorded_at)) latest.set(p.format_id, p);
  }
  const out = new Map<string, FormatOption[]>();
  for (const f of formats) {
    if (!f.is_active) continue;
    const p = latest.get(f.id);
    if (!p) continue;
    const arr = out.get(f.ingredient_id) ?? [];
    arr.push({ format_id: f.id, supplier_id: f.supplier_id, label: f.label, pack_price: dec(p.pack_price), pack_quantity_base: dec(p.pack_quantity_base), whole_packs_only: f.whole_packs_only, effective_at: p.effective_at });
    out.set(f.ingredient_id, arr);
  }
  return out;
}

function packsFor(need: Decimal, f: FormatOption): Decimal {
  if (need.lessThanOrEqualTo(0)) return ZERO;
  const raw = need.div(f.pack_quantity_base);
  return f.whole_packs_only ? raw.toDecimalPlaces(0, Decimal.ROUND_CEIL) : raw;
}

/**
 * Consolida demanda neta → bruto con merma (una sola vez) → resta stock disponible → envases.
 * La demanda se suma ANTES de redondear a envases (nunca ceil por evento).
 */
export function buildShoppingList(
  demand: Map<string, Decimal>,
  ingredients: Map<string, IngredientData>,
  available: Map<string, Decimal>,
  options: Map<string, FormatOption[]>,
  current: Map<string, CurrentPrice>,
): ShoppingRow[] {
  const rows: ShoppingRow[] = [];
  for (const [ingId, net] of demand) {
    const ing = ingredients.get(ingId);
    if (!ing) continue;
    const w = pctFraction(ing.waste_pct, 'waste_pct');
    const gross = net.div(ONE.minus(w));
    const stock = available.get(ingId) ?? ZERO;
    const need = Decimal.max(ZERO, gross.minus(stock.isNegative() ? ZERO : stock));
    const opts = options.get(ingId) ?? [];
    const cur = current.get(ingId);
    const chosen = opts.find((o) => o.format_id === cur?.format_id) ?? opts[0] ?? null;
    const packs = chosen ? packsFor(need, chosen) : ZERO;
    const alternatives = opts
      .filter((o) => o !== chosen)
      .map((o) => {
        const p = packsFor(need, o);
        return { format: o, packs: p, cost: p.times(o.pack_price) };
      });
    rows.push({
      ingredient_id: ingId,
      name: ing.name,
      base_unit: ing.base_unit,
      waste_pct: dec(ing.waste_pct),
      net,
      gross,
      stock_available: stock,
      need,
      format: chosen,
      packs,
      expected_cost: chosen ? packs.times(chosen.pack_price) : null,
      surplus: chosen ? packs.times(chosen.pack_quantity_base).minus(need) : ZERO,
      alternatives,
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/**
 * Stock disponible para una selección de eventos: existencias físicas menos lo reservado por eventos
 * que NO están en la selección (las reservas propias de la selección cubren su propia demanda).
 */
export function availableForSelection(balances: Map<string, StockBalance>, selectedEventIds: string[]): Map<string, Decimal> {
  const sel = new Set(selectedEventIds);
  const out = new Map<string, Decimal>();
  for (const [ing, b] of balances) {
    let reservedOthers = ZERO;
    for (const [ev, q] of b.reserved_by_event) if (!sel.has(ev)) reservedOthers = reservedOthers.plus(q);
    out.set(ing, b.on_hand.minus(reservedOthers));
  }
  return out;
}

// ─────────────────────────── E. Alertas de precio ───────────────────────────

export interface PriceAlert {
  format_id: string;
  ingredient_id: string;
  previous_unit_price: Decimal;
  current_unit_price: Decimal;
  change_pct: Decimal;
  format_changed: boolean;
  effective_at: string;
}

/** Compara las dos últimas entradas de cada formato por precio por unidad base (bruto). */
export function priceAlerts(formats: FormatData[], prices: PriceEntry[], thresholdPct: Decimal): PriceAlert[] {
  const byFormat = new Map<string, PriceEntry[]>();
  for (const p of prices) {
    const arr = byFormat.get(p.format_id) ?? [];
    arr.push(p);
    byFormat.set(p.format_id, arr);
  }
  const out: PriceAlert[] = [];
  for (const f of formats) {
    const arr = (byFormat.get(f.id) ?? []).sort((a, b) => (a.effective_at === b.effective_at ? a.recorded_at.localeCompare(b.recorded_at) : a.effective_at.localeCompare(b.effective_at)));
    if (arr.length < 2) continue;
    const prev = arr[arr.length - 2]!;
    const cur = arr[arr.length - 1]!;
    const pu = dec(prev.pack_price).div(dec(prev.pack_quantity_base));
    const cu = dec(cur.pack_price).div(dec(cur.pack_quantity_base));
    if (pu.isZero()) continue;
    const change = cu.minus(pu).div(pu).times(100);
    const format_changed = !dec(prev.pack_quantity_base).equals(dec(cur.pack_quantity_base));
    if (change.abs().greaterThanOrEqualTo(thresholdPct) || format_changed) {
      out.push({ format_id: f.id, ingredient_id: f.ingredient_id, previous_unit_price: pu, current_unit_price: cu, change_pct: change, format_changed, effective_at: cur.effective_at });
    }
  }
  return out.sort((a, b) => b.effective_at.localeCompare(a.effective_at));
}
