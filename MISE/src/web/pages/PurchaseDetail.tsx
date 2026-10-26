import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ErrorBox, Loading, PageHead, StatusPill, useConfirm, useErrorText, useToast } from '../components/ui';
import { api, newKey } from '../lib/api';
import { useI18n } from '../lib/i18n';

export default function PurchaseDetail() {
  const { id } = useParams();
  const { t, money, num, date } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const errText = useErrorText();
  const { ask, node } = useConfirm();
  const q = useQuery({ queryKey: ['purchase', id], queryFn: () => api.get(`/purchases/${id}`) });
  const [rx, setRx] = useState<Record<string, string>>({});
  const [key, setKey] = useState(newKey());
  const receive = useMutation({
    mutationFn: () => api.post(`/purchases/${id}/receive`, { idempotency_key: key, received_at: new Date().toISOString().slice(0, 10), lines: Object.entries(rx).filter(([, v]) => Number(v.replace(',', '.')) > 0).map(([line_id, packs]) => ({ line_id, packs })) }),
    onSuccess: () => { qc.invalidateQueries(); setRx({}); setKey(newKey()); toast(t('Recepción registrada en stock')); },
    onError: (e) => toast(errText(e), 'error'),
  });
  const cancel = useMutation({ mutationFn: () => api.post(`/purchases/${id}/cancel`), onSuccess: () => qc.invalidateQueries(), onError: (e) => toast(errText(e), 'error') });
  if (q.isError) return <ErrorBox error={q.error} />;
  if (!q.data) return <Loading />;
  const p = q.data;
  const total = p.lines.reduce((a: number, l: any) => a + Number(l.ordered_packs) * Number(l.pack_price), 0);
  const open = ['ordered', 'partial'].includes(p.status);
  return (
    <>
      <PageHead back={{ to: '/compras?tab=purchases', label: t('Compras') }} kicker={date(p.purchase_date)} title={`${p.supplier?.name ?? t('Compra')}${p.external_reference ? ` · ${p.external_reference}` : ''}`} sub={<StatusPill status={p.status} />}
        actions={<>{p.document_id && <Link className="btn light" to={`/documentos/${p.document_id}`}>{t('Ver documento')}</Link>}{p.status === 'ordered' && <button className="btn danger" onClick={async () => { if (await ask(t('¿Cancelar este pedido?'))) cancel.mutate(); }}>{t('Cancelar pedido')}</button>}</>} />
      <section className="card">
        <div className="table-wrap"><table><thead><tr><th>{t('Ingrediente')}</th><th>{t('Formato')}</th><th className="num">{t('Pedido')}</th><th className="num">{t('Recibido')}</th><th className="num">{t('Precio')}</th><th className="num">{t('Total')}</th>{open && <th>{t('Recibir ahora')}</th>}</tr></thead>
          <tbody>{p.lines.map((l: any) => {
            const pending = Number(l.ordered_packs) - Number(l.received_packs);
            return <tr key={l.id}><td><Link to={`/ingredientes/${l.ingredient_id}`}>{l.ingredient_name}</Link>{l.description && <div className="muted">{l.description}</div>}</td><td>{l.format_label ?? '—'} <span className="muted">({num(l.pack_quantity_base)} {l.base_unit})</span></td>
              <td className="num">{num(l.ordered_packs)}</td><td className="num">{num(l.received_packs)}</td><td className="num">{money(l.pack_price)}</td><td className="num strong">{money(Number(l.ordered_packs) * Number(l.pack_price))}</td>
              {open && <td>{pending > 0 ? <input aria-label={t('Envases a recibir')} inputMode="decimal" style={{ maxWidth: 110 }} placeholder={String(pending)} value={rx[l.id] ?? ''} onChange={(e) => setRx({ ...rx, [l.id]: e.target.value })} /> : '✓'}</td>}</tr>;
          })}<tr><td colSpan={5} className="strong">{t('Total sin IVA')}</td><td className="num strong">{money(total)}</td>{open && <td />}</tr></tbody></table></div>
      </section>
      {open && <div className="actions" style={{ marginTop: 12 }}>
        <button className="btn light" onClick={() => setRx(Object.fromEntries(p.lines.map((l: any) => [l.id, String(Number(l.ordered_packs) - Number(l.received_packs))]).filter(([, v]: any) => Number(v) > 0)))}>{t('Rellenar todo lo pendiente')}</button>
        <button className="btn" disabled={receive.isPending || !Object.values(rx).some((v) => Number(v.replace(',', '.')) > 0)} onClick={() => receive.mutate()}>{t('Registrar recepción')}</button>
      </div>}
      <p className="footnote">{t('Las recepciones son idempotentes: un reintento no duplica el stock. Se admiten recepciones parciales.')}</p>
      {node}
    </>
  );
}
