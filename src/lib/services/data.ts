import { supabase } from "../supabase";
import { HistoryService } from "./history";

export const cardService = {
    async fetchExtra() {
        const { data, error } = await supabase
            .from("cards")
            .select("*")
            .is("person_id", null);
        if (error) throw error;
        return data || [];
    },

    async save(data: any) {
        const payload = {
            type: data.type,
            folio: data.folio,
            status: data.person_id ? "active" : (data.status || "available"),
            person_id: data.person_id || null,
            programming_status: data.programming_status || (data.person_id ? "pending" : null),
            responsiva_status: data.responsiva_status || (data.person_id ? "unsigned" : null)
        };

        const { data: savedCard, error } = await supabase
            .from("cards")
            .upsert(payload, { onConflict: "folio, type" })
            .select()
            .single();

        if (error) throw error;

        await HistoryService.log("CARD", savedCard.id, "UPSERT", {
            message: `Tarjeta ${savedCard.folio} (${savedCard.type}) guardada/actualizada`
        });

        // Trigger System Tickets
        if (savedCard.person_id) {
            // Check Responsiva: only create if programming is already done
            if (savedCard.responsiva_status !== 'signed' && savedCard.programming_status === 'done') {
                await ticketService.ensureSystemTicket(
                    savedCard.id,
                    "Firma Responsiva",
                    "Firma de Responsiva",
                    `Firma pendiente para la tarjeta ${savedCard.folio}`,
                    savedCard.person_id
                );
            }

            if (savedCard.programming_status !== 'done') {
                await ticketService.ensureSystemTicket(
                    savedCard.id,
                    "Programación de Acceso",
                    "Programación de Acceso",
                    `Configurar niveles de acceso para ${savedCard.folio}`,
                    savedCard.person_id
                );
            }
        }
    },

    async updateStatus(id: string, status: string) {
        let finalStatus = status;

        // Requirement: when unlocking an unassigned card, it should go to 'available'
        if (status === 'active') {
            const { data: card } = await supabase.from("cards").select("person_id").eq("id", id).single();
            if (card && !card.person_id) {
                finalStatus = 'available';
            }
        }

        const { error } = await supabase
            .from("cards")
            .update({ status: finalStatus })
            .eq("id", id);
        if (error) throw error;

        await HistoryService.log("CARD", id, "UPDATE_STATUS", {
            message: `Cambio de estado de tarjeta a ${finalStatus}`
        });
    },

    async updateProgrammingStatus(id: string, status: string) {
        const { data: card, error } = await supabase
            .from("cards")
            .update({ programming_status: status })
            .eq("id", id)
            .select() // Select to get details for ticket
            .single();

        if (error) throw error;
        await HistoryService.log("CARD", id, "UPDATE_PROGRAMMING", {
            message: `Actualización de estatus de programación a ${status}`
        });

        // Sync Ticket
        if (status === 'done') {
            await ticketService.closeSystemTicket(id, "Programación de Acceso");
            // Also trigger Responsiva ticket now that programming is done
            if (card.person_id && card.responsiva_status !== 'signed') {
                await ticketService.ensureSystemTicket(
                    card.id,
                    "Firma Responsiva",
                    "Firma de Responsiva",
                    `Firma pendiente para la tarjeta ${card.folio}`,
                    card.person_id
                );
            }
        } else if (status === 'pending' && card.person_id) {
            await ticketService.ensureSystemTicket(
                card.id,
                "Programación de Acceso",
                "Programación de Acceso",
                `Configurar niveles de acceso para ${card.folio}`,
                card.person_id
            );
        }
    },

    async updateResponsivaStatus(id: string, status: string) {
        const { data: card, error } = await supabase
            .from("cards")
            .update({ responsiva_status: status })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        await HistoryService.log("CARD", id, "UPDATE_RESPONSIVA", {
            message: `Actualización de estatus de responsiva a ${status}`
        });

        // Sync Ticket
        if (status === 'signed') {
            await ticketService.closeSystemTicket(id, "Firma Responsiva");
        } else if (status === 'unsigned' && card.person_id && card.programming_status === 'done') {
            await ticketService.ensureSystemTicket(
                card.id,
                "Firma Responsiva",
                "Firma de Responsiva",
                `Firma pendiente para la tarjeta ${card.folio}`,
                card.person_id
            );
        }
    },

    async unassign(id: string) {
        const { error } = await supabase
            .from("cards")
            .update({
                person_id: null,
                status: "available",
                responsiva_status: "unsigned", // Reset to default
                programming_status: "pending"
            })
            .eq("id", id);
        if (error) throw error;
        await HistoryService.log("CARD", id, "UNASSIGN", {
            message: `Tarjeta desvinculada y marcada como disponible`
        });

        // Close/Delete pending tickets for this card as they are no longer relevant to the previous owner
        // We can just try to close both types
        await ticketService.closeSystemTicket(id, "Firma Responsiva");
        await ticketService.closeSystemTicket(id, "Programación de Acceso");
    },

    async deactivate(id: string) {
        // "Baja" logic: unassign if assigned, and set status to inactive
        const { error } = await supabase
            .from("cards")
            .update({
                person_id: null,
                status: "inactive",
                responsiva_status: "unsigned",
                programming_status: "pending"
            })
            .eq("id", id);
        if (error) throw error;
        await HistoryService.log("CARD", id, "UPDATE_STATUS", {
            message: `Tarjeta dada de baja (Inactiva)`
        });
        await ticketService.closeSystemTicket(id, "Firma Responsiva");
        await ticketService.closeSystemTicket(id, "Programación de Acceso");
    },

    async update(id: string, updates: any) {
        const { error } = await supabase
            .from("cards")
            .update(updates)
            .eq("id", id);
        if (error) throw error;
        await HistoryService.log("CARD", id, "UPDATE", {
            message: `Actualización de datos de tarjeta`
        });
    },

    async delete(id: string) {
        const { error } = await supabase.from("cards").delete().eq("id", id);
        if (error) throw error;
        await HistoryService.log("CARD", id, "DELETE", {
            message: `Eliminación permanente de tarjeta`
        });
    }
};

