import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ErrorBox, Loading, NumField, PageHead, ReviewPill, SelectField, Sheet, StatusPill, Tabs, TextArea, TextField, fieldErrors, useConfirm, useErrorText, useToast } from '../components/ui';
import { api, newKey } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { internalReportPdf, proposalPdf } from '../pdf/docs';

type Tab = 'budget' | 'data' | 'costs' | 'production' | 'closing' | 'history';

export function useCostLabels() {
  const { t } = useI18n();
  return costLabelsOf(t);
}

export default function EventDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t, money, pct, date, num, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const { ask, node } = useConfirm();
  const [tab, setTab] = useState<Tab>('budget');
  const q = useQuery({ queryKey: ['event', id], queryFn: () => api.get(`/events/${id}`) });
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings') });
  const refresh = () => qc.invalidateQueries();
  const act = useMutation({
    mutationFn: (a: string) => api.post(`/events/${id}/${a}`),
    onSuccess: (_, a) => { refresh(); toast(({ quote: t('Presupuesto guardado (versión congelada)'), confirm: t('Evento confirmado: presupuesto congelado'), requote: t('Nueva versión del presupuesto creada'), complete: t('Evento cerrado'), cancel: t('Evento cancelado') } as Record<string, string>)[a] ?? t('Hecho')); },
    onError: (e) => toast(errText(e), 'error'),
  });
  const pdf = useMutation({
    mutationFn: async (kind: 'proposal_es' | 'proposal_ca' | 'internal') => {
      const brand = settings.data?.brand_name ?? 'MISE';
      if (kind === 'internal') return internalReportPdf(await api.get(`/events/${id}/internal-report`), { t, money, pct, date, num, lang, brand });
      const l = kind === 'proposal_ca' ? 'ca' : 'es';
      return proposalPdf(await api.get(`/events/${id}/proposal?lang=${l}`), l);
    },
    onError: (e) => toast(errText(e), 'error'),
  });
  if (q.isError) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  if (!q.data) return <Loading />;
  const e = q.data;
  const fin = e.live_financials;
  const snap = e.snapshot;
  const shown = snap && ['quoted', 'confirmed', 'completed'].includes(e.status) ? snap.financials : fin;
  const closed = e.status === 'completed' || e.status === 'cancelled';
  return (
    <>
      <PageHead back={{ to: '/eventos', label: t('Eventos') }} kicker={`${date(e.event_date)}${e.event_time ? ` · ${e.event_time}` : ''} · ${t('{n} comensales', { n: e.guest_count })}`} title={e.title}
        sub={<span className="actions"><StatusPill status={e.status} /><Link to={`/clientes/${e.client_id}`}>{e.client?.display_name}</Link>{e.menu && <Link to={`/menus/${e.menu.id}`}>{e.menu.name}</Link>}<ReviewPill state={e.menu_allergen_review} /></span>}
        actions={<>
          <button className="btn light" disabled={pdf.isPending} onClick={() => pdf.mutate('proposal_es')}>{t('Propuesta PDF (ES)')}</button>
          <button className="btn light" disabled={pdf.isPending} onClick={() => pdf.mutate('proposal_ca')}>{t('Propuesta PDF (CA)')}</button>
          <button className="btn light" disabled={pdf.isPending} onClick={() => pdf.mutate('internal')}>{t('Informe interno PDF')}</button>
        </>} />
      <Tabs value={tab} onChange={setTab} tabs={[['budget', t('Presupuesto')], ['data', t('Datos y comensales')], ['costs', t('Costes')], ['production', t('Compras y producción')], ['closing', t('Cierre')], ['history', t('Versiones')]]} />

      {tab === 'budget' && (
        <div className="split">
          <div className="stack">
            {e.financials_error && <div className="notice danger">{t('No se pudo calcular')}: {e.financials_error}</div>}
            {e.changed_since_snapshot && e.status !== 'completed' && <div className="notice warn">{t('Han cambiado precios, menú o datos desde la versión congelada {v}. Las cifras congeladas no se alteran.', { v: snap?.version })} {e.status === 'confirmed' && <button className="link-btn" onClick={() => act.mutate('requote')}>{t('Re-presupuestar (nueva versión)')}</button>}</div>}
            {shown?.warnings?.includes('missing_prices') && <div className="notice warn">{t('Hay ingredientes sin precio: el coste de comida está incompleto.')}</div>}
            {shown?.warnings?.includes('no_menu') && <div className="notice warn">{t('Sin menú asignado: el coste de comida es 0.')}</div>}
            <section className="card panel">
              <div className="panel-head"><h3>{snap && e.status !== 'draft' ? t('Presupuesto congelado v{v}', { v: snap.version }) : t('Presupuesto (precios actuales)')}</h3>{snap && <span className="muted">{t('Precios a')} {date(snap.prices_as_of)}</span>}</div>
              {shown && <div className="kv">
                <span className="k">{t('Precio por comensal × {n}', { n: e.guest_count })}</span><span className="v">{money(shown.revenue_services)}</span>
                <span className="k">{t('Ingresos adicionales')}</span><span className="v">{money(shown.additional_revenue)}</span>
                <span className="k">{t('Descuento')}</span><span className="v">−{money(shown.discount)}</span>
                <span className="k total">{t('Ingreso neto (base imponible)')}</span><span className="v total">{money(shown.revenue_net)}</span>
                <span className="k">{t('IVA {r}', { r: pct(shown.vat_rate) })}</span><span className="v">{money(shown.vat_amount)}</span>
                <span className="k">{t('Total con IVA (cliente)')}</span><span className="v">{money(shown.total_with_vat)}</span>
              </div>}
            </section>
            <section className="card panel">
              <h3>{t('Costes previstos')}</h3>
              {shown && <div className="kv" style={{ marginTop: 10 }}>
                <span className="k">{t('Comida')} ({money(shown.food_cost_per_guest)}/{t('comensal')})</span><span className="v">{money(shown.food_cost)}</span>
                {Object.entries(shown.operating as Record<string, string>).filter(([, v]) => Number(v) !== 0).map(([k, v]) => <Fragment key={k}><span className="k">{costLabelsOf(t)[k]}</span><span className="v">{money(v)}</span></Fragment>)}
                <span className="k total">{t('Coste total')}</span><span className="v total">{money(shown.total_cost)}</span>
              </div>}
            </section>
          </div>
          <div className="stack sticky">
            <section className="card panel">
              <h3>{t('Rentabilidad prevista')}</h3>
              {shown && <section className="metrics" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 10 }}>
                <div className="metric card"><div className="lbl">{t('Beneficio')}</div><div className={`val ${Number(shown.profit) < 0 ? 'neg' : ''}`}>{money(shown.profit)}</div></div>
                <div className="metric card"><div className="lbl">{t('Margen')}</div><div className="val">{pct(shown.margin_pct)}</div></div>
                <div className="metric card"><div className="lbl">{t('Food cost')}</div><div className="val">{pct(shown.food_cost_pct)}</div></div>
                <div className="metric card"><div className="lbl">{t('Coste / comensal')}</div><div className="val">{money(shown.cost_per_guest)}</div></div>
              </section>}
              {fin && <div className="notice info">{t('Para un margen del {m} (sobre ingresos) el precio recomendado es {p} por comensal, sin IVA.', { m: pct(fin.target_margin_pct), p: money(fin.suggested_per_guest) })}</div>}
            </section>
            <section className="card panel">
              <h3>{t('Siguiente paso')}</h3>
              {e.status === 'draft' && <><p className="muted2">{t('Guarda una versión del presupuesto o confírmalo cuando el cliente acepte.')}</p><div className="actions"><button className="btn light" disabled={act.isPending} onClick={() => act.mutate('quote')}>{t('Marcar como presupuestado')}</button><button className="btn" disabled={act.isPending} onClick={() => act.mutate('confirm')}>{t('Confirmar evento')}</button></div></>}
              {e.status === 'quoted' && <div className="actions"><button className="btn light" onClick={() => act.mutate('quote')}>{t('Nueva versión del presupuesto')}</button><button className="btn" onClick={() => act.mutate('confirm')}>{t('Confirmar evento')}</button></div>}
              {e.status === 'confirmed' && <><p className="muted2">{t('Prepara compras y producción. Tras el servicio, registra los costes reales y cierra.')}</p><div className="actions"><button className="btn light" onClick={() => setTab('production')}>{t('Compras y producción')}</button><button className="btn" onClick={() => setTab('closing')}>{t('Cerrar evento')}</button></div></>}
              {e.status === 'completed' && <p className="muted2">{t('Evento cerrado. Resultado real en la pestaña Cierre.')}</p>}
              {e.status === 'cancelled' && <p className="muted2">{t('Evento cancelado.')}</p>}
              {['draft', 'quoted'].includes(e.status) && e.confirm_missing.length > 0 && <div className="notice warn" style={{ marginTop: 10 }}>{t('Para confirmar falta')}: {e.confirm_missing.map((m: string) => ({ client: t('cliente'), event_date: t('fecha'), menu: t('menú'), guest_count: t('comensales'), price: t('precio'), menu_allergen_review: t('revisión de alérgenos del menú') } as Record<string, string>)[m] ?? m).join(', ')}{e.confirm_missing.includes('menu_allergen_review') && e.menu && <> · <Link to={`/menus/${e.menu.id}`}>{t('Revisar menú')}</Link></>}</div>}
              {!closed && <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={async () => { if (await ask(t('¿Cancelar este evento? Se liberarán las reservas de stock.'))) act.mutate('cancel'); }}>{t('Cancelar evento')}</button>}
              {(e.status === 'cancelled' || e.status === 'draft') && <button className="btn ghost sm" onClick={async () => { if (await ask(t('¿Archivar este evento?'))) { await api.del(`/events/${id}`); refresh(); nav('/eventos'); } }}>{t('Archivar')}</button>}
            </section>
          </div>
        </div>
      )}
      {tab === 'data' && <EventDataForm e={e} />}
      {tab === 'costs' && <CostsTab e={e} />}
      {tab === 'production' && <ProductionTab e={e} />}
      {tab === 'closing' && <ClosingTab e={e} onComplete={() => act.mutate('complete')} pending={act.isPending} />}
      {tab === 'history' && <HistoryTab e={e} />}
      {node}
    </>
  );
}

