import { supabase } from "../supabase";
import { HistoryService } from "./history";
import { handleError, withTimeout } from "../utils/error";
import { catalogCache } from "../utils/catalogCache";
import { appEvents, EVENTS } from "../utils/appEvents";
import type { Person, Card, DashboardMetrics } from "../types";

const mapPersonRecord = (p: any): Person => {
    const allCards = (p.cards || []);
    const activeCards = allCards.filter((c: any) => c.status === "active");
    const readyCards = activeCards.filter(
        (c: any) => c.programming_status === "done" && (c.responsiva_status === "signed" || c.responsiva_status === "legacy")
    );

    const readyTypes = new Set(readyCards.map((c: any) => c.type));

    let displayStatus = "Baja";

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
        building: p.buildings?.name || "N/A",
        dependency: p.dependencies?.name || "N/A",
        schedule: p.schedules ? {
            days: p.schedules.name,
            entry: p.entry_time || p.schedules.default_entry || "09:00",
            exit: p.exit_time || p.schedules.default_exit || "18:00"
        } : null,
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
        try {
            // "Activo/a", "Parcial", "Sin Acceso" are computed from DB status "active" + card readiness.
            // We can only filter "Bloqueado/a" and "Baja" directly at the DB level.
            // For computed statuses we must query all "active" records and post-filter.
            const isComputedStatus = ["Activo/a", "Parcial", "Sin Acceso"].includes(statusFilter);
            const dbStatusMap: Record<string, string> = {
                "Bloqueado/a": "blocked",
                "Baja": "inactive"
            };

            let query = supabase
                .from("personnel")
                .select("*, cards(*), buildings(name), dependencies(name), schedules(*)", { count: "exact" });

            if (search) {
                const searchTerm = `%${search}%`;
                query = query.or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},employee_no.ilike.${searchTerm}`);
            }

            if (statusFilter !== "Todos") {
                if (dbStatusMap[statusFilter]) {
                    // Direct DB status
                    query = query.eq("status", dbStatusMap[statusFilter]);
                } else if (isComputedStatus) {
                    // All computed statuses derive from "active"
                    query = query.eq("status", "active");
                }
            }

            if (dependencyId) {
                query = query.eq("dependency_id", dependencyId);
            }

            if (buildingId === "__none__") {
                query = query.is("building_id", null);
            } else if (buildingId) {
                query = query.eq("building_id", buildingId);
            }

            // For computed statuses, we need to fetch ALL matching "active" records to post-filter
            // and then manually paginate. Supabase caps at 1000 rows per request, so we batch.
            if (isComputedStatus) {
                const allMapped: Person[] = [];
                let batchPage = 0;
                const batchSize = 1000;
                let hasMore = true;

                while (hasMore) {
                    const { data: batch, error } = await query
                        .order("first_name", { ascending: true })
                        .range(batchPage * batchSize, (batchPage + 1) * batchSize - 1);
                    if (error) throw error;

                    if (batch && batch.length > 0) {
                        allMapped.push(...batch.map(p => mapPersonRecord(p)));
                        if (batch.length < batchSize) hasMore = false;
                        else batchPage++;
                    } else {
                        hasMore = false;
                    }
                }

                const filtered = allMapped.filter(p => p.status === statusFilter);
                const from = (page - 1) * limit;
                const paged = filtered.slice(from, from + limit);

                return { data: paged, count: filtered.length };
            } else {
                const from = (page - 1) * limit;
                const to = from + limit - 1;
                const { data, count, error } = await query
                    .order("first_name", { ascending: true })
                    .range(from, to);

                if (error) throw error;
                const mappedData = (data || []).map(p => mapPersonRecord(p));
                return { data: mappedData, count: count || 0 };
            }
        } catch (error) {
            handleError(error, "Fetch Personnel");
            return { data: [], count: 0 };
        }
    },

    async fetchOptions(throwOnError: boolean = false): Promise<{ id: string, name: string, employee_no: string }[]> {
        try {
            const { data, error } = await supabase
                .from("personnel")
                .select("id, first_name, last_name, employee_no")
                .neq("status", "inactive")
                .order("first_name", { ascending: true });

            if (error) throw error;

            return (data || []).map(p => ({
                id: p.id,
                name: `${p.first_name} ${p.last_name}`,
                employee_no: p.employee_no
            }));
        } catch (error) {
            handleError(error, "Fetch Personnel Options");
            if (throwOnError) throw error;
            return [];
        }
    },

    async fetchForExport(search: string = "", statusFilter: string = "Todos", dependencyId: string = ""): Promise<Person[]> {
        try {
            const isComputedStatus = ["Activo/a", "Parcial", "Sin Acceso"].includes(statusFilter);
            const dbStatusMap: Record<string, string> = {
                "Bloqueado/a": "blocked",
                "Baja": "inactive"
            };

            const allData: Person[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                let query = supabase
                    .from("personnel")
                    .select("*, cards(*), buildings(name), dependencies(name), schedules(*)");

                if (search) {
                    const searchTerm = `%${search}%`;
                    query = query.or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},employee_no.ilike.${searchTerm}`);
                }

                if (statusFilter !== "Todos") {
                    if (dbStatusMap[statusFilter]) {
                        query = query.eq("status", dbStatusMap[statusFilter]);
                    } else if (isComputedStatus) {
                        query = query.eq("status", "active");
                    }
                }

                if (dependencyId) {
                    query = query.eq("dependency_id", dependencyId);
                }

                const { data, error } = await query
                    .order("first_name", { ascending: true })
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;

                if (data && data.length > 0) {
                    allData.push(...data.map(p => mapPersonRecord(p)));
                    page++;
                    if (data.length < pageSize) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            }

            // Post-filter for computed statuses
            if (isComputedStatus) {
                return allData.filter(p => p.status === statusFilter);
            }
            return allData;
        } catch (error) {
            handleError(error, "Fetch Personnel for Export");
            return [];
        }
    },

    async fetchById(id: string): Promise<Person | null> {
        try {
            const { data, error } = await supabase
                .from("personnel")
                .select("*, cards(*), buildings(name), dependencies(name), schedules(*)")
                .eq("id", id)
                .single();

            if (error) throw error;
            if (!data) return null;

            return mapPersonRecord(data);
        } catch (error) {
            handleError(error, "Fetch Person By ID");
            return null;
        }
    },

    /** Search personnel by apellidos and/or nombres (case-insensitive ilike).
     * Returns all candidates ordered by last_name. Caller decides how to handle 0/1/many results. */
    async searchByName(apellidos: string, nombres: string): Promise<Person[]> {
        try {
            let query = supabase
                .from("personnel")
                .select("*, cards(*), buildings(name), dependencies(name), schedules(*)");

            if (apellidos) query = query.ilike("last_name", `%${apellidos.trim()}%`);
            if (nombres) query = query.ilike("first_name", `%${nombres.trim()}%`);

            const { data, error } = await query
                .neq("status", "inactive")
                .order("last_name", { ascending: true })
                .limit(10);

            if (error) throw error;

            return (data || []).map((p: any) => ({
                id: p.id,
                first_name: p.first_name,
                last_name: p.last_name,
                name: `${p.first_name} ${p.last_name}`,
                employee_no: p.employee_no,
                email: p.email,
                area: p.area,
                position: p.position,
                floor: p.floor,
                building: p.buildings?.name || "N/A",
                dependency: p.dependencies?.name || "N/A",
                building_id: p.building_id,
                dependency_id: p.dependency_id,
                schedule: p.schedules ? {
                    days: p.schedules.name,
                    entry: p.entry_time || p.schedules.default_entry || "09:00",
                    exit: p.exit_time || p.schedules.default_exit || "18:00"
                } : null,
                status_raw: p.status,
                status: p.status,
                cards: p.cards || [],
                floors_p2000: p.floors_p2000 || [],
                floors_kone: p.floors_kone || [],
                specialAccesses: p.special_accesses || []
            } as Person));
        } catch (error) {
            handleError(error, "Search Personnel by Name");
            return [];
        }
    },

    async save(data: any) {
        try {
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

            // Assign cards to the person
            const cards = data.cards || [];
            if (cards.length > 0) {
                const { cardService } = await import("./cards");
                for (const card of cards) {
                    await cardService.save({
                        ...card,
                        person_id: personId,
                    });
                }
            }

            appEvents.emit(EVENTS.PERSONNEL_CHANGED);
        } catch (error) {
            handleError(error, "Save Personnel");
            throw error;
        }
    },

    async updateStatus(id: string, status: string) {
        try {
            // Update Person
            const { error } = await withTimeout(supabase.from("personnel").update({ status }).eq("id", id));
            if (error) throw error;

            // Cascade to Cards
            const cardStatus = status;
            const { error: cardError } = await withTimeout(supabase
                .from("cards")
                .update({ status: cardStatus })
                .eq("person_id", id));

            if (cardError) throw cardError;

            // If status is 'baja' (inactive/baja), delete all tickets linked to this person
            if (status === "inactive" || status === "baja") {
                const { ticketService } = await import("./tickets");
                await ticketService.deleteByPerson(id);
            }

            // Fetch person name for history before logging
            const { data: person } = await supabase.from("personnel").select("first_name, last_name").eq("id", id).single();
            const personName = person ? `${person.first_name} ${person.last_name}` : `Personal (${id})`;

            // Consolidated Log for status change (avoids noise from cascading card updates)
            const statusLabel = status === 'active' ? 'activo' : status === 'blocked' ? 'bloqueado/a' : 'BAJA';
            await HistoryService.log("PERSONNEL", id, "UPDATE_STATUS", {
                message: `Estado actualizado a ${statusLabel} (incluye tarjetas)`,
                entityName: personName
            });
            appEvents.emit(EVENTS.PERSONNEL_CHANGED);
            appEvents.emit(EVENTS.CARDS_CHANGED);
        } catch (error) {
            handleError(error, "Update Personnel Status");
            throw error;
        }
    },

    async delete(id: string, cardActionMap?: Record<string, "delete" | "keep">) {
        try {
            // Log deletion BEFORE removing data
            // Fetch person name for history BEFORE deleting
            const { data: person } = await supabase.from("personnel").select("first_name, last_name").eq("id", id).single();
            const personName = person ? `${person.first_name} ${person.last_name}` : `Personal (${id})`;

            // Handle card actions if provided
            if (cardActionMap) {
                for (const [cardId, action] of Object.entries(cardActionMap)) {
                    if (action === "delete") {
                        await supabase.from("cards").delete().eq("id", cardId);
                    } else if (action === "keep") {
                        await supabase
                            .from("cards")
                            .update({
                                person_id: null,
                                status: "available",
                                responsiva_status: "unsigned",
                                programming_status: "pending"
                            })
                            .eq("id", cardId);
                    }
                }
            }

            await HistoryService.log("PERSONNEL", id, "DELETE", {
                message: `Registro eliminado permanentemente${cardActionMap ? " (con gestión de tarjetas)" : ""}`,
                entityName: personName
            });

            // Delete the person
            const { error } = await supabase.from("personnel").delete().eq("id", id);
            if (error) throw error;
            appEvents.emit(EVENTS.PERSONNEL_CHANGED);
        } catch (error) {
            handleError(error, "Delete Personnel");
            throw error;
        }
    },

    async fetchDashboardStats() {
        try {
            // 1. Get all unique person_id from cards that meet the 'ready' criteria
            // We batch fetch because of the 1000 row limit of PostgREST
            const readyPersonIds = new Set<string>();
            let hasMoreCards = true;
            let cardPage = 0;
            const batchSize = 1000;

            while (hasMoreCards) {
                const { data: cardBatch, error: cError } = await supabase
                    .from("cards")
                    .select("person_id")
                    .eq("status", "active")
                    .eq("programming_status", "done")
                    .in("responsiva_status", ["signed", "legacy"])
                    .not("person_id", "is", null)
                    .range(cardPage * batchSize, (cardPage + 1) * batchSize - 1);

                if (cError) throw cError;
                if (!cardBatch || cardBatch.length === 0) {
                    hasMoreCards = false;
                } else {
                    cardBatch.forEach(c => readyPersonIds.add(c.person_id));
                    if (cardBatch.length < batchSize) hasMoreCards = false;
                    else cardPage++;
                }
            }

            // 2. Get all personnel IDs where status is active
            const activePersonnelIds = new Set<string>();
            let hasMorePeople = true;
            let peoplePage = 0;

            while (hasMorePeople) {
                const { data: peopleBatch, error: pError } = await supabase
                    .from("personnel")
                    .select("id")
                    .eq("status", "active")
                    .range(peoplePage * batchSize, (peoplePage + 1) * batchSize - 1);

                if (pError) throw pError;
                if (!peopleBatch || peopleBatch.length === 0) {
                    hasMorePeople = false;
                } else {
                    peopleBatch.forEach(p => activePersonnelIds.add(p.id));
                    if (peopleBatch.length < batchSize) hasMorePeople = false;
                    else peoplePage++;
                }
            }

            // 3. Intersection: People who are active AND have at least one ready card
            let activePersonnelCount = 0;
            for (const id of readyPersonIds) {
                if (activePersonnelIds.has(id)) {
                    activePersonnelCount++;
                }
            }

            // 4. Card Stock Counts (head queries are NOT subject to the 1000 record delivery limit)
            const { count: koneStock, error: kError } = await supabase
                .from("cards")
                .select("*", { count: "exact", head: true })
                .is("person_id", null)
                .eq("status", "available")
                .eq("type", "KONE");

            if (kError) throw kError;

            const { count: p2000Stock, error: p2Error } = await supabase
                .from("cards")
                .select("*", { count: "exact", head: true })
                .is("person_id", null)
                .eq("status", "available")
                .eq("type", "P2000");

            if (p2Error) throw p2Error;

            return {
                activePersonnel: activePersonnelCount,
                koneStock: koneStock || 0,
                p2000Stock: p2000Stock || 0
            };
        } catch (error) {
            handleError(error, "Fetch Dashboard Stats");
            return { activePersonnel: 0, koneStock: 0, p2000Stock: 0 };
        }
    },

    async fetchDashboardMetrics(): Promise<DashboardMetrics> {
        const empty: DashboardMetrics = {
            totalPersonnel: 0,
            statusCounts: { activo: 0, parcial: 0, inactivo: 0, bloqueado: 0, baja: 0 },
            cardCoverage: { conP2000: 0, sinP2000: 0, conKone: 0, sinKone: 0, operativos: 0 },
            topDependencies: [],
            topBuildings: [],
            dataQuality: { sinEmail: 0, sinSchedule: 0, sinPosition: 0, sinArea: 0, total: 0 },
        };
        try {
            // Fetch ALL personnel with cards (batched)
            const allData: Person[] = [];
            let page = 0;
            const batchSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from("personnel")
                    .select("*, cards(*), buildings(name), dependencies(name), schedules(*)")
                    .order("first_name", { ascending: true })
                    .range(page * batchSize, (page + 1) * batchSize - 1);

                if (error) throw error;
                if (data && data.length > 0) {
                    allData.push(...data.map(p => mapPersonRecord(p)));
                    if (data.length < batchSize) hasMore = false;
                    else page++;
                } else {
                    hasMore = false;
                }
            }

            const total = allData.length;
            if (total === 0) return empty;

            // Status counts
            const activo = allData.filter(p => p.status === "Activo/a").length;
            const parcial = allData.filter(p => p.status === "Parcial").length;
            const inactivo = allData.filter(p => p.status === "Sin Acceso").length;
            const bloqueado = allData.filter(p => p.status === "Bloqueado/a").length;
            const baja = allData.filter(p => p.status === "Baja").length;

            // Card coverage (operativos = activo + parcial)
            const operativos = allData.filter(p => p.status === "Activo/a" || p.status === "Parcial");
            const opCount = operativos.length;
            const conP2000 = operativos.filter(p => p.cards?.some(c => c.type?.toUpperCase() === "P2000")).length;
            const conKone = operativos.filter(p => p.cards?.some(c => c.type?.toUpperCase() === "KONE")).length;

            // Top Dependencies
            const depMap: Record<string, { total: number; activos: number }> = {};
            allData.forEach(p => {
                const dep = p.dependency || "Sin Dependencia";
                if (!depMap[dep]) depMap[dep] = { total: 0, activos: 0 };
                depMap[dep].total++;
                if (p.status === "Activo/a" || p.status === "Parcial") depMap[dep].activos++;
            });
            const topDependencies = Object.entries(depMap)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([name, stats]) => ({ name, total: stats.total, activos: stats.activos }));

            // Building distribution
            const buildMap: Record<string, number> = {};
            allData.forEach(p => {
                const b = p.building || "Sin Edificio";
                buildMap[b] = (buildMap[b] || 0) + 1;
            });
            const topBuildings = Object.entries(buildMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([name, total]) => ({ name, total }));

            // Data Quality
            const sinEmail = allData.filter(p => !p.email).length;
            const sinSchedule = allData.filter(p => !p.schedule?.days).length;
            const sinPosition = allData.filter(p => !p.position).length;
            const sinArea = allData.filter(p => !p.area).length;

            return {
                totalPersonnel: total,
                statusCounts: { activo, parcial, inactivo, bloqueado, baja },
                cardCoverage: { conP2000, sinP2000: opCount - conP2000, conKone, sinKone: opCount - conKone, operativos: opCount },
                topDependencies,
                topBuildings,
                dataQuality: { sinEmail, sinSchedule, sinPosition, sinArea, total },
            };
        } catch (error) {
            handleError(error, "Fetch Dashboard Metrics");
            return empty;
        }
    }

};