export const ticketService = {
    async create(ticket: any) {
        const { error } = await supabase
            .from("tickets")
            .insert([{
                title: ticket.title,
                description: ticket.description,
                type: ticket.type,
                priority: ticket.priority,
                status: "pending",
                person_id: ticket.person_id || null,
                card_id: ticket.card_id || null, // Ensure card_id is saved
                payload: ticket.payload || {}
            }]);
        if (error) throw error;
    },

    async ensureSystemTicket(cardId: string, type: string, title: string, description: string, personId: string | null) {
        // Check if pending ticket exists
        const { data: existing } = await supabase
            .from("tickets")
            .select("id")
            .eq("card_id", cardId)
            .eq("type", type)
            .eq("status", "pending")
            .limit(1);

        if (!existing || existing.length === 0) {
            // Create new ticket
            await this.create({
                title,
                description,
                type,
                priority: "Alta", // System tickets are high priority
                person_id: personId,
                card_id: cardId,
                payload: { isSystemGenerated: true }
            });
            console.log(`System Ticket Created: ${type} for Card ${cardId}`);
        }
    },

    async closeSystemTicket(cardId: string, type: string) {
        // Find pending ticket
        const { data: existing } = await supabase
            .from("tickets")
            .select("id")
            .eq("card_id", cardId)
            .eq("type", type)
            .eq("status", "pending")
            .single();

        if (existing) {
            await this.updateStatus(existing.id, "completed");
            console.log(`System Ticket Closed: ${type} for Card ${cardId}`);
        }
    },

    async syncSystemTickets() {
        // One-off sync: Fetch all assigned cards and ensure tickets exist if needed
        const { data: cards } = await supabase
            .from("cards")
            .select("*, personnel(id, first_name, last_name)")
            .not("person_id", "is", null);

        if (!cards) return;

        for (const card of cards) {
            const personName = card.personnel ? `${card.personnel.first_name} ${card.personnel.last_name}` : "N/A";

            // Check Responsiva: only ensure if programming is done
            if (card.responsiva_status !== "signed" && card.programming_status === "done") {
                await this.ensureSystemTicket(
                    card.id,
                    "Firma Responsiva",
                    "Firma de Responsiva",
                    `Firma pendiente para la tarjeta ${card.folio}`,
                    card.person_id
                );
            } else {
                // Ensure closed if exists
                await this.closeSystemTicket(card.id, "Firma Responsiva");
            }

            // Check Programming
            if (card.programming_status !== "done") {
                await this.ensureSystemTicket(
                    card.id,
                    "Programación de Acceso",
                    "Programación de Acceso",
                    `Configurar niveles de acceso para ${card.folio}`,
                    card.person_id
                );
            } else {
                await this.closeSystemTicket(card.id, "Programación de Acceso");
            }
        }
    },

    async fetchAll() {
        // Just fetch everything from DB
        const { data: tickets, error } = await supabase
            .from("tickets")
            .select("*, personnel(first_name, last_name), cards(folio, type)")
            .neq("status", "completed") // Only fetch active tickets for the main list? existing logic implies showing all or filtering in UI? 
            // The original fetchAll logic filtered out nothing explicitly but virtual ones were implicit.
            // Let's return all non-completed for "Pendientes" or just all and let UI filter?
            // "pendingItems" usually implies pending.
            // Let's filter by status pending for the main "Pendientes" view if that's what this feeds.
            // App.svelte filters `pendingItems` for the sidebar?
            // Actually App.svelte uses `pendingItems` for... everything?
            // Let's fetch ALL for now, or maybe just pending to keep it lighter?
            // Original code fetched ALL real tickets.
            .order("created_at", { ascending: false });

        if (error) throw error;

        return (tickets || []).map(t => ({
            ...t,
            personName: t.personnel ? `${t.personnel.first_name} ${t.personnel.last_name}` : "N/A",
            cardType: t.cards?.type,
            cardFolio: t.cards?.folio,
            // Add helpers for UI compat if needed
            id: t.id, // now number
        }));
    },

    async updateStatus(id: number, status: string) {
        const { error } = await supabase
            .from("tickets")
            .update({ status })
            .eq("id", id);
        if (error) throw error;
        await HistoryService.log("TICKET", id.toString(), "UPDATE_STATUS", {
            message: `Ticket ID ${id} actualizado a estado: ${status}`
        });
    },

    async delete(id: number) {
        const { error } = await supabase
            .from("tickets")
            .delete()
            .eq("id", id);
        if (error) throw error;
        await HistoryService.log("TICKET", id.toString(), "DELETE", {
            message: `Eliminación de ticket ID ${id}`
        });
    }
};
