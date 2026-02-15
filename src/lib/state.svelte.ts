import type { Person, Card, Ticket, UserProfile, CatalogItem } from './types';

export class AppState {
    activePage = $state('Dashboard');
    isSidebarOpen = $state(false);

    // Global Data
    personnel = $state<Person[]>([]);
    extraCards = $state<Card[]>([]);
    pendingItems = $state<Ticket[]>([]);

    // Catalogs
    dependencies = $state<CatalogItem[]>([]);
    buildings = $state<CatalogItem[]>([]);
    specialAccesses = $state<CatalogItem[]>([]);
    schedules = $state<CatalogItem[]>([]);
    filteredHistoryLogs = $state<any[]>([]); // To be typed later
    userProfile = $state<UserProfile | null>(null);

    setActivePage(page: string) {
        this.activePage = page;
    }

    toggleSidebar() {
        this.isSidebarOpen = !this.isSidebarOpen;
    }

    // Generic setter with type safeguards could be better, but for now we keep it simple
    // to match existing usage in App.svelte which passes strings dynamically.
    setData<K extends keyof AppState>(key: K, data: AppState[K]) {
        (this as any)[key] = data;
    }
}

export const appState = new AppState();