export const catalogService = {
    // --- Fetch (with localStorage 24h cache) ---
    async fetchDependencies(throwOnError: boolean = false) {
        const cached = catalogCache.get<any[]>('dependencies');
        if (cached) return cached;
        try {
            const { data, error } = await supabase.from("dependencies").select("*");
            if (error) throw error;
            const result = data || [];
            catalogCache.set('dependencies', result);
            return result;
        } catch (error) {
            handleError(error, "Fetch Dependencies");
            if (throwOnError) throw error;
            return [];
        }
    },
    async fetchBuildings(throwOnError: boolean = false) {
        const cached = catalogCache.get<any[]>('buildings');
        if (cached) return cached;
        try {
            const { data, error } = await supabase.from("buildings").select("*");
            if (error) throw error;
            const result = data || [];
            catalogCache.set('buildings', result);
            return result;
        } catch (error) {
            handleError(error, "Fetch Buildings");
            if (throwOnError) throw error;
            return [];
        }
    },
    async fetchAccesses(throwOnError: boolean = false) {
        const cached = catalogCache.get<any[]>('special_accesses');
        if (cached) return cached;
        try {
            const { data, error } = await supabase.from("special_accesses").select("*");
            if (error) throw error;
            const result = data || [];
            catalogCache.set('special_accesses', result);
            return result;
        } catch (error) {
            handleError(error, "Fetch Accesses");
            if (throwOnError) throw error;
            return [];
        }
    },
    async fetchSchedules(throwOnError: boolean = false) {
        const cached = catalogCache.get<any[]>('schedules');
        if (cached) return cached;
        try {
            const { data, error } = await supabase.from("schedules").select("*");
            if (error) throw error;
            const result = data || [];
            catalogCache.set('schedules', result);
            return result;
        } catch (error) {
            handleError(error, "Fetch Schedules");
            if (throwOnError) throw error;
            return [];
        }
    },

    // --- Save (Create/Update) --- 
    // Invalidate the relevant cache key after any mutation so stale data is never served.
    async saveBuilding(id: number | null, payload: { name: string; floors: string[] }) {
        try {
            if (id) {
                const { error } = await supabase.from("buildings").update(payload).eq("id", id);
                if (error) throw error;
                await HistoryService.log("SYSTEM", id, "UPDATE_CATALOG", { message: `Edificio actualizado: ${payload.name}` });
            } else {
                const { data, error } = await supabase.from("buildings").insert([payload]).select().single();
                if (error) throw error;
                await HistoryService.log("SYSTEM", data.id, "CREATE_CATALOG", { message: `Edificio creado: ${payload.name}` });
            }
            catalogCache.invalidate('buildings');
        } catch (error) {
            handleError(error, "Save Building");
            throw error;
        }
    },

    async saveDependency(id: number | null, payload: { name: string }) {
        try {
            if (id) {
                const { error } = await supabase.from("dependencies").update(payload).eq("id", id);
                if (error) throw error;
                await HistoryService.log("SYSTEM", id, "UPDATE_CATALOG", { message: `Dependencia actualizada: ${payload.name}` });
            } else {
                const { data, error } = await supabase.from("dependencies").insert([payload]).select().single();
                if (error) throw error;
                await HistoryService.log("SYSTEM", data.id, "CREATE_CATALOG", { message: `Dependencia creada: ${payload.name}` });
            }
            catalogCache.invalidate('dependencies');
        } catch (error) {
            handleError(error, "Save Dependency");
            throw error;
        }
    },

    async saveAccess(id: number | null, payload: { name: string }) {
        try {
            if (id) {
                const { error } = await supabase.from("special_accesses").update(payload).eq("id", id);
                if (error) throw error;
                await HistoryService.log("SYSTEM", id, "UPDATE_CATALOG", { message: `Acceso especial actualizado: ${payload.name}` });
            } else {
                const { data, error } = await supabase.from("special_accesses").insert([payload]).select().single();
                if (error) throw error;
                await HistoryService.log("SYSTEM", data.id, "CREATE_CATALOG", { message: `Acceso especial creado: ${payload.name}` });
            }
            catalogCache.invalidate('special_accesses');
        } catch (error) {
            handleError(error, "Save Access");
            throw error;
        }
    },

    async saveSchedule(id: number | null, payload: { name: string; days: string[] }) {
        try {
            if (id) {
                const { error } = await supabase.from("schedules").update(payload).eq("id", id);
                if (error) throw error;
                await HistoryService.log("SYSTEM", id, "UPDATE_CATALOG", { message: `Horario actualizado: ${payload.name}` });
            } else {
                const { data, error } = await supabase.from("schedules").insert([payload]).select().single();
                if (error) throw error;
                await HistoryService.log("SYSTEM", data.id, "CREATE_CATALOG", { message: `Horario creado: ${payload.name}` });
            }
            catalogCache.invalidate('schedules');
        } catch (error) {
            handleError(error, "Save Schedule");
            throw error;
        }
    },

    // --- Delete ---
    async deleteCatalogItem(table: string, id: number, itemName: string) {
        try {
            const { error } = await supabase.from(table).delete().eq("id", id);
            if (error) throw error;
            await HistoryService.log("SYSTEM", id, "DELETE_CATALOG", { message: `Eliminado de ${table}: ${itemName}` });
            catalogCache.invalidate(table);
        } catch (error) {
            handleError(error, "Delete Catalog Item");
            throw error;
        }
    }
};

export const profileService = {
    async fetchAll() {
        try {
            const { data, error } = await supabase.from('profiles').select('*').order('email');
            if (error) throw error;
            return data || [];
        } catch (error) {
            handleError(error, "Fetch Profiles");
            return [];
        }
    },
    async updateRole(userId: string, role: string) {
        try {
            const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
            if (error) throw error;
            await HistoryService.log('SYSTEM', userId, 'UPDATE_ROLE', { message: `Rol actualizado a ${role}` });
        } catch (error) {
            handleError(error, "Update Role");
            throw error;
        }
    }
};