function costLabelsOf(t: (k: string) => string) {
  return { staff: t('Personal'), chef_hours: t('Horas del chef'), travel: t('Transporte / desplazamiento'), equipment: t('Material / alquiler'), food: t('Comida (materia prima)'), consumables: t('Consumibles'), overhead: t('Costes fijos imputados'), other: t('Otros') } as Record<string, string>;
}

function EventDataForm({ e }: { e: any }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/clients') });
  const menus = useQuery({ queryKey: ['menus'], queryFn: () => api.get('/menus') });
  const [f, setF] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    setF({ client_id: e.client_id, menu_id: e.menu_id ?? '', title: e.title, service_type: e.service_type, event_date: e.event_date, event_time: e.event_time ?? '', location_private: e.location_private ?? '', guest_count: String(e.guest_count),
      price_per_guest: e.price_per_guest, additional_revenue: e.additional_revenue, discount: e.discount, vat_rate: e.vat_rate, target_margin_pct: e.target_margin_pct, purchase_date: e.purchase_date ?? '', production_date: e.production_date ?? '', instructions: e.instructions ?? '', restrictions: e.restrictions ?? '', notes_private: e.notes_private ?? '' });
    setGroups(e.guest_groups.map((g: any) => ({ label: g.label, guest_count: String(g.guest_count), variant: g.variant, dietary_notes_private: g.dietary_notes_private ?? '' })));
  }, [e]);
  const save = useMutation({
    mutationFn: () => api.patch(`/events/${e.id}`, { ...f, menu_id: f.menu_id || null, guest_count: parseInt(f.guest_count, 10) || 0, guest_groups: groups.map((g) => ({ ...g, guest_count: parseInt(g.guest_count, 10) || 0 })) }),
    onSuccess: () => { qc.invalidateQueries(); toast(t('Evento actualizado')); setErrors({}); },
    onError: (err) => { setErrors(fieldErrors(err)); toast(errText(err), 'error'); },
  });
  if (!f || !clients.data || !menus.data) return <Loading />;
  const set = (k: string) => (v: string) => setF({ ...f, [k]: v });
  const closed = e.status === 'completed' || e.status === 'cancelled';
  const menu = (menus.data as any[]).find((m) => m.id === f.menu_id);
  return (
    <div className="split">
      <section className="card panel">
        {e.status === 'confirmed' && <div className="notice info">{t('El evento está confirmado: los cambios no alteran el presupuesto congelado. Usa «Re-presupuestar» para crear una versión nueva.')}</div>}
        <fieldset disabled={closed} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="fields">
            <TextField label={t('Título')} value={f.title} onChange={set('title')} span2 error={errors.title} />
            <SelectField label={t('Cliente')} value={f.client_id} onChange={set('client_id')} options={(clients.data as any[]).map((c) => [c.id, c.display_name] as [string, string])} />
            <SelectField label={t('Menú')} value={f.menu_id} onChange={set('menu_id')} options={[['', t('— Sin menú —')], ...(menus.data as any[]).map((m) => [m.id, m.name] as [string, string])]} />
            <TextField label={t('Fecha')} type="date" value={f.event_date} onChange={set('event_date')} error={errors.event_date} />
            <TextField label={t('Hora')} type="time" value={f.event_time} onChange={set('event_time')} />
            <NumField label={t('Comensales')} value={f.guest_count} onChange={set('guest_count')} integer error={errors.guest_count} />
            <SelectField label={t('Tipo de servicio')} value={f.service_type} onChange={set('service_type')} options={[['private_dinner', t('Cena privada')], ['tasting', t('Menú degustación')], ['celebration', t('Celebración')], ['corporate', t('Corporativo')], ['class', t('Clase / showcooking')], ['other', t('Otro')]]} />
            <TextField label={t('Lugar (privado)')} value={f.location_private} onChange={set('location_private')} span2 />
            <NumField label={t('Precio por comensal sin IVA (€)')} value={f.price_per_guest} onChange={set('price_per_guest')} error={errors.price_per_guest} />
            <NumField label={t('Ingresos adicionales (€)')} value={f.additional_revenue} onChange={set('additional_revenue')} />
            <NumField label={t('Descuento (€)')} value={f.discount} onChange={set('discount')} />
            <NumField label={t('IVA aplicable (%)')} value={f.vat_rate} onChange={set('vat_rate')} />
            <NumField label={t('Margen objetivo (%)')} value={f.target_margin_pct} onChange={set('target_margin_pct')} />
            <TextField label={t('Fecha de compras')} type="date" value={f.purchase_date} onChange={set('purchase_date')} />
            <TextField label={t('Fecha de producción')} type="date" value={f.production_date} onChange={set('production_date')} />
            <TextArea label={t('Alergias y restricciones del servicio')} value={f.restrictions} onChange={set('restrictions')} rows={2} />
            <TextArea label={t('Instrucciones (acceso, cocina, horarios)')} value={f.instructions} onChange={set('instructions')} rows={2} />
            <TextArea label={t('Notas privadas')} value={f.notes_private} onChange={set('notes_private')} rows={2} />
          </div>
        </fieldset>
      </section>
      <div className="stack sticky">
        <section className="card panel">
          <h3>{t('Grupos dietéticos')}</h3>
          <p className="muted2">{t('Asigna alternativas del menú a parte de los comensales. El resto toma el menú base.')}</p>
          {groups.map((g, i) => (
            <div key={i} className="fields" style={{ background: 'var(--sage-mist)', padding: 10, borderRadius: 12, marginTop: 8 }}>
              <TextField label={t('Grupo')} value={g.label} onChange={(v) => setGroups(groups.map((x, j) => (j === i ? { ...x, label: v } : x)))} />
              <NumField label={t('Comensales')} value={g.guest_count} onChange={(v) => setGroups(groups.map((x, j) => (j === i ? { ...x, guest_count: v } : x)))} integer />
              <SelectField label={t('Alternativa del menú')} value={g.variant} onChange={(v) => setGroups(groups.map((x, j) => (j === i ? { ...x, variant: v } : x)))} options={[['', t('— Menú base (solo nota) —')], ...((menu?.variants ?? []) as string[]).map((v) => [v, v] as [string, string])]} />
              <TextField label={t('Nota dietética (privada)')} value={g.dietary_notes_private} onChange={(v) => setGroups(groups.map((x, j) => (j === i ? { ...x, dietary_notes_private: v } : x)))} />
              <button className="btn danger sm" disabled={closed} onClick={() => setGroups(groups.filter((_, j) => j !== i))}>{t('Quitar grupo')}</button>
            </div>
          ))}
          {!closed && <button className="btn light sm" style={{ marginTop: 10 }} onClick={() => setGroups([...groups, { label: '', guest_count: '1', variant: menu?.variants?.[0] ?? '', dietary_notes_private: '' }])}>＋ {t('Grupo')}</button>}
          {errors['guest_groups'] && <div className="err">{errors['guest_groups']}</div>}
        </section>
        {!closed && <button className="btn block" disabled={save.isPending} onClick={() => save.mutate()}>{t('Guardar cambios')}</button>}
      </div>
    </div>
  );
}

