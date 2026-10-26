import { Hono } from 'hono';
import { serializeDecimals } from '../../shared/costing';
import { Decimal, ZERO, dec } from '../../shared/decimal';
import { SettingsSchema } from '../../shared/schemas';
import { priceAlerts } from '../../shared/shopping';
import { getDb, nowIso, todayMadrid, type Db } from '../db';
import type { AppEnv } from '../env';
import { body } from '../http';
import { loadCatalog, type Catalog } from '../services/catalog';
import { computeFinancials, loadEventBundles, menuReviewState } from '../services/events';

export const insights = new Hono<AppEnv>();

insights.get('/me', (c) => {
  const u = c.get('user');
  return c.json({ email: u.email, role: u.role, auth_mode: c.env.AUTH_MODE === 'access' ? 'cloudflare_access' : 'dev_loopback', app_env: c.env.APP_ENV ?? 'local' });
});

insights.get('/settings', async (c) => {
  const db = getDb(c);
  return c.json(await db.first('SELECT * FROM settings WHERE owner_id = ?', db.owner));
});
insights.patch('/settings', async (c) => {
  const db = getDb(c);
  const d = await body(c, SettingsSchema);
  // Claves limitadas por el esquema zod (las desconocidas se descartan); valores siempre parametrizados.
  const entries = Object.entries(d).filter(([, v]) => v !== undefined);
  if (entries.length) {
    await db.batch([
      db.prepare(`UPDATE settings SET ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? WHERE owner_id = ?`, ...entries.map(([, v]) => v as string | number), nowIso(), db.owner),
      db.audit('update', 'settings', null, { fields: entries.map(([k]) => k) }),
    ]);
  }
  return c.json(await db.first('SELECT * FROM settings WHERE owner_id = ?', db.owner));
});

export interface ProfitRow {
  id: string; title: string; client_name: string; event_date: string; status: string; guest_count: number;
  revenue_net: string; food_cost: string; total_cost: string; profit: string; margin_pct: string | null;
  actual_total_cost: string | null; actual_profit: string | null; actual_margin_pct: string | null; source: 'snapshot' | 'live'; warnings: string[];
}

/**
 * Cifras por evento: para presupuestados/confirmados/realizados se usa el snapshot más reciente (inmutable);
 * los borradores se calculan en vivo con precios actuales. Número de consultas acotado.
 */
export async function profitabilityRows(db: Db, cat: Catalog, from: string | null, to: string | null): Promise<ProfitRow[]> {
  const params: string[] = [db.owner];
  let where = "e.owner_id = ? AND e.archived_at IS NULL AND e.status <> 'cancelled'";
  if (from) { where += ' AND e.event_date >= ?'; params.push(from); }
  if (to) { where += ' AND e.event_date <= ?'; params.push(to); }
  const evs = await db.all<{ id: string; title: string; client_name: string; event_date: string; status: string; guest_count: number }>(
    `SELECT e.id, e.title, c.display_name AS client_name, e.event_date, e.status, e.guest_count FROM events e JOIN clients c ON c.id = e.client_id WHERE ${where} ORDER BY e.event_date`, ...params);
  const snaps = await db.all<Record<string, string | null>>(`SELECT s.event_id, s.snapshot_kind,
      json_extract(s.snapshot_json, '$.financials.revenue_net') AS revenue_net, json_extract(s.snapshot_json, '$.financials.food_cost') AS food_cost,
      json_extract(s.snapshot_json, '$.financials.total_cost') AS total_cost, json_extract(s.snapshot_json, '$.financials.profit') AS profit,
      json_extract(s.snapshot_json, '$.financials.margin_pct') AS margin_pct,
      json_extract(s.snapshot_json, '$.closing.actual_total_cost') AS actual_total_cost, json_extract(s.snapshot_json, '$.closing.actual_profit') AS actual_profit,
      json_extract(s.snapshot_json, '$.closing.actual_margin_pct') AS actual_margin_pct
    FROM event_snapshots s WHERE s.owner_id = ? AND s.version = (SELECT MAX(version) FROM event_snapshots x WHERE x.event_id = s.event_id AND x.owner_id = s.owner_id)`, db.owner);
  const snapBy = new Map(snaps.map((s) => [s.event_id!, s]));
  const liveIds = evs.filter((e) => !snapBy.has(e.id)).map((e) => e.id);
  const bundles = await loadEventBundles(db, liveIds);
  return evs.map((e) => {
    const s = snapBy.get(e.id);
    if (s) {
      return { ...e, revenue_net: s.revenue_net ?? '0', food_cost: s.food_cost ?? '0', total_cost: s.total_cost ?? '0', profit: s.profit ?? '0', margin_pct: s.margin_pct ?? null,
        actual_total_cost: s.actual_total_cost ?? null, actual_profit: s.actual_profit ?? null, actual_margin_pct: s.actual_margin_pct ?? null, source: 'snapshot' as const, warnings: [] };
    }
    const b = bundles.get(e.id)!;
    try {
      const f = computeFinancials(b, cat);
      return { ...e, revenue_net: f.revenue_net.toFixed(), food_cost: f.food_cost.toFixed(), total_cost: f.total_cost.toFixed(), profit: f.profit.toFixed(), margin_pct: f.margin_pct?.toFixed() ?? null,
        actual_total_cost: null, actual_profit: null, actual_margin_pct: null, source: 'live' as const, warnings: f.warnings };
    } catch {
      return { ...e, revenue_net: '0', food_cost: '0', total_cost: '0', profit: '0', margin_pct: null, actual_total_cost: null, actual_profit: null, actual_margin_pct: null, source: 'live' as const, warnings: ['calculation_error'] };
    }
  });
}

