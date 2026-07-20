import type { CardlessRegistry } from "../types";
import { PaginatedListState } from "./paginatedList.svelte";
import { cardlessRegistryService } from "../services/cardlessRegistry";

export type CardlessRegistryFilters = {
    startDate: string;
    endDate: string;
    reason: string;
    search: string;
    dependencyId: string;
};

export class CardlessRegistryState {
    pagination = new PaginatedListState<CardlessRegistry>();

    /** Filtros unificados. */
    filters: CardlessRegistryFilters = $state({
        startDate: "",
        endDate: "",
        reason: "",
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
            (p, s) => cardlessRegistryService.fetchAll(p, s, this.filters),
            page,
        );
    }

    setFilters(partial: Partial<CardlessRegistryFilters>) {
        let changed = false;
        for (const key of Object.keys(partial) as (keyof CardlessRegistryFilters)[]) {
            if (partial[key] !== undefined && partial[key] !== this.filters[key]) {
                this.filters[key] = partial[key] as any;
                changed = true;
            }
        }
        if (changed) {
            this.pagination.currentPage = 1;
        }
    }
}

export const cardlessRegistryState = new CardlessRegistryState();