function CostsTab({ e }: { e: any }) {
  const { t, money } = useI18n();
  const labels = useCostLabels();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const [adding, setAdding] = useState<'estimated' | 'actual' | null>(null);
  const del = useMutation({ mutationFn: (cid: string) => api.del(`/events/${e.id}/costs/${cid}`), onSuccess: () => qc.invalidateQueries(), onError: (err) => toast(errText(err), 'error') });
  const closed = e.status === 'completed' || e.status === 'cancelled';
  const block = (kind: 'estimated' | 'actual') => {
    const rows = (e.costs as any[]).filter((c) => c.cost_kind === kind);
    const total = rows.reduce((a, c) => a + Number(c.quantity) * Number(c.unit_amount), 0);
    return (
      <section className="card panel">
        <div className="panel-head"><h3>{kind === 'estimated' ? t('Costes previstos') : t('Costes reales')}</h3>{!closed && <button className="btn light sm" onClick={() => setAdding(kind)}>＋ {t('Añadir')}</button>}</div>
        {kind === 'estimated' && <p className="muted2">{t('La comida prevista se calcula desde el menú; aquí van personal, tus horas, transporte, alquileres y otros.')}</p>}
        {kind === 'actual' && <p className="muted2">{t('Registra lo realmente gastado, incluida la comida (compras: {p}).', { p: money(e.linked_purchases_total) })}</p>}
        {rows.length ? <ul className="list">{rows.map((c) => (
          <li key={c.id} className="row"><div><div>{labels[c.category]}</div><div className="muted">{c.description || ''} {Number(c.quantity) !== 1 ? `· ${c.quantity} × ${money(c.unit_amount)}` : ''}</div></div>
            <div className="right"><div className="num strong">{money(String(Number(c.quantity) * Number(c.unit_amount)))}</div>{!closed && <button className="link-btn danger" onClick={() => del.mutate(c.id)}>{t('Quitar')}</button>}</div></li>))}
          <li className="row"><span className="strong">{t('Total')}</span><span className="num strong">{money(total)}</span></li></ul> : <p className="muted">{t('Sin partidas.')}</p>}
      </section>
    );
  };
  return (
    <>
      <div className="grid two">{block('estimated')}{block('actual')}</div>
      {adding && <CostSheet eventId={e.id} kind={adding} suggestedFood={e.linked_purchases_total} onClose={() => setAdding(null)} />}
    </>
  );
}

