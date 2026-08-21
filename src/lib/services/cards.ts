import { supabase } from "../supabase";
import { HistoryService } from "./history";
import { accessAssignmentService } from "./accessAssignments";
import type { Card } from "../types";
import { withErrorHandling, withErrorHandlingSafe, withErrorHandlingConditional, withTimeout, dbCache, batchPaginate } from "../utils";
import { networkStore } from "../stores/network.svelte";

/** Resuelve el tipo de medio a partir del nombre mostrado (ej. "P2000"). */
async function resolveMediaTypeId(type: string): Promise<string> {
    const { data: byKey } = await supabase
        .from("access_media_types")
        .select("id")
        .ilike("key", type)
        .limit(1)
        .maybeSingle();
    if (byKey) return byKey.id;

    const { data: byName } = await supabase
        .from("access_media_types")
        .select("id")
        .ilike("name", type)
        .limit(1)
        .maybeSingle();
    if (byName) return byName.id;

    throw new Error(`No existe un tipo de medio de acceso para "${type}"`);
}

/** Convierte una fila de access_media (con joins) a la forma `Card` de la UI. */
function toCard(m: any): Card {
    return {
        id: m.id,
        folio: m.identifier ?? "",
        type: mediaTypeName(m),
        status: m.status,
        person_id: m.person_id,
        programming_status: m.programming_status,
        responsiva_status: m.responsiva_status,
        personName: m.personnel ? `${m.personnel.first_name} ${m.personnel.last_name}` : "Sin asignar",
        personStatus: m.personnel?.status,
        personnel: m.personnel,
    };
}

