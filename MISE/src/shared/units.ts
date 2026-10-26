import { Decimal, DomainError, dec } from './decimal';

export type BaseUnit = 'g' | 'ml' | 'ud';
export type LineUnit = 'g' | 'kg' | 'ml' | 'l' | 'ud' | 'portion';
export const BASE_UNITS: BaseUnit[] = ['g', 'ml', 'ud'];
export const LINE_UNITS: LineUnit[] = ['g', 'kg', 'ml', 'l', 'ud', 'portion'];

const DIMENSION: Record<Exclude<LineUnit, 'portion'>, { base: BaseUnit; factor: number }> = {
  g: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  ud: { base: 'ud', factor: 1 },
};

export function baseOf(unit: LineUnit): BaseUnit | null {
  return unit === 'portion' ? null : DIMENSION[unit].base;
}

/**
 * Convierte una cantidad a la unidad base indicada. Nunca convierte masa↔volumen
 * (no hay densidades configuradas): lanza `incompatible_units`.
 */
export function toBase(qty: Decimal | string, from: LineUnit, target: BaseUnit): Decimal {
  if (from === 'portion') throw new DomainError('incompatible_units', `portion → ${target}`, { from, target });
  const d = DIMENSION[from];
  if (d.base !== target) throw new DomainError('incompatible_units', `${from} → ${target}`, { from, target });
  return dec(qty).times(d.factor);
}