function CostSheet({ eventId, kind, suggestedFood, onClose }: { eventId: string; kind: 'estimated' | 'actual'; suggestedFood: string; onClose: () => void }) {
  const { t, money } = useI18n();
  const labels = useCostLabels();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings') });
  const [f, setF] = useState({ category: kind === 'actual' ? 'food' : 'staff', description: '', quantity: '1', unit_amount: '' });
  const m = useMutation({ mutationFn: () => api.post(`/events/${eventId}/costs`, { ...f, cost_kind: kind }), onSuccess: () => { qc.invalidateQueries(); toast(t('Coste añadido')); onClose(); }, onError: (e) => toast(errText(e), 'error') });
  const cats = Object.keys(labels).filter((c) => kind === 'actual' || c !== 'food');
  return (
    <Sheet title={kind === 'estimated' ? t('Nuevo coste previsto') : t('Nuevo coste real')} onClose={onClose} footer={<><button className="btn light" onClick={onClose}>{t('Cancelar')}</button><button className="btn" disabled={!f.unit_amount || m.isPending} onClick={() => m.mutate()}>{t('Añadir')}</button></>}>
      <div className="fields">
        <SelectField label={t('Categoría')} value={f.category} onChange={(v) => setF({ ...f, category: v, quantity: '1', unit_amount: v === 'chef_hours' ? settings.data?.chef_hourly_rate ?? '' : f.unit_amount })} options={cats.map((c) => [c, labels[c]!] as [string, string])} />
        <TextField label={t('Descripción')} value={f.description} onChange={(v) => setF({ ...f, description: v })} />
        <NumField label={f.category === 'chef_hours' ? t('Horas') : t('Cantidad')} value={f.quantity} onChange={(v) => setF({ ...f, quantity: v })} />
        <NumField label={f.category === 'chef_hours' ? t('Tarifa por hora (€)') : t('Importe unitario sin IVA (€)')} value={f.unit_amount} onChange={(v) => setF({ ...f, unit_amount: v })} required />
      </div>
      {kind === 'actual' && f.category === 'food' && Number(suggestedFood) > 0 && <button className="link-btn" onClick={() => setF({ ...f, unit_amount: suggestedFood, description: t('Compras vinculadas al evento') })}>{t('Usar total de compras vinculadas ({p})', { p: money(suggestedFood) })}</button>}
    </Sheet>
  );
}

