import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toCsv } from '../../shared/csv';
import { Empty, ErrorBox, Loading, NumField, PageHead, SelectField, Sheet, StatusPill, Tabs, TextField, useErrorText, useToast } from '../components/ui';
import { api, saveBlob } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { shoppingListPdf } from '../pdf/docs';

const today = () => new Date().toISOString().slice(0, 10);

export default function Purchasing() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as 'list' | 'purchases') ?? 'list';
  return (
    <>
      <PageHead kicker={t('Aprovisionamiento')} title={t('Compras')} sub={t('Necesidades netas → compra bruta con merma → menos stock → envases enteros.')} />
      <Tabs value={tab} onChange={(v) => { const p = new URLSearchParams(params); p.set('tab', v); setParams(p); }} tabs={[['list', t('Lista de compra')], ['purchases', t('Pedidos y recepciones')]]} />
      {tab === 'list' ? <ShoppingList /> : <PurchaseList />}
    </>
  );
}

function ShoppingList() {
  const { t, money, num, date, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const errText = useErrorText();
  const qc = useQueryClient();
  const events = useQuery({ queryKey: ['events'], queryFn: () => api.get('/events') });
  const selected = (params.get('events') ?? '').split(',').filter(Boolean);
  const q = useQuery({ queryKey: ['shopping', selected.join(',')], queryFn: () => api.get(`/shopping-list${selected.length ? `?events=${selected.join(',')}` : ''}`) });
  const candidates = ((events.data ?? []) as any[]).filter((e) => ['confirmed', 'quoted'].includes(e.status) && e.event_date >= today()).sort((a, b) => a.event_date.localeCompare(b.event_date));
  const toggle = (id: string) => {
    const base = selected.length ? selected : ((q.data?.events ?? []) as any[]).map((e) => e.id);
    const next = base.includes(id) ? base.filter((x: string) => x !== id) : [...base, id];
    const p = new URLSearchParams(params); p.set('events', next.join(',')); p.set('tab', 'list'); setParams(p);
  };
  const bySupplier = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of (q.data?.rows ?? []) as any[]) { const k = r.supplier_name ?? t('Sin proveedor'); m.set(k, [...(m.get(k) ?? []), r]); }
    return [...m.entries()];
  }, [q.data, t]);
  const order = useMutation({
    mutationFn: async (rows: any[]) => {
      const evIds = (q.data.events as any[]).map((e) => e.id);
      return api.post('/purchases', { supplier_id: rows[0].format?.supplier_id ?? null, event_id: evIds.length === 1 ? evIds[0] : null, purchase_date: today(), status: 'ordered', update_prices: false,
        lines: rows.filter((r) => r.format && Number(r.packs) > 0).map((r) => ({ ingredient_id: r.ingredient_id, format_id: r.format.format_id, ordered_packs: r.packs, pack_quantity_base: r.format.pack_quantity_base, pack_price: r.format.pack_price })) });
    },
    onSuccess: (r) => { qc.invalidateQueries(); toast(t('Pedido creado')); nav(`/compras/pedidos/${r.id}`); },
    onError: (e) => toast(errText(e), 'error'),
  });
  const exportCsv = () => {
    const csv = toCsv((q.data?.rows ?? []) as any[], [
      { header: t('Proveedor'), value: (r) => r.supplier_name }, { header: t('Ingrediente'), value: (r) => r.name }, { header: t('Unidad'), value: (r) => r.base_unit },
      { header: t('Necesidad neta'), value: (r) => r.net, numeric: true }, { header: t('Bruto con merma'), value: (r) => r.gross, numeric: true }, { header: t('Stock disponible'), value: (r) => r.stock_available, numeric: true },
      { header: t('A comprar'), value: (r) => r.need, numeric: true }, { header: t('Formato'), value: (r) => r.format?.label }, { header: t('Envases'), value: (r) => r.packs, numeric: true },
      { header: t('Coste previsto sin IVA'), value: (r) => r.expected_cost, numeric: true },
    ]);
    saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `MISE_lista_compra_${today()}.csv`);
  };
  return (
    <>
      <section className="card panel" style={{ marginBottom: 14 }}>
        <div className="panel-head"><h3>{t('Eventos incluidos')}</h3><span className="muted">{selected.length ? t('Selección manual') : t('Por defecto: confirmados próximos')}</span></div>
        {candidates.length ? <div className="actions">{candidates.map((e) => {
          const on = selected.length ? selected.includes(e.id) : (q.data?.events ?? []).some((x: any) => x.id === e.id);
          return <label key={e.id} className="check chip" style={{ minHeight: 40 }}><input type="checkbox" checked={on} onChange={() => toggle(e.id)} />{date(e.event_date)} · {e.title} ({e.guest_count})</label>;
        })}</div> : <p className="muted">{t('No hay eventos próximos confirmados o presupuestados.')}</p>}
      </section>
      {q.isError ? <ErrorBox error={q.error} /> : !q.data ? <Loading /> : !q.data.rows.length ? <div className="card"><Empty title={t('Nada que comprar')} desc={t('Selecciona eventos con menú y recetas con ingredientes.')} /></div> : (
        <>
          <div className="metrics">
            <div className="metric card"><div className="lbl">{t('Ingredientes')}</div><div className="val">{q.data.rows.length}</div></div>
            <div className="metric card"><div className="lbl">{t('Envases')}</div><div className="val">{num(q.data.rows.reduce((a: number, r: any) => a + Number(r.packs), 0), 2)}</div></div>
            <div className="metric card"><div className="lbl">{t('Compra prevista')}</div><div className="val">{money(q.data.total_expected)}</div><div className="note">{t('sin IVA, envases completos')}</div></div>
            <div className="metric card"><div className="lbl">{t('Sin formato/precio')}</div><div className="val">{q.data.missing_formats.length}</div></div>
          </div>
          <div className="actions" style={{ marginBottom: 12 }}>
            <button className="btn light" onClick={exportCsv}>{t('Exportar CSV')}</button>
            <button className="btn light" onClick={() => shoppingListPdf(q.data, { t, money, num, date, lang })}>{t('PDF para el mercado')}</button>
          </div>
          {bySupplier.map(([sup, rows]) => (
            <section key={sup} className="card" style={{ marginBottom: 14 }}>
              <div className="panel-head panel" style={{ marginBottom: 0, paddingBottom: 6 }}><h3>{sup}</h3>{rows.some((r) => r.format && Number(r.packs) > 0) && <button className="btn light sm" disabled={order.isPending} onClick={() => order.mutate(rows)}>{t('Crear pedido')}</button>}</div>
              <div className="table-wrap"><table><thead><tr><th>{t('Ingrediente')}</th><th className="num">{t('Neto')}</th><th className="num">{t('Bruto')}</th><th className="num">{t('Stock')}</th><th className="num">{t('A comprar')}</th><th>{t('Envases')}</th><th className="num">{t('Coste')}</th></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r.ingredient_id}><td><Link to={`/ingredientes/${r.ingredient_id}`}>{r.name}</Link>{Number(r.waste_pct) > 0 && <div className="muted">{t('merma')} {num(r.waste_pct, 1)} %</div>}</td>
                    <td className="num">{num(r.net, 1)} {r.base_unit}</td><td className="num">{num(r.gross, 1)}</td><td className="num">{num(r.stock_available, 1)}</td><td className="num strong">{num(r.need, 1)}</td>
                    <td>{r.format ? <>{num(r.packs, 2)} × {r.format.label}{Number(r.surplus) > 0 && <div className="muted">{t('sobrante')} {num(r.surplus, 0)} {r.base_unit}</div>}{r.alternatives.length > 0 && <div className="muted">{t('Alternativa')}: {r.alternatives.map((a: any) => `${a.supplier_name ?? ''} ${a.format.label} ${money(a.cost)}`).join(' · ')}</div>}</> : <span className="pill warn">{t('Sin formato con precio')}</span>}</td>
                    <td className="num strong">{r.expected_cost ? money(r.expected_cost) : '—'}</td></tr>))}</tbody></table></div>
            </section>
          ))}
          <p className="footnote">{t('La demanda de varios eventos se suma antes de redondear a envases. El stock reservado por otros eventos no se cuenta como disponible.')}</p>
        </>
      )}
    </>
  );
}

