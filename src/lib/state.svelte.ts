export class AppState {
    activePage = $state('Dashboard');
    isSidebarOpen = $state(false);

    // Global Data
    personnel = $state<any[]>([]);
    extraCards = $state<any[]>([]);
    pendingItems = $state<any[]>([]);

    // Catalogs
    dependencies = $state<any[]>([]);
    buildings = $state<any[]>([]);
    specialAccesses = $state<any[]>([]);
    schedules = $state<any[]>([]);
    filteredHistoryLogs = $state<any[]>([]);
    userProfile = $state<{ id: string, role: 'admin' | 'operator' | 'viewer', full_name: string, email: string } | null>(null);

    setActivePage(page: string) {
        this.activePage = page;
    }

    toggleSidebar() {
        this.isSidebarOpen = !this.isSidebarOpen;
    }

    setData(key: string, data: any) {
        (this as any)[key] = data;
    }
}

export const appState = new AppState();
