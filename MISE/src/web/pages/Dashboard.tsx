import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Empty, ErrorBox, Loading, PageHead, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';

export default function Dashboard() {
  const { t, money, pct, date } = useI18n();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/dashboard') });
  if (q.isError) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  if (!q.data) return <Loading />;
  const d = q.data;
  const maxRev = Math.max(1, ...d.by_month.map((m: any) => Number(m.revenue)));
  return (
    <>
      <PageHead kicker={t('Operaciones · vista general')} title={t('Tu cocina, bajo control')} sub={t('Previsión de eventos confirmados y resultado real de los cerrados (importes sin IVA).')}
        actions={<Link className="btn" to="/eventos/nuevo">＋ {t('Nuevo evento')}</Link>} />
      <section className="metrics" aria-label={t('Indicadores')}>
        <div className="metric card"><div className="lbl">{t('Facturación prevista')}</div><div className="val">{money(d.forecast.revenue)}</div><div className="note">{t('{n} eventos confirmados próximos', { n: d.forecast.events })}</div></div>
        <div className="metric card"><div className="lbl">{t('Coste previsto')}</div><div className="val">{money(d.forecast.cost)}</div><div className="note">{t('Comida + personal + logística')}</div></div>
        <div className="metric card"><div className="lbl">{t('Beneficio previsto')}</div><div className={`val ${Number(d.forecast.profit) < 0 ? 'neg' : ''}`}>{money(d.forecast.profit)}</div><div className="note">{t('Margen')} {pct(d.forecast.margin_pct)}</div></div>
        <div className="metric card"><div className="lbl">{t('Resultado real cerrado')}</div><div className={`val ${Number(d.actual.profit) < 0 ? 'neg' : ''}`}>{money(d.actual.profit)}</div><div className="note">{t('{n} eventos cerrados · margen', { n: d.actual.events })} {pct(d.actual.margin_pct)}</div></div>
      </section>
      {(d.attention.length > 0 || d.missing_prices > 0 || d.pending_documents > 0 || d.pending_purchases > 0) && (
        <section className="card panel" style={{ marginBottom: 14 }} aria-label={t('Avisos')}>
          <div className="panel-head"><h3>{t('Avisos')}</h3></div>
          <ul className="list">
            {d.attention.map((a: any) => <li key={a.event_id + a.issue} className="row"><span>⚠ {a.title}: {t('alérgenos del menú sin revisar')}</span><Link className="btn light sm" to={`/eventos/${a.event_id}`}>{t('Abrir')}</Link></li>)}
            {d.missing_prices > 0 && <li className="row"><span>⚠ {t('{n} ingredientes sin precio: los escandallos estarán incompletos', { n: d.missing_prices })}</span><Link className="btn light sm" to="/ingredientes">{t('Revisar')}</Link></li>}
            {d.pending_purchases > 0 && <li className="row"><span>⇅ {t('{n} compras pendientes de recibir', { n: d.pending_purchases })}</span><Link className="btn light sm" to="/compras?tab=purchases">{t('Ver')}</Link></li>}
            {d.pending_documents > 0 && <li className="row"><span>⎙ {t('{n} documentos pendientes de revisión', { n: d.pending_documents })}</span><Link className="btn light sm" to="/documentos">{t('Revisar')}</Link></li>}
          </ul>
        </section>
      )}
      <section className="grid two">
        <div className="card panel">
          <div className="panel-head"><h3>{t('Próximos servicios')}</h3><Link to="/eventos" className="link-btn">{t('Agenda')}</Link></div>
          {d.upcoming.length ? <ul className="list">{d.upcoming.map((e: any) => (
            <li key={e.id}><Link to={`/eventos/${e.id}`} className="row-link" style={{ padding: '12px 0' }}>
              <div><div className="title-sm">{e.title}</div><div className="muted">{date(e.event_date)} · {t('{n} comensales', { n: e.guest_count })} · {e.client_name}</div></div>
              <div className="right"><StatusPill status={e.status} /><div className="muted num">{money(e.revenue_net)}</div></div>
            </Link></li>))}</ul> : <Empty title={t('Agenda vacía')} desc={t('No hay eventos próximos.')} action={<Link className="btn light" to="/eventos/nuevo">{t('Crear evento')}</Link>} />}
        </div>
        <div className="card panel">
          <div className="panel-head"><h3>{t('Rentabilidad por mes')}</h3><Link to="/informes" className="link-btn">{t('Informes')}</Link></div>
          <p className="muted">{t('Barra: ingresos netos. Verde: beneficio previsto.')}</p>
          {d.by_month.length ? d.by_month.map((m: any) => (
            <div key={m.month} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 92px', gap: 10, alignItems: 'center', margin: '8px 0' }}>
              <span className="muted num">{m.month}</span>
              <div className="bar" style={{ background: '#e6eee9' }} title={money(m.revenue)}><span style={{ width: `${Math.max(0, Number(m.revenue) / maxRev * 100)}%`, background: '#cfe0d5', position: 'relative' }}><span style={{ display: 'block', height: '100%', width: `${Number(m.revenue) > 0 ? Math.max(0, Math.min(100, Number(m.profit) / Number(m.revenue) * 100)) : 0}%`, background: 'var(--sage)' }} /></span></div>
              <span className="num right strong">{money(m.profit)}</span>
            </div>)) : <Empty title={t('Sin datos todavía')} />}
        </div>
      </section>
      {d.price_alerts.length > 0 && (
        <section className="card panel" style={{ marginTop: 14 }}>
          <div className="panel-head"><h3>{t('Variaciones de precio')}</h3><Link to="/ingredientes" className="link-btn">{t('Ingredientes')}</Link></div>
          <ul className="list">{d.price_alerts.map((a: any) => (
            <li key={a.format_id} className="row"><Link to={`/ingredientes/${a.ingredient_id}`}>{a.ingredient_name}</Link>
              <span className="num">{a.format_changed && <span className="pill warn" style={{ marginRight: 6 }}>{t('Formato cambiado')}</span>}<span className={Number(a.change_pct) > 0 ? 'neg strong' : 'pos strong'}>{Number(a.change_pct) > 0 ? '+' : ''}{pct(a.change_pct)}</span> <span className="muted">{date(a.effective_at)}</span></span></li>))}</ul>
        </section>
      )}
      <p className="footnote">{t('Cifras sin IVA. Los eventos presupuestados o confirmados usan su foto financiera congelada; los borradores se calculan con precios actuales. No sustituye a la contabilidad oficial.')}</p>
    </>
  );
}
