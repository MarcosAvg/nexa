import { supabase } from "../supabase";
import { HistoryService } from "./history";
import type { Ticket } from "../types";
import { withErrorHandling, withErrorHandlingSafe, withErrorHandlingConditional, batchPaginate, handleError } from "../utils";
import { ticketState } from "../stores";

type CardAssignmentInfo = {
    movementType: string;
    registeredAt: string;
};

async function fetchCardAssignmentTypes(
    cardIds: string[],
    personnelCreatedAt: Record<string, string>
): Promise<Record<string, CardAssignmentInfo>> {
    const result: Record<string, CardAssignmentInfo> = {};
    if (cardIds.length === 0) return result;

    const uniqueIds = [...new Set(cardIds)];
    const logs: { action: string; details: Record<string, unknown>; timestamp: string; entity_id?: string }[] = [];

    const chunkSize = 40;
    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
        const chunk = uniqueIds.slice(i, i + chunkSize);
        const orFilter = chunk
            .map((id) => `details->>related_card_id.eq.${id}`)
            .join(",");

        const { data, error } = await supabase
            .from("history_logs")
            .select("action, details, timestamp, entity_id")
            .eq("entity_type", "PERSON")
            .in("action", ["REPLACE_CARD", "ASSIGN_CARD"])
            .or(orFilter);

        if (error) {
            handleError(error, "Fetch Card Assignment Types");
            continue;
        }
        if (data) logs.push(...data);
    }

    const byCard: Record<string, { action: string; timestamp: string; personId?: string }> = {};
    for (const log of logs) {
        const cardId = (log.details as Record<string, unknown>)?.related_card_id as string | undefined;
        if (!cardId) continue;
        const existing = byCard[cardId];
        if (!existing || log.timestamp > existing.timestamp) {
            byCard[cardId] = {
                action: log.action,
                timestamp: log.timestamp,
                personId: log.entity_id || (log.details as Record<string, unknown>)?.related_person_id as string | undefined,
            };
        }
    }

    for (const cardId of uniqueIds) {
        const entry = byCard[cardId];
        if (!entry) {
            result[cardId] = { movementType: "Sin clasificar", registeredAt: "" };
            continue;
        }

        if (entry.action === "REPLACE_CARD") {
            result[cardId] = { movementType: "Reposición", registeredAt: entry.timestamp };
            continue;
        }

        const personCreated = entry.personId ? personnelCreatedAt[entry.personId] : null;
        let movementType = "Asignación";
        if (personCreated) {
            const assignDate = new Date(entry.timestamp);
            const createDate = new Date(personCreated);
            const diffDays = Math.floor(
                (assignDate.getTime() - createDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (diffDays >= 0 && diffDays <= 7) {
                movementType = "Alta de Personal";
            }
        }

        result[cardId] = { movementType, registeredAt: entry.timestamp };
    }

    return result;
}

async function enrichWithAccessMedia(tickets: any[]): Promise<any[]> {
    const mediaIds = tickets.map((t) => t.access_media_id).filter(Boolean) as string[];
    if (mediaIds.length === 0) return tickets;

    const uniqueIds = [...new Set(mediaIds)];
    const { data } = await supabase
        .from("access_media")
        .select("id, identifier, access_media_types(name)")
        .in("id", uniqueIds);

    const byMediaId = new Map<string, { type: string; folio: string }>();
    for (const m of data || []) {
        const rel = m.access_media_types as { name?: string }[] | { name?: string } | null | undefined;
        const typeName = Array.isArray(rel) ? (rel[0]?.name ?? "") : (rel?.name ?? "");
        byMediaId.set(m.id, {
            type: typeName,
            folio: m.identifier ?? "",
        });
    }

    return tickets.map((t) => {
        if (t.access_media_id && byMediaId.has(t.access_media_id)) {
            const info = byMediaId.get(t.access_media_id)!;
            return { ...t, cardType: info.type, cardFolio: info.folio };
        }
        return t;
    });
}

async function enrichWithMovementType(tickets: Ticket[]): Promise<(Ticket & { movementType: string; assignmentDate: string })[]> {
    const cardIds = tickets.map((t) => t.access_media_id).filter(Boolean) as string[];
    const personnelCreatedAt: Record<string, string> = {};
    for (const t of tickets) {
        const pers = t.personnel as { created_at?: string } | null;
        if (t.person_id && pers?.created_at) {
            personnelCreatedAt[t.person_id] = pers.created_at;
        }
    }

    const assignmentMap = await fetchCardAssignmentTypes(cardIds, personnelCreatedAt);

    return tickets.map((t: Ticket & { movementType?: string; assignmentDate?: string }) => {
        const info = t.access_media_id ? assignmentMap[t.access_media_id] : undefined;
        let movementType = info?.movementType ?? "Sin clasificar";
        let assignmentDate = info?.registeredAt || t.created_at;

        const personnelWithDate = t.personnel as { created_at?: string } | null;
        if (movementType === "Sin clasificar" && t.person_id && personnelWithDate?.created_at) {
            const createDate = new Date(personnelWithDate.created_at);
            const ticketDate = new Date(t.created_at);
            const diffDays = Math.floor(
                (ticketDate.getTime() - createDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (diffDays >= 0 && diffDays <= 7) {
                movementType = "Alta de Personal";
                assignmentDate = personnelWithDate.created_at;
            } else {
                movementType = "Asignación";
            }
        }

        return { ...t, movementType, assignmentDate } as Ticket & { movementType: string; assignmentDate: string };
    });
}

export const ticketService = {
    async fetchAll(throwOnError: boolean = false): Promise<Ticket[]> {
        return withErrorHandlingConditional(async () => {
            const { data, error } = await supabase
                .from("tickets")
                .select("*, personnel(first_name, last_name)")
                .eq("status", "pending")
                .order('created_at', { ascending: true })
                .limit(200);

            if (error) throw error;
            return (data || []).map(t => ({ ...t } as Ticket));
        }, "Fetch Tickets", throwOnError, []);
    },

    async fetchPaginated(
        page: number = 1,
        limit: number = 50,
        typeFilter: string = "Todos",
        priorityFilter: string = "Todas",
        search: string = "",
        section: string = "General",
        dependencyId: string = ""
    ): Promise<{ data: Ticket[]; count: number }> {
        return withErrorHandlingSafe(async () => {
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            let selectString = "*, personnel(first_name, last_name, dependency_id)";
            if (dependencyId) {
                selectString = "*, personnel!inner(first_name, last_name, dependency_id)";
            }
            if (section === "Responsivas") {
                selectString = dependencyId
                    ? "*, cards(id, folio, type), personnel!inner(first_name, last_name, dependency_id, created_at)"
                    : "*, cards(id, folio, type), personnel(first_name, last_name, dependency_id, created_at)";
            }

            let query = supabase
                .from("tickets")
                .select(selectString, { count: "exact" })
                .eq("status", "pending");

            if (section === "Responsivas") {
                query = query.eq("type", "Firma Responsiva");
            } else {
                query = query.neq("type", "Firma Responsiva");
                if (typeFilter && typeFilter !== "Todos") {
                    query = query.eq("type", typeFilter);
                }
            }
            if (priorityFilter && priorityFilter !== "Todas") {
                query = query.ilike("priority", priorityFilter);
            }
            if (dependencyId) {
                query = query.eq("personnel.dependency_id", dependencyId);
            }
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
                    query = query.or(`title.ilike.${searchTerm},description.ilike.${searchTerm},person_id.in.(${personIds.join(',')})`);
                } else {
                    query = query.or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);
                }
            }

            const { data, count, error } = await query
                .order('created_at', { ascending: true })
                .range(from, to);

            if (error) throw error;

            const mapped = ((data || []) as any[]).map(t => ({ ...t } as unknown as Ticket));
            const withMedia = await enrichWithAccessMedia(mapped);

            if (section === "Responsivas" && withMedia.length > 0) {
                const enriched = await enrichWithMovementType(withMedia);
                return { data: enriched as unknown as Ticket[], count: count || 0 };
            }

            return { data: withMedia as unknown as Ticket[], count: count || 0 };
        }, "Fetch Tickets Paginated", { data: [], count: 0 });
    },

    async fetchResponsivasForExport(
        dependencyId: string = "",
        search: string = ""
    ): Promise<(Ticket & { movementType: string; assignmentDate: string })[]> {
        return withErrorHandlingSafe(async () => {
            const personnelSelect = dependencyId
                ? "personnel!inner(id, first_name, last_name, employee_no, dependency_id, created_at, dependencies(name))"
                : "personnel(id, first_name, last_name, employee_no, dependency_id, created_at, dependencies(name))";

            // Resolver IDs de personas para la búsqueda una sola vez (fuera del batch)
            let searchPersonIds: string[] = [];
            if (search) {
                const terms = search.trim().split(/\s+/).filter(Boolean);
                let peopleQuery = supabase.from("personnel").select("id");
                for (const term of terms) {
                    peopleQuery = peopleQuery.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
                }
                const { data: people } = await peopleQuery;
                searchPersonIds = people?.map(p => p.id) || [];
            }

            const allData = await batchPaginate<any>(async (from, to) => {
                let query = supabase
                    .from("tickets")
                    .select(`*, cards(id, folio, type), ${personnelSelect}`)
                    .eq("status", "pending")
                    .eq("type", "Firma Responsiva");

                if (dependencyId) {
                    query = query.eq("personnel.dependency_id", dependencyId);
                }
                if (search) {
                    const searchTerm = `%${search}%`;
                    if (searchPersonIds.length > 0) {
                        query = query.or(`title.ilike.${searchTerm},description.ilike.${searchTerm},person_id.in.(${searchPersonIds.join(',')})`);
                    } else {
                        query = query.or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);
                    }
                }

                return query
                    .order("created_at", { ascending: true })
                    .range(from, to);
            });

            const withMedia = await enrichWithAccessMedia(allData);
            return enrichWithMovementType(withMedia);
        }, "Fetch Responsivas for Export", []);
    },

    async create(data: {
        type: string;
        description?: string;
        priority: string;
        person_id?: string | null;
        access_media_id?: string | null;
        title?: string;
        payload?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
    }) {
        return withErrorHandling(async () => {
            const payload = {
                type: data.type,
                description: data.description,
                priority: (data.priority || "media").toLowerCase(),
                status: "pending",
                person_id: data.person_id || null,
                access_media_id: data.access_media_id || null,
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
                message: `Ticket creado: ${payload.title}`,
                entityName: `Ticket #${newTicket.id}: ${payload.title}`
            });

            ticketState.addTicket(newTicket as Ticket);
        }, "Create Ticket");
    },

    async createBatch(
        tickets: { type: string; title: string; description: string; priority: string; payload: Record<string, string> }[]
    ): Promise<{ created: number; errors: { index: number; message: string }[] }> {
        const errors: { index: number; message: string }[] = [];
        let created = 0;

        const payloads = tickets.map(t => ({
            type: t.type,
            title: t.title,
            description: t.description,
            priority: t.priority.toLowerCase(),
            status: 'pending',
            person_id: null,
            access_media_id: null,
            payload: t.payload,
        }));

        try {
            const { data: newTickets, error } = await supabase
                .from('tickets')
                .insert(payloads)
                .select();

            if (error) throw error;

            created = newTickets?.length ?? 0;

            // Único registro de historial para toda la importación
            if (created > 0) {
                await HistoryService.log('TICKET', newTickets![0].id, 'CREATE', {
                    message: `Importación masiva: ${created} ticket(s) creados desde plantilla Excel`,
                    entityName: `Importación Excel (${new Date().toLocaleDateString()})`
                });
            }

            // Actualizar store
            const fresh = await ticketService.fetchAll();
            ticketState.setTickets(fresh);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            tickets.forEach((_, i) => errors.push({ index: i, message: msg }));
        }

        return { created, errors };
    },


    async delete(id: number, reason?: string) {
        return withErrorHandling(async () => {
            const { data: ticket } = await supabase.from("tickets").select("title").eq("id", id).single();

            await HistoryService.log("TICKET", id, "COMPLETE", {
                message: reason || `Ticket completado/atendido`,
                entityName: ticket ? `Ticket #${id}: ${ticket.title}` : `Ticket #${id}`
            });

            const { error } = await supabase.from("tickets").delete().eq("id", id);
            if (error) throw error;
            ticketState.removeTicket(id);
        }, "Delete Ticket");
    },

    async deleteByCard(cardId: string, types?: string[], reason?: string) {
        return withErrorHandling(async () => {
            let fetchQuery = supabase.from("tickets")
                .select("id, title")
                .eq("access_media_id", cardId);
            if (types && types.length > 0) fetchQuery = fetchQuery.in("type", types);

            const { data: tickets } = await fetchQuery;

            if (tickets) {
                for (const t of tickets) {
                    await HistoryService.log("TICKET", t.id, "CANCEL", {
                        message: reason || `Ticket #${t.id} cancelado por baja de tarjeta`,
                        entityName: `Ticket #${t.id}: ${t.title}`
                    });
                }
            }

            let query = supabase.from("tickets").delete().eq("access_media_id", cardId);
            if (types && types.length > 0) {
                query = query.in("type", types);
            }
            const { error } = await query;
            if (error) throw error;
            ticketState.removeByCard(cardId, types);
        }, "Delete Tickets by Card");
    },

    async deleteByPerson(personId: string, reason?: string) {
        return withErrorHandling(async () => {
            const { data: tickets } = await supabase.from("tickets")
                .select("id, title")
                .eq("person_id", personId);

            if (tickets) {
                for (const t of tickets) {
                    await HistoryService.log("TICKET", t.id, "CANCEL", {
                        message: reason || `Ticket #${t.id} cancelado por baja de personal`,
                        entityName: `Ticket #${t.id}: ${t.title}`
                    });
                }
            }

            const { error } = await supabase.from("tickets").delete().eq("person_id", personId);
            if (error) throw error;
            ticketState.removeByPerson(personId);
        }, "Delete Tickets by Person");
    },

};

