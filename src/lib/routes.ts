
import DashboardView from './views/DashboardView.svelte';
import PersonnelView from './views/PersonnelView.svelte';
import CardsView from './views/CardsView.svelte';
import TicketsView from './views/TicketsView.svelte';
import HistoryView from './views/HistoryView.svelte';
import SettingsView from './views/SettingsView.svelte';
import EnlacesView from './views/EnlacesView.svelte';
import RegistroSinTarjetaView from './views/RegistroSinTarjetaView.svelte';

// ⚠ svelte-spa-router requiere el helper wrap() para lazy loading.
// Se mantienen imports eager para compatibilidad con todas las versiones del router.
export const routes = {
    '/': DashboardView,
    '/dashboard': DashboardView,
    '/personal': PersonnelView,
    '/cards': CardsView,
    '/tickets': TicketsView,
    '/history': HistoryView,
    '/settings': SettingsView,
    '/enlaces': EnlacesView,
    '/registro-sin-tarjeta': RegistroSinTarjetaView,
    // Catch-all route last
    '*': DashboardView
};
