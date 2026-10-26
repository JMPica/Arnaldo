/** Los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011, anexo II). */
export const ALLERGENS = [
  'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk',
  'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const ALLERGEN_LABELS: Record<'es' | 'ca', Record<Allergen, string>> = {
  es: {
    gluten: 'Gluten', crustaceans: 'Crustáceos', eggs: 'Huevos', fish: 'Pescado', peanuts: 'Cacahuetes',
    soy: 'Soja', milk: 'Lácteos', nuts: 'Frutos de cáscara', celery: 'Apio', mustard: 'Mostaza',
    sesame: 'Sésamo', sulphites: 'Sulfitos', lupin: 'Altramuces', molluscs: 'Moluscos',
  },
  ca: {
    gluten: 'Gluten', crustaceans: 'Crustacis', eggs: 'Ous', fish: 'Peix', peanuts: 'Cacauets',
    soy: 'Soja', milk: 'Lactis', nuts: 'Fruits de closca', celery: 'Api', mustard: 'Mostassa',
    sesame: 'Sèsam', sulphites: 'Sulfits', lupin: 'Tramussos', molluscs: 'Mol·luscs',
  },
};

export function isAllergen(x: unknown): x is Allergen {
  return typeof x === 'string' && (ALLERGENS as readonly string[]).includes(x);
}

export function normalizeAllergens(list: unknown): Allergen[] {
  if (!Array.isArray(list)) return [];
  return ALLERGENS.filter((a) => list.includes(a));
}

/**
 * Hash determinista (FNV-1a 32 bits) para detectar si una revisión de alérgenos ha quedado obsoleta.
 * No es un control criptográfico: solo compara el estado revisado con el actual.
 */
export function stableHash(value: unknown): string {
  const s = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Mapea texto libre de v1 ("Gluten, Huevos, Lácteos") a códigos. Solo coincidencias exactas de etiqueta
 * (sin inferencias por nombre de ingrediente). Lo no reconocido se devuelve aparte para revisión humana.
 */
export function parseAllergenText(text: string | undefined | null): { codes: Allergen[]; unknown: string[] } {
  const codes = new Set<Allergen>();
  const unknown: string[] = [];
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const lookup = new Map<string, Allergen>();
  for (const lang of ['es', 'ca'] as const) {
    for (const a of ALLERGENS) lookup.set(norm(ALLERGEN_LABELS[lang][a]), a);
  }
  const extra: Record<string, Allergen> = { leche: 'milk', lactosa: 'milk', huevo: 'eggs', 'frutos secos': 'nuts', soja: 'soy', sulfitos: 'sulphites', marisco: 'crustaceans' };
  for (const [k, v] of Object.entries(extra)) lookup.set(k, v);
  for (const part of String(text ?? '').split(/[,;/]+/)) {
    const p = norm(part);
    if (!p) continue;
    const hit = lookup.get(p);
    if (hit) codes.add(hit);
    else unknown.push(part.trim());
  }
  return { codes: ALLERGENS.filter((a) => codes.has(a)), unknown };
}