function ProductionTab({ e }: { e: any }) {
  const { t, num } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const { ask, node } = useConfirm();
  const q = useQuery({ queryKey: ['production', e.id], queryFn: () => api.get(`/events/${e.id}/production`), enabled: !!e.menu_id });
  const reserve = useMutation({ mutationFn: () => api.post(`/events/${e.id}/reserve-stock`, { idempotency_key: newKey() }), onSuccess: (r) => { qc.invalidateQueries(); toast(t('{n} ingredientes reservados', { n: r.reserved.length })); }, onError: (err) => toast(errText(err), 'error') });
  const consume = useMutation({ mutationFn: () => api.post(`/events/${e.id}/consume-stock`, { idempotency_key: newKey() }), onSuccess: () => { qc.invalidateQueries(); toast(t('Consumo de producción registrado')); }, onError: (err) => toast(errText(err), 'error') });
  if (!e.menu_id) return <div className="notice warn">{t('Asigna un menú al evento.')}</div>;
  if (q.isError) return <ErrorBox error={q.error} />;
  if (!q.data) return <Loading />;
  return (
    <>
      <div className="actions" style={{ marginBottom: 12 }}>
        <Link className="btn" to={`/compras?events=${e.id}`}>{t('Lista de compra de este evento')}</Link>
        {e.status === 'confirmed' && <button className="btn light" disabled={reserve.isPending} onClick={() => reserve.mutate()}>{t('Reservar stock disponible')}</button>}
        {e.status === 'confirmed' && <button className="btn light" disabled={consume.isPending} onClick={async () => { if (await ask(t('¿Registrar el consumo de producción? Se descontarán del stock las cantidades brutas previstas.'), false)) consume.mutate(); }}>{t('Registrar consumo de producción')}</button>}
      </div>
      <div className="grid two">
        <section className="card panel">
          <h3>{t('Plan de producción (mise en place)')}</h3>
          <p className="muted">{t('Compras')}: {e.purchase_date ?? '—'} · {t('Producción')}: {e.production_date ?? '—'}</p>
          <div className="table-wrap"><table><thead><tr><th>{t('Receta')}</th><th className="num">{t('Raciones')}</th><th className="num">{t('Lotes')}</th></tr></thead>
            <tbody>{q.data.plan.map((p: any) => <tr key={p.recipe_id}><td><Link to={`/recetas/${p.recipe_id}`}>{p.name}</Link>{p.subrecipes.length > 0 && <div className="muted">↳ {p.subrecipes.join(', ')}</div>}</td><td className="num">{num(p.portions, 2)}</td><td className="num">{num(p.lots, 2)}</td></tr>)}</tbody></table></div>
        </section>
        <section className="card panel">
          <h3>{t('Necesidades brutas y stock')}</h3>
          <div className="table-wrap"><table><thead><tr><th>{t('Ingrediente')}</th><th className="num">{t('Necesario')}</th><th className="num">{t('Stock')}</th><th className="num">{t('Reservado')}</th><th className="num">{t('Consumido')}</th></tr></thead>
            <tbody>{q.data.ingredients.map((r: any) => <tr key={r.ingredient_id}><td>{r.name}</td><td className="num">{num(r.gross_needed, 1)} {r.base_unit}</td><td className={`num ${Number(r.on_hand) < Number(r.gross_needed) ? 'neg' : ''}`}>{num(r.on_hand, 1)}</td><td className="num">{num(r.reserved_this_event, 1)}</td><td className="num">{num(r.consumed, 1)}</td></tr>)}</tbody></table></div>
        </section>
      </div>
      {node}
    </>
  );
}

