import { supabase } from "../supabase";
import { HistoryService } from "./history";
import type { Card } from "../types";
import { withErrorHandling, withErrorHandlingSafe, withErrorHandlingConditional, withTimeout, dbCache, batchPaginate } from "../utils";
import { networkStore } from "../stores/network.svelte";

export const cardService = {
    async fetchAll(
        page: number = 1,
        limit: number = 50,
        search: string = "",
        typeFilter: string = "Todos",
        statusFilter: string = "Todas",
        depId: string = ""
    ): Promise<{ data: Card[]; count: number }> {
        return withErrorHandlingSafe(async () => {
            const cacheKey = `cards_page_${page}_${typeFilter}_${statusFilter}_${search}_${depId}`;
            if (!networkStore.isOnline) {
                const cachedData = await dbCache.load<{ data: Card[], count: number }>(cacheKey);
                if (cachedData) return cachedData;
                return { data: [], count: 0 };
            }

            const from = (page - 1) * limit;
            const to = from + limit - 1;

            let query = supabase
                .from("cards_ordered")
                .select("*, personnel(first_name, last_name, status)", { count: "exact" });

            if (search) {
                const terms = search.trim().split(/\s+/).filter(Boolean);
                const searchTerm = `%${search}%`;

                let peopleQuery = supabase
                    .from("personnel")
                    .select("id");

                for (const term of terms) {
                    const termPattern = `%${term}%`;
                    peopleQuery = peopleQuery.or(`first_name.ilike.${termPattern},last_name.ilike.${termPattern}`);
                }

                const { data: people } = await peopleQuery;
                const personIds = people?.map(p => p.id) || [];

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

            if (depId) {
                const { data: people } = await supabase
                    .from("personnel")
                    .select("id")
                    .eq("dependency_id", depId);
                const personIds = people?.map(p => p.id) || [];
                if (personIds.length > 0) {
                    query = query.in("person_id", personIds);
                } else {
                    return { data: [], count: 0 };
                }
            }

            const { data, count, error } = await query
                .order("folio_sort", { ascending: true })
                .range(from, to);

            if (error) throw error;

            const mappedData = (data || []).map((c) => ({
                ...c,
                personName: c.personnel
                    ? `${c.personnel.first_name} ${c.personnel.last_name}`
                    : "Sin asignar",
                personStatus: c.personnel?.status
            }));

            const result = { data: mappedData, count: count || 0 };
            await dbCache.save(cacheKey, result);
            return result;
        }, "Fetch All Cards", { data: [], count: 0 });
    },

    async fetchForExport(
        search: string = "",
        typeFilter: string = "Todos",
        statusFilter: string = "Todas",
        depId: string = ""
    ): Promise<Card[]> {
        return withErrorHandlingSafe(async () => {
            let personIds: string[] = [];
            if (search) {
                const terms = search.trim().split(/\s+/).filter(Boolean);
                let peopleQuery = supabase.from("personnel").select("id");
                for (const term of terms) {
                    peopleQuery = peopleQuery.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
                }
                const { data: people } = await peopleQuery;
                personIds = people?.map(p => p.id) || [];
            }

            // Resolve person IDs for dependency filter once, outside the batch callback
            let depPersonIds: string[] | null = null;
            if (depId) {
                const { data: people } = await supabase
                    .from("personnel")
                    .select("id")
                    .eq("dependency_id", depId);
                depPersonIds = people?.map(p => p.id) || [];
            }

            if (depPersonIds !== null && depPersonIds.length === 0) {
                return [];
            }

            const allData = await batchPaginate<any>(async (from, to) => {
                let q = supabase.from("cards_ordered").select("*, personnel(first_name, last_name, status)");
                if (search) {
                    const st = `%${search}%`;
                    if (personIds.length > 0) {
                        q = q.or(`folio.ilike.${st},person_id.in.(${personIds.join(',')})`);
                    } else {
                        q = q.ilike("folio", st);
                    }
                }
                if (typeFilter !== "Todos") q = q.eq("type", typeFilter);
                if (statusFilter !== "Todas") {
                    const sm: Record<string, string> = { "Activa": "active", "Bloqueada": "blocked", "Baja": "inactive", "Disponible": "available" };
                    if (sm[statusFilter]) q = q.eq("status", sm[statusFilter]);
                }
                if (depPersonIds !== null && depPersonIds.length > 0) {
                    q = q.in("person_id", depPersonIds);
                }
                return q.order("folio_sort", { ascending: true }).range(from, to);
            });

            return allData.map(c => ({
                ...c,
                personName: c.personnel ? `${c.personnel.first_name} ${c.personnel.last_name}` : "Sin asignar",
                personStatus: c.personnel?.status
            })).sort((a, b) => a.folio.localeCompare(b.folio, undefined, { numeric: true }));
        }, "Fetch Cards for Export", []);
    },

    async fetchExtra(throwOnError: boolean = false): Promise<Card[]> {
        return withErrorHandlingConditional(async () => {
            const { data, error } = await supabase
                .from("cards")
                .select("*")
                .is("person_id", null);

            if (error) throw error;
            return (data || []).map((c) => ({ ...c, personName: "Sin asignar" }));
        }, "Fetch Extra Cards", throwOnError, []);
    },

    /** Look up a card by exact folio + type, including owner info */
    async findByFolio(folio: string, type: string): Promise<{
        card: Record<string, unknown> & { id: string; folio: string; type: string; status: string; person_id: string | null };
        ownerName: string | null;
    } | null> {
        const { data, error } = await supabase
            .from("cards")
            .select("id, folio, type, status, person_id, personnel(first_name, last_name)")
            .eq("folio", folio)
            .eq("type", type)
            .maybeSingle();

        if (error || !data) return null;

        const person = data.personnel as { first_name?: string; last_name?: string } | null;
        const ownerName = person
            ? `${person.first_name || ""} ${person.last_name || ""}`.trim()
            : null;

        return { card: data, ownerName };
    },

    /** Search cards by folio loosely */
    async searchByFolio(folioPart: string): Promise<Card[]> {
        return withErrorHandlingSafe(async () => {
            const cleanFolio = (folioPart || "").trim();
            if (!cleanFolio) return [];

            const { data, error } = await supabase
                .from("cards")
                .select("id, folio, type, status, person_id, personnel(first_name, last_name)")
                .ilike("folio", `%${cleanFolio}%`)
                .limit(5);

            if (error) throw error;
            return (data || []) as unknown as Card[];
        }, "Search Cards by Folio", []);
    },

    async save(data: {
        id?: string;
        folio: string;
        type: string;
        status?: string;
        person_id?: string | null;
        programming_status?: string | null;
        responsiva_status?: string | null;
        [key: string]: unknown;
    }, replacementOptions?: { oldCardStatus: string, skipTicket?: boolean }) {
        return withErrorHandling(async () => {
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

            if (replacementOptions && data.person_id) {
                const { data: currentCards } = await supabase
                    .from("cards")
                    .select("id, folio")
                    .eq("person_id", data.person_id)
                    .eq("type", data.type)
                    .neq("status", "inactive");

                if (currentCards && currentCards.length > 0) {
                    const oldCard = currentCards[0];
                    const newStatus = replacementOptions.oldCardStatus;

                    const { error: updateError } = await withTimeout(supabase
                        .from("cards")
                        .update({
                            status: newStatus,
                            person_id: null,
                            programming_status: null,
                            responsiva_status: null,
                        })
                        .eq("id", oldCard.id));

                    if (updateError) throw updateError;

                    await HistoryService.log("CARD", oldCard.id, "REPLACE_OLD", {
                        message: `Tarjeta ${oldCard.folio} reemplazada. Nuevo estado: ${newStatus === "blocked" ? "Baja Definitiva" : "Disponible"}`,
                        related_person_id: data.person_id,
                        entityName: `${data.type} (Folio: ${oldCard.folio})`
                    });
                }
            }

            const payload = {
                folio: data.folio,
                type: data.type,
                status: data.status || (data.person_id ? "active" : "available"),
                person_id: data.person_id || null,
                programming_status: isNewAssignment ? "pending" : data.programming_status || null,
                responsiva_status: data.responsiva_status || null,
            };

            let cardId = data.id;

            if (cardId) {
                const { error } = await withTimeout(supabase.from("cards").update(payload).eq("id", cardId));
                if (error) throw error;
            } else {
                const { data: newCard, error } = await withTimeout(supabase.from("cards").insert([payload]).select().single());
                if (error) throw error;
                cardId = newCard.id;
                await HistoryService.log("CARD", cardId, "CREATE", {
                    message: `Tarjeta ${payload.folio} creada`,
                    entityName: `${payload.type} (Folio: ${payload.folio})`
                });
            }

            if (isNewAssignment) {
                const { ticketService } = await import("./tickets");
                await ticketService.create({
                    type: "Programación",
                    description: replacementOptions
                        ? `Reponer tarjeta ${payload.type} (Folio anterior dado de baja/liberado). Nuevo folio: ${payload.folio}`
                        : `Programar acceso para tarjeta ${payload.type} folio ${payload.folio}`,
                    priority: "alta",
                    person_id: data.person_id,
                    card_id: cardId,
                    title: `Programación: ${payload.folio}`,
                });

                if (data.person_id) {
                    const { data: person } = await supabase.from("personnel").select("first_name, last_name").eq("id", data.person_id).single();
                    const personName = person ? `${person.first_name} ${person.last_name}` : `Personal (${data.person_id})`;

                    await HistoryService.log("PERSON", data.person_id, replacementOptions ? "REPLACE_CARD" : "ASSIGN_CARD", {
                        message: replacementOptions
                            ? `Tarjeta ${payload.folio} (${payload.type}) asignada por Reposición`
                            : `Tarjeta ${payload.folio} (${payload.type}) asignada`,
                        related_card_id: cardId,
                        entityName: personName
                    });
                }
            }
        }, "Save Card");
    },

    async updateProgrammingStatus(cardId: string, status: string | null) {
        return withErrorHandling(async () => {
            const { data: card } = await supabase.from("cards")
                .select("folio, responsiva_status, person_id, type")
                .eq("id", cardId).single();

            const { error } = await supabase.from("cards")
                .update({ programming_status: status }).eq("id", cardId);
            if (error) throw error;

            if (status === "done" && card && card.responsiva_status !== "signed" && card.person_id) {
                const { ticketService } = await import("./tickets");
                await ticketService.create({
                    type: "Firma Responsiva",
                    description: `Firma de responsiva para tarjeta ${card.type || ''} folio ${card.folio}`,
                    priority: "media", person_id: card.person_id, card_id: cardId,
                    title: `Firma: ${card.folio}`
                });
            }
        }, "Update Programming Status");
    },

    async updateResponsivaStatus(cardId: string, status: string) {
        return withErrorHandling(async () => {
            const { error } = await supabase.from("cards")
                .update({ responsiva_status: status }).eq("id", cardId);
            if (error) throw error;

            if (status === "signed") {
                const { ticketService } = await import("./tickets");
                await ticketService.deleteByCard(cardId, ["Firma Responsiva"], "Ticket completado/atendido");
            }

            await supabase.from("cards").select("folio, type").eq("id", cardId).single();
        }, "Update Responsiva Status");
    },

    async updateStatus(cardId: string, status: string) {
        return withErrorHandling(async () => {
            const { data: card, error: fetchError } = await supabase.from("cards")
                .select("person_id").eq("id", cardId).single();
            if (fetchError) throw fetchError;

            const finalStatus = (status === "active" && !card.person_id) ? "available" : status;

            const { error } = await supabase.from("cards")
                .update({ status: finalStatus }).eq("id", cardId);
            if (error) throw error;

            await supabase.from("cards").select("folio, type").eq("id", cardId).single();
        }, "Update Card Status");
    },

    async unassign(cardId: string) {
        return withErrorHandling(async () => {
            const { error } = await supabase.from("cards")
                .update({ person_id: null, programming_status: null, responsiva_status: null, status: "available" })
                .eq("id", cardId);
            if (error) throw error;

            const { ticketService } = await import("./tickets");
            await ticketService.deleteByCard(cardId, ["Programación", "Firma Responsiva"], "Ticket cancelado por desvinculación de tarjeta");

            const { data: card } = await supabase.from("cards").select("folio, type").eq("id", cardId).single();
            await HistoryService.log("CARD", cardId, "UNASSIGN", {
                message: `Tarjeta desvinculada de la persona`,
                entityName: card ? `${card.type} (Folio: ${card.folio})` : `Tarjeta (${cardId})`
            });
        }, "Unassign Card");
    },

    async delete(id: string) {
        return withErrorHandling(async () => {
            const { data: card } = await supabase.from("cards").select("folio, type").eq("id", id).single();
            const cardName = card ? `${card.type} (Folio: ${card.folio})` : `Tarjeta (${id})`;

            await HistoryService.log("CARD", id, "DELETE", {
                message: `Tarjeta eliminada permanentemente`,
                entityName: cardName
            });

            const { ticketService } = await import("./tickets");
            await ticketService.deleteByCard(id);

            const { error } = await supabase.from("cards").delete().eq("id", id);
            if (error) throw error;
        }, "Delete Card");
    },

    async fetchCardsByType(type: string): Promise<{ folio: string, status: string }[]> {
        return withErrorHandlingSafe(async () => {
            return await batchPaginate(async (from, to) => {
                return supabase.from("cards").select("folio, status").eq("type", type).range(from, to);
            });
        }, "Fetch Cards By Type", []);
    }
};
