import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Empty, ErrorBox, Loading, PageHead, ReviewPill } from '../components/ui';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';

export default function Menus() {
  const { t, money } = useI18n();
  const q = useQuery({ queryKey: ['menus'], queryFn: () => api.get('/menus') });
  return (
    <>
      <PageHead kicker={t('Diseño de experiencias')} title={t('Menús degustación')} sub={t('Pases, raciones por comensal y alternativas dietéticas. Coste por comensal siempre interno.')}
        actions={<Link className="btn" to="/menus/nuevo">＋ {t('Nuevo menú')}</Link>} />
      {q.isError ? <ErrorBox error={q.error} /> : !q.data ? <Loading /> : !q.data.length ? <div className="card"><Empty title={t('Sin menús')} desc={t('Crea un menú con tus recetas.')} action={<Link className="btn" to="/menus/nuevo">{t('Crear menú')}</Link>} /></div> : (
        <div className="cards">{(q.data as any[]).map((m) => {
          const courses = [...new Set(m.lines.map((l: any) => l.position))].length;
          return (
            <Link key={m.id} to={`/menus/${m.id}`} className="card item">
              <div className="actions"><span className="pill draft">{m.kind === 'tasting' ? t('Degustación') : t('Por pases')}</span>{m.variants.map((v: string) => <span key={v} className="pill quoted">{v}</span>)}</div>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500 }}>{m.name}</h3>
              <div className="muted">{t('{n} pases', { n: courses })} · v{m.version}</div>
              <div>{m.lines.filter((l: any) => !l.variant).slice(0, 5).map((l: any) => <span key={l.id} className="chip">{l.recipe_name}</span>)}</div>
              <div className="foot"><div><div className="muted">{t('Coste por comensal')}</div><div className="strong num" style={{ fontSize: 18 }}>{money(m.cost_per_guest.base?.per_guest)}</div></div><ReviewPill state={m.allergen_review} /></div>
            </Link>);
        })}</div>
      )}
    </>
  );
}