function ClosingTab({ e, onComplete, pending }: { e: any; onComplete: () => void; pending: boolean }) {
  const { t, money, pct, date } = useI18n();
  const labels = useCostLabels();
  const { ask, node } = useConfirm();
  const c = e.closing;
  if (e.status !== 'confirmed' && e.status !== 'completed') return <div className="notice">{t('El cierre está disponible para eventos confirmados.')}</div>;
  return (
    <>
      {c && (
        <div className="split">
          <section className="card panel">
            <h3>{t('Previsto (v{v}) vs real', { v: c.snapshot_version ?? '—' })}</h3>
            <div className="table-wrap"><table><thead><tr><th>{t('Partida')}</th><th className="num">{t('Previsto')}</th><th className="num">{t('Real')}</th><th className="num">{t('Desviación')}</th></tr></thead>
              <tbody>{c.rows.filter((r: any) => Number(r.estimated) !== 0 || Number(r.actual) !== 0).map((r: any) => <tr key={r.category}><td>{labels[r.category]}</td><td className="num">{money(r.estimated)}</td><td className="num">{money(r.actual)}</td><td className={`num ${Number(r.variance) > 0 ? 'neg' : 'pos'}`}>{Number(r.variance) > 0 ? '+' : ''}{money(r.variance)}</td></tr>)}
                <tr><td className="strong">{t('Coste total')}</td><td className="num strong">{money(c.estimated_total_cost)}</td><td className="num strong">{money(c.actual_total_cost)}</td><td className={`num strong ${Number(c.variance_total_cost) > 0 ? 'neg' : 'pos'}`}>{money(c.variance_total_cost)}</td></tr></tbody></table></div>
          </section>
          <section className="card panel">
            <h3>{t('Resultado')}</h3>
            <div className="kv" style={{ marginTop: 10 }}>
              <span className="k">{t('Ingreso neto')}</span><span className="v">{money(c.revenue_net)}</span>
              <span className="k">{t('Beneficio previsto')}</span><span className="v">{money(c.estimated_profit)} · {pct(c.estimated_margin_pct)}</span>
              <span className="k total">{t('Beneficio real')}</span><span className={`v total ${Number(c.actual_profit) < 0 ? 'neg' : 'pos'}`}>{money(c.actual_profit)}</span>
              <span className="k">{t('Margen real')}</span><span className="v">{pct(c.actual_margin_pct)}</span>
              <span className="k">{t('Food cost real')}</span><span className="v">{pct(c.actual_food_cost_pct)}</span>
            </div>
            {!c.has_actual_food && e.status === 'confirmed' && <div className="notice warn" style={{ marginTop: 10 }}>{t('Aún no has registrado el coste real de comida.')}</div>}
            {e.status === 'confirmed' && <button className="btn block" style={{ marginTop: 14 }} disabled={pending} onClick={async () => { if (await ask(t('¿Cerrar el evento? Se congelará el resultado real y no podrá editarse.'), false)) onComplete(); }}>{t('Cerrar y archivar resultado')}</button>}
            {e.status === 'completed' && <div className="notice" style={{ marginTop: 10 }}>{t('Cerrado el {d}.', { d: date(String(e.completed_at).slice(0, 10)) })}</div>}
          </section>
        </div>
      )}
      {node}
    </>
  );
}

