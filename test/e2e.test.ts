// Prueba de extremo a extremo: arranca el Worker real (workerd + D1 local vía
// `wrangler dev`) contra un servidor que simula la API pública de Kraken, y
// comprueba con peticiones HTTP reales que los controles del panel cambian el
// estado del motor, que todo persiste tras reiniciar y que las órdenes
// simuladas quedan registradas una sola vez.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { webcrypto } from "node:crypto";

const ROOT = join(import.meta.dirname, "..");
const PASSWORD = "contraseña-de-prueba-larga";
const TOKEN = "token-de-investigacion-de-prueba-123456";
const MOCK_PORT = 18787;
const WORKER_PORT = 18788;
const BASE = `http://127.0.0.1:${WORKER_PORT}`;

// --- Kraken simulado ---
let price = 80000;
let breakoutAt = 0; // ts de la hora que rompe al alza
function hourly(nowSec: number) {
  const last = Math.floor(nowSec / 3600) * 3600 - 3600; // última hora cerrada
  const out = [];
  for (let ts = last - 24 * 3600 * 400; ts <= last; ts += 3600) {
    const wiggle = Math.sin(ts / 7200) * 50;
    let c = 80000 + wiggle;
    if (breakoutAt && ts >= breakoutAt) c = 82500 + wiggle;
    out.push({ time: ts * 1000, open: String(c - 10), high: String(c + 30), low: String(c - 30), close: String(c), volume: "1" });
  }
  return out;
}
function aggregated(nowSec: number, span: number) {
  const h = hourly(nowSec);
  const m = new Map<number, any>();
  for (const c of h) {
    const ts = Math.floor(c.time / 1000 / span) * span;
    const cur = m.get(ts);
    if (!cur) m.set(ts, { ...c, time: ts * 1000 });
    else {
      cur.high = String(Math.max(+cur.high, +c.high));
      cur.low = String(Math.min(+cur.low, +c.low));
      cur.close = c.close;
    }
  }
  return [...m.values()];
}
function startMock(): Promise<Server> {
  const srv = createServer((req, res) => {
    const u = new URL(req.url!, "http://x");
    const now = Math.floor(Date.now() / 1000);
    let body: any = { error: "no" };
    if (u.pathname.startsWith("/derivatives/api/v3/tickers/")) {
      body = { result: "success", serverTime: new Date().toISOString(), ticker: { symbol: "PF_XBTUSD", last: price, markPrice: price, indexPrice: price, bid: price - 1, ask: price + 1, relativeFundingRate: 0.000002, suspended: false } };
    } else if (u.pathname.startsWith("/api/charts/v1/trade/")) {
      const tf = u.pathname.split("/").pop();
      const from = Number(u.searchParams.get("from"));
      const to = Number(u.searchParams.get("to"));
      const span = tf === "1h" ? 3600 : tf === "4h" ? 14400 : 86400;
      const all = span === 3600 ? hourly(now) : aggregated(now, span);
      // incluye la vela en curso, como la API real (el cliente la filtra)
      all.push({ time: (Math.floor(now / span) * span) * 1000, open: String(price), high: String(price), low: String(price), close: String(price), volume: "1" });
      body = { candles: all.filter((c) => c.time / 1000 >= from && c.time / 1000 <= to).slice(-2000) };
    } else if (u.pathname === "/0/public/Ticker") {
      body = { error: [], result: { EURUSD: { c: ["1.1500", "1"] } } };
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  });
  return new Promise((r) => srv.listen(MOCK_PORT, "127.0.0.1", () => r(srv)));
}

// --- Worker ---
let worker: ChildProcess | null = null;
let mock: Server;
const persist = mkdtempSync(join(tmpdir(), "apex-e2e-"));

async function hash(pw: string) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await webcrypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 20000 }, key, 256));
  return `pbkdf2:20000:${Buffer.from(salt).toString("base64")}:${Buffer.from(bits).toString("base64")}`;
}

