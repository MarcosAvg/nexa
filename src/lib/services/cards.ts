import { supabase } from "../supabase";
import { HistoryService } from "./history";
import type { Card } from "../types";
import { handleError } from "../utils/error";

export const cardService = {
    async fetchExtra(): Promise<Card[]> {
        try {
            const { data, error } = await supabase
                .from("cards")
                .select("*")
                .is("person_id", null);

            if (error) throw error;
            return (data || []).map((c) => ({
                ...c,
                personName: "Sin asignar",
            }));
        } catch (error) {
            handleError(error, "Fetch Extra Cards");
            return [];
        }
    },

    async save(data: any) {
        try {
            // Check if this is a new assignment
            let isNewAssignment = false;
            if (data.id && data.person_id) {
                const { data: existing } = await supabase
                    .from("cards")
                    .select("person_id, programming_status")
                    .eq("id", data.id)
                    .single();

                if (existing && !existing.person_id) {
                    isNewAssignment = true;
                }
            } else if (!data.id && data.person_id) {
                isNewAssignment = true;
            }

            const payload = {
                folio: data.folio,
                type: data.type,
                status: data.status || (data.person_id ? "active" : "available"),
                person_id: data.person_id || null,
                programming_status: isNewAssignment ? "pending" : (data.programming_status || null),
                responsiva_status: data.responsiva_status || null,
            };

            let cardId = data.id;

            if (cardId) {
                const { error } = await supabase
                    .from("cards")
                    .update(payload)
                    .eq("id", cardId);
                if (error) throw error;
                await HistoryService.log("CARD", cardId, "UPDATE", {
                    message: `Tarjeta ${payload.folio} actualizada`,
                });
            } else {
                const { data: newCard, error } = await supabase
                    .from("cards")
                    .insert([payload])
                    .select()
                    .single();
                if (error) throw error;
                cardId = newCard.id;
                await HistoryService.log("CARD", cardId, "CREATE", {
                    message: `Tarjeta ${payload.folio} creada`,
                });
            }

            // Trigger Automatic Ticket for Programming
            if (isNewAssignment) {
                const { ticketService } = await import("./tickets");
                await ticketService.create({
                    type: "Programación",
                    description: `Programar acceso para tarjeta folio ${payload.folio}`,
                    priority: "alta",
                    person_id: data.person_id,
                    card_id: cardId,
                    title: `Programación: ${payload.folio}`
                });
            }
        } catch (error) {
            handleError(error, "Save Card");
            throw error;
        }
    },

    async updateProgrammingStatus(cardId: string, status: string | null) {
        try {
            const { error } = await supabase
                .from("cards")
                .update({ programming_status: status })
                .eq("id", cardId);

            if (error) throw error;

            // Trigger "Firma Responsiva" ticket if status is 'done' AND card is not signed
            if (status === "done") {
                const { data: card } = await supabase
                    .from("cards")
                    .select("folio, responsiva_status, person_id")
                    .eq("id", cardId)
                    .single();

                if (card && card.responsiva_status !== "signed" && card.person_id) {
                    const { ticketService } = await import("./tickets");
                    await ticketService.create({
                        type: "Firma Responsiva",
                        description: `Firma de responsiva para tarjeta folio ${card.folio}`,
                        priority: "media",
                        person_id: card.person_id,
                        card_id: cardId,
                        title: `Firma: ${card.folio}`
                    });
                }
            }

            await HistoryService.log("CARD", cardId, "UPDATE", {
                message: `Estado de programación actualizado a ${status || 'N/A'}`,
            });
        } catch (error) {
            handleError(error, "Update Programming Status");
            throw error;
        }
    },

    async updateResponsivaStatus(cardId: string, status: string) {
        try {
            const { error } = await supabase
                .from("cards")
                .update({ responsiva_status: status })
                .eq("id", cardId);

            if (error) throw error;

            // Delete "Firma Responsiva" tickets if signed
            if (status === "signed") {
                const { ticketService } = await import("./tickets");
                await ticketService.deleteByCard(cardId, ["Firma Responsiva"]);
            }

            await HistoryService.log("CARD", cardId, "UPDATE", {
                message: `Estado de responsiva actualizado a ${status}`,
            });
        } catch (error) {
            handleError(error, "Update Responsiva Status");
            throw error;
        }
    },

    async updateStatus(cardId: string, status: string) {
        try {
            // First fetch to check assignment
            const { data: card, error: fetchError } = await supabase
                .from("cards")
                .select("person_id")
                .eq("id", cardId)
                .single();

            if (fetchError) throw fetchError;

            let finalStatus = status;
            // If reactivating and no person assigned, set to available
            if (status === "active" && !card.person_id) {
                finalStatus = "available";
            }

            const { error } = await supabase
                .from("cards")
                .update({ status: finalStatus })
                .eq("id", cardId);

            if (error) throw error;

            await HistoryService.log("CARD", cardId, "UPDATE_STATUS", {
                message: `Estado de tarjeta actualizado a ${finalStatus}`,
            });
        } catch (error) {
            handleError(error, "Update Card Status");
            throw error;
        }
    },

    async unassign(cardId: string) {
        try {
            const { error } = await supabase
                .from("cards")
                .update({
                    person_id: null,
                    programming_status: null,
                    responsiva_status: null,
                    status: "available",
                })
                .eq("id", cardId);

            if (error) throw error;

            // Delete associated Programming/Responsiva tickets
            const { ticketService } = await import("./tickets");
            await ticketService.deleteByCard(cardId, ["Programación", "Firma Responsiva"]);

            await HistoryService.log("CARD", cardId, "UNASSIGN", {
                message: `Tarjeta desvinculada de la persona`,
            });
        } catch (error) {
            handleError(error, "Unassign Card");
            throw error;
        }
    },

    async delete(id: string) {
        try {
            const { error } = await supabase.from("cards").delete().eq("id", id);
            if (error) throw error;
            await HistoryService.log("CARD", id, "DELETE", {
                message: "Tarjeta eliminada permanentemente",
            });
        } catch (error) {
            handleError(error, "Delete Card");
            throw error;
        }
    },
};
