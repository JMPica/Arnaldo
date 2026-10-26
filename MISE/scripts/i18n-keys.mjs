// Extrae todas las cadenas t('…') / translate(lang, '…') del frontend (para el diccionario CA y su test).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function collectKeys(dir) {
  const keys = new Set();
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|mjs)$/.test(f) && !p.endsWith('ca.ts')) {
        const src = readFileSync(p, 'utf8');
        for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
      }
    }
  };
  walk(dir);
  return [...keys].sort();
}

if (process.argv[1] && process.argv[1].endsWith('i18n-keys.mjs')) {
  const keys = collectKeys(new URL('../src/web', import.meta.url).pathname);
  const { CA } = await import('../src/web/lib/ca.ts').catch(() => ({ CA: {} }));
  const missing = keys.filter((k) => !(k in CA));
  if (process.argv.includes('--missing')) console.log(JSON.stringify(missing, null, 0));
  else console.log(`${keys.length} claves, ${missing.length} sin traducir`);
}