function aggregate(rows: ProfitRow[]) {
  const revenue = rows.reduce((a, r) => a.plus(dec(r.revenue_net)), ZERO);
  const cost = rows.reduce((a, r) => a.plus(dec(r.total_cost)), ZERO);
  const food = rows.reduce((a, r) => a.plus(dec(r.food_cost)), ZERO);
  const profit = revenue.minus(cost);
  return { events: rows.length, revenue, cost, food, profit, margin_pct: revenue.greaterThan(0) ? profit.div(revenue).times(100) : null, food_cost_pct: revenue.greaterThan(0) ? food.div(revenue).times(100) : null };
}

insights.get('/dashboard', async (c) => {
  const db = getDb(c);
  const cat = await loadCatalog(db);
  const today = todayMadrid();
  const rows = await profitabilityRows(db, cat, null, null);
  const upcoming = rows.filter((r) => r.event_date >= today && r.status !== 'completed').slice(0, 8);
  const confirmedUpcoming = rows.filter((r) => r.event_date >= today && r.status === 'confirmed');
  const year = today.slice(0, 4);
  const yearRows = rows.filter((r) => r.event_date.startsWith(year) && ['confirmed', 'completed'].includes(r.status));
  const completed = rows.filter((r) => r.status === 'completed' && r.actual_profit !== null);
  const actualProfit = completed.reduce((a, r) => a.plus(dec(r.actual_profit!)), ZERO);
  const actualRevenue = completed.reduce((a, r) => a.plus(dec(r.revenue_net)), ZERO);
  const months = new Map<string, ProfitRow[]>();
  for (const r of rows.filter((x) => ['confirmed', 'completed', 'quoted'].includes(x.status))) months.set(r.event_date.slice(0, 7), [...(months.get(r.event_date.slice(0, 7)) ?? []), r]);
  const settings = await db.first<{ price_alert_threshold_pct: string; brand_name: string }>('SELECT price_alert_threshold_pct, brand_name FROM settings WHERE owner_id = ?', db.owner);
  const alerts = priceAlerts(cat.formats, cat.prices, dec(settings?.price_alert_threshold_pct ?? '5')).slice(0, 6).map((a) => serializeDecimals({ ...a, ingredient_name: cat.ingredients.get(a.ingredient_id)?.name }));
  const pendingPurchases = await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM purchases WHERE owner_id = ? AND status IN ('ordered','partial')", db.owner);
  const pendingDocs = await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM documents WHERE owner_id = ? AND review_status IN ('pending','extracted')", db.owner);
  const bundles = await loadEventBundles(db, confirmedUpcoming.map((r) => r.id));
  const attention = [...bundles.values()].flatMap((b) => {
    const out: { event_id: string; title: string; issue: string }[] = [];
    if (menuReviewState(b, cat) !== 'reviewed') out.push({ event_id: String(b.event.id), title: String(b.event.title), issue: 'menu_allergen_review' });
    return out;
  });
  const missingPrices = [...cat.ingredients.values()].filter((i) => !i.archived_at && !cat.current.has(i.id)).length;
  return c.json(serializeDecimals({
    brand_name: settings?.brand_name,
    today,
    upcoming,
    forecast: aggregate(confirmedUpcoming),
    year: { year, ...aggregate(yearRows) },
    actual: { events: completed.length, revenue: actualRevenue, profit: actualProfit, margin_pct: actualRevenue.greaterThan(0) ? actualProfit.div(actualRevenue).times(100) : null },
    by_month: [...months.entries()].sort().slice(-12).map(([month, rs]) => ({ month, ...aggregate(rs) })),
    counts: Object.fromEntries(['draft', 'quoted', 'confirmed', 'completed'].map((s) => [s, rows.filter((r) => r.status === s).length])),
    price_alerts: alerts,
    pending_purchases: pendingPurchases?.n ?? 0,
    pending_documents: pendingDocs?.n ?? 0,
    attention,
    missing_prices: missingPrices,
  }));
});

