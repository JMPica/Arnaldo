import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Decimal } from '../../shared/decimal';
import { Loading, NumField, PageHead, SelectField, TextArea, TextField, fieldErrors, useErrorText, useToast } from '../components/ui';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';

const d = (s: string | number | null | undefined) => { try { const x = new Decimal(String(s ?? '0').replace(',', '.') || '0'); return x.isFinite() ? x : new Decimal(0); } catch { return new Decimal(0); } };

/** Alta rápida de evento (objetivo ≤ 3 minutos desde el iPhone). */
export default function EventNew() {
  const { t, money, pct } = useI18n();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/clients') });
  const menus = useQuery({ queryKey: ['menus'], queryFn: () => api.get('/menus') });
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings') });
  const [f, setF] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (settings.data && !f) {
      setF({
        client_id: params.get('client') ?? '', new_client: '', new_phone: '', new_email: '',
        title: '', event_date: '', event_time: '', location_private: '', guest_count: '8', service_type: 'private_dinner', menu_id: '',
        price_per_guest: '', additional_revenue: '0', discount: '0', vat_rate: settings.data.default_vat_rate, target_margin_pct: settings.data.default_target_margin_pct,
        chef_hours: '', chef_rate: settings.data.chef_hourly_rate, staff: '', travel: '', equipment: '', restrictions: '',
      });
    }
  }, [settings.data, f, params]);
  const menu = useMemo(() => ((menus.data ?? []) as any[]).find((m) => m.id === f?.menu_id), [menus.data, f?.menu_id]);
  const save = useMutation({
    mutationFn: async () => {
      let clientId = f.client_id;
      if (!clientId) {
        if (!f.new_client.trim()) throw Object.assign(new Error('client'), { local: t('Elige un cliente o escribe uno nuevo') });
        clientId = (await api.post('/clients', { display_name: f.new_client, phone: f.new_phone, email: f.new_email })).id;
      }
      const ev = await api.post('/events', {
        client_id: clientId, menu_id: f.menu_id || null, title: f.title || `${t('Evento')} ${f.new_client || ((clients.data as any[]).find((c) => c.id === clientId)?.display_name ?? '')}`.trim(),
        service_type: f.service_type, event_date: f.event_date, event_time: f.event_time || null, location_private: f.location_private, guest_count: Math.max(0, parseInt(f.guest_count || '0', 10) || 0),
        price_per_guest: f.price_per_guest || '0', additional_revenue: f.additional_revenue || '0', discount: f.discount || '0', vat_rate: f.vat_rate, target_margin_pct: f.target_margin_pct, restrictions: f.restrictions,
      });
      const costs: [string, string, string, string][] = [['chef_hours', t('Horas del chef'), f.chef_hours, f.chef_rate], ['staff', t('Personal'), '1', f.staff], ['travel', t('Desplazamiento'), '1', f.travel], ['equipment', t('Material / alquiler'), '1', f.equipment]];
      for (const [category, description, quantity, amount] of costs) {
        if (d(quantity).greaterThan(0) && d(amount).greaterThan(0)) await api.post(`/events/${ev.id}/costs`, { category, description, quantity, unit_amount: amount, cost_kind: 'estimated' });
      }
      return ev;
    },
    onSuccess: (ev) => { qc.invalidateQueries(); toast(t('Evento creado')); nav(`/eventos/${ev.id}`); },
    onError: (e: any) => { if (e.local) { toast(e.local, 'error'); return; } setErrors(fieldErrors(e)); toast(errText(e), 'error'); },
  });

  if (!f || !clients.data || !menus.data) return <Loading />;
  const set = (k: string) => (v: string) => setF({ ...f, [k]: v });
  const guests = Math.max(0, parseInt(f.guest_count || '0', 10) || 0);
  const food = menu ? d(menu.cost_per_guest.base?.per_guest).times(guests) : new Decimal(0);
  const operating = d(f.chef_hours).times(d(f.chef_rate)).plus(d(f.staff)).plus(d(f.travel)).plus(d(f.equipment));
  const total = food.plus(operating);
  const m = d(f.target_margin_pct).div(100);
  const suggested = m.lessThan(1) && guests > 0 ? total.div(new Decimal(1).minus(m)).minus(d(f.additional_revenue)).plus(d(f.discount)).div(guests) : null;
  const revenue = d(f.price_per_guest).times(guests).plus(d(f.additional_revenue)).minus(d(f.discount));
  const profit = revenue.minus(total);
  const margin = revenue.greaterThan(0) ? profit.div(revenue).times(100) : null;

  return (
    <>
      <PageHead back={{ to: '/eventos', label: t('Eventos') }} kicker={t('Nuevo evento')} title={t('Presupuesto rápido')} sub={t('Importes sin IVA. Podrás detallar costes, grupos dietéticos y compras después.')} />
      <div className="split">
        <div className="stack">
          <section className="card panel">
            <div className="steps"><span className="on">1 · {t('Cliente')}</span></div>
            <div className="fields">
              <SelectField label={t('Cliente existente')} value={f.client_id} onChange={set('client_id')} span2 options={[['', t('— Cliente nuevo —')], ...(clients.data as any[]).map((c) => [c.id, c.display_name] as [string, string])]} />
              {!f.client_id && <>
                <TextField label={t('Nombre del cliente nuevo')} value={f.new_client} onChange={set('new_client')} span2 />
                <TextField label={t('Teléfono')} type="tel" value={f.new_phone} onChange={set('new_phone')} />
                <TextField label={t('Email')} type="email" value={f.new_email} onChange={set('new_email')} />
              </>}
            </div>
          </section>
          <section className="card panel">
            <div className="steps"><span className="on">2 · {t('Servicio')}</span></div>
            <div className="fields">
              <TextField label={t('Título del evento')} value={f.title} onChange={set('title')} placeholder={t('Ej.: Cena aniversario')} span2 error={errors.title} />
              <TextField label={t('Fecha')} type="date" value={f.event_date} onChange={set('event_date')} required error={errors.event_date} />
              <TextField label={t('Hora')} type="time" value={f.event_time} onChange={set('event_time')} />
              <NumField label={t('Comensales')} value={f.guest_count} onChange={set('guest_count')} integer required error={errors.guest_count} />
              <SelectField label={t('Tipo de servicio')} value={f.service_type} onChange={set('service_type')} options={[['private_dinner', t('Cena privada')], ['tasting', t('Menú degustación')], ['celebration', t('Celebración')], ['corporate', t('Corporativo')], ['class', t('Clase / showcooking')], ['other', t('Otro')]]} />
              <TextField label={t('Lugar (privado)')} value={f.location_private} onChange={set('location_private')} span2 />
            </div>
          </section>
          <section className="card panel">
            <div className="steps"><span className="on">3 · {t('Menú')}</span></div>
            <SelectField label={t('Menú')} value={f.menu_id} onChange={set('menu_id')} options={[['', t('— Sin menú todavía —')], ...(menus.data as any[]).map((mm) => [mm.id, `${mm.name} · ${money(mm.cost_per_guest.base?.per_guest)}/${t('comensal')}`] as [string, string])]} />
            <div style={{ marginTop: 10 }}><TextArea label={t('Alergias y restricciones del servicio')} value={f.restrictions} onChange={set('restrictions')} rows={2} /></div>
          </section>
          <section className="card panel">
            <div className="steps"><span className="on">4 · {t('Costes previstos')}</span></div>
            <div className="fields three">
              <NumField label={t('Horas del chef')} value={f.chef_hours} onChange={set('chef_hours')} />
              <NumField label={t('Tarifa hora (€)')} value={f.chef_rate} onChange={set('chef_rate')} />
              <NumField label={t('Personal (€)')} value={f.staff} onChange={set('staff')} />
              <NumField label={t('Desplazamiento (€)')} value={f.travel} onChange={set('travel')} />
              <NumField label={t('Material / alquiler (€)')} value={f.equipment} onChange={set('equipment')} />
            </div>
          </section>
          <section className="card panel">
            <div className="steps"><span className="on">5 · {t('Precio')}</span></div>
            <div className="fields three">
              <NumField label={t('Precio por comensal sin IVA (€)')} value={f.price_per_guest} onChange={set('price_per_guest')} error={errors.price_per_guest} />
              <NumField label={t('Ingresos adicionales (€)')} value={f.additional_revenue} onChange={set('additional_revenue')} />
              <NumField label={t('Descuento (€)')} value={f.discount} onChange={set('discount')} />
              <NumField label={t('Margen objetivo (%)')} value={f.target_margin_pct} onChange={set('target_margin_pct')} hint={t('Margen sobre ingresos, no recargo sobre coste.')} />
              <NumField label={t('IVA aplicable (%)')} value={f.vat_rate} onChange={set('vat_rate')} hint={t('Verifica el tipo con tu asesoría.')} />
            </div>
          </section>
        </div>
        <div className="stack sticky">
          <section className="card panel">
            <h3>{t('Resumen previsto')}</h3>
            <div className="kv" style={{ marginTop: 10 }}>
              <span className="k">{t('Comida (menú × comensales)')}</span><span className="v">{money(food.toFixed())}</span>
              <span className="k">{t('Costes operativos')}</span><span className="v">{money(operating.toFixed())}</span>
              <span className="k total">{t('Coste total')}</span><span className="v total">{money(total.toFixed())}</span>
              <span className="k">{t('Ingreso neto')}</span><span className="v">{money(revenue.toFixed())}</span>
              <span className="k">{t('Beneficio')}</span><span className={`v ${profit.isNegative() ? 'neg' : 'pos'}`}>{money(profit.toFixed())}</span>
              <span className="k">{t('Margen')}</span><span className="v">{pct(margin?.toFixed() ?? null)}</span>
            </div>
            {suggested && <div className="notice info" style={{ marginTop: 12 }}>{t('Precio recomendado para un margen del {m}: {p} por comensal (sin IVA).', { m: pct(f.target_margin_pct), p: money(suggested.toFixed()) })}
              <div><button className="link-btn" onClick={() => setF({ ...f, price_per_guest: suggested.toDecimalPlaces(2, Decimal.ROUND_CEIL).toFixed(2) })}>{t('Usar precio recomendado')}</button></div></div>}
            {!menu && <div className="notice warn" style={{ marginTop: 12 }}>{t('Sin menú el coste de comida es 0: el beneficio estará sobrestimado.')}</div>}
            <button className="btn block" style={{ marginTop: 14 }} disabled={save.isPending || !f.event_date || guests < 1} onClick={() => save.mutate()}>{t('Guardar presupuesto')}</button>
          </section>
        </div>
      </div>
    </>
  );
}
