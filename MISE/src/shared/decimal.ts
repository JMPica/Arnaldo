import DecimalBase from 'decimal.js';

/**
 * Decimal configurado para MISE: 40 dígitos significativos, sin notación exponencial al serializar.
 * Política de redondeo: solo se redondea al presentar o al cerrar importes finales (HALF_UP, 2 decimales).
 */
export const Decimal = DecimalBase.clone({ precision: 40, rounding: DecimalBase.ROUND_HALF_UP, toExpNeg: -30, toExpPos: 40 });
export type Decimal = InstanceType<typeof Decimal>;

export const CALCULATION_VERSION = 'mise-calc-2.0.0';

export class DomainError extends Error {
  constructor(public code: string, message?: string, public details?: Record<string, unknown>) {
    super(message ?? code);
    this.name = 'DomainError';
  }
}

const DECIMAL_RE = /^-?\d{1,15}(\.\d{1,12})?$/;

/** Acepta "12,5", "12.5", 12.5 y devuelve Decimal; lanza DomainError si no es un número finito válido. */
export function dec(value: string | number | Decimal | null | undefined, field = 'value'): Decimal {
  if (value instanceof Decimal) return value;
  if (value === null || value === undefined || value === '') throw new DomainError('invalid_number', `${field} vacío`, { field });
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new DomainError('invalid_number', `${field} no finito`, { field });
    return new Decimal(String(value));
  }
  const s = String(value).trim().replace(',', '.');
  if (!DECIMAL_RE.test(s)) throw new DomainError('invalid_number', `${field} no es un decimal válido`, { field });
  return new Decimal(s);
}

export function isDecimalString(s: unknown): boolean {
  return typeof s === 'string' && DECIMAL_RE.test(s.trim().replace(',', '.'));
}

/** Serializa sin ceros sobrantes ni notación exponencial ("12.5", "0.003"). */
export function canon(d: Decimal): string {
  return d.toFixed();
}

export function money2(d: Decimal): Decimal {
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Importe final redondeado a céntimos como string "123.45". */
export function moneyStr(d: Decimal): string {
  return money2(d).toFixed(2);
}

export const ZERO = new Decimal(0);
export const ONE = new Decimal(1);
export const HUNDRED = new Decimal(100);

export function sum(values: Decimal[]): Decimal {
  return values.reduce((a, b) => a.plus(b), ZERO);
}

/** Porcentaje en [0,100) como fracción; lanza si fuera de rango. */
export function pctFraction(pct: Decimal | string, field: string, opts: { allowHundred?: boolean } = {}): Decimal {
  const p = dec(pct, field);
  if (p.isNegative() || (opts.allowHundred ? p.greaterThan(100) : p.greaterThanOrEqualTo(100))) {
    throw new DomainError('out_of_range', `${field} fuera de rango`, { field });
  }
  return p.div(HUNDRED);
}
