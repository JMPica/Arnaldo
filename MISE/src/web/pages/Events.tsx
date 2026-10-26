import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Empty, ErrorBox, Loading, PageHead, Seg, StatusPill } from '../components/ui';
import { api, download } from '../lib/api';
import { useI18n } from '../lib/i18n';

export default function Events() {
  const { t, money, date } = useI18n();
  const [view, setView] = useState<'upcoming' | 'all' | 'draft' | 'completed'>('upcoming');
  const [filter, setFilter] = useState('');
  const q = useQuery({ queryKey: ['events'], queryFn: () => api.get('/events') });
  const today = new Date().toISOString().slice(0, 10);
  let list = ((q.data ?? []) as any[]).filter((e) => !filter || `${e.title} ${e.client_name} ${e.menu_name ?? ''}`.toLowerCase().includes(filter.toLowerCase()));
  if (view === 'upcoming') list = list.filter((e) => e.event_date >= today && !['cancelled', 'completed'].includes(e.status)).sort((a, b) => a.event_date.localeCompare(b.event_date));
  if (view === 'draft') list = list.filter((e) => ['draft', 'quoted'].includes(e.status));
  if (view === 'completed') list = list.filter((e) => e.status === 'completed');
  return (
    <>
      <PageHead kicker={t('Servicios')} title={t('Eventos')} sub={t('Cliente → menú → presupuesto → compras → producción → cierre.')}
        actions={<><button className="btn light" onClick={() => download('/calendar.ics', 'mise.ics')}>{t('Calendario iCal')}</button><Link className="btn" to="/eventos/nuevo">＋ {t('Nuevo evento')}</Link></>} />
      <div className="toolbar">
        <input className="search" type="search" placeholder={t('Buscar evento, cliente o menú…')} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t('Buscar')} />
        <Seg value={view} onChange={setView} label={t('Filtro')} options={[['upcoming', t('Próximos')], ['draft', t('Presupuestos')], ['completed', t('Cerrados')], ['all', t('Todos')]]} />
      </div>
      {q.isError ? <ErrorBox error={q.error} /> : !q.data ? <Loading /> : !list.length ? <div className="card"><Empty title={t('No hay eventos')} desc={t('Crea el primero: cliente, comensales, fecha y menú.')} action={<Link className="btn" to="/eventos/nuevo">{t('Crear evento')}</Link>} /></div> : (
        <div className="cards">{list.map((e) => {
          const rev = Number(e.price_per_guest) * e.guest_count + Number(e.additional_revenue) - Number(e.discount);
          return (
            <Link key={e.id} to={`/eventos/${e.id}`} className="card item">
              <div className="actions" style={{ justifyContent: 'space-between' }}><span className="strong" style={{ color: 'var(--sage)' }}>{date(e.event_date)}{e.event_time ? ` · ${e.event_time}` : ''}</span><StatusPill status={e.status} /></div>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500 }}>{e.title}</h3>
              <div className="muted">{e.client_name} · {t('{n} comensales', { n: e.guest_count })}</div>
              <div className="muted">{e.menu_name ?? t('Sin menú asignado')}</div>
              <div className="foot"><span className="muted">{t('Ingreso sin IVA')}</span><span className="strong num">{money(rev)}</span></div>
            </Link>);
        })}</div>
      )}
    </>
  );
}
