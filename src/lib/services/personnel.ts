import { supabase } from "../supabase";
import { HistoryService } from "./history";
import { withErrorHandling, withErrorHandlingSafe, withErrorHandlingConditional, withTimeout, dbCache, batchPaginate, batchCollectIds } from "../utils";
import type { Person, Card, DashboardMetrics } from "../types";
import { networkStore } from "../stores/network.svelte";

/** Row shape from personnel_with_status view or personnel table with joins */
interface PersonnelRow {
    id: string;
    first_name: string;
    last_name: string;
    employee_no: string;
    email?: string | null;
    area?: string | null;
    position?: string | null;
    floor?: string | null;
    status: string;
    computed_status?: string;
    entry_time?: string | null;
    exit_time?: string | null;
    building_id?: string | null;
    dependency_id?: string | null;
    building_name?: string | null;
    dependency_name?: string | null;
    photo_url?: string | null;
    floors_p2000?: string[];
    floors_kone?: string[];
    special_accesses?: string[];
    schedule_id?: string | null;
    schedule_name?: string | null;
    schedules?: { name: string; default_entry?: string; default_exit?: string } | null;
    buildings?: { name: string } | null;
    dependencies?: { name: string } | null;
    cards?: {
        id: string;
        folio: string;
        type: string;
        status: string;
        programming_status: string | null;
        responsiva_status: string | null;
    }[];
}

const mapPersonRecord = (p: PersonnelRow): Person => {
    const allCards = (p.cards || []);
    const activeCards = allCards.filter((c) => c.status === "active");
    const readyCards = activeCards.filter(
        (c) => c.programming_status === "done" && (c.responsiva_status === "signed" || c.responsiva_status === "legacy")
    );

    const readyTypes = new Set(readyCards.map((c) => c.type));

    let displayStatus = p.computed_status;
    if (!displayStatus) {
        displayStatus = "Baja";
        if (p.status === "active") {
            if (readyTypes.size >= 2) {
                displayStatus = "Activo/a";
            } else if (readyTypes.size === 1) {
                displayStatus = "Parcial";
            } else if (allCards.length > 0) {
                displayStatus = "Bloqueado/a";
            } else {
                displayStatus = "Sin Acceso";
            }
        } else if (p.status === "blocked") {
            displayStatus = "Bloqueado/a";
        }
    }

    return {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        name: `${p.first_name} ${p.last_name}`,
        employee_no: p.employee_no,
        email: p.email,
        area: p.area,
        position: p.position,
        floor: p.floor,
        building: p.building_name || p.buildings?.name || "N/A",
        dependency: p.dependency_name || p.dependencies?.name || "N/A",
        schedule: p.schedules ? {
            days: p.schedules.name,
            entry: p.entry_time || p.schedules.default_entry || "09:00",
            exit: p.exit_time || p.schedules.default_exit || "18:00"
        } : (p.schedule_name ? {
            days: p.schedule_name,
            entry: p.entry_time || "09:00",
            exit: p.exit_time || "18:00"
        } : null),
        status_raw: p.status,
        status: displayStatus,
        cards: p.cards || [],
        floors_p2000: p.floors_p2000 || [],
        floors_kone: p.floors_kone || [],
        specialAccesses: p.special_accesses || []
    } as Person;
};