function HistoryTab({ e }: { e: any }) {
  const { t, money, pct } = useI18n();
  const [open, setOpen] = useState<number | null>(null);
  const q = useQuery({ queryKey: ['snapshot', e.id, open], queryFn: () => api.get(`/events/${e.id}/snapshots/${open}`), enabled: open !== null });
  const kinds: Record<string, string> = { quoted: t('Presupuestado'), confirmed: t('Confirmado'), requoted: t('Re-presupuestado'), completed: t('Cerrado') };
  return (
    <section className="card panel">
      <h3>{t('Versiones congeladas')}</h3>
      <p className="muted2">{t('Cada versión guarda entradas, precios usados, cálculo y huella SHA-256. Nunca se modifican.')}</p>
      {e.snapshots.length ? <ul className="list">{e.snapshots.map((s: any) => (
        <li key={s.id} className="row"><div><div className="title-sm">v{s.version} · {kinds[s.snapshot_kind]}</div><div className="muted">{s.created_at.slice(0, 16).replace('T', ' ')} · {s.calculation_version} · sha256 {s.sha256.slice(0, 12)}…</div></div><button className="btn light sm" onClick={() => setOpen(s.version)}>{t('Ver')}</button></li>))}</ul> : <p className="muted">{t('Aún no hay versiones: presupuesta o confirma el evento.')}</p>}
      {open !== null && q.data && (
        <Sheet title={`v${open} · ${kinds[q.data.snapshot_kind]}`} onClose={() => setOpen(null)}>
          <div className="kv">
            <span className="k">{t('Ingreso neto')}</span><span className="v">{money(q.data.data.financials.revenue_net)}</span>
            <span className="k">{t('Comida')}</span><span className="v">{money(q.data.data.financials.food_cost)}</span>
            <span className="k">{t('Coste total')}</span><span className="v">{money(q.data.data.financials.total_cost)}</span>
            <span className="k">{t('Beneficio')}</span><span className="v">{money(q.data.data.financials.profit)}</span>
            <span className="k">{t('Margen')}</span><span className="v">{pct(q.data.data.financials.margin_pct)}</span>
          </div>
          <h3 style={{ marginTop: 14 }}>{t('Precios usados')}</h3>
          <ul className="list">{q.data.data.prices_used.map((p: any) => <li key={p.ingredient_id} className="row"><span>{p.name}</span><span className="muted num">{p.label ?? '—'} · {p.pack_price ? money(p.pack_price) : t('sin precio')} · {p.effective_at ?? ''}</span></li>)}</ul>
        </Sheet>
      )}
    </section>
  );
}
