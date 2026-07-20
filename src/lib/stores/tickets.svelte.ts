import type { Ticket } from "../types";
import { PaginatedListState } from "./paginatedList.svelte";

export type TicketFilters = {
    type: string;
    priority: string;
    search: string;
    dependencyId: string;
    section: string;
};

export class TicketState {
    pagination = new PaginatedListState<Ticket>();

    /** Filtros unificados. */
    filters: TicketFilters = $state({
        type: "Todos",
        priority: "Todas",
        search: "",
        dependencyId: "",
        section: "General",
    });

    /**
     * Todos los tickets pendientes (no paginados).
     * Se actualiza desde ticketService.fetchAll() para el Dashboard.
     */
    pendingItems = $state<Ticket[]>([]);

    setTickets(data: Ticket[]) {
        this.pendingItems = data;
    }

    addTicket(ticket: Ticket) {
        this.pendingItems.push(ticket);
    }

    removeTicket(id: number) {
        this.pendingItems = this.pendingItems.filter(t => t.id !== id);
    }

    removeByCard(cardId: string, types?: string[]) {
        this.pendingItems = this.pendingItems.filter(t => {
            if (t.card_id !== cardId) return true;
            if (types && types.length > 0) {
                return !types.includes(t.type);
            }
            return false;
        });
    }

    removeByPerson(personId: string) {
        this.pendingItems = this.pendingItems.filter(t => t.person_id !== personId);
    }

    /** Carga la primera página con los filtros actuales. */
    async init() {
        await this.refresh();
    }

    destroy() {
        // sin suscripciones propias que limpiar
    }

    async refresh(page?: number) {
        const { ticketService } = await import("../services/tickets");
        await this.pagination.fetchPage(
            (p, s) => ticketService.fetchPaginated(
                p, s,
                this.filters.type,
                this.filters.priority,
                this.filters.search,
                this.filters.section,
                this.filters.dependencyId,
            ),
            page,
        );
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
}

export const ticketState = new TicketState();
