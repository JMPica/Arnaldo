import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { Sheet } from './ui';

export interface NavItem { to: string; label: string; ico: string }

export function useNav() {
  const { t } = useI18n();
  const main: NavItem[] = [
    { to: '/', label: t('Resumen'), ico: '◫' },
    { to: '/eventos', label: t('Eventos'), ico: '▣' },
    { to: '/clientes', label: t('Clientes'), ico: '☺' },
    { to: '/menus', label: t('Menús'), ico: '▤' },
    { to: '/recetas', label: t('Recetas'), ico: '♧' },
    { to: '/ingredientes', label: t('Ingredientes'), ico: '◈' },
    { to: '/proveedores', label: t('Proveedores'), ico: '⌂' },
    { to: '/compras', label: t('Compras'), ico: '✓' },
    { to: '/inventario', label: t('Inventario'), ico: '▥' },
    { to: '/documentos', label: t('Documentos'), ico: '⎙' },
    { to: '/informes', label: t('Rentabilidad'), ico: '↗' },
    { to: '/ajustes', label: t('Ajustes y datos'), ico: '⚙' },
  ];
  return main;
}

function SearchSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const res = useQuery({ queryKey: ['search', q], queryFn: () => api.get<{ type: string; id: string; label: string }[]>(`/search?q=${encodeURIComponent(q)}`), enabled: q.trim().length >= 2 });
  const route: Record<string, string> = { ingredient: '/ingredientes/', recipe: '/recetas/', menu: '/menus/', client: '/clientes/', event: '/eventos/', supplier: '/proveedores?id=' };
  const typeLabel: Record<string, string> = { ingredient: t('Ingrediente'), recipe: t('Receta'), menu: t('Menú'), client: t('Cliente'), event: t('Evento'), supplier: t('Proveedor') };
  return (
    <Sheet title={t('Buscar')} onClose={onClose}>
      <input type="search" autoFocus placeholder={t('Ingrediente, receta, menú, cliente, evento…')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('Buscar')} />
      <ul className="list" style={{ marginTop: 10 }}>
        {(res.data ?? []).map((r) => (
          <li key={r.type + r.id}><button className="row-link" style={{ width: '100%', background: 'none', border: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => { nav(route[r.type] + r.id); onClose(); }}>
            <span>{r.label}</span><span className="pill draft">{typeLabel[r.type]}</span>
          </button></li>
        ))}
        {q.trim().length >= 2 && res.data?.length === 0 && <li className="muted" style={{ padding: 12 }}>{t('Sin resultados')}</li>}
      </ul>
    </Sheet>
  );
}

export function Layout({ children, brand }: { children: ReactNode; brand: string }) {
  const { t } = useI18n();
  const items = useNav();
  const [search, setSearch] = useState(false);
  const [more, setMore] = useState(false);
  const loc = useLocation();
  useEffect(() => { setMore(false); window.scrollTo(0, 0); }, [loc.pathname]);
  const tab = (to: string) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to));
  const mobileTabs = [items[0]!, items[1]!, items[4]!, items[7]!];
  const moreActive = !mobileTabs.some((i) => tab(i.to));
  return (
    <div className="shell">
      <aside className="sidebar" aria-label={t('Navegación principal')}>
        <Link to="/" className="brand">{brand.toUpperCase() === 'MISE' ? <>MISE<span>.</span></> : brand}</Link>
        <div className="brand-sub">Private Chef OS</div>
        <button className="search-btn" onClick={() => setSearch(true)}>⌕ {t('Buscar')}…</button>
        <nav>
          <div className="nav-label">{t('Operación')}</div>
          {items.slice(0, 3).map((i) => <NavLink key={i.to} to={i.to} end={i.to === '/'}><span className="ico">{i.ico}</span>{i.label}</NavLink>)}
          <div className="nav-label">{t('Cocina')}</div>
          {items.slice(3, 7).map((i) => <NavLink key={i.to} to={i.to}><span className="ico">{i.ico}</span>{i.label}</NavLink>)}
          <div className="nav-label">{t('Aprovisionamiento')}</div>
          {items.slice(7, 10).map((i) => <NavLink key={i.to} to={i.to}><span className="ico">{i.ico}</span>{i.label}</NavLink>)}
          <div className="nav-label">{t('Gestión')}</div>
          {items.slice(10).map((i) => <NavLink key={i.to} to={i.to}><span className="ico">{i.ico}</span>{i.label}</NavLink>)}
        </nav>
        <div className="foot">{t('Acceso privado · Datos en tu base de datos')}</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <Link to="/" className="brand" aria-label="MISE">MISE<span>.</span></Link>
          <span className="brand-sub">Private Chef OS</span>
          <span className="spacer" />
          <button className="icon-btn" onClick={() => setSearch(true)} aria-label={t('Buscar')}>⌕</button>
        </header>
        <main className="content" id="main">{children}</main>
      </div>
      <nav className="tabbar" aria-label={t('Navegación principal')}>
        {mobileTabs.map((i) => <Link key={i.to} to={i.to} className={tab(i.to) ? 'active' : ''} aria-current={tab(i.to) ? 'page' : undefined}><span className="ico">{i.ico}</span>{i.label}</Link>)}
        <button className={moreActive ? 'active' : ''} onClick={() => setMore(true)} aria-haspopup="dialog"><span className="ico">☰</span>{t('Más')}</button>
      </nav>
      {more && (
        <Sheet title={t('Más secciones')} onClose={() => setMore(false)}>
          <div className="nav-sheet">{items.filter((i) => !mobileTabs.includes(i)).map((i) => <Link key={i.to} to={i.to}><span className="ico">{i.ico}</span>{i.label}</Link>)}</div>
        </Sheet>
      )}
      {search && <SearchSheet onClose={() => setSearch(false)} />}
    </div>
  );
}
