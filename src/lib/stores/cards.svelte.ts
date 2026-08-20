import { cardService } from "../services/cards";
import { accessMediaService } from "../services/accessMedia";
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
            (p, s) => this.fetch(p, s),
            page,
        );
    }

    /**
     * Lee el modelo nuevo (access_media) y lo normaliza a la forma que espera
     * la vista. Si falla, hace fallback al modelo legacy (cards).
     */
    private async fetch(page: number, size: number): Promise<{ data: Card[]; count: number }> {
        try {
            const res = await accessMediaService.fetchAll(
                page,
                size,
                this.filters.search,
                this.filters.type,
                this.filters.status,
                this.filters.dependencyId,
            );
            const data = res.data.map((m) => ({
                ...m,
                // Las acciones de la vista siguen operando sobre cards.id.
                id: (m.legacy_card_id ?? m.id) as string,
                access_media_id: m.id,
                type: m.access_media_types?.name ?? (m.metadata?.legacy_type as string) ?? "",
                folio: m.identifier ?? "",
            })) as unknown as Card[];
            return { data, count: res.count };
        } catch {
            return cardService.fetchAll(
                page,
                size,
                this.filters.search,
                this.filters.type,
                this.filters.status,
                this.filters.dependencyId,
            );
        }
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
