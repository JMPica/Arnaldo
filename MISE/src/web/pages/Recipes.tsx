import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AllergenList, Empty, ErrorBox, Loading, PageHead, ReviewPill, Seg } from '../components/ui';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';

export default function Recipes() {
  const { t, money, num } = useI18n();
  const [filter, setFilter] = useState('');
  const [view, setView] = useState<'active' | 'archived'>('active');
  const q = useQuery({ queryKey: ['recipes', view], queryFn: () => api.get(`/recipes${view === 'archived' ? '?archived=1' : ''}`) });
  const list = useMemo(() => ((q.data ?? []) as any[]).filter((r) => !filter || `${r.name} ${r.category ?? ''}`.toLowerCase().includes(filter.toLowerCase())), [q.data, filter]);
  return (
    <>
      <PageHead kicker={t('Biblioteca culinaria')} title={t('Recetas y fichas técnicas')} sub={t('Escandallos vivos: al cambiar un precio cambia el coste de cada plato (los presupuestos confirmados no).')}
        actions={<Link className="btn" to="/recetas/nueva">＋ {t('Nueva receta')}</Link>} />
      <div className="toolbar">
        <input className="search" type="search" placeholder={t('Buscar receta o categoría…')} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t('Buscar')} />
        <Seg value={view} onChange={setView} label={t('Estado')} options={[['active', t('Activas')], ['archived', t('Archivadas')]]} />
      </div>
      {q.isError ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : !q.data ? <Loading /> : !list.length ? (
        <div className="card"><Empty title={t('Tu recetario está vacío')} desc={t('Crea elaboraciones y asigna ingredientes o subrecetas.')} action={<Link className="btn" to="/recetas/nueva">{t('Crear receta')}</Link>} /></div>
      ) : (
        <div className="cards">{list.map((r) => (
          <Link key={r.id} to={`/recetas/${r.id}`} className="card item">
            <div className="actions"><span className="pill draft">{r.category || t('Receta')}</span>{r.uses_subrecipes && <span className="pill quoted">{t('Con subrecetas')}</span>}{!r.complete && <span className="pill warn">{r.error === 'recipe_cycle' ? t('Ciclo') : t('Incompleta')}</span>}</div>
            <h3 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500 }}>{r.name}</h3>
            <div className="muted">{t('{n} raciones', { n: num(r.portions) })} · {t('{n} líneas', { n: r.lines_count })}{r.yield_quantity ? ` · ${t('rinde')} ${num(r.yield_quantity)} ${r.yield_unit}` : ''}</div>
            <div className="muted"><AllergenList list={r.allergens} /></div>
            <div className="foot"><div><div className="muted">{t('Coste por ración')}</div><div className="strong num" style={{ fontSize: 18 }}>{money(r.portion_cost)}</div></div><ReviewPill state={r.allergen_review} /></div>
          </Link>))}</div>
      )}
    </>
  );
}
