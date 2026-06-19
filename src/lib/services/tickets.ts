import { supabase } from "../supabase";
import { HistoryService } from "./history";
import type { Ticket } from "../types";
import { handleError } from "../utils/error";
import { ticketState } from "../stores";
import { appEvents, EVENTS } from "../utils/appEvents";

export const ticketService = {
    async fetchAll(throwOnError: boolean = false): Promise<Ticket[]> {
        try {
            const { data, error } = await supabase
                .from("tickets")
                .select("*, personnel(first_name, last_name)")
                .eq("status", "pending")
                .order('created_at', { ascending: true })
                .limit(200); // Cap at 200 to avoid overloading initial load

            if (error) throw error;
            return (data || []).map(t => ({
                ...t,
                personId: t.person_id,
                cardId: t.card_id,
            } as Ticket));
        } catch (error) {
            handleError(error, "Fetch Tickets");
            if (throwOnError) throw error;
            return [];
        }
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
        try {
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            let selectString = "*, personnel(first_name, last_name, dependency_id)";
            if (dependencyId) {
                selectString = "*, personnel!inner(first_name, last_name, dependency_id)";
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

                // Find matching people IDs first
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

            const mapped = (data as any[] || []).map(t => ({
                ...t,
                personId: t.person_id,
                cardId: t.card_id,
            } as Ticket));

            return { data: mapped, count: count || 0 };
        } catch (error) {
            handleError(error, "Fetch Tickets Paginated");
            return { data: [], count: 0 };
        }
    },

    async fetchResponsivasForExport(
        dependencyId: string = ""
    ): Promise<any[]> {
        try {
            const allData: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            const personnelSelect = dependencyId
                ? "personnel!inner(id, first_name, last_name, employee_no, dependency_id, dependencies(name))"
                : "personnel(id, first_name, last_name, employee_no, dependency_id, dependencies(name))";

            while (hasMore) {
                let query = supabase
                    .from("tickets")
                    .select(`*, cards(id, folio, type), ${personnelSelect}`)
                    .eq("status", "pending")
                    .eq("type", "Firma Responsiva");

                if (dependencyId) {
                    query = query.eq("personnel.dependency_id", dependencyId);
                }

                const { data, error } = await query
                    .order("created_at", { ascending: true })
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;

                if (data && data.length > 0) {
                    allData.push(...data);
                    page++;
                    if (data.length < pageSize) hasMore = false;
                } else {
                    hasMore = false;
                }
            }

            return allData;
        } catch (error) {
            handleError(error, "Fetch Responsivas for Export");
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
                message: `Ticket creado: ${payload.title}`,
                entityName: `Ticket #${newTicket.id}: ${payload.title}`
            });

            ticketState.addTicket(newTicket as Ticket);
            appEvents.emit(EVENTS.TICKETS_CHANGED);
        } catch (error) {
            handleError(error, "Create Ticket");
            throw error;
        }
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
            card_id: null,
            payload: t.payload,
        }));

        try {
            const { data: newTickets, error } = await supabase
                .from('tickets')
                .insert(payloads)
                .select();

            if (error) throw error;

            created = newTickets?.length ?? 0;

            // Single history log for the whole import
            if (created > 0) {
                await HistoryService.log('TICKET', newTickets![0].id, 'CREATE', {
                    message: `Importación masiva: ${created} ticket(s) creados desde plantilla Excel`,
                    entityName: `Importación Excel (${new Date().toLocaleDateString()})`
                });
            }

            // Refresh store
            const fresh = await ticketService.fetchAll();
            ticketState.setTickets(fresh);
            appEvents.emit(EVENTS.TICKETS_CHANGED);
        } catch (err: any) {
            tickets.forEach((_, i) => errors.push({ index: i, message: err?.message ?? 'Error desconocido' }));
        }

        return { created, errors };
    },


    async delete(id: number, reason?: string) {
        try {
            // Fetch ticket title for history BEFORE deleting
            const { data: ticket } = await supabase.from("tickets").select("title").eq("id", id).single();

            // Log completion BEFORE removing data
            await HistoryService.log("TICKET", id, "COMPLETE", {
                message: reason || `Ticket completado/atendido`,
                entityName: ticket ? `Ticket #${id}: ${ticket.title}` : `Ticket #${id}`
            });

            const { error } = await supabase.from("tickets").delete().eq("id", id);
            if (error) throw error;
            ticketState.removeTicket(id);
            appEvents.emit(EVENTS.TICKETS_CHANGED);
        } catch (error) {
            handleError(error, "Delete Ticket");
            throw error;
        }
    },

    async deleteByCard(cardId: string, types?: string[], reason?: string) {
        try {
            // 0. Fetch tickets to log deletion
            let fetchQuery = supabase.from("tickets")
                .select("id, title")
                .eq("card_id", cardId);
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

            let query = supabase.from("tickets").delete().eq("card_id", cardId);
            if (types && types.length > 0) {
                query = query.in("type", types);
            }
            const { error } = await query;
            if (error) throw error;
            ticketState.removeByCard(cardId, types);
            appEvents.emit(EVENTS.TICKETS_CHANGED);
        } catch (error) {
            handleError(error, "Delete Tickets by Card");
            throw error;
        }
    },

    async deleteByPerson(personId: string, reason?: string) {
        try {
            // 0. Fetch tickets to log deletion
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

            // We delete all tickets linked to this person ID
            const { error } = await supabase.from("tickets").delete().eq("person_id", personId);
            if (error) throw error;
            ticketState.removeByPerson(personId);
            appEvents.emit(EVENTS.TICKETS_CHANGED);
        } catch (error) {
            handleError(error, "Delete Tickets by Person");
            throw error;
        }
    },

    async updateStatus(id: string, status: string, details?: string) {
        try {
            const { error } = await supabase.from("tickets").update({ status }).eq("id", id);
            if (error) throw error;
            // Fetch ticket title for history
            const { data: ticket } = await supabase.from("tickets").select("title").eq("id", id).single();

            await HistoryService.log("TICKET", id, "UPDATE_STATUS", {
                message: `Estado actualizado a ${status} ${details ? `(${details})` : ''}`,
                entityName: ticket ? `Ticket #${id}: ${ticket.title}` : `Ticket #${id}`
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
            appEvents.emit(EVENTS.TICKETS_CHANGED);
        } catch (error) {
            handleError(error, "Update Ticket Status");
            throw error;
        }
    }
};
