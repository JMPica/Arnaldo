import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Component, StrictMode, Suspense, lazy, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation, useParams } from 'react-router';
import { Layout } from './components/Layout';
import { ErrorBox, Loading, ToastProvider } from './components/ui';
import { api, ApiError } from './lib/api';
import { I18nProvider, type Lang } from './lib/i18n';
import './styles.css';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Events = lazy(() => import('./pages/Events'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const EventNew = lazy(() => import('./pages/EventNew'));
const Clients = lazy(() => import('./pages/Clients'));
const Menus = lazy(() => import('./pages/Menus'));
const MenuEditor = lazy(() => import('./pages/MenuEditor'));
const Recipes = lazy(() => import('./pages/Recipes'));
const RecipeEditor = lazy(() => import('./pages/RecipeEditor'));
const Ingredients = lazy(() => import('./pages/Ingredients'));
const IngredientDetail = lazy(() => import('./pages/IngredientDetail'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Purchasing = lazy(() => import('./pages/Purchasing'));
const PurchaseDetail = lazy(() => import('./pages/PurchaseDetail'));
const Stock = lazy(() => import('./pages/Stock'));
const Documents = lazy(() => import('./pages/Documents'));
const DocumentReview = lazy(() => import('./pages/DocumentReview'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));

/** Evita pantallas en blanco: muestra el error y permite recargar. */
class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  override componentDidUpdate(prev: { resetKey: string }) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  override render() {
    if (this.state.error) return <div className="notice danger" role="alert">Error de la interfaz / Error de la interfície: {this.state.error.message} <button className="link-btn" onClick={() => location.reload()}>↻</button></div>;
    return this.props.children;
  }
}

function RoutedBoundary({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return <ErrorBoundary resetKey={loc.pathname}>{children}</ErrorBoundary>;
}

/** Remonta la pantalla de detalle cuando cambia el :id (evita estado de formulario de otra entidad). */
function Keyed({ C }: { C: React.ComponentType }) {
  const { id } = useParams();
  return <C key={id} />;
}

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2, refetchOnWindowFocus: true },
  },
});

function App() {
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings') });
  const lang: Lang = settings.data?.locale === 'ca' ? 'ca' : 'es';
  if (settings.isError) {
    return <I18nProvider lang="es"><div className="content" style={{ maxWidth: 560 }}><h1 style={{ margin: '40px 0 16px' }}>MISE</h1><ErrorBox error={settings.error} retry={() => settings.refetch()} /></div></I18nProvider>;
  }
  if (!settings.data) return <div className="content"><Loading /></div>;
  document.documentElement.lang = lang;
  return (
    <I18nProvider lang={lang}>
      <ToastProvider>
        <Layout brand={settings.data.brand_name ?? 'MISE'}>
          <RoutedBoundary><Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/eventos" element={<Events />} />
              <Route path="/eventos/nuevo" element={<EventNew />} />
              <Route path="/eventos/:id" element={<Keyed C={EventDetail} />} />
              <Route path="/clientes" element={<Clients />} />
              <Route path="/clientes/:id" element={<Clients />} />
              <Route path="/menus" element={<Menus />} />
              <Route path="/menus/:id" element={<Keyed C={MenuEditor} />} />
              <Route path="/recetas" element={<Recipes />} />
              <Route path="/recetas/:id" element={<Keyed C={RecipeEditor} />} />
              <Route path="/ingredientes" element={<Ingredients />} />
              <Route path="/ingredientes/:id" element={<Keyed C={IngredientDetail} />} />
              <Route path="/proveedores" element={<Suppliers />} />
              <Route path="/compras" element={<Purchasing />} />
              <Route path="/compras/pedidos/:id" element={<Keyed C={PurchaseDetail} />} />
              <Route path="/inventario" element={<Stock />} />
              <Route path="/documentos" element={<Documents />} />
              <Route path="/documentos/:id" element={<Keyed C={DocumentReview} />} />
              <Route path="/informes" element={<Reports />} />
              <Route path="/ajustes" element={<Settings />} />
              <Route path="*" element={<div className="empty"><div className="big">404</div></div>} />
            </Routes>
          </Suspense></RoutedBoundary>
        </Layout>
      </ToastProvider>
    </I18nProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter><App /></BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

// PWA: el service worker solo cachea recursos estáticos con hash (/assets/*), nunca datos de la API.
if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}
