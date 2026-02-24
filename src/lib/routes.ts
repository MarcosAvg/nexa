
import DashboardView from './views/DashboardView.svelte';
import PersonnelView from './views/PersonnelView.svelte';
import CardsView from './views/CardsView.svelte';
import TicketsView from './views/TicketsView.svelte';
import HistoryView from './views/HistoryView.svelte';
import SettingsView from './views/SettingsView.svelte';

// NOTE: svelte-spa-router requires the `wrap()` helper for lazy loading.
// Keeping eager imports for now to ensure compatibility with all router versions.
export const routes = {
    '/': DashboardView,
    '/dashboard': DashboardView,
    '/personal': PersonnelView,
    '/cards': CardsView,
    '/tickets': TicketsView,
    '/history': HistoryView,
    '/settings': SettingsView,
    // Catch-all route last
    '*': DashboardView
};