insights.get('/reports/profitability', async (c) => {
  const db = getDb(c);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(c.req.query('from') ?? '') ? c.req.query('from')! : null;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(c.req.query('to') ?? '') ? c.req.query('to')! : null;
  const cat = await loadCatalog(db);
  const rows = await profitabilityRows(db, cat, from, to);
  const closed = rows.filter((r) => r.actual_profit !== null);
  const variance = closed.reduce((a, r) => a.plus(dec(r.actual_profit!).minus(dec(r.profit))), ZERO);
  return c.json(serializeDecimals({ rows, totals: aggregate(rows.filter((r) => ['confirmed', 'completed'].includes(r.status))), closed_variance_profit: variance }));
});

insights.get('/search', async (c) => {
  const db = getDb(c);
  const q = (c.req.query('q') ?? '').trim().slice(0, 80);
  if (q.length < 2) return c.json([]);
  const like = `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
  // D1 limita los términos de un SELECT compuesto: dos consultas en un mismo batch.
  const [a, b] = await db.batch([
    db.prepare(`SELECT 'ingredient' AS type, id, name AS label FROM ingredients WHERE owner_id = ?1 AND name LIKE ?2 ESCAPE '\\'
      UNION ALL SELECT 'recipe', id, name FROM recipes WHERE owner_id = ?1 AND name LIKE ?2 ESCAPE '\\'
      UNION ALL SELECT 'menu', id, name FROM menus WHERE owner_id = ?1 AND name LIKE ?2 ESCAPE '\\' LIMIT 15`, db.owner, like),
    db.prepare(`SELECT 'client' AS type, id, display_name AS label FROM clients WHERE owner_id = ?1 AND display_name LIKE ?2 ESCAPE '\\'
      UNION ALL SELECT 'event', id, title || ' · ' || event_date FROM events WHERE owner_id = ?1 AND title LIKE ?2 ESCAPE '\\'
      UNION ALL SELECT 'supplier', id, name FROM suppliers WHERE owner_id = ?1 AND name LIKE ?2 ESCAPE '\\' LIMIT 15`, db.owner, like),
  ]);
  const rows = [...a!.results, ...b!.results];
  return c.json(rows);
});

insights.get('/audit', async (c) => {
  const db = getDb(c);
  return c.json(await db.all('SELECT action, entity_type, entity_id, metadata_json, created_at FROM audit_log WHERE owner_id = ? ORDER BY created_at DESC LIMIT 200', db.owner));
});

/** Calendario iCal privado (eventos, compras y producción). Se descarga autenticado. */
insights.get('/calendar.ics', async (c) => {
  const db = getDb(c);
  const evs = await db.all<{ id: string; title: string; event_date: string; event_time: string | null; status: string; guest_count: number; purchase_date: string | null; production_date: string | null }>(
    "SELECT id, title, event_date, event_time, status, guest_count, purchase_date, production_date FROM events WHERE owner_id = ? AND archived_at IS NULL AND status <> 'cancelled'", db.owner);
  const esc = (s: string) => s.replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MISE//Private Chef OS//ES', 'CALSCALE:GREGORIAN', 'X-WR-TIMEZONE:Europe/Madrid'];
  const add = (uid: string, date: string, time: string | null, summary: string) => {
    lines.push('BEGIN:VEVENT', `UID:${uid}@mise`, `DTSTAMP:${stamp}`);
    if (time) lines.push(`DTSTART;TZID=Europe/Madrid:${date.replace(/-/g, '')}T${time.replace(':', '')}00`);
    else lines.push(`DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`);
    lines.push(`SUMMARY:${esc(summary)}`, 'END:VEVENT');
  };
  for (const e of evs) {
    add(e.id, e.event_date, e.event_time, `${e.title} (${e.guest_count} pax)`);
    if (e.purchase_date) add(`${e.id}-buy`, e.purchase_date, null, `Compras · ${e.title}`);
    if (e.production_date) add(`${e.id}-prod`, e.production_date, null, `Producción · ${e.title}`);
  }
  lines.push('END:VCALENDAR');
  return new Response(lines.join('\r\n') + '\r\n', { headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'attachment; filename="mise.ics"', 'cache-control': 'no-store' } });
});

export { Decimal };
