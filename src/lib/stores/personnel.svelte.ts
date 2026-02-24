import type { Person, Card } from "../types";

export class PersonnelState {
    personnel = $state<Person[]>([]);
    personnelOptions = $state<{ id: string, name: string, employee_no: string }[]>([]);
    selectedPersonId = $state<string | null>(null);
    extraCards = $state<Card[]>([]);
    isDetailsOpen = $state(false);
    editingPerson = $state<Person | null>(null);
    isEditModalOpen = $state(false);
    highlightedCardId = $state<string | null>(null);

    currentPage = $state(1);
    pageSize = $state(50);
    totalRecords = $state(0);
    searchQuery = $state("");
    statusFilter = $state("Todos");
    dependencyId = $state("");
    isLoading = $state(false);
    dashboardStats = $state({
        activePersonnel: 0,
        koneStock: 0,
        p2000Stock: 0
    });

    setPersonnel(data: Person[], count: number) {
        this.personnel = data;
        this.totalRecords = count;
    }

    setPersonnelOptions(data: { id: string, name: string, employee_no: string }[]) {
        this.personnelOptions = data;
    }

    async refreshDashboardStats() {
        try {
            const { personnelService } = await import("../services/personnel");
            const stats = await personnelService.fetchDashboardStats();
            this.dashboardStats = stats;
        } catch (error) {
            console.error("Error refreshing dashboard stats:", error);
        }
    }

    async refresh(page: number = 1, search: string = "", status: string = "Todos", depId: string = "") {
        this.isLoading = true;
        this.currentPage = page;
        this.searchQuery = search;
        this.statusFilter = status;
        this.dependencyId = depId;

        try {
            const { personnelService } = await import("../services/personnel");
            const { data, count } = await personnelService.fetchAll(
                this.currentPage,
                this.pageSize,
                this.searchQuery,
                this.statusFilter,
                this.dependencyId
            );
            this.setPersonnel(data, count);
        } finally {
            this.isLoading = false;
        }
    }

    async nextPage() {
        if (this.currentPage * this.pageSize < this.totalRecords) {
            await this.refresh(this.currentPage + 1, this.searchQuery, this.statusFilter, this.dependencyId);
        }
    }

    async prevPage() {
        if (this.currentPage > 1) {
            await this.refresh(this.currentPage - 1, this.searchQuery, this.statusFilter, this.dependencyId);
        }
    }

    async goToPage(page: number) {
        await this.refresh(page, this.searchQuery, this.statusFilter, this.dependencyId);
    }

    async search(query: string) {
        await this.refresh(1, query, this.statusFilter, this.dependencyId);
    }

    async filter(status: string, depId: string) {
        await this.refresh(1, this.searchQuery, status, depId);
    }

    setCards(data: Card[]) {
        this.extraCards = data;
    }

    selectPerson(id: string | null) {
        this.selectedPersonId = id;
        this.isDetailsOpen = !!id;
    }

    setDetailsOpen(open: boolean) {
        this.isDetailsOpen = open;
        if (!open) this.selectedPersonId = null;
    }

    openEditModal(person: Person | null) {
        this.editingPerson = person;
        this.isEditModalOpen = true;
        this.setDetailsOpen(false); // Close details when editing
    }

    closeEditModal() {
        this.isEditModalOpen = false;
        this.editingPerson = null;
    }
}

export const personnelState = new PersonnelState();
