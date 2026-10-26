import { z } from 'zod';
import { ALLERGENS } from './allergens';
import { COST_CATEGORIES } from './costing';
import { LINE_UNITS } from './units';

/** Esquemas de validación server-side (también usados por el cliente para tipado). */

const canonDecimal = (s: string) => {
  const t = s.trim().replace(',', '.');
  return t.includes('.') ? t.replace(/0+$/, '').replace(/\.$/, '') : t.replace(/^0+(?=\d)/, '');
};
/** Decimal no negativo como string ("12,5" → "12.5"). */
export const decimalStr = (maxDecimals = 6) =>
  z.union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((s) => new RegExp(`^\\d{1,12}([.,]\\d{1,${maxDecimals}})?$`).test(s), { message: 'invalid_decimal' })
    .transform(canonDecimal);
export const positiveDecimal = (maxDecimals = 6) => decimalStr(maxDecimals).refine((s) => Number(s) > 0, { message: 'must_be_positive' });
export const signedDecimal = z.union([z.string(), z.number()]).transform((v) => String(v).trim())
  .refine((s) => /^-?\d{1,12}([.,]\d{1,6})?$/.test(s), { message: 'invalid_decimal' })
  .transform((s) => s.replace(',', '.'));
export const pctStr = decimalStr(4).refine((s) => Number(s) < 100, { message: 'must_be_below_100' });
export const money = decimalStr(4);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date').refine((s) => !Number.isNaN(Date.parse(s + 'T00:00:00Z')), 'invalid_date');
export const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'invalid_time');
const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) => z.union([z.string().trim().max(max), z.null()]).optional().transform((v) => (v === undefined ? undefined : v === '' ? null : v));
const name = (max = 160) => z.string().trim().min(1, 'required').max(max);
const id = z.string().min(1).max(64).regex(/^[\w-]+$/, 'invalid_id');
const optId = z.union([id, z.null(), z.literal('')]).optional().transform((v) => (v === '' ? null : v));
const optEmail = z.union([z.string().trim().email().max(200), z.literal(''), z.null()]).optional().transform((v) => (v === '' ? null : v));
const allergenList = z.array(z.enum(ALLERGENS)).max(14);
/** Claves de idempotencia: solo [A-Za-z0-9_-] (se usan en comparaciones LIKE). */
const idemKey = z.string().regex(/^[\w-]{8,100}$/, 'invalid_idempotency_key');

export const SettingsSchema = z.object({
  locale: z.enum(['es', 'ca']),
  brand_name: name(80),
  brand_tagline: text(120),
  contact_line: text(240),
  default_vat_rate: decimalStr(2).refine((s) => Number(s) <= 100, 'out_of_range'),
  vat_note: text(400),
  default_target_margin_pct: pctStr,
  chef_hourly_rate: money,
  price_alert_threshold_pct: decimalStr(2),
  proposal_validity_days: z.number().int().min(1).max(365),
  proposal_terms: text(4000),
}).partial();

export const SupplierSchema = z.object({
  name: name(),
  contact_name: optText(160),
  email: optEmail,
  phone: optText(40),
  website: optText(300),
  tax_id: optText(40),
  notes: optText(4000),
});

export const IngredientSchema = z.object({
  name: name(),
  category: optText(80),
  base_unit: z.enum(['g', 'ml', 'ud']),
  waste_pct: pctStr,
  allergens: allergenList,
  notes: optText(4000),
  preferred_supplier_id: optId,
  preferred_format_id: optId,
});

export const FormatSchema = z.object({
  ingredient_id: id,
  supplier_id: optId,
  label: name(80),
  supplier_ref: optText(80),
  pack_quantity_base: positiveDecimal(4),
  whole_packs_only: z.boolean().default(true),
  is_active: z.boolean().default(true),
  initial_price: money.optional(),
  effective_at: isoDate.optional(),
});

export const PriceSchema = z.object({
  pack_price: money,
  pack_quantity_base: positiveDecimal(4).optional(),
  effective_at: isoDate,
  note: optText(300),
});

export const RecipeLineSchema = z.object({
  ingredient_id: optId,
  subrecipe_id: optId,
  quantity: positiveDecimal(4),
  unit: z.enum(LINE_UNITS as [string, ...string[]]),
  notes: optText(300),
}).refine((l) => (!!l.ingredient_id) !== (!!l.subrecipe_id), { message: 'line_needs_ingredient_xor_subrecipe' });

export const RecipeSchema = z.object({
  name: name(),
  category: optText(80),
  description_es: optText(4000),
  description_ca: optText(4000),
  instructions_es: optText(20000),
  instructions_ca: optText(20000),
  techniques: optText(1000),
  conservation: optText(1000),
  notes: optText(4000),
  portions: positiveDecimal(3),
  yield_quantity: z.union([positiveDecimal(3), z.null(), z.literal('')]).optional().transform((v) => (v === '' ? null : v)),
  yield_unit: z.union([z.enum(['g', 'ml', 'ud']), z.null(), z.literal('')]).optional().transform((v) => (v === '' ? null : v)),
  preparation_minutes: z.number().int().min(0).max(100000).default(0),
  cooking_minutes: z.number().int().min(0).max(100000).default(0),
  allergens_declared: allergenList.default([]),
  lines: z.array(RecipeLineSchema).max(200),
}).refine((r) => (r.yield_quantity == null) === (r.yield_unit == null), { message: 'yield_quantity_and_unit_together', path: ['yield_unit'] });