function PurchaseList() {
  const { t, money, date } = useI18n();
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ['purchases'], queryFn: () => api.get('/purchases') });
  return (
    <>
      <div className="actions" style={{ marginBottom: 12 }}><button className="btn" onClick={() => setCreating(true)}>＋ {t('Registrar compra')}</button><Link className="btn light" to="/documentos">{t('Desde factura o albarán')}</Link></div>
      {q.isError ? <ErrorBox error={q.error} /> : !q.data ? <Loading /> : !q.data.length ? <div className="card"><Empty title={t('Sin compras registradas')} /></div> : (
        <div className="card"><ul className="list">{(q.data as any[]).map((p) => (
          <li key={p.id}><Link className="row-link" to={`/compras/pedidos/${p.id}`}><div><div className="title-sm">{p.supplier_name ?? t('Sin proveedor')} {p.external_reference ? `· ${p.external_reference}` : ''}</div><div className="muted">{date(p.purchase_date)} · {t('{n} líneas', { n: p.lines_count })}{p.event_title ? ` · ${p.event_title}` : ''}{p.document_id ? ` · ${t('con documento')}` : ''}</div></div>
            <div className="right"><StatusPill status={p.status} /><div className="num strong">{money(p.total)}</div></div></Link></li>))}</ul></div>
      )}
      {creating && <NewPurchase onClose={() => setCreating(false)} />}
    </>
  );
}

