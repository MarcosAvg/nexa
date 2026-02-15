import { supabase } from "../supabase";
import { HistoryService } from "./history";
import type { Ticket } from "../types";
import { handleError } from "../utils/error";
import { ticketState } from "../stores";

export const ticketService = {
    async fetchAll(): Promise<Ticket[]> {
        try {
            const { data, error } = await supabase
                .from("tickets")
                .select("*")
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(t => ({
                ...t,
            } as Ticket));
        } catch (error) {
            handleError(error, "Fetch Tickets");
            return [];
        }
    },

    async create(data: any) {
        try {
            const payload = {
                type: data.type,
                description: data.description,
                priority: (data.priority || "media").toLowerCase(),
                status: "pending",
                person_id: data.person_id || null,
                card_id: data.card_id || null,
                title: data.title || data.type,
                payload: data.payload || data.metadata || {}
            };

            const { data: newTicket, error } = await supabase
                .from("tickets")
                .insert([payload])
                .select()
                .single();

            if (error) throw error;

            await HistoryService.log("TICKET", newTicket.id, "CREATE", {
                message: `Ticket creado: ${payload.title}`
            });

            ticketState.addTicket(newTicket as Ticket);
        } catch (error) {
            handleError(error, "Create Ticket");
            throw error;
        }
    },

    async delete(id: number) {
        try {
            const { error } = await supabase.from("tickets").delete().eq("id", id);
            if (error) throw error;
            ticketState.removeTicket(id);
        } catch (error) {
            handleError(error, "Delete Ticket");
            throw error;
        }
    },

    async deleteByCard(cardId: string, types?: string[]) {
        try {
            let query = supabase.from("tickets").delete().eq("card_id", cardId);
            if (types && types.length > 0) {
                query = query.in("type", types);
            }
            const { error } = await query;
            if (error) throw error;
            ticketState.removeByCard(cardId, types);
        } catch (error) {
            handleError(error, "Delete Tickets by Card");
            throw error;
        }
    },

    async deleteByPerson(personId: string) {
        try {
            // We delete all tickets linked to this person ID
            const { error } = await supabase.from("tickets").delete().eq("person_id", personId);
            if (error) throw error;
            ticketState.removeByPerson(personId);
        } catch (error) {
            handleError(error, "Delete Tickets by Person");
            throw error;
        }
    },

    async updateStatus(id: string, status: string, details?: string) {
        try {
            const { error } = await supabase.from("tickets").update({ status }).eq("id", id);
            if (error) throw error;
            await HistoryService.log("TICKET", id, "UPDATE_STATUS", {
                message: `Estado actualizado a ${status} ${details ? `(${details})` : ''}`
            });

            // Fetch the updated ticket to sync with store
            const { data: updatedTicket } = await supabase
                .from("tickets")
                .select("*")
                .eq("id", id)
                .single();

            if (updatedTicket) {
                ticketState.updateTicket(updatedTicket as Ticket);
            }
        } catch (error) {
            handleError(error, "Update Ticket Status");
            throw error;
        }
    }
};
