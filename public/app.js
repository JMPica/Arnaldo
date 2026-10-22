"use strict";
// APEX Control — cliente del panel. Todo lo que muestra viene del backend;
// ningún dato es inventado en el navegador.

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let state = null;
let fx = 1.16;

const eur = (usd, d = 2) => (usd === null || usd === undefined || !isFinite(usd) ? "—" : (usd / fx).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €");
const usd = (v, d = 2) => (v === null || v === undefined || !isFinite(v) ? "—" : v.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }) + " US$");
const pct = (v, d = 2) => (v === null || v === undefined || !isFinite(v) ? "—" : (v * 100).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %");
const num = (v, d = 1) => (v === null || v === undefined || !isFinite(v) ? "—" : Number(v).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }));
const when = (ts) => (ts ? new Date(ts * 1000).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const ago = (s) => (s === null || s === undefined ? "—" : s < 90 ? `hace ${s} s` : s < 5400 ? `hace ${Math.round(s / 60)} min` : `hace ${Math.round(s / 3600)} h`);
const signCls = (v) => (v > 0 ? "up" : v < 0 ? "down" : "");

async function api(path, opts = {}) {
  const r = await fetch(path, { credentials: "same-origin", ...opts, headers: { "content-type": "application/json", "x-apex": "1", ...(opts.headers || {}) } });
  if (r.status === 401 && path !== "/api/login") {
    showLogin();
    throw new Error("no autenticado");
  }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.message || `error ${r.status}`);
  return body;
}
const post = (path, data) => api(path, { method: "POST", body: JSON.stringify(data || {}) });

// ---------- Acceso ----------
async function showLogin() {
  $("#app").hidden = true;
  $("#login").hidden = false;
  try {
    const info = await fetch("/api/auth-info").then((r) => r.json());
    $("#totp-row").hidden = !info.totp;
    if (!info.configured) $("#login-msg").textContent = "La contraseña del propietario aún no está configurada en el servidor.";
  } catch {}
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#login-msg").textContent = "Comprobando…";
  try {
    await post("/api/login", { password: $("#pw").value, code: $("#code").value });
    $("#pw").value = "";
    $("#code").value = "";
    $("#login-msg").textContent = "";
    start();
  } catch (err) {
    $("#login-msg").textContent = err.message;
  }
});

// ---------- Navegación ----------
const loaders = { status: loadStatus, trades: loadTrades, strategy: loadStrategy, learning: loadLearning, reports: loadReports };
let current = "status";
function go(tab) {
  current = tab;
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.dataset.view !== tab));
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  try { localStorage.setItem("apex-tab", tab); } catch {}
  loaders[tab]().catch(showError);
  window.scrollTo(0, 0);
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
function showError(err) {
  if (err.message !== "no autenticado") $("#action-msg").textContent = `Error: ${err.message}`;
}

