import { cardService } from "../services/cards";
import type { Card } from "../types";
import { PaginatedListState } from "./paginatedList.svelte";

export type CardFilters = {
    type: string;
    status: string;
    search: string;
    dependencyId: string;
};

export class CardState {
    pagination = new PaginatedListState<Card>();

    /** Filtros unificados. */
    filters: CardFilters = $state({
        type: "Todos",
        status: "Todas",
        search: "",
        dependencyId: "",
    });

    /** Carga la primera página con los filtros actuales. */
    async init() {
        await this.refresh();
    }

    /** Libera recursos. */
    destroy() {
        // sin suscripciones propias que limpiar
    }

    async refresh(page?: number) {
        await this.pagination.fetchPage(
            (p, s) => cardService.fetchAll(p, s, this.filters.search, this.filters.type, this.filters.status, this.filters.dependencyId),
            page,
        );
    }

    setFilters(type: string, status: string, depId: string = "") {
        this.filters.type = type;
        this.filters.status = status;
        this.filters.dependencyId = depId;
        this.pagination.currentPage = 1;
    }

    setSearch(query: string) {
        this.filters.search = query;
        this.pagination.currentPage = 1;
    }

    nextPage() {
        if (this.pagination.nextPage()) {
            this.refresh(this.pagination.currentPage);
        }
    }

    prevPage() {
        if (this.pagination.prevPage()) {
            this.refresh(this.pagination.currentPage);
        }
    }

    goToPage(page: number) {
        if (this.pagination.goToPage(page)) {
            this.refresh(this.pagination.currentPage);
        }
    }

    // Las suscripciones se manejan vía Supabase Realtime
    // en initGlobalRealtime() + PersonnelState.initRealtime()
}

export const cardState = new CardState();