export const personnelService = {
    async fetchAll(page: number = 1, limit: number = 50, search: string = "", statusFilter: string = "Todos", dependencyId: string = "", buildingId: string = ""): Promise<{ data: Person[], count: number }> {
        return withErrorHandlingSafe(async () => {
            const cacheKey = `personnel_page_${page}_${statusFilter}_${dependencyId}_${buildingId}_${search}`;
            if (!networkStore.isOnline) {
                const cachedData = await dbCache.load<{ data: Person[], count: number }>(cacheKey);
                if (cachedData) return cachedData;
                return { data: [], count: 0 };
            }

            let query = supabase
                .from("personnel_with_status")
                .select("*, cards(id, folio, type, status, programming_status, responsiva_status)", { count: "exact" });

            if (search) {
                const terms = search.trim().split(/\s+/).filter(Boolean);
                for (const term of terms) {
                    query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,employee_no.ilike.%${term}%`);
                }
            }
            if (statusFilter !== "Todos") query = query.eq("computed_status", statusFilter);
            if (dependencyId) query = query.eq("dependency_id", dependencyId);
            if (buildingId === "__none__") query = query.is("building_id", null);
            else if (buildingId) query = query.eq("building_id", buildingId);

            const from = (page - 1) * limit;
            const { data, count, error } = await query
                .order("first_name", { ascending: true })
                .range(from, from + limit - 1);

            if (error) {
                console.warn("Falling back from personnel_with_status view:", error.message);
                return this._fetchAllFallback(page, limit, search, statusFilter, dependencyId, buildingId);
            }

            const result = { data: (data || []).map(p => mapPersonRecord(p)), count: count || 0 };
            await dbCache.save(cacheKey, result);
            return result;
        }, "Fetch Personnel", { data: [], count: 0 });
    },

    // Helper para lógica de fallback
    async _fetchAllFallback(page: number, limit: number, search: string, statusFilter: string, dependencyId: string, buildingId: string) {
        const isComputedStatus = ["Activo/a", "Parcial", "Sin Acceso"].includes(statusFilter);
        const dbStatusMap: Record<string, string> = {
            "Bloqueado/a": "blocked",
            "Baja": "inactive"
        };

        // Construir query sin .range() — Supabase muta .range() in-place,
        // así que construimos una vez y encadenamos diferentes .range() por página en batchPaginate.
        const buildBaseQuery = (withCount: boolean = false): any => {
            let q: any = supabase
                .from("personnel");
            
            if (withCount) {
                q = q.select("*", { count: "exact", head: true });
            } else {
                q = q.select("*, cards(*), buildings(name), dependencies(name), schedules(*)");
            }

            if (search) {
                const terms = search.trim().split(/\s+/).filter(Boolean);
                for (const term of terms) {
                    const termPattern = `%${term}%`;
                    q = q.or(`first_name.ilike.${termPattern},last_name.ilike.${termPattern},employee_no.ilike.${termPattern}`);
                }
            }

            if (statusFilter !== "Todos") {
                if (dbStatusMap[statusFilter]) {
                    q = q.eq("status", dbStatusMap[statusFilter]);
                } else if (isComputedStatus) {
                    q = q.eq("status", "active");
                }
            }

            if (dependencyId) q = q.eq("dependency_id", dependencyId);
            if (buildingId === "__none__") q = q.is("building_id", null);
            else if (buildingId) q = q.eq("building_id", buildingId);

            return q;
        };

        if (isComputedStatus) {
            const allData = await batchPaginate<any>(async (from, to) => {
                return buildBaseQuery()
                    .order("first_name", { ascending: true })
                    .range(from, to);
            });

            const allMapped = allData.map(p => mapPersonRecord(p));
            const filtered = allMapped.filter(p => p.status === statusFilter);
            const from = (page - 1) * limit;
            return { data: filtered.slice(from, from + limit), count: filtered.length };
        } else {
            const from = (page - 1) * limit;
            const to = from + limit - 1;
            const baseQuery = buildBaseQuery();
            const { data, error } = await baseQuery
                .order("first_name", { ascending: true })
                .range(from, to);
            if (error) throw error;
            const { count, error: countError } = await buildBaseQuery(true);
            if (countError) throw countError;
            return { data: (data || []).map((p: any) => mapPersonRecord(p)), count: count || 0 };
        }
    },

    async fetchOptions(throwOnError: boolean = false): Promise<{ id: string, name: string, employee_no: string }[]> {
        return withErrorHandlingConditional(async () => {
            const { data, error } = await supabase
                .from("personnel")
                .select("id, first_name, last_name, employee_no")
                .neq("status", "inactive")
                .order("first_name", { ascending: true });
            if (error) throw error;
            return (data || []).map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, employee_no: p.employee_no }));
        }, "Fetch Personnel Options", throwOnError, []);
    },

    async fetchForExport(search: string = "", statusFilter: string = "Todos", dependencyId: string = ""): Promise<Person[]> {
        return withErrorHandlingSafe(async () => {
            const isComputedStatus = ["Activo/a", "Parcial", "Sin Acceso"].includes(statusFilter);
            const dbStatusMap: Record<string, string> = { "Bloqueado/a": "blocked", "Baja": "inactive" };

            const allData = await batchPaginate<any>(async (from, to) => {
                let q = supabase.from("personnel").select("*, cards(*), buildings(name), dependencies(name), schedules(*)");
                if (search) {
                    const terms = search.trim().split(/\s+/).filter(Boolean);
                    for (const term of terms) q = q.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,employee_no.ilike.%${term}%`);
                }
                if (statusFilter !== "Todos") q = dbStatusMap[statusFilter] ? q.eq("status", dbStatusMap[statusFilter]) : q.eq("status", "active");
                if (dependencyId) q = q.eq("dependency_id", dependencyId);
                return q.order("first_name", { ascending: true }).range(from, to);
            });

            const mapped = allData.map(p => mapPersonRecord(p));
            return isComputedStatus ? mapped.filter(p => p.status === statusFilter) : mapped;
        }, "Fetch Personnel for Export", []);
    },

    async fetchById(id: string): Promise<Person | null> {
        return withErrorHandlingSafe(async () => {
            const { data, error } = await supabase
                .from("personnel")
                .select("*, cards(*), buildings(name), dependencies(name), schedules(*)")
                .eq("id", id).single();
            if (error) throw error;
            return data ? mapPersonRecord(data) : null;
        }, "Fetch Person By ID", null);
    },

    /** Search personnel by apellidos and/or nombres (case-insensitive ilike).
     * Returns all candidates ordered by last_name. Caller decides how to handle 0/1/many results. */
    async searchByName(apellidos: string, nombres: string): Promise<Person[]> {
        return withErrorHandlingSafe(async () => {
            const cleanApellidos = (apellidos || "").trim();
            const cleanNombres = (nombres || "").trim();
            if (!cleanApellidos && !cleanNombres) return [];

            let peopleQuery;
            let rpcIds: string[] | null = null;

            if (!cleanApellidos || !cleanNombres) {
                const queryStr = cleanApellidos || cleanNombres;
                const terms = queryStr.split(/\s+/).filter(Boolean);
                if (terms.length === 0) return [];

                peopleQuery = supabase.from("personnel").select("*, cards(*), buildings(name), dependencies(name), schedules(*)");
                for (const term of terms) peopleQuery = peopleQuery.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,employee_no.ilike.%${term}%`);
                peopleQuery = peopleQuery.order("first_name", { ascending: true }).limit(20);
            } else {
                const { data, error } = await supabase.rpc('search_personnel_fuzzy', { p_last_name: cleanApellidos, p_first_name: cleanNombres, p_limit: 20 });
                if (error) throw error;
                if (!data || data.length === 0) return [];
                rpcIds = data.map((p: { id: string }) => p.id);
                peopleQuery = supabase.from("personnel").select("*, cards(*), buildings(name), dependencies(name), schedules(*)").in("id", rpcIds ?? []);
            }

            const { data: fullPeople, error: fetchError } = await peopleQuery;
            if (fetchError) throw fetchError;

            let orderedPeople = fullPeople || [];
            if (rpcIds) {
                const idToData = Object.fromEntries(fullPeople.map(p => [p.id, p]));
                orderedPeople = rpcIds.map(id => idToData[id]).filter(Boolean);
            }

            return orderedPeople.map(p => ({
                id: p.id, first_name: p.first_name, last_name: p.last_name,
                name: `${p.first_name} ${p.last_name}`, employee_no: p.employee_no,
                email: p.email, area: p.area, position: p.position, floor: p.floor,
                building: p.buildings?.name || "N/A", dependency: p.dependencies?.name || "N/A",
                building_id: p.building_id, dependency_id: p.dependency_id,
                schedule: p.schedules ? { days: p.schedules.name, entry: p.entry_time || p.schedules.default_entry || "09:00", exit: p.exit_time || p.schedules.default_exit || "18:00" } : null,
                status_raw: p.status, status: p.status, cards: p.cards || [],
                floors_p2000: p.floors_p2000 || [], floors_kone: p.floors_kone || [],
                specialAccesses: p.special_accesses || []
            } as Person));
        }, "Search Personnel by Name (Fuzzy)", []);
    },

    /** Input shape for creating/updating a personnel record */
    async save(data: {
        id?: string;
        first_name?: string;
        last_name?: string;
        nombres?: string;
        apellidos?: string;
        employee_no?: string;
        noEmpleado?: string;
        email?: string | null;
        area?: string;
        areaEquipo?: string;
        position?: string;
        puestoFuncion?: string;
        dependency_id?: string;
        dependencyId?: string;
        building_id?: string;
        buildingId?: string;
        floor?: string;
        pisoBase?: string;
        floors_p2000?: string[];
        floors_kone?: string[];
        schedule_id?: string;
        scheduleId?: string;
        entry_time?: string | null;
        exit_time?: string | null;
        specialAccesses?: string[];
        special_accesses?: string[];
        status?: string;
        cards?: any[];
        [key: string]: unknown;
    }) {
        return withErrorHandling(async () => {
            if (!data.id) {
                const results = await this.searchByName(
                    data.apellidos || data.last_name || "",
                    data.nombres || data.first_name || "",
                );
                const isDuplicate = results.some((r) => {
                    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return norm(r.first_name + " " + r.last_name) === norm((data.nombres || data.first_name || "") + " " + (data.apellidos || data.last_name || ""));
                });
                if (isDuplicate) throw new Error(`Ya existe un registro activo con el nombre "${data.nombres || data.first_name} ${data.apellidos || data.last_name}".`);
            }

            const payload = {
                first_name: data.first_name || data.nombres,
                last_name: data.last_name || data.apellidos,
                employee_no: (data.employee_no || data.noEmpleado)?.trim() || null,
                area: data.area || data.areaEquipo,
                position: data.position || data.puestoFuncion,
                dependency_id: data.dependency_id || data.dependencyId,
                building_id: data.building_id || data.buildingId,
                floor: data.floor || data.pisoBase,
                floors_p2000: data.floors_p2000 || [],
                floors_kone: data.floors_kone || [],
                schedule_id: data.schedule_id || data.scheduleId,
                entry_time: data.entry_time || null,
                exit_time: data.exit_time || null,
                special_accesses: data.specialAccesses || data.special_accesses || [],
                email: data.email || null,
                status: data.status || "active"
            };

            let personId = data.id;
            if (personId) {
                const { error } = await withTimeout(supabase.from("personnel").update(payload).eq("id", personId));
                if (error) throw error;
                await HistoryService.log("PERSONNEL", personId, "UPDATE", { message: `Actualización de ${payload.first_name}`, entityName: `${payload.first_name} ${payload.last_name}` });
            } else {
                const { data: newPerson, error } = await withTimeout(supabase.from("personnel").insert([payload]).select().single());
                if (error) throw error;
                personId = newPerson.id;
                await HistoryService.log("PERSONNEL", personId, "CREATE", { message: `Registro de ${payload.first_name}`, entityName: `${payload.first_name} ${payload.last_name}` });
            }

            const cards = data.cards || [];
            if (cards.length > 0) {
                const { cardService } = await import("./cards");
                for (const card of cards) await cardService.save({ ...card, person_id: personId });
            }
        }, "Save Personnel");
    },

    async updateStatus(id: string, status: string) {
        return withErrorHandling(async () => {
            const { error } = await withTimeout(supabase.from("personnel").update({ status }).eq("id", id));
            if (error) throw error;

            const { error: cardError } = await withTimeout(supabase.from("cards").update({ status }).eq("person_id", id));
            if (cardError) throw cardError;

            if (status === "inactive" || status === "baja") {
                const { ticketService } = await import("./tickets");
                await ticketService.deleteByPerson(id);
            }

            const { data: person } = await supabase.from("personnel").select("first_name, last_name").eq("id", id).single();
            const personName = person ? `${person.first_name} ${person.last_name}` : `Personal (${id})`;
            const statusLabel = status === 'active' ? 'activo' : status === 'blocked' ? 'bloqueado/a' : 'BAJA';

            await HistoryService.log("PERSONNEL", id, "UPDATE_STATUS", {
                message: `Estado actualizado a ${statusLabel} (incluye tarjetas)`,
                entityName: personName
            });
        }, "Update Personnel Status");
    },

    async delete(id: string, cardActionMap?: Record<string, "delete" | "keep">) {
        return withErrorHandling(async () => {
            const { data: person } = await supabase.from("personnel").select("first_name, last_name").eq("id", id).single();
            const personName = person ? `${person.first_name} ${person.last_name}` : `Personal (${id})`;

            if (cardActionMap) {
                for (const [cardId, action] of Object.entries(cardActionMap)) {
                    if (action === "delete") await supabase.from("cards").delete().eq("id", cardId);
                    else if (action === "keep") await supabase.from("cards").update({ person_id: null, status: "available", responsiva_status: "unsigned", programming_status: "pending" }).eq("id", cardId);
                }
            }

            await HistoryService.log("PERSONNEL", id, "DELETE", {
                message: `Registro eliminado permanentemente${cardActionMap ? " (con gestión de tarjetas)" : ""}`,
                entityName: personName
            });

            const { error } = await supabase.from("personnel").delete().eq("id", id);
            if (error) throw error;
        }, "Delete Personnel");
    },

    async fetchDashboardStats() {
        return withErrorHandlingSafe(async () => {
            const readyPersonIds = await batchCollectIds(async (from, to) => {
                return supabase.from("cards")
                    .select("person_id").eq("status", "active").eq("programming_status", "done")
                    .in("responsiva_status", ["signed", "legacy"]).not("person_id", "is", null)
                    .range(from, to);
            }, "person_id");

            const activePersonnelIds = await batchCollectIds(async (from, to) => {
                return supabase.from("personnel").select("id").eq("status", "active").range(from, to);
            });

            let activePersonnelCount = 0;
            for (const id of readyPersonIds) { if (activePersonnelIds.has(id)) activePersonnelCount++; }

            const { count: koneStock, error: kError } = await supabase.from("cards")
                .select("*", { count: "exact", head: true }).is("person_id", null).eq("status", "available").eq("type", "KONE");
            if (kError) throw kError;

            const { count: p2000Stock, error: p2Error } = await supabase.from("cards")
                .select("*", { count: "exact", head: true }).is("person_id", null).eq("status", "available").eq("type", "P2000");
            if (p2Error) throw p2Error;

            return { activePersonnel: activePersonnelCount, koneStock: koneStock || 0, p2000Stock: p2000Stock || 0 };
        }, "Fetch Dashboard Stats", { activePersonnel: 0, koneStock: 0, p2000Stock: 0 });
    },

    async fetchDashboardMetrics(): Promise<DashboardMetrics> {
        return withErrorHandlingSafe(async () => {
            const { data, error } = await supabase.rpc('get_dashboard_metrics');
            if (error) throw error;
            return data as DashboardMetrics;
        }, "Fetch Dashboard Metrics (RPC)", {
            totalPersonnel: 0,
            statusCounts: { activo: 0, parcial: 0, inactivo: 0, bloqueado: 0, baja: 0 },
            cardCoverage: { conP2000: 0, sinP2000: 0, conKone: 0, sinKone: 0, operativos: 0 },
            topDependencies: [],
            topBuildings: [],
            dataQuality: { sinEmail: 0, sinSchedule: 0, sinPosition: 0, sinArea: 0, total: 0 },
        });
    },

    subscribeToChanges(callback: (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void) {
        return supabase
            .channel('personnel-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'personnel' },
                (payload) => callback(payload)
            )
            .subscribe();
    }
};