export function NewPurchase({ onClose }: { onClose: () => void }) {
  const { t, money } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/suppliers') });
  const ings = useQuery({ queryKey: ['ingredients', 'active'], queryFn: () => api.get('/ingredients') });
  const formats = useQuery({ queryKey: ['formats'], queryFn: () => api.get('/purchase-formats') });
  const events = useQuery({ queryKey: ['events'], queryFn: () => api.get('/events') });
  const [h, setH] = useState({ supplier_id: '', event_id: '', external_reference: '', purchase_date: today(), update_prices: true, receive_now: true });
  const [lines, setLines] = useState<any[]>([{ ingredient_id: '', format_id: '', ordered_packs: '1', pack_quantity_base: '', pack_price: '' }]);
  const m = useMutation({
    mutationFn: async () => {
      const r = await api.post('/purchases', { ...h, supplier_id: h.supplier_id || null, event_id: h.event_id || null, status: 'ordered', lines: lines.filter((l) => l.ingredient_id).map((l) => ({ ...l, format_id: l.format_id || null })) });
      if (h.receive_now) {
        const p = await api.get(`/purchases/${r.id}`);
        await api.post(`/purchases/${r.id}/receive`, { idempotency_key: `rx-${r.id}`, received_at: h.purchase_date, lines: p.lines.map((l: any) => ({ line_id: l.id, packs: l.ordered_packs })) });
      }
      return r;
    },
    onSuccess: (r) => { qc.invalidateQueries(); toast(t('Compra registrada')); onClose(); nav(`/compras/pedidos/${r.id}`); },
    onError: (e) => toast(errText(e), 'error'),
  });
  if (!suppliers.data || !ings.data || !formats.data) return <Sheet title={t('Registrar compra')} onClose={onClose}><Loading /></Sheet>;
  const fmtFor = (iid: string) => (formats.data as any[]).filter((f) => f.ingredient_id === iid);
  const total = lines.reduce((a, l) => a + (Number(String(l.ordered_packs).replace(',', '.')) || 0) * (Number(String(l.pack_price).replace(',', '.')) || 0), 0);
  return (
    <Sheet title={t('Registrar compra')} sub={t('Precios sin IVA. Actualiza el historial de precios y, si lo marcas, el stock.')} onClose={onClose} wide
      footer={<><button className="btn light" onClick={onClose}>{t('Cancelar')}</button><button className="btn" disabled={m.isPending || !lines.some((l) => l.ingredient_id)} onClick={() => m.mutate()}>{t('Guardar compra')} · {money(total)}</button></>}>
      <div className="fields three">
        <SelectField label={t('Proveedor')} value={h.supplier_id} onChange={(v) => setH({ ...h, supplier_id: v })} options={[['', t('— Sin proveedor —')], ...(suppliers.data as any[]).map((s) => [s.id, s.name] as [string, string])]} />
        <TextField label={t('Fecha')} type="date" value={h.purchase_date} onChange={(v) => setH({ ...h, purchase_date: v })} />
        <TextField label={t('Nº factura / albarán')} value={h.external_reference} onChange={(v) => setH({ ...h, external_reference: v })} />
        <SelectField label={t('Evento (opcional)')} value={h.event_id} onChange={(v) => setH({ ...h, event_id: v })} options={[['', '—'], ...((events.data ?? []) as any[]).filter((e) => e.status === 'confirmed').map((e) => [e.id, `${e.event_date} · ${e.title}`] as [string, string])]} />
        <label className="check"><input type="checkbox" checked={h.update_prices} onChange={(e) => setH({ ...h, update_prices: e.target.checked })} />{t('Actualizar precios')}</label>
        <label className="check"><input type="checkbox" checked={h.receive_now} onChange={(e) => setH({ ...h, receive_now: e.target.checked })} />{t('Recibido ahora (sumar al stock)')}</label>
      </div>
      <div className="line-editor" style={{ marginTop: 12 }}>
        {lines.map((l, i) => {
          const ing = (ings.data as any[]).find((x) => x.id === l.ingredient_id);
          const upd = (patch: any) => setLines(lines.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <div key={i} className="fields three" style={{ background: 'var(--sage-mist)', padding: 10, borderRadius: 12 }}>
              <SelectField label={t('Ingrediente')} value={l.ingredient_id} onChange={(v) => { const f = fmtFor(v)[0]; upd({ ingredient_id: v, format_id: f?.id ?? '', pack_quantity_base: f?.pack_quantity_base ?? '', pack_price: f?.last_price ?? '' }); }} options={[['', '—'], ...(ings.data as any[]).map((x) => [x.id, x.name] as [string, string])]} />
              <SelectField label={t('Formato')} value={l.format_id} onChange={(v) => { const f = fmtFor(l.ingredient_id).find((x) => x.id === v); upd({ format_id: v, pack_quantity_base: f?.pack_quantity_base ?? l.pack_quantity_base, pack_price: f?.last_price ?? l.pack_price }); }} options={[['', t('— Sin formato (no actualiza precio) —')], ...fmtFor(l.ingredient_id).map((f) => [f.id, `${f.label}${f.supplier_name ? ` · ${f.supplier_name}` : ''}`] as [string, string])]} />
              <NumField label={t('Envases')} value={l.ordered_packs} onChange={(v) => upd({ ordered_packs: v })} />
              <NumField label={t('Contenido envase ({u})', { u: ing?.base_unit ?? '' })} value={l.pack_quantity_base} onChange={(v) => upd({ pack_quantity_base: v })} />
              <NumField label={t('Precio envase sin IVA (€)')} value={l.pack_price} onChange={(v) => upd({ pack_price: v })} />
              <div className="field"><label>&nbsp;</label><button className="btn danger sm" onClick={() => setLines(lines.filter((_, j) => j !== i))}>{t('Quitar')}</button></div>
            </div>
          );
        })}
        <button className="btn light sm" onClick={() => setLines([...lines, { ingredient_id: '', format_id: '', ordered_packs: '1', pack_quantity_base: '', pack_price: '' }])}>＋ {t('Línea')}</button>
      </div>
    </Sheet>
  );
}
