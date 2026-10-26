import { describe, expect, it } from 'vitest';
// @ts-expect-error módulo JS de scripts
import { collectKeys } from '../../scripts/i18n-keys.mjs';
import { CA } from '../../src/web/lib/ca';
import { roundHalfUp, translate } from '../../src/web/lib/i18n';

describe('E2E-06 (parte estática) i18n ES/CA completo', () => {
  const keys: string[] = collectKeys(new URL('../../src/web', import.meta.url).pathname);
  it('todas las cadenas de la interfaz tienen traducción catalana', () => {
    const missing = keys.filter((k) => !(k in CA));
    expect(missing).toEqual([]);
    expect(keys.length).toBeGreaterThan(700);
  });
  it('las traducciones conservan los marcadores {var}', () => {
    for (const k of keys) {
      const vars = (k.match(/\{\w+\}/g) ?? []).sort();
      expect((CA[k]!.match(/\{\w+\}/g) ?? []).sort(), k).toEqual(vars);
    }
  });
  it('interpolación y redondeo HALF_UP de presentación', () => {
    expect(translate('ca', '{n} comensales', { n: 8 })).toBe('8 comensals');
    expect(translate('es', '{n} comensales', { n: 8 })).toBe('8 comensales');
    expect(roundHalfUp('2.345', 2)).toBe(2.35);
    expect(roundHalfUp('-2.345', 2)).toBe(-2.35);
    expect(roundHalfUp('0.125', 2)).toBe(0.13);
    expect(roundHalfUp('89.744', 1)).toBe(89.7);
  });
});
