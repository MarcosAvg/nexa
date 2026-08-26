import { HistoryService } from "../services/history";
import type { HistoryStory } from "../services/history";
import type { HistoryLog } from "../types";
import { PaginatedListState } from "./paginatedList.svelte";

export type { HistoryStory };

export type HistoryFilters = {
    person: string;
    cardType: string;
    folio: string;
    action: string;
    startDate: string;
    endDate: string;
};

export class HistoryState {
    /** Paginación por fila (vista "Individual"). */
    pagination = new PaginatedListState<HistoryLog>();
    /** Paginación por flujo (vista "Por flujo") — historias completas. */
    storiesPagination = new PaginatedListState<HistoryStory>();

    filters: HistoryFilters = $state({
        person: "",
        cardType: "Todos",
        folio: "",
        action: "Todas",
        startDate: "",
        endDate: "",
    });

    /** Carga la primera página con los filtros actuales. */
    async init() {
        await this.refresh(1);
        await this.refreshFlows(1);
    }

    /** Libera recursos. */
    destroy() {
        // sin suscripciones propias que limpiar
    }

    async refresh(page: number = 1) {
        await this.pagination.fetchPage(
            (p, s) => HistoryService.fetchAll(p, s, this.filters),
            page,
        );
    }

    async refreshFlows(page: number = 1) {
        await this.storiesPagination.fetchPage(
            (p, s) => HistoryService.fetchFlows(p, s, this.filters),
            page,
        );
    }

    /**
     * Actualiza filtros parcialmente y resetea a página 1 si hubo cambios.
     */
    setFilters(partial: Partial<HistoryFilters>) {
        let changed = false;
        for (const key of Object.keys(partial) as (keyof HistoryFilters)[]) {
            if (partial[key] !== undefined && partial[key] !== this.filters[key]) {
                (this.filters as any)[key] = partial[key];
                changed = true;
            }
        }
        if (changed) {
            this.pagination.currentPage = 1;
            this.storiesPagination.currentPage = 1;
        }
    }

    /**
     * Resetea todos los filtros a sus valores por defecto.
     */
    clearFilters() {
        this.filters = {
            person: "",
            cardType: "Todos",
            folio: "",
            action: "Todas",
            startDate: "",
            endDate: "",
        };
        this.pagination.currentPage = 1;
        this.storiesPagination.currentPage = 1;
    }

    async nextPage() {
        if (this.pagination.nextPage()) {
            await this.refresh(this.pagination.currentPage);
        }
    }

    async prevPage() {
        if (this.pagination.prevPage()) {
            await this.refresh(this.pagination.currentPage);
        }
    }

    async goToPage(page: number) {
        if (this.pagination.goToPage(page)) {
            await this.refresh(this.pagination.currentPage);
        }
    }

    async nextFlowPage() {
        if (this.storiesPagination.nextPage()) {
            await this.refreshFlows(this.storiesPagination.currentPage);
        }
    }

    async prevFlowPage() {
        if (this.storiesPagination.prevPage()) {
            await this.refreshFlows(this.storiesPagination.currentPage);
        }
    }

    async goToFlowPage(page: number) {
        if (this.storiesPagination.goToPage(page)) {
            await this.refreshFlows(this.storiesPagination.currentPage);
        }
    }
}

export const historyState = new HistoryState();