/** Obtiene el nombre del tipo de medio (access_media_types puede venir como objeto o array). */
function mediaTypeName(m: any): string {
    const t = m?.access_media_types;
    if (Array.isArray(t)) return (t[0]?.name ?? "") as string;
    return (t?.name ?? (m?.metadata?.legacy_type as string) ?? "") as string;
}

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
                .from("access_media")
                .select("*, access_media_types(*), personnel(first_name, last_name, status)", { count: "exact" });

            if (search) {
                const terms = search.trim().split(/\s+/).filter(Boolean);
                const searchTerm = `%${search}%`;

                let peopleQuery = supabase.from("personnel").select("id");
                for (const term of terms) {
                    const termPattern = `%${term}%`;
                    peopleQuery = peopleQuery.or(`first_name.ilike.${termPattern},last_name.ilike.${termPattern}`);
                }
                const { data: people } = await peopleQuery;
                const personIds = people?.map(p => p.id) || [];

                if (personIds.length > 0) {
                    query = query.or(`identifier.ilike.${searchTerm},person_id.in.(${personIds.join(',')})`);
                } else {
                    query = query.ilike("identifier", searchTerm);
                }
            }

            if (typeFilter !== "Todos") {
                query = query.eq("access_media_types.name", typeFilter);
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
                .order("identifier", { ascending: true })
                .range(from, to);

            if (error) throw error;

            const mappedData = (data || []).map(toCard);
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
                let q = supabase.from("access_media").select("*, access_media_types(*), personnel(first_name, last_name, status)");
                if (search) {
                    const st = `%${search}%`;
                    if (personIds.length > 0) {
                        q = q.or(`identifier.ilike.${st},person_id.in.(${personIds.join(',')})`);
                    } else {
                        q = q.ilike("identifier", st);
                    }
                }
                if (typeFilter !== "Todos") q = q.eq("access_media_types.name", typeFilter);
                if (statusFilter !== "Todas") {
                    const sm: Record<string, string> = { "Activa": "active", "Bloqueada": "blocked", "Baja": "inactive", "Disponible": "available" };
                    if (sm[statusFilter]) q = q.eq("status", sm[statusFilter]);
                }
                if (depPersonIds !== null && depPersonIds.length > 0) {
                    q = q.in("person_id", depPersonIds);
                }
                return q.order("identifier", { ascending: true }).range(from, to);
            });

            return allData.map(toCard).sort((a, b) => a.folio.localeCompare(b.folio, undefined, { numeric: true }));
        }, "Fetch Cards for Export", []);
    },

    async fetchExtra(throwOnError: boolean = false): Promise<Card[]> {
        return withErrorHandlingConditional(async () => {
            const { data, error } = await supabase
                .from("access_media")
                .select("*, access_media_types(*)")
                .is("person_id", null);

            if (error) throw error;
            return (data || []).map(toCard);
        }, "Fetch Extra Cards", throwOnError, []);
    },

    /** Look up a card by exact folio + type, including owner info */
    async findByFolio(folio: string, type: string): Promise<{
        card: Card;
        ownerName: string | null;
    } | null> {
        const { data, error } = await supabase
            .from("access_media")
            .select("*, access_media_types(*), personnel(first_name, last_name)")
            .eq("identifier", folio)
            .eq("access_media_types.name", type)
            .maybeSingle();

        if (error || !data) return null;

        const person = data.personnel as { first_name?: string; last_name?: string } | null;
        const ownerName = person
            ? `${person.first_name || ""} ${person.last_name || ""}`.trim()
            : null;

        return { card: toCard(data), ownerName };
    },

    /** Search cards by folio loosely */
    async searchByFolio(folioPart: string): Promise<Card[]> {
        return withErrorHandlingSafe(async () => {
            const cleanFolio = (folioPart || "").trim();
            if (!cleanFolio) return [];

            const { data, error } = await supabase
                .from("access_media")
                .select("*, access_media_types(*), personnel(first_name, last_name)")
                .ilike("identifier", `%${cleanFolio}%`)
                .limit(5);

            if (error) throw error;
            return (data || []).map(toCard);
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
            const mediaTypeId = await resolveMediaTypeId(data.type);

            let isNewAssignment = false;
            if (data.id && data.person_id) {
                const { data: existing } = await supabase
                    .from("access_media")
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
                const { data: currentMedia } = await supabase
                    .from("access_media")
                    .select("id, identifier")
                    .eq("person_id", data.person_id)
                    .eq("media_type_id", mediaTypeId)
                    .neq("status", "inactive");

                if (currentMedia && currentMedia.length > 0) {
                    const oldMedia = currentMedia[0];
                    const newStatus = replacementOptions.oldCardStatus;

                    const { error: updateError } = await withTimeout(supabase
                        .from("access_media")
                        .update({
                            status: newStatus,
                            person_id: null,
                            programming_status: null,
                            responsiva_status: null,
                        })
                        .eq("id", oldMedia.id));

                    if (updateError) throw updateError;

                    await accessAssignmentService.revokeByMedia(oldMedia.id);

                    await HistoryService.log("CARD", oldMedia.id, "REPLACE_OLD", {
                        message: `Tarjeta ${oldMedia.identifier} reemplazada. Nuevo estado: ${newStatus === "blocked" ? "Baja Definitiva" : "Disponible"}`,
                        related_person_id: data.person_id,
                        entityName: `${data.type} (Folio: ${oldMedia.identifier})`
                    });
                }
            }

            const payload = {
                identifier: data.folio,
                media_type_id: mediaTypeId,
                status: data.status || (data.person_id ? "active" : "available"),
                person_id: data.person_id || null,
                programming_status: isNewAssignment ? "pending" : data.programming_status || null,
                responsiva_status: data.responsiva_status || null,
            };

            let cardId = data.id;

            if (cardId) {
                const { error } = await withTimeout(supabase.from("access_media").update(payload).eq("id", cardId));
                if (error) throw error;
            } else {
                const { data: newMedia, error } = await withTimeout(supabase
                    .from("access_media")
                    .insert([{ ...payload, metadata: { legacy_type: data.type, legacy_folio: data.folio } }])
                    .select()
                    .single());
                if (error) throw error;
                cardId = newMedia.id;
                await HistoryService.log("CARD", cardId, "CREATE", {
                    message: `Tarjeta ${payload.identifier} creada`,
                    entityName: `${data.type} (Folio: ${payload.identifier})`
                });
            }

            // Mantener la asignación del modelo nuevo (antes lo hacía el trigger).
            if (data.person_id && cardId) {
                await accessAssignmentService.assignMedia(data.person_id, mediaTypeId, cardId);
                await accessAssignmentService.rebuildPersonAccess(data.person_id);
            } else if (cardId) {
                await accessAssignmentService.revokeByMedia(cardId);
            }

            if (isNewAssignment) {
                const { ticketService } = await import("./tickets");
                await ticketService.create({
                    type: "Programación",
                    description: replacementOptions
                        ? `Reponer tarjeta ${data.type} (Folio anterior dado de baja/liberado). Nuevo folio: ${data.folio}`
                        : `Programar acceso para tarjeta ${data.type} folio ${data.folio}`,
                    priority: "alta",
                    person_id: data.person_id,
                    access_media_id: cardId,
                    title: `Programación: ${data.folio}`,
                });

                if (data.person_id) {
                    const { data: person } = await supabase.from("personnel").select("first_name, last_name").eq("id", data.person_id).single();
                    const personName = person ? `${person.first_name} ${person.last_name}` : `Personal (${data.person_id})`;

                    await HistoryService.log("PERSON", data.person_id, replacementOptions ? "REPLACE_CARD" : "ASSIGN_CARD", {
                        message: replacementOptions
                            ? `Tarjeta ${data.folio} (${data.type}) asignada por Reposición`
                            : `Tarjeta ${data.folio} (${data.type}) asignada`,
                        related_card_id: cardId,
                        entityName: personName
                    });
                }
            }
        }, "Save Card");
    },

    async updateProgrammingStatus(cardId: string, status: string | null) {
        return withErrorHandling(async () => {
            const { data: media } = await supabase.from("access_media")
                .select("identifier, responsiva_status, person_id, access_media_types(name)")
                .eq("id", cardId).single();

            const { error } = await supabase.from("access_media")
                .update({ programming_status: status }).eq("id", cardId);
            if (error) throw error;

            if (status === "done" && media && media.responsiva_status !== "signed" && media.person_id) {
                const typeName = mediaTypeName(media);
                const { ticketService } = await import("./tickets");
                await ticketService.create({
                    type: "Firma Responsiva",
                    description: `Firma de responsiva para tarjeta ${typeName} folio ${media.identifier}`,
                    priority: "media", person_id: media.person_id, access_media_id: cardId,
                    title: `Firma: ${media.identifier}`
                });
            }
        }, "Update Programming Status");
    },

    async updateResponsivaStatus(cardId: string, status: string) {
        return withErrorHandling(async () => {
            const { error } = await supabase.from("access_media")
                .update({ responsiva_status: status }).eq("id", cardId);
            if (error) throw error;

            if (status === "signed") {
                const { ticketService } = await import("./tickets");
                await ticketService.deleteByCard(cardId, ["Firma Responsiva"], "Ticket completado/atendido");
            }
        }, "Update Responsiva Status");
    },

    async updateStatus(cardId: string, status: string) {
        return withErrorHandling(async () => {
            const { data: media, error: fetchError } = await supabase.from("access_media")
                .select("person_id").eq("id", cardId).single();
            if (fetchError) throw fetchError;

            const finalStatus = (status === "active" && !media.person_id) ? "available" : status;

            const { error } = await supabase.from("access_media")
                .update({ status: finalStatus }).eq("id", cardId);
            if (error) throw error;
        }, "Update Card Status");
    },

    async unassign(cardId: string) {
        return withErrorHandling(async () => {
            const { error } = await supabase.from("access_media")
                .update({ person_id: null, programming_status: null, responsiva_status: null, status: "available" })
                .eq("id", cardId);
            if (error) throw error;

            await accessAssignmentService.revokeByMedia(cardId);

            const { ticketService } = await import("./tickets");
            await ticketService.deleteByCard(cardId, ["Programación", "Firma Responsiva"], "Ticket cancelado por desvinculación de tarjeta");

            const { data: media } = await supabase.from("access_media")
                .select("identifier, access_media_types(name)")
                .eq("id", cardId).single();
            await HistoryService.log("CARD", cardId, "UNASSIGN", {
                message: `Tarjeta desvinculada de la persona`,
                entityName: media ? `${mediaTypeName(media)} (Folio: ${media.identifier})` : `Tarjeta (${cardId})`
            });
        }, "Unassign Card");
    },

    async delete(id: string) {
        return withErrorHandling(async () => {
            const { data: media } = await supabase.from("access_media")
                .select("identifier, access_media_types(name)")
                .eq("id", id).single();
            const cardName = media ? `${mediaTypeName(media)} (Folio: ${media.identifier})` : `Tarjeta (${id})`;

            await HistoryService.log("CARD", id, "DELETE", {
                message: `Tarjeta eliminada permanentemente`,
                entityName: cardName
            });

            const { ticketService } = await import("./tickets");
            await ticketService.deleteByCard(id);

            await accessAssignmentService.revokeByMedia(id);

            const { error } = await supabase.from("access_media").delete().eq("id", id);
            if (error) throw error;
        }, "Delete Card");
    },

};
