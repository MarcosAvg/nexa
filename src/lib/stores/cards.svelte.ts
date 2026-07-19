import { cardService } from "../services/cards";
import { appEvents, EVENTS } from "../utils";
import type { Card } from "../types";

export class CardState {
    cards = $state<Card[]>([]);
    currentPage = $state(1);
    pageSize = $state(50);
    totalRecords = $state(0);
    isLoading = $state(false);

    // Filtros
    statusFilter = $state("Todas");
    typeFilter = $state("Todos");
    searchQuery = $state("");
    dependencyFilter = $state("");

    totalPages = $derived(Math.ceil(this.totalRecords / this.pageSize));

    async refresh(page?: number) {
        this.isLoading = true;
        if (page !== undefined) this.currentPage = page;
        try {
            const result = await cardService.fetchAll(
                this.currentPage,
                this.pageSize,
                this.searchQuery,
                this.typeFilter,
                this.statusFilter,
                this.dependencyFilter,
            );
            this.cards = result.data;
            this.totalRecords = result.count;
        } finally {
            this.isLoading = false;
        }
    }

    setFilters(type: string, status: string, depId: string = "") {
        this.typeFilter = type;
        this.statusFilter = status;
        this.dependencyFilter = depId;
        this.currentPage = 1;
    }

    setSearch(query: string) {
        this.searchQuery = query;
        this.currentPage = 1;
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.refresh(this.currentPage + 1);
        }
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.refresh(this.currentPage - 1);
        }
    }

    goToPage(page: number) {
        if (page >= 1 && page <= this.totalPages) {
            this.refresh(page);
        }
    }

    initSubscriptions() {
        const unsubs: (() => void)[] = [];

        unsubs.push(
            appEvents.on(EVENTS.CARDS_CHANGED, () => this.refresh(this.currentPage)),
            appEvents.on(EVENTS.PERSONNEL_CHANGED, () => this.refresh(this.currentPage)),
        );

        return () => unsubs.forEach(fn => fn());
    }
}

export const cardState = new CardState();
