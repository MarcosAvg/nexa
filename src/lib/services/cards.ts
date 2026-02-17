import { supabase } from "../supabase";
import { HistoryService } from "./history";
import type { Card } from "../types";
import { handleError, withTimeout } from "../utils/error";

export const cardService = {
    async fetchAll(
        page: number = 1,
        limit: number = 50,
        search: string = "",
        typeFilter: string = "Todos",
        statusFilter: string = "Todas"
    ): Promise<{ data: Card[]; count: number }> {
        try {
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            let query = supabase
                .from("cards")
                .select("*, personnel(first_name, last_name, status)", { count: "exact" });

            if (search) {
                const searchTerm = `%${search}%`;

                // 1. Find matching people IDs first
                const { data: people } = await supabase
                    .from("personnel")
                    .select("id")
                    .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm}`);

                const personIds = people?.map(p => p.id) || [];

                // 2. Build Query: Folio match OR Person match
                if (personIds.length > 0) {
                    query = query.or(`folio.ilike.${searchTerm},person_id.in.(${personIds.join(',')})`);
                } else {
                    query = query.ilike("folio", searchTerm);
                }
            }

            if (typeFilter !== "Todos") {
                query = query.eq("type", typeFilter);
            }

            if (statusFilter !== "Todas") {
                const statusMap: Record<string, string> = {
                    "Activa": "active",
                    "Bloqueada": "blocked",
                    "Baja": "inactive",
                    "Disponible": "available"
                };
                if (statusMap[statusFilter]) {
                    query = query.eq("status", statusMap[statusFilter]);
                }
            }

            const { data, count, error } = await query
                .order("folio", { ascending: true })
                .range(from, to);

            if (error) throw error;

            const mappedData = (data || []).map((c) => ({
                ...c,
                personName: c.personnel
                    ? `${c.personnel.first_name} ${c.personnel.last_name}`
                    : "Sin asignar",
                personStatus: c.personnel?.status
            }));

            return { data: mappedData, count: count || 0 };
        } catch (error) {
            handleError(error, "Fetch All Cards");
            return { data: [], count: 0 };
        }
    },

    async fetchForExport(
        search: string = "",
        typeFilter: string = "Todos",
        statusFilter: string = "Todas"
    ): Promise<Card[]> {
        try {
            let query = supabase
                .from("cards")
                .select("*, personnel(first_name, last_name, status)");

            if (search) {
                const searchTerm = `%${search}%`;

                // 1. Find matching people IDs first
                const { data: people } = await supabase
                    .from("personnel")
                    .select("id")
                    .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm}`);

                const personIds = people?.map(p => p.id) || [];

                // 2. Build Query: Folio match OR Person match
                if (personIds.length > 0) {
                    query = query.or(`folio.ilike.${searchTerm},person_id.in.(${personIds.join(',')})`);
                } else {
                    query = query.ilike("folio", searchTerm);
                }
            }

            if (typeFilter !== "Todos") {
                query = query.eq("type", typeFilter);
            }

            if (statusFilter !== "Todas") {
                const statusMap: Record<string, string> = {
                    "Activa": "active",
                    "Bloqueada": "blocked",
                    "Baja": "inactive",
                    "Disponible": "available"
                };
                if (statusMap[statusFilter]) {
                    query = query.eq("status", statusMap[statusFilter]);
                }
            }

            const { data, error } = await query.order("folio", { ascending: true });

            if (error) throw error;

            return (data || []).map((c) => ({
                ...c,
                personName: c.personnel
                    ? `${c.personnel.first_name} ${c.personnel.last_name}`
                    : "Sin asignar",
                personStatus: c.personnel?.status
            }));
        } catch (error) {
            handleError(error, "Fetch Cards for Export");
            return [];
        }
    },

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

    async save(data: any, replacementOptions?: { oldCardStatus: string }) {
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

            // Handle Replacement Logic BEFORE creating/updating the new card
            if (replacementOptions && data.person_id) {
                // 1. Find the currently assigned card of the same type
                const { data: currentCards } = await supabase
                    .from("cards")
                    .select("id, folio")
                    .eq("person_id", data.person_id)
                    .eq("type", data.type) // Ensure same type
                    .neq("status", "inactive"); // Active cards only

                if (currentCards && currentCards.length > 0) {
                    const oldCard = currentCards[0];
                    const newStatus = replacementOptions.oldCardStatus; // 'blocked' or 'available'

                    // 2. Update Old Card Status
                    const { error: updateError } = await withTimeout(supabase
                        .from("cards")
                        .update({
                            status: newStatus,
                            person_id: null, // Unassign
                            programming_status: null,
                            responsiva_status: null,
                        })
                        .eq("id", oldCard.id));

                    if (updateError) throw updateError;

                    // 3. Log History for Old Card
                    await HistoryService.log("CARD", oldCard.id, "REPLACE_OLD", {
                        message: `Tarjeta ${oldCard.folio} reemplazada. Nuevo estado: ${newStatus === "blocked" ? "Baja Definitiva" : "Disponible"
                            }`,
                        related_person_id: data.person_id,
                    });
                }
            }

            const payload = {
                folio: data.folio,
                type: data.type,
                status: data.status || (data.person_id ? "active" : "available"),
                person_id: data.person_id || null,
                programming_status: isNewAssignment
                    ? "pending"
                    : data.programming_status || null,
                responsiva_status: data.responsiva_status || null,
            };

            let cardId = data.id;

            if (cardId) {
                const { error } = await withTimeout(supabase
                    .from("cards")
                    .update(payload)
                    .eq("id", cardId));
                if (error) throw error;
                await HistoryService.log("CARD", cardId, "UPDATE", {
                    message: `Tarjeta ${payload.folio} actualizada`,
                });
            } else {
                const { data: newCard, error } = await withTimeout(supabase
                    .from("cards")
                    .insert([payload])
                    .select()
                    .single());
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
                    type: replacementOptions ? "Reposición" : "Programación", // Distinct type for replacement
                    description: replacementOptions
                        ? `Reponer tarjeta ${payload.type} (Folio anterior dado de baja/liberado). Nuevo folio: ${payload.folio}`
                        : `Programar acceso para tarjeta ${payload.type} folio ${payload.folio}`,
                    priority: replacementOptions ? "urgente" : "alta",
                    person_id: data.person_id,
                    card_id: cardId,
                    title: replacementOptions
                        ? `Reposición: ${payload.folio}`
                        : `Programación: ${payload.folio}`,
                });

                // Log history for new card to link it to the person explicitly
                if (data.person_id) {
                    await HistoryService.log("PERSON", data.person_id, replacementOptions ? "REPLACE_CARD" : "ASSIGN_CARD", {
                        message: replacementOptions
                            ? `Tarjeta ${payload.folio} (${payload.type}) asignada por Reposición`
                            : `Tarjeta ${payload.folio} (${payload.type}) asignada`,
                        related_card_id: cardId,
                    });
                }
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
                    .select("folio, responsiva_status, person_id, type")
                    .eq("id", cardId)
                    .single();

                if (card && card.responsiva_status !== "signed" && card.person_id) {
                    const { ticketService } = await import("./tickets");
                    await ticketService.create({
                        type: "Firma Responsiva",
                        description: `Firma de responsiva para tarjeta ${card.type || ''} folio ${card.folio}`,
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
            // Log deletion BEFORE removing data so proactive snapshotting can capture the name
            await HistoryService.log("CARD", id, "DELETE", { message: `Tarjeta eliminada permanentemente` });

            // Associated tickets are transient and can be deleted. 
            // History remains readable because HistoryService captures names PROACTIVELY.
            const { ticketService } = await import("./tickets");
            await ticketService.deleteByCard(id);

            // Delete the card
            const { error } = await supabase.from("cards").delete().eq("id", id);
            if (error) throw error;

        } catch (error) {
            handleError(error, "Delete Card");
            throw error;
        }
    },
};
