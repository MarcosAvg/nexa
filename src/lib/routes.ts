
import DashboardView from './views/DashboardView.svelte';
import PersonnelView from './views/PersonnelView.svelte';
import CardsView from './views/CardsView.svelte';
import TicketsView from './views/TicketsView.svelte';
import HistoryView from './views/HistoryView.svelte';
import SettingsView from './components/SettingsView.svelte';

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
