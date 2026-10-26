import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Empty, ErrorBox, Loading, PageHead, StatusPill, TextField } from '../components/ui';
import { api, download } from '../lib/api';
import { useI18n } from '../lib/i18n';

export default function Reports() {
  const { t, money, pct, date } = useI18n();
  const y = new Date().getFullYear();
  const [from, setFrom] = useState(`${y}-01-01`);
  const [to, setTo] = useState(`${y}-12-31`);
  const q = useQuery({ queryKey: ['report', from, to], queryFn: () => api.get(`/reports/profitability?from=${from}&to=${to}`) });
  return (
    <>
      <PageHead kicker={t('Rentabilidad')} title={t('Informes')} sub={t('Previsto (versión congelada) frente a real (cierre). Importes sin IVA.')} actions={<button className="btn light" onClick={() => download('/exports/csv/profitability', 'rentabilidad.csv')}>{t('Exportar CSV')}</button>} />
      <div className="toolbar"><div style={{ width: 170 }}><TextField label={t('Desde')} type="date" value={from} onChange={setFrom} /></div><div style={{ width: 170 }}><TextField label={t('Hasta')} type="date" value={to} onChange={setTo} /></div></div>
      {q.isError ? <ErrorBox error={q.error} /> : !q.data ? <Loading /> : (
        <>
          <section className="metrics">
            <div className="metric card"><div className="lbl">{t('Ingresos (confirmados y realizados)')}</div><div className="val">{money(q.data.totals.revenue)}</div></div>
            <div className="metric card"><div className="lbl">{t('Coste previsto')}</div><div className="val">{money(q.data.totals.cost)}</div></div>
            <div className="metric card"><div className="lbl">{t('Beneficio previsto')}</div><div className="val">{money(q.data.totals.profit)}</div><div className="note">{t('Margen')} {pct(q.data.totals.margin_pct)} · {t('Food cost')} {pct(q.data.totals.food_cost_pct)}</div></div>
            <div className="metric card"><div className="lbl">{t('Desviación real vs previsto')}</div><div className={`val ${Number(q.data.closed_variance_profit) < 0 ? 'neg' : 'pos'}`}>{money(q.data.closed_variance_profit)}</div><div className="note">{t('En eventos cerrados')}</div></div>
          </section>
          {!q.data.rows.length ? <div className="card"><Empty title={t('Sin eventos en el periodo')} /></div> : (
            <div className="card"><div className="table-wrap"><table><thead><tr><th>{t('Evento')}</th><th>{t('Estado')}</th><th className="num">{t('Ingreso')}</th><th className="num">{t('Beneficio previsto')}</th><th className="num">{t('Margen')}</th><th className="num">{t('Beneficio real')}</th><th className="num">{t('Margen real')}</th></tr></thead>
              <tbody>{(q.data.rows as any[]).map((r) => <tr key={r.id}><td><Link to={`/eventos/${r.id}`}>{r.title}</Link><div className="muted">{date(r.event_date)} · {r.client_name} · {r.source === 'snapshot' ? t('congelado') : t('en vivo')}</div></td><td><StatusPill status={r.status} /></td>
                <td className="num">{money(r.revenue_net)}</td><td className={`num ${Number(r.profit) < 0 ? 'neg' : ''}`}>{money(r.profit)}</td><td className="num">{pct(r.margin_pct)}</td><td className="num strong">{r.actual_profit ? money(r.actual_profit) : '—'}</td><td className="num">{pct(r.actual_margin_pct)}</td></tr>)}</tbody></table></div></div>
          )}
        </>
      )}
    </>
  );
}
