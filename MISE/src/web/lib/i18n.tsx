import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { CA } from './ca';

/**
 * i18n: las cadenas se escriben en castellano en el código (t('Texto')) y el diccionario CA las traduce.
 * Un test unitario extrae todas las llamadas t('…') y exige su traducción catalana (sin cadenas mezcladas).
 */
export type Lang = 'es' | 'ca';
type Vars = Record<string, string | number>;

function interpolate(s: string, vars?: Vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export function translate(lang: Lang, key: string, vars?: Vars) {
  const s = lang === 'ca' ? (CA[key] ?? key) : key;
  return interpolate(s, vars);
}

interface I18n {
  lang: Lang;
  t: (key: string, vars?: Vars) => string;
  money: (v: string | number | null | undefined, opts?: { decimals?: number }) => string;
  num: (v: string | number | null | undefined, decimals?: number) => string;
  pct: (v: string | number | null | undefined) => string;
  date: (iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions) => string;
}

function makeI18n(lang: Lang): I18n {
  {
    const locale = lang === 'ca' ? 'ca-ES' : 'es-ES';
    const nf = (d: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: d });
    const mf = (d: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d });
    const toNum = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? null : Number(v));
    return {
      lang,
      t: (k, v) => translate(lang, k, v),
      money: (v, o) => {
        const n = toNum(v);
        if (n === null || !Number.isFinite(n)) return '—';
        const d = o?.decimals ?? 2;
        // redondeo HALF_UP sobre el string decimal exacto antes de formatear
        return mf(d).format(roundHalfUp(String(v), d));
      },
      num: (v, d = 2) => {
        const n = toNum(v);
        return n === null || !Number.isFinite(n) ? '—' : nf(d).format(roundHalfUp(String(v), d));
      },
      pct: (v) => {
        const n = toNum(v);
        return n === null || !Number.isFinite(n) ? '—' : `${nf(1).format(roundHalfUp(String(v), 1))} %`;
      },
      date: (iso, opts) => {
        if (!iso) return '—';
        const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
        if (!y || !m || !d) return iso;
        return new Intl.DateTimeFormat(locale, opts ?? { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
      },
    };
  }
}

const Ctx = createContext<I18n>(makeI18n('es'));

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo(() => makeI18n(lang), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}

/** Redondeo HALF_UP de un decimal en texto, sin pasar por binario hasta el final. */
export function roundHalfUp(s: string, decimals: number): number {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s.trim());
  if (!m) return Number(s);
  const [, sign, int, frac = ''] = m;
  if (frac.length <= decimals) return Number(s);
  const keep = frac.slice(0, decimals);
  const next = Number(frac[decimals]);
  let digits = BigInt(int + keep);
  if (next >= 5) digits += 1n;
  const str = digits.toString().padStart(decimals + 1, '0');
  const res = decimals ? `${str.slice(0, -decimals)}.${str.slice(-decimals)}` : str;
  return Number(sign + res);
}
