export class UIState {
    activePage = $state("Dashboard");
    isSidebarOpen = $state(false);
    isSidebarCondensed = $state(false);
    isDirectEditMode = $state(false);

    setActivePage(page: string) {
        this.activePage = page;
    }

    toggleSidebar() {
        this.isSidebarOpen = !this.isSidebarOpen;
    }

    toggleSidebarCondensed() {
        this.isSidebarCondensed = !this.isSidebarCondensed;
    }

    toggleDirectEditMode() {
        this.isDirectEditMode = !this.isDirectEditMode;
    }

    openSidebar() {
        this.isSidebarOpen = true;
    }

    closeSidebar() {
        this.isSidebarOpen = false;
    }
}

export const uiState = new UIState();
