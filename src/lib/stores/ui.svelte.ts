export class UIState {
    activePage = $state("Dashboard");
    isSidebarOpen = $state(false);
    isSidebarCondensed = $state(false);
    isDirectEditMode = $state(false);
    isCommandPaletteOpen = $state(false);
    isMoreMenuOpen = $state(false);

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

    toggleCommandPalette() {
        this.isCommandPaletteOpen = !this.isCommandPaletteOpen;
    }

    openCommandPalette() {
        this.isCommandPaletteOpen = true;
    }

    closeCommandPalette() {
        this.isCommandPaletteOpen = false;
    }

    toggleMoreMenu() {
        this.isMoreMenuOpen = !this.isMoreMenuOpen;
    }

    closeMoreMenu() {
        this.isMoreMenuOpen = false;
    }
}

export const uiState = new UIState();