async function startWorker() {
  worker = spawn(
    join(ROOT, "node_modules", ".bin", "wrangler"),
    ["dev", "--local", "--port", String(WORKER_PORT), "--ip", "127.0.0.1", "--persist-to", persist, "--test-scheduled", "--env-file", join(persist, ".dev.vars"), "--show-interactive-dev-session=false"],
    { cwd: ROOT, env: { ...process.env, WRANGLER_SEND_METRICS: "false", NO_COLOR: "1" }, stdio: ["ignore", "pipe", "pipe"], detached: true },
  );
  let log = "";
  worker.stdout!.on("data", (d) => (log += d));
  worker.stderr!.on("data", (d) => (log += d));
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${BASE}/api/auth-info`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`el Worker no arrancó:\n${log}`);
}
async function stopWorker() {
  if (!worker) return;
  const w = worker;
  worker = null;
  // mata todo el grupo de procesos (wrangler + workerd)
  const killGroup = (sig: NodeJS.Signals) => { try { process.kill(-w.pid!, sig); } catch {} };
  await new Promise<void>((r) => {
    w.once("exit", () => r());
    killGroup("SIGTERM");
    setTimeout(() => { killGroup("SIGKILL"); r(); }, 5000);
  });
  await new Promise((r) => setTimeout(r, 300));
}

let cookie = "";
async function call(path: string, opts: { method?: string; body?: unknown; auth?: boolean; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-apex": "1", origin: BASE, ...(opts.headers ?? {}) };
  if (opts.auth !== false && cookie) headers.cookie = cookie;
  const r = await fetch(`${BASE}${path}`, { method: opts.method ?? "GET", headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, headers: r.headers, text };
}
const tick = () => fetch(`${BASE}/__scheduled?cron=*%2F5+*+*+*+*`);

beforeAll(async () => {
  mock = await startMock();
  writeFileSync(
    join(persist, ".dev.vars"),
    `OWNER_PASSWORD_HASH='${await hash(PASSWORD)}'\nRESEARCH_TOKEN='${TOKEN}'\nKRAKEN_BASE='http://127.0.0.1:${MOCK_PORT}'\nKRAKEN_SPOT_BASE='http://127.0.0.1:${MOCK_PORT}'\n`,
  );
  execFileSync("npx", ["wrangler", "d1", "migrations", "apply", "apex", "--local", "--persist-to", persist], { cwd: ROOT, stdio: "pipe", env: { ...process.env, CI: "1" } });
  await startWorker();
}, 120000);

afterAll(async () => {
  await stopWorker();
  mock?.close();
  rmSync(persist, { recursive: true, force: true });
});

describe("APEX de extremo a extremo", () => {
  it("protege la API y sirve el panel", async () => {
    expect((await call("/api/status", { auth: false })).status).toBe(401);
    expect((await call("/api/control", { method: "POST", body: { action: "start" }, auth: false })).status).toBe(401);
    const page = await fetch(`${BASE}/`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("APEX");
    expect(page.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect((await call("/api/research", { method: "POST", body: { candidates: [] }, auth: false })).status).toBe(401);
  });

  it("rechaza contraseñas incorrectas y peticiones de otro origen", async () => {
    expect((await call("/api/login", { method: "POST", body: { password: "mala" }, auth: false })).status).toBe(401);
    expect((await call("/api/login", { method: "POST", body: { password: PASSWORD }, auth: false, headers: { origin: "https://evil.example" } })).status).toBe(403);
  });

  it("inicia sesión con la contraseña correcta", async () => {
    const r = await call("/api/login", { method: "POST", body: { password: PASSWORD }, auth: false });
    expect(r.status).toBe(200);
    const sc = r.headers.get("set-cookie")!;
    expect(sc).toContain("HttpOnly");
    expect(sc).toContain("SameSite=Strict");
    cookie = sc.split(";")[0];
    expect((await call("/api/auth-info")).json.authenticated).toBe(true);
  });

  it("el ciclo del motor registra latido, cuenta y datos de mercado", async () => {
    expect((await tick()).status).toBe(200);
    const s = (await call("/api/status")).json;
    expect(s.engine.healthy).toBe(true);
    expect(s.engine.ticks).toBe(1);
    expect(s.market.price).toBe(80000);
    expect(s.account.initialCapital).toBeCloseTo(200 * 1.15, 6);
    expect(s.account.equity).toBeCloseTo(230, 6);
    expect(s.controls.running).toBe(false);
    expect(s.strategy.approved).toBe(true); // estrategia aprobada por la investigación incluida en el despliegue
    expect((await call("/api/health", { auth: false })).json.ok).toBe(true);
  });

  it("encender, pausar, reanudar y apagar producen cambios verificables y auditados", async () => {
    let r = await call("/api/control", { method: "POST", body: { action: "start" } });
    expect(r.json.controls.running).toBe(true);
    r = await call("/api/control", { method: "POST", body: { action: "pause" } });
    expect(r.json.controls.paused).toBe(true);
    expect((await call("/api/status")).json.controls.paused).toBe(true);
    r = await call("/api/control", { method: "POST", body: { action: "resume" } });
    expect(r.json.controls.paused).toBe(false);
    r = await call("/api/control", { method: "POST", body: { action: "stop" } });
    expect(r.json.controls.running).toBe(false);
    const ev = (await call("/api/events")).json.map((e: any) => e.type);
    for (const t of ["control_start", "control_pause", "control_resume", "control_stop", "login"]) expect(ev).toContain(t);
    // el panel no puede activar el dinero real
    expect((await call("/api/status")).json.controls.liveApproved).toBe(false);
  });

  it("no permite cambiar límites por encima de los topes", async () => {
    const r = await call("/api/limits", { method: "POST", body: { maxLeverage: 5 } });
    expect(r.status).toBe(400);
  });

  it("el ciclo de aprendizaje programa una estrategia candidata aprobada y el motor la activa", async () => {
    const gateInput = { oosSharpe: 1.2, oosPsr: 0.99, positiveFolds: 0.8, probDD20: 0, oosTrades: 60, neighborPositive: 1, oosMaxDD: 0.08, stressSharpe: 0.9 };
    const cand = { family: "donchian", config: { id: "x", family: "donchian", timeframe: "1h", params: { entry: 5, exit: 3, allowShort: 0, stopAtr: 2, trail: 0 } }, oosSharpe: 5, oosCagr: 0.1, oosMaxDD: 0.08, oosTrades: 60, gateInput };
    const bad = { ...cand, family: "rsi_mr", config: { id: "y", family: "rsi_mr", timeframe: "4h", params: { rsiLen: 2, oversold: 10, trend: 100, exitMa: 5, maxBars: 12, stopAtr: 2, allowShort: 0 } }, oosSharpe: -1, gateInput: { ...gateInput, oosSharpe: -1 } };
    const r = await call("/api/research", { method: "POST", auth: false, headers: { authorization: `Bearer ${TOKEN}` }, body: { generatedAt: "t", dataFrom: "a", dataTo: "b", configsTested: 2, candidates: [cand, bad] } });
    expect(r.status).toBe(200);
    expect(r.json.promoted).toContain("donchian:1h");
    await call("/api/control", { method: "POST", body: { action: "start" } });
    breakoutAt = Math.floor(Date.now() / 1000 / 3600) * 3600 - 3600; // la última hora cerrada rompe el canal
    price = 82500;
    await call("/api/tick", { method: "POST" });
    const s = (await call("/api/status")).json;
    expect(s.strategy.config.family).toBe("donchian");
    expect(s.strategy.config.timeframe).toBe("1h");
    const strategies = (await call("/api/strategies")).json.strategies;
    expect(strategies.find((x: any) => x.family === "rsi_mr").status).toBe("rejected");
  });

  it("abre una operación simulada respetando 2x y 1 % y sin duplicados", async () => {
    // Fuerza el reproceso de la última hora (el motor la procesó antes de activar la estrategia)
    let s = (await call("/api/status")).json;
    if (!s.position) {
      // espera a la siguiente hora no es viable en un test: se reinicia la última hora procesada
      await stopWorker();
      execFileSync("npx", ["wrangler", "d1", "execute", "apex", "--local", "--persist-to", persist, "--command", "UPDATE kv SET value = json_set(value, '$.lastHourTs', json_extract(value, '$.lastHourTs') - 3600) WHERE key = 'account'"], { cwd: ROOT, stdio: "pipe" });
      await startWorker();
      await tick();
      s = (await call("/api/status")).json;
    }
    expect(s.position).not.toBeNull();
    expect(s.position.side).toBe("long");
    expect(s.position.leverage).toBeLessThanOrEqual(2);
    expect(s.position.stop).toBeLessThan(s.position.entryPrice);
    const risk = (s.position.qty * (s.position.entryPrice - s.position.stop)) / s.account.initialCapital;
    expect(risk).toBeLessThanOrEqual(0.0101);
    await tick();
    await tick();
    const ev = (await call("/api/events")).json.filter((e: any) => e.type === "entry");
    expect(ev.length).toBe(1);
    const dec = (await call("/api/decisions")).json;
    expect(dec.some((d: any) => d.acted === 1 && d.action === "enter_long")).toBe(true);
  });

  it("el estado persiste tras reiniciar el servidor", async () => {
    const before = (await call("/api/status")).json;
    await stopWorker();
    await startWorker();
    const after = (await call("/api/status")).json;
    expect(after.position?.tradeId).toBe(before.position?.tradeId);
    expect(after.controls.running).toBe(true);
    expect(after.account.cash).toBeCloseTo(before.account.cash, 9);
  });

  it("la parada de emergencia cierra la posición y apaga el bot", async () => {
    price = 81000;
    const r = await call("/api/control", { method: "POST", body: { action: "emergency" } });
    expect(r.status).toBe(200);
    expect(r.json.done).toBe(true);
    const s = (await call("/api/status")).json;
    expect(s.position).toBeNull();
    expect(s.controls.running).toBe(false);
    const trades = (await call("/api/trades")).json;
    expect(trades.length).toBe(1);
    expect(trades[0].exit_reason).toBe("parada de emergencia");
    expect(trades[0].fees).toBeGreaterThan(0);
    const detail = (await call(`/api/trades/${trades[0].trade_id}`)).json;
    expect(detail.orders.length).toBe(2);
    expect(detail.decisions.length).toBeGreaterThan(0);
  });

  it("genera el informe mensual con el cron del día 1", async () => {
    expect((await fetch(`${BASE}/__scheduled?cron=7+6+1+*+*`)).status).toBe(200);
    const reports = (await call("/api/reports")).json;
    expect(reports.length).toBe(1);
    expect(reports[0]).toHaveProperty("uptimePct");
  });

  it("cerrar sesión invalida la cookie", async () => {
    await call("/api/logout", { method: "POST" });
    expect((await call("/api/status")).status).toBe(401);
  });
});
