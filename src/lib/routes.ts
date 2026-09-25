import { wrap } from 'svelte-spa-router/wrap';
import RouteFallback from './components/RouteFallback.svelte';
import { moduleRoutes } from './modules/generated';

// Lazy loading por ruta: cada vista se carga bajo demanda (code-splitting).
// `wrap` permite `asyncComponent` + un placeholder mientras carga.
const lazy = (asyncComponent: () => Promise<any>): any =>
    wrap({ asyncComponent, loadingComponent: RouteFallback as any });

export const routes = {
    '/': lazy(() => import('./views/DashboardView.svelte')),
    '/dashboard': lazy(() => import('./views/DashboardView.svelte')),
    '/personal': lazy(() => import('./views/PersonnelView.svelte')),
    '/cards': lazy(() => import('./views/CardsView.svelte')),
    '/tickets': lazy(() => import('./views/TicketsView.svelte')),
    '/history': lazy(() => import('./views/HistoryView.svelte')),
    '/settings': lazy(() => import('./views/SettingsView.svelte')),
    '/enlaces': lazy(() => import('./views/EnlacesView.svelte')),
    // Rutas de módulos compilados (generated.ts bajo VITE_MODULES)
    ...moduleRoutes,
    // Catch-all route last
    '*': lazy(() => import('./views/DashboardView.svelte')),
};
