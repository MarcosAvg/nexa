import { wrap } from 'svelte-spa-router/wrap';
import { push } from 'svelte-spa-router';
import RouteFallback from './components/RouteFallback.svelte';
import { moduleRoutes } from './modules/generated';
import { userState } from './stores';
import { canAccessRoute } from './routeAccess';

// Guard de rol: bloquea la navegación (y la descarga del chunk) si el rol
// actual no puede ver la ruta, redirigiendo al Dashboard.
const guard =
    (path: string) =>
    (_detail: unknown): boolean => {
        if (!canAccessRoute(path, userState.profile?.role)) {
            void push('/');
            return false;
        }
        return true;
    };

// Lazy loading por ruta: cada vista se carga bajo demanda (code-splitting).
// `wrap` permite `asyncComponent` + un placeholder mientras carga.
const lazy = (path: string, asyncComponent: () => Promise<any>): any =>
    wrap({ asyncComponent, loadingComponent: RouteFallback as any, conditions: [guard(path)] });

// Rutas de módulos compilados: se re-envuelven para aplicar el mismo guard
// (generated.ts no se edita a mano). OJO: `wrap()` devuelve el loader en
// `component` (no en `asyncComponent`); hay que reinyectarlo como
// `asyncComponent` o el router renderiza en blanco.
const guardedModuleRoutes: Record<string, any> = Object.fromEntries(
    Object.entries(moduleRoutes).map(([path, route]: [string, any]) => [
        path,
        wrap({
            asyncComponent: route.component ?? route.asyncComponent,
            loadingComponent: RouteFallback as any,
            ...(route.userData ? { userData: route.userData } : {}),
            ...(route.props ? { props: route.props } : {}),
            conditions: [guard(path)],
        }),
    ]),
);

export const routes = {
    '/': lazy('/', () => import('./views/DashboardView.svelte')),
    '/dashboard': lazy('/dashboard', () => import('./views/DashboardView.svelte')),
    '/personal': lazy('/personal', () => import('./views/PersonnelView.svelte')),
    '/cards': lazy('/cards', () => import('./views/CardsView.svelte')),
    '/tickets': lazy('/tickets', () => import('./views/TicketsView.svelte')),
    '/history': lazy('/history', () => import('./views/HistoryView.svelte')),
    '/settings': lazy('/settings', () => import('./views/SettingsView.svelte')),
    '/enlaces': lazy('/enlaces', () => import('./views/EnlacesView.svelte')),
    // Rutas de módulos compilados (generated.ts bajo VITE_MODULES)
    ...guardedModuleRoutes,
    // Catch-all route last
    '*': lazy('/', () => import('./views/DashboardView.svelte')),
};