// ---------- Estado ----------
async function loadStatus() {
  const [s, eq, dec] = await Promise.all([api("/api/status"), api("/api/equity?days=90"), api("/api/decisions")]);
  state = s;
  fx = s.account?.eurusd || fx;
  const c = s.controls;
  const a = s.account;

  // Pastilla de estado
  const pill = $("#state-pill");
  let label = "Apagado", cls = "";
  if (a?.halted) { label = "Suspendido"; cls = "bad"; }
  else if (c.running && !s.strategy.approved) { label = "Observación"; cls = "warn"; }
  else if (c.running && c.paused) { label = "En pausa"; cls = "warn"; }
  else if (c.running) { label = "Encendido"; cls = "good"; }
  if (!s.engine.healthy) { label += " · sin señal"; cls = "bad"; }
  pill.textContent = label;
  pill.className = `pill ${cls}`;
  const badge = $("#mode-badge");
  badge.textContent = c.mode === "live" ? "DINERO REAL" : "PAPER";
  badge.classList.toggle("live", c.mode === "live");

  // Avisos
  const banner = $("#banner");
  const msgs = [];
  if (!s.engine.healthy) msgs.push(["bad", `El motor no responde (${ago(s.engine.heartbeatAgeSec)}). ${s.engine.heartbeat?.error ? "Último error: " + esc(s.engine.heartbeat.error) : ""}`]);
  if (a?.halted) msgs.push(["bad", `Nuevas operaciones suspendidas: ${esc(a.haltReason)}. Revisa los resultados antes de reanudar.`]);
  if (!s.strategy.approved) msgs.push(["warn", "Ninguna estrategia supera ahora los criterios de aceptación. El motor registra datos y señales, pero no abre operaciones."]);
  if (s.strategy.pending) msgs.push(["warn", `Cambio de estrategia programado (se aplicará sin posición abierta): ${esc(s.strategy.pending.config.id)}`]);
  banner.hidden = !msgs.length;
  banner.className = `banner ${msgs.some((m) => m[0] === "bad") ? "bad" : "warn"}`;
  banner.innerHTML = msgs.map((m) => `<div>${m[1]}</div>`).join("");

  // Capital
  $("#equity-eur").textContent = eur(a?.equity);
  $("#equity-usd").textContent = a ? `· ${usd(a.equity)}` : "";
  const pnl = $("#pnl");
  pnl.textContent = a ? `${a.pnl >= 0 ? "+" : ""}${eur(a.pnl)} (${pct(a.pnlPct)}) desde el inicio` : "Sin datos todavía";
  pnl.className = signCls(a?.pnl);
  drawSpark(eq, a?.initialCapital);

  // Controles
  $("#btn-run").textContent = c.running ? "Apagar" : "Encender";
  $("#btn-run").className = c.running ? "btn" : "btn primary";
  $("#btn-pause").textContent = c.paused ? "Reanudar entradas" : "Pausar entradas";
  $("#btn-pause").disabled = !c.running;
  $("#btn-halt").hidden = !a?.halted;

  // Posición
  const p = s.position;
  $("#position").innerHTML = p
    ? `<div class="row"><span class="side ${p.side === "long" ? "up" : "down"}">${p.side === "long" ? "Largo" : "Corto"} ${num(p.qty, 4)} BTC</span><span class="${signCls(p.unrealized)}">${p.unrealized >= 0 ? "+" : ""}${eur(p.unrealized)}</span></div>
       <div class="row"><span>Entrada</span><span>${usd(p.entryPrice, 1)}</span></div>
       <div class="row"><span>Precio actual</span><span>${usd(p.markPrice, 1)}</span></div>
       <div class="row"><span>Stop de protección</span><span>${usd(p.stop, 1)}</span></div>
       <div class="row"><span>Nocional · apalancamiento</span><span>${usd(p.notional)} · ${num(p.leverage, 2)}x</span></div>
       <div class="row"><span>Riesgo hasta el stop</span><span>${eur(p.riskToStop)} (${pct(p.riskToStopPct)})</span></div>
       <div class="row"><span>Abierta</span><span>${when(p.entryTs)}</span></div>
       <div class="row"><span>Motivo</span><span>${esc(p.entryReason || "")}</span></div>`
    : `<span class="muted">Sin posición abierta.</span>`;

  // Cuenta
  $("#account").innerHTML = a
    ? [
        ["Capital inicial", `${eur(a.initialCapital)}`],
        ["Capital actual", `${eur(a.equity)}`],
        ["Beneficio / pérdida", `<span class="${signCls(a.pnl)}">${eur(a.pnl)}</span>`],
        ["Caída desde máximo", pct(a.drawdown)],
        ["Comisiones pagadas", eur(a.feesPaid)],
        ["Funding neto pagado", eur(a.fundingPaid)],
        ["Límite de caída", pct(s.limits.maxDrawdown, 0)],
        ["Riesgo por operación", pct(s.limits.riskPerTrade, 1)],
        ["Apalancamiento máximo", `${s.limits.maxLeverage}x`],
        ["EUR/USD", num(fx, 4)],
      ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")
    : `<dt>Cuenta</dt><dd>se crea en el primer ciclo</dd>`;

  // Motor
  $("#engine").innerHTML = [
    ["Último ciclo", `${ago(s.engine.heartbeatAgeSec)} ${s.engine.heartbeat?.ok === false ? "(con error)" : ""}`],
    ["Precio BTC (Kraken PF_XBTUSD)", s.market ? usd(s.market.price, 0) : "—"],
    ["Funding por hora", s.market ? pct(s.market.fundingHourly, 4) : "—"],
    ["Ciclos ejecutados", num(s.engine.ticks, 0)],
    ["Ciclos con error", num(s.engine.errors, 0)],
    ["Estrategia", s.strategy.config ? `<code>${esc(s.strategy.config.family)} ${esc(s.strategy.config.timeframe)}</code>` : "ninguna"],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");

  // Decisiones
  $("#decisions").innerHTML = dec.length
    ? dec.slice(0, 8).map((d) => `<li><span class="t">${labelAction(d.action)}${d.acted ? " ✓" : ""}</span><span class="r muted">${when(d.ts)}</span><span class="d">${esc(d.reason)}${d.note ? ` — ${esc(d.note)}` : ""}</span></li>`).join("")
    : `<li><span class="empty">Aún no hay decisiones. La estrategia decide al cierre de cada vela de su marco temporal.</span></li>`;
}

function labelAction(a) {
  return { enter_long: "Entrar largo", enter_short: "Entrar corto", exit: "Salir", hold: "Mantener / esperar" }[a] || a;
}

function drawSpark(rows, initial) {
  const svg = $("#spark");
  if (!rows || rows.length < 2) {
    svg.innerHTML = `<text x="160" y="36" text-anchor="middle" font-size="12" fill="currentColor" opacity="0.6">La curva de capital aparecerá tras las primeras horas</text>`;
    $("#spark-from").textContent = "";
    $("#spark-to").textContent = "";
    return;
  }
  const ys = rows.map((r) => r.equity);
  if (initial) ys.push(initial);
  const min = Math.min(...ys), max = Math.max(...ys);
  const pad = (max - min) * 0.1 || max * 0.01 || 1;
  const lo = min - pad, hi = max + pad;
  const W = 320, H = 64;
  const x = (i) => (i / (rows.length - 1)) * W;
  const y = (v) => H - ((v - lo) / (hi - lo)) * H;
  const pts = rows.map((r, i) => `${x(i).toFixed(1)},${y(r.equity).toFixed(1)}`).join(" ");
  const last = rows[rows.length - 1];
  svg.innerHTML =
    (initial ? `<line class="base" x1="0" x2="${W}" y1="${y(initial).toFixed(1)}" y2="${y(initial).toFixed(1)}"/>` : "") +
    `<polygon class="area" points="0,${H} ${pts} ${W},${H}"/><polyline class="line" points="${pts}"/>` +
    `<circle class="dot" cx="${W - 2}" cy="${y(last.equity).toFixed(1)}" r="3"/>`;
  $("#spark-from").textContent = when(rows[0].ts);
  $("#spark-to").textContent = when(last.ts);
}

// Controles con confirmación integrada en la página
let pendingAction = null;
function ask(text, action) {
  pendingAction = action;
  $("#confirm-text").textContent = text;
  $("#confirm").hidden = false;
}
$("#confirm-no").addEventListener("click", () => { $("#confirm").hidden = true; pendingAction = null; });
$("#confirm-yes").addEventListener("click", async () => {
  $("#confirm").hidden = true;
  if (pendingAction) await doAction(pendingAction);
  pendingAction = null;
});
async function doAction(action) {
  const msg = $("#action-msg");
  msg.textContent = "Enviando…";
  document.querySelectorAll(".controls .btn").forEach((b) => (b.disabled = true));
  try {
    const r = await post("/api/control", { action });
    msg.textContent = r.message;
    if (action === "start") post("/api/tick").catch(() => {});
  } catch (err) {
    msg.textContent = `No se pudo completar: ${err.message}`;
  } finally {
    document.querySelectorAll(".controls .btn").forEach((b) => (b.disabled = false));
    await loadStatus().catch(showError);
  }
}
$("#btn-run").addEventListener("click", () => {
  if (!state) return;
  if (state.controls.running) ask("¿Apagar el bot? No abrirá ni cerrará operaciones por estrategia; una posición abierta conserva su stop.", "stop");
  else doAction("start");
});
$("#btn-pause").addEventListener("click", () => state && doAction(state.controls.paused ? "resume" : "pause"));
$("#btn-emergency").addEventListener("click", () => ask("Parada de emergencia: apaga el bot, cancela órdenes y cierra la posición abierta al precio actual.", "emergency"));
$("#btn-halt").addEventListener("click", () => ask("Vas a levantar la suspensión por caída. El límite del 20 % se volverá a medir desde el capital actual. ¿Has revisado los resultados?", "reset_halt"));

// ---------- Operaciones ----------
async function loadTrades() {
  const t = await api("/api/trades");
  const net = t.reduce((s, x) => s + x.net, 0);
  const wins = t.filter((x) => x.net > 0).length;
  const fees = t.reduce((s, x) => s + x.fees, 0);
  $("#trade-summary").innerHTML = t.length ? `${t.length} operaciones cerradas · ${wins} ganadoras (${pct(wins / t.length, 0)}) · neto <span class="${signCls(net)}">${eur(net)}</span> · comisiones ${eur(fees)}` : "";
  $("#trades").innerHTML = t.length
    ? t.map((x) => `<li class="tap" data-id="${esc(x.trade_id)}" tabindex="0"><span class="t">${x.side === "long" ? "Largo" : "Corto"} ${num(x.qty, 4)} BTC</span><span class="r ${signCls(x.net)}">${x.net >= 0 ? "+" : ""}${eur(x.net)}</span><span class="d">${when(x.entry_ts)} → ${when(x.exit_ts)} · ${usd(x.entry_price, 0)} → ${usd(x.exit_price, 0)} · ${esc(x.exit_reason)}</span></li>`).join("")
    : `<li><span class="empty">Todavía no hay operaciones cerradas. Las operaciones simuladas aparecerán aquí con su razonamiento.</span></li>`;
  document.querySelectorAll("#trades li.tap").forEach((li) => {
    const open = () => showTrade(li.dataset.id).catch(showError);
    li.addEventListener("click", open);
    li.addEventListener("keydown", (e) => e.key === "Enter" && open());
  });
  $("#trade-detail").hidden = true;
}

async function showTrade(id) {
  const d = await api(`/api/trades/${encodeURIComponent(id)}`);
  const t = d.trade;
  const el = $("#trade-detail");
  el.hidden = false;
  el.innerHTML = `<h2>Detalle ${esc(t.trade_id)}</h2>
    <div class="row"><span>Estrategia</span><span><code>${esc(t.strategy_id)}</code></span></div>
    <div class="row"><span>Motivo de entrada</span><span>${esc(t.entry_reason)}</span></div>
    <div class="row"><span>Motivo de salida</span><span>${esc(t.exit_reason)}</span></div>
    <div class="row"><span>Bruto · comisiones · funding</span><span>${eur(t.gross)} · ${eur(t.fees)} · ${eur(t.funding)}</span></div>
    <div class="row"><span>Neto · múltiplo R</span><span class="${signCls(t.net)}">${eur(t.net)} · ${num(t.r_multiple, 2)} R</span></div>
    <div class="row"><span>Modo</span><span>${esc(t.mode)}</span></div>
    <h2>Órdenes</h2>${d.orders.map((o) => `<div class="row"><span>${when(o.ts)} ${o.kind === "entry" ? "entrada" : "salida"}</span><span>${num(o.qty, 4)} @ ${usd(o.price, 1)}</span></div>`).join("")}
    <h2>Razonamiento registrado</h2>${d.decisions.map((x) => `<div class="row"><span>${when(x.ts)}</span><span>${labelAction(x.action)} — ${esc(x.reason)}</span></div>`).join("") || '<span class="muted">—</span>'}
    ${d.events.length ? `<h2>Eventos</h2>${d.events.map((x) => `<div class="row"><span>${when(x.ts)}</span><span>${esc(x.message)}</span></div>`).join("")}` : ""}`;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Estrategia ----------
async function loadStrategy() {
  const [s, st] = await Promise.all([api("/api/status"), api("/api/strategies")]);
  const cfg = s.strategy.config;
  const perf = Object.fromEntries((st.performance || []).map((p) => [p.strategy_id, p]));
  const active = (st.strategies || []).find((x) => cfg && x.id === cfg.id);
  $("#strategy-active").innerHTML = cfg
    ? `<div class="row"><span>Estado</span><span class="${s.strategy.approved ? "ok" : "ko"}">${s.strategy.approved ? "Activa y aprobada" : "No aprobada (observación)"}</span></div>
       <div class="row"><span>Familia</span><span>${esc(cfg.family)}</span></div>
       <div class="row"><span>Marco temporal</span><span>${esc(cfg.timeframe)}</span></div>
       ${Object.entries(cfg.params).map(([k, v]) => `<div class="row"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")}
       <div class="row"><span>Sharpe fuera de muestra</span><span>${active?.oos_sharpe != null ? num(active.oos_sharpe, 2) : "—"}</span></div>
       <div class="row"><span>Resultado en paper</span><span>${perf[cfg.id] ? `${perf[cfg.id].n} ops · ${eur(perf[cfg.id].net)}` : "sin operaciones aún"}</span></div>
       ${gatesHtml(active?.gates)}`
    : `<span class="muted">Sin estrategia configurada.</span>`;
  const L = s.limits;
  $("#limits").innerHTML = [
    ["Riesgo por operación", pct(L.riskPerTrade, 1)],
    ["Apalancamiento máximo", `${L.maxLeverage}x`],
    ["Posiciones simultáneas", L.maxPositions],
    ["Suspensión por caída", pct(L.maxDrawdown, 0)],
    ["Lote mínimo", `${L.minLot} BTC`],
    ["Órdenes máximas al día", L.maxOrdersPerDay],
    ["Martingala", "prohibida"],
    ["Retiradas desde la API", "no implementadas"],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  $("#strategies").innerHTML = (st.strategies || []).length
    ? st.strategies.map((x) => `<li><span class="t"><code>${esc(x.id)}</code></span><span class="r ${x.status === "active" || x.status === "approved" ? "ok" : x.status === "rejected" ? "ko" : "muted"}">${statusLabel(x.status)}</span><span class="d">Sharpe OOS ${x.oos_sharpe != null ? num(x.oos_sharpe, 2) : "—"}${perf[x.id] ? ` · paper: ${perf[x.id].n} ops, ${eur(perf[x.id].net)}` : ""}</span></li>`).join("")
    : `<li><span class="empty">Sin candidatas registradas todavía.</span></li>`;
}
function statusLabel(s) {
  return { active: "activa", approved: "aprobada", rejected: "rechazada", retired: "retirada", candidate: "candidata" }[s] || s;
}
function gatesHtml(g) {
  try {
    const gates = typeof g === "string" ? JSON.parse(g) : g;
    if (!gates?.checks) return "";
    return `<div class="gates">${gates.checks.map((c) => `<div><span>${esc(c.name)}</span><span class="${c.ok ? "ok" : "ko"}">${num(c.value, 2)} ${c.ok ? "✓" : "✗"}</span></div>`).join("")}</div>`;
  } catch { return ""; }
}

// ---------- Aprendizaje ----------
async function loadLearning() {
  const l = await api("/api/learning");
  $("#learning").innerHTML = l.length
    ? l.map((x) => `<li><span class="t">${{ research: "Investigación", promotion: "Cambio de estrategia", drift: "Control de deriva", note: "Nota" }[x.kind] || esc(x.kind)}</span><span class="r muted">${when(x.ts)}</span><span class="d">${esc(x.summary)}</span></li>`).join("")
    : `<li><span class="empty">El primer ciclo de investigación semanal aparecerá aquí.</span></li>`;
}

// ---------- Informes ----------
async function loadReports() {
  const [r, ev] = await Promise.all([api("/api/reports"), api("/api/events")]);
  $("#reports").innerHTML = r.length
    ? r.map((x) => `<div class="card report"><h3>${monthName(x.month)}</h3>
        <div class="row"><span>Capital inicio → fin</span><span>${eur(x.startEquity)} → ${eur(x.endEquity)}</span></div>
        <div class="row"><span>Resultado del mes</span><span class="${signCls(x.pnl)}">${eur(x.pnl)} (${pct(x.pnlPct)})</span></div>
        <div class="row"><span>BTC en el mes</span><span>${pct(x.btcChangePct)}</span></div>
        <div class="row"><span>Caída máxima</span><span>${pct(x.maxDrawdown)}</span></div>
        <div class="row"><span>Operaciones · acierto</span><span>${x.trades} · ${pct(x.winRate, 0)}</span></div>
        <div class="row"><span>Comisiones · funding</span><span>${eur(x.fees)} · ${eur(x.funding)}</span></div>
        <div class="row"><span>Rechazos de riesgo · errores</span><span>${x.riskRejections} · ${x.errors}</span></div>
        <div class="row"><span>Disponibilidad del motor</span><span>${pct(x.uptimePct, 1)}</span></div>
        ${x.strategyChanges.length ? `<div class="row"><span>Cambios de estrategia</span><span>${x.strategyChanges.map(esc).join("<br>")}</span></div>` : ""}
        ${x.notes.map((n) => `<p class="muted">${esc(n)}</p>`).join("")}</div>`).join("")
    : `<p class="muted">Aún no hay informes.</p>`;
  $("#events").innerHTML = ev.length
    ? ev.map((x) => `<li class="lvl-${esc(x.level)}"><span class="t">${esc(x.message)}</span><span class="r muted">${when(x.ts)}</span></li>`).join("")
    : `<li><span class="empty">Sin actividad registrada.</span></li>`;
}
function monthName(m) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
}
$("#btn-report").addEventListener("click", async () => {
  try { await post("/api/reports/generate", {}); await loadReports(); } catch (err) { showError(err); }
});
$("#btn-logout").addEventListener("click", async () => {
  try { await post("/api/logout"); } catch {}
  showLogin();
});

// ---------- Arranque ----------
let timer = null;
async function start() {
  try {
    const info = await fetch("/api/auth-info").then((r) => r.json());
    if (!info.authenticated) return showLogin();
  } catch {
    return showLogin();
  }
  $("#login").hidden = true;
  $("#app").hidden = false;
  let tab = "status";
  try { tab = localStorage.getItem("apex-tab") || "status"; } catch {}
  go(loaders[tab] ? tab : "status");
  clearInterval(timer);
  timer = setInterval(() => { if (!document.hidden && current === "status") loadStatus().catch(showError); }, 30000);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && !$("#app").hidden) loaders[current]().catch(showError); });
start();
