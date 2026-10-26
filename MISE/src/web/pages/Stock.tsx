import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Empty, ErrorBox, Loading, PageHead } from '../components/ui';
import { api, download } from '../lib/api';
import { useI18n } from '../lib/i18n';

export default function Stock() {
  const { t, money, num, date } = useI18n();
  const [filter, setFilter] = useState('');
  const q = useQuery({ queryKey: ['stock'], queryFn: () => api.get('/stock') });
  const moves = useQuery({ queryKey: ['movements'], queryFn: () => api.get('/stock/movements') });
  const list = ((q.data ?? []) as any[]).filter((r) => (Number(r.on_hand) !== 0 || Number(r.reserved) !== 0 || filter) && (!filter || r.name.toLowerCase().includes(filter.toLowerCase())));
  const value = list.reduce((a, r) => a + (Number(r.value) || 0), 0);
  const kinds: Record<string, string> = { opening: t('Inicial'), receipt: t('Recepción'), consumption: t('Consumo'), waste: t('Merma'), adjustment: t('Ajuste'), reservation: t('Reserva'), reservation_release: t('Liberación') };
  return (
    <>
      <PageHead kicker={t('Aprovisionamiento')} title={t('Inventario')} sub={t('Existencias calculadas desde el libro de movimientos (nunca un campo editable).')} actions={<button className="btn light" onClick={() => download('/exports/csv/stock', 'stock.csv')}>{t('Exportar movimientos CSV')}</button>} />
      <div className="toolbar"><input className="search" type="search" placeholder={t('Buscar ingrediente…')} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t('Buscar')} /><span className="pill">{t('Valor aproximado')}: {money(value)}</span></div>
      {q.isError ? <ErrorBox error={q.error} /> : !q.data ? <Loading /> : !list.length ? <div className="card"><Empty title={t('Sin existencias registradas')} desc={t('Recibe compras o registra un stock inicial desde la ficha del ingrediente.')} /></div> : (
        <div className="card"><div className="table-wrap"><table><thead><tr><th>{t('Ingrediente')}</th><th className="num">{t('Físico')}</th><th className="num">{t('Reservado')}</th><th className="num">{t('Disponible')}</th><th className="num">{t('Valor')}</th></tr></thead>
          <tbody>{list.map((r) => <tr key={r.ingredient_id}><td><Link to={`/ingredientes/${r.ingredient_id}`}>{r.name}</Link><div className="muted">{r.category ?? ''}</div></td><td className="num">{num(r.on_hand, 1)} {r.base_unit}</td><td className="num">{num(r.reserved, 1)}</td><td className="num strong">{num(r.available, 1)}</td><td className="num">{r.value ? money(r.value) : '—'}</td></tr>)}</tbody></table></div></div>
      )}
      <section className="card panel" style={{ marginTop: 14 }}>
        <h3>{t('Últimos movimientos')}</h3>
        {(moves.data ?? []).length ? <ul className="list">{(moves.data as any[]).slice(0, 40).map((m) => <li key={m.id} className="row"><div><div>{m.ingredient_name} · {kinds[m.kind]}</div><div className="muted">{date(m.occurred_at)} {m.notes ? `· ${m.notes}` : ''}</div></div><span className="num strong">{['consumption', 'waste'].includes(m.kind) ? '−' : ''}{num(m.quantity_base, 1)} {m.base_unit}</span></li>)}</ul> : <p className="muted">{t('Sin movimientos.')}</p>}
      </section>
    </>
  );
}