export const MenuLineSchema = z.object({
  position: z.number().int().min(1).max(100),
  course_name_es: optText(120),
  course_name_ca: optText(120),
  recipe_id: id,
  servings_per_guest: positiveDecimal(3),
  variant: z.string().trim().max(40).default(''),
});

export const MenuSchema = z.object({
  name: name(),
  kind: z.enum(['tasting', 'courses']).default('tasting'),
  description_es: optText(4000),
  description_ca: optText(4000),
  notes: optText(4000),
  lines: z.array(MenuLineSchema).max(200),
}).refine((m) => new Set(m.lines.map((l) => `${l.position}|${l.variant}`)).size === m.lines.length, { message: 'duplicate_course_variant', path: ['lines'] });

export const ClientSchema = z.object({
  display_name: name(),
  email: optEmail,
  phone: optText(40),
  address_private: optText(500),
  dietary_preferences: optText(2000),
  notes_private: optText(4000),
  legal_basis: z.enum(['precontractual', 'contract', 'consent', 'legitimate_interest']).default('precontractual'),
});

export const GuestGroupSchema = z.object({
  label: name(80),
  guest_count: z.number().int().min(1).max(10000),
  variant: z.string().trim().max(40).default(''),
  dietary_notes_private: optText(1000),
});

export const EventSchema = z.object({
  client_id: id,
  menu_id: optId,
  title: name(160),
  service_type: z.enum(['private_dinner', 'tasting', 'celebration', 'corporate', 'class', 'other']).default('private_dinner'),
  event_date: isoDate,
  event_time: z.union([timeStr, z.literal(''), z.null()]).optional().transform((v) => (v === '' ? null : v)),
  location_private: optText(500),
  guest_count: z.number().int().min(1).max(10000),
  price_per_guest: money,
  additional_revenue: money.default('0'),
  discount: money.default('0'),
  vat_rate: decimalStr(2).refine((s) => Number(s) <= 100, 'out_of_range'),
  target_margin_pct: pctStr,
  purchase_date: z.union([isoDate, z.literal(''), z.null()]).optional().transform((v) => (v === '' ? null : v)),
  production_date: z.union([isoDate, z.literal(''), z.null()]).optional().transform((v) => (v === '' ? null : v)),
  instructions: optText(4000),
  restrictions: optText(4000),
  notes_private: optText(4000),
  guest_groups: z.array(GuestGroupSchema).max(50).optional(),
});

export const EventCostSchema = z.object({
  category: z.enum(COST_CATEGORIES as [string, ...string[]]),
  description: optText(200),
  quantity: decimalStr(4).default('1'),
  unit_amount: money,
  cost_kind: z.enum(['estimated', 'actual']),
});

export const PurchaseLineSchema = z.object({
  ingredient_id: id,
  format_id: optId,
  description: optText(200),
  ordered_packs: positiveDecimal(4),
  pack_quantity_base: positiveDecimal(4),
  pack_price: money,
});

export const PurchaseSchema = z.object({
  supplier_id: optId,
  event_id: optId,
  external_reference: optText(80),
  purchase_date: isoDate,
  status: z.enum(['draft', 'ordered']).default('ordered'),
  notes: optText(2000),
  update_prices: z.boolean().default(true),
  lines: z.array(PurchaseLineSchema).min(1).max(300),
  allow_duplicate_reference: z.boolean().default(false),
});

export const ReceiveSchema = z.object({
  idempotency_key: idemKey,
  received_at: isoDate,
  lines: z.array(z.object({ line_id: id, packs: positiveDecimal(4) })).min(1).max(300),
});

export const StockMovementSchema = z.object({
  ingredient_id: id,
  kind: z.enum(['opening', 'adjustment', 'waste']),
  quantity_base: signedDecimal,
  occurred_at: isoDate,
  notes: optText(300),
  idempotency_key: idemKey,
});

export const EventStockSchema = z.object({
  idempotency_key: idemKey,
  lines: z.array(z.object({ ingredient_id: id, quantity_base: positiveDecimal(4) })).max(500).optional(),
});

export const DocumentExtractionSchema = z.object({
  method: z.enum(['pdf_text', 'ocr_local', 'manual']),
  supplier_id: optId,
  doc_date: z.union([isoDate, z.null()]).optional(),
  doc_reference: optText(80),
  source_type: z.enum(['invoice', 'delivery_note', 'receipt', 'other']).optional(),
  text_excerpt: z.string().max(20000).optional(),
  data: z.unknown(),
});

export const DocumentConfirmSchema = z.object({
  supplier_id: optId,
  doc_date: isoDate,
  doc_reference: optText(80),
  receive_stock: z.boolean().default(false),
  allow_duplicate_reference: z.boolean().default(false),
  lines: z.array(z.object({
    ingredient_id: id,
    format_id: optId,
    new_format_label: optText(80),
    description: optText(200),
    packs: positiveDecimal(4),
    pack_quantity_base: positiveDecimal(4),
    pack_price: money,
  })).min(1).max(300),
});
