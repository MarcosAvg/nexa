import type { Ticket } from "../types";

export class TicketState {
    pendingItems = $state<Ticket[]>([]);

    setTickets(data: Ticket[]) {
        this.pendingItems = data;
    }

    addTicket(ticket: Ticket) {
        this.pendingItems.push(ticket);
    }

    updateTicket(ticket: Ticket) {
        const index = this.pendingItems.findIndex(t => t.id === ticket.id);
        if (index !== -1) {
            this.pendingItems[index] = ticket;
        }
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
}

export const ticketState = new TicketState();
