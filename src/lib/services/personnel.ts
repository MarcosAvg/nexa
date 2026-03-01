import { supabase } from "../supabase";
import { HistoryService } from "./history";
import { handleError, withTimeout } from "../utils/error";
import { catalogCache } from "../utils/catalogCache";
import { appEvents, EVENTS } from "../utils/appEvents";
import type { Person, Card, DashboardMetrics } from "../types";
import { dbCache } from "../utils/dbCache";
import { networkStore } from "../stores/network.svelte";

const mapPersonRecord = (p: any): Person => {
    const allCards = (p.cards || []);
    const activeCards = allCards.filter((c: any) => c.status === "active");
    const readyCards = activeCards.filter(
        (c: any) => c.programming_status === "done" && (c.responsiva_status === "signed" || c.responsiva_status === "legacy")
    );

    const readyTypes = new Set(readyCards.map((c: any) => c.type));

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
        try {
            // Offline fallback
            if (!networkStore.isOnline) {
                const cacheKey = `personnel_page_${page}_${statusFilter}_${dependencyId}_${buildingId}_${search}`;
                const cachedData = await dbCache.load<{ data: Person[], count: number }>(cacheKey);
                if (cachedData) return cachedData;
                return { data: [], count: 0 };
            }

            // Use the optimized view if available (personnel_with_status includes computed_status)
            // If the view doesn't exist yet, it will fallback to the original logic
            let query = supabase
                .from("personnel_with_status")
                .select("*, cards(id, folio, type, status, programming_status, responsiva_status)", { count: "exact" });

            if (search) {
                const searchTerm = `%${search}%`;
                query = query.or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},employee_no.ilike.${searchTerm}`);
            }

            if (statusFilter !== "Todos") {
                query = query.eq("computed_status", statusFilter);
            }

            if (dependencyId) {
                query = query.eq("dependency_id", dependencyId);
            }

            if (buildingId === "__none__") {
                query = query.is("building_id", null);
            } else if (buildingId) {
                query = query.eq("building_id", buildingId);
            }

            const from = (page - 1) * limit;
            const to = from + limit - 1;

            const { data, count, error } = await query
                .order("first_name", { ascending: true })
                .range(from, to);

            if (error) {
                // Fallback to original personnel table if view fails
                console.warn("Falling back from personnel_with_status view:", error.message);
                return this._fetchAllFallback(page, limit, search, statusFilter, dependencyId, buildingId);
            }

            const mappedData = (data || []).map(p => mapPersonRecord(p));
            const result = { data: mappedData, count: count || 0 };

            // Save to cache
            const cacheKey = `personnel_page_${page}_${statusFilter}_${dependencyId}_${buildingId}_${search}`;
            await dbCache.save(cacheKey, result);

            return result;
        } catch (error) {
            handleError(error, "Fetch Personnel");
            return { data: [], count: 0 };
        }
    },

    // Helper for fallback logic
    async _fetchAllFallback(page: number, limit: number, search: string, statusFilter: string, dependencyId: string, buildingId: string) {
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
                query = query.eq("status", dbStatusMap[statusFilter]);
            } else if (isComputedStatus) {
                query = query.eq("status", "active");
            }
        }

        if (dependencyId) query = query.eq("dependency_id", dependencyId);
        if (buildingId === "__none__") query = query.is("building_id", null);
        else if (buildingId) query = query.eq("building_id", buildingId);

        if (isComputedStatus) {
            const allMapped: Person[] = [];
            let batchPage = 0;
            const batchSize = 1000;
            let hasMore = true;
            while (hasMore) {
                const { data: batch, error } = await query.order("first_name", { ascending: true }).range(batchPage * batchSize, (batchPage + 1) * batchSize - 1);
                if (error) throw error;
                if (batch && batch.length > 0) {
                    allMapped.push(...batch.map(p => mapPersonRecord(p)));
                    if (batch.length < batchSize) hasMore = false;
                    else batchPage++;
                } else hasMore = false;
            }
            const filtered = allMapped.filter(p => p.status === statusFilter);
            const from = (page - 1) * limit;
            return { data: filtered.slice(from, from + limit), count: filtered.length };
        } else {
            const from = (page - 1) * limit;
            const to = from + limit - 1;
            const { data, count, error } = await query.order("first_name", { ascending: true }).range(from, to);
            if (error) throw error;
            return { data: (data || []).map(p => mapPersonRecord(p)), count: count || 0 };
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
            const cleanApellidos = (apellidos || "").trim();
            const cleanNombres = (nombres || "").trim();

            if (!cleanApellidos && !cleanNombres) return [];

            // Call the PostgreSQL RPC function for robust fuzzy search
            const { data, error } = await supabase.rpc('search_personnel_fuzzy', {
                p_last_name: cleanApellidos,
                p_first_name: cleanNombres,
                p_limit: 20
            });

            if (error) throw error;

            // The RPC returns SETOF personnel, but we need the joins for mapPersonRecord.
            // However, Supabase RPC doesn't support complex joins in the same call easily.
            // We can fetch the full records for these IDs to get the joins, or map partially.
            // Given the original code had joins, we'll fetch the full details for the returned IDs.
            if (!data || data.length === 0) return [];

            const ids = data.map((p: any) => p.id);
            const { data: fullPeople, error: fetchError } = await supabase
                .from("personnel")
                .select("*, cards(*), buildings(name), dependencies(name), schedules(*)")
                .in("id", ids);

            if (fetchError) throw fetchError;

            // Sort them back according to the order from RPC (similarity score)
            const idToData = Object.fromEntries(fullPeople.map(p => [p.id, p]));
            const orderedPeople = data.map((p: any) => idToData[p.id]).filter(Boolean);

            return (orderedPeople || []).map((p: any) => ({
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
            handleError(error, "Search Personnel by Name (Fuzzy)");
            return [];
        }
    },

    async save(data: any) {
        try {
            // 1. Validation: Prevent duplicates by name for NEW records
            if (!data.id) {
                const results = await this.searchByName(
                    data.apellidos || data.last_name || "",
                    data.nombres || data.first_name || "",
                );
                // Compare normalized names to decide if it's a "hard" duplicate
                const isDuplicate = results.some((r) => {
                    const n1 = (r.first_name + " " + r.last_name)
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "");
                    const n2 = ((data.nombres || data.first_name || "") + " " + (data.apellidos || data.last_name || ""))
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "");
                    return n1 === n2;
                });

                if (isDuplicate) {
                    throw new Error(
                        `Ya existe un registro activo con el nombre "${data.nombres || data.first_name} ${data.apellidos || data.last_name}".`,
                    );
                }
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
        try {
            // Replaced manual computation (downloading all personnel) with a single RPC call
            const { data, error } = await supabase.rpc('get_dashboard_metrics');
            if (error) throw error;
            return data as DashboardMetrics;
        } catch (error) {
            // Fallback: If RPC not deployed, we keep returning an empty state or we could 
            // re-implement the heavy logic here, but RPC is the goal.
            handleError(error, "Fetch Dashboard Metrics (RPC)");
            return {
                totalPersonnel: 0,
                statusCounts: { activo: 0, parcial: 0, inactivo: 0, bloqueado: 0, baja: 0 },
                cardCoverage: { conP2000: 0, sinP2000: 0, conKone: 0, sinKone: 0, operativos: 0 },
                topDependencies: [],
                topBuildings: [],
                dataQuality: { sinEmail: 0, sinSchedule: 0, sinPosition: 0, sinArea: 0, total: 0 },
            };
        }
    },

    subscribeToChanges(callback: (payload: any) => void) {
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
