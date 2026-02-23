import { supabase } from "../supabase";
import { HistoryService } from "./history";
import { handleError, withTimeout } from "../utils/error";
import type { Person, Card } from "../types";

export const personnelService = {
    async fetchAll(page: number = 1, limit: number = 50, search: string = "", statusFilter: string = "Todos", dependencyId: string = ""): Promise<{ data: Person[], count: number }> {
        try {
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            let query = supabase
                .from("personnel")
                .select("*, cards(*), buildings(name), dependencies(name), schedules(*)", { count: "exact" });

            if (search) {
                const searchTerm = `%${search}%`;
                query = query.or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},employee_no.ilike.${searchTerm}`);
            }

            if (statusFilter !== "Todos") {
                const statusMap: Record<string, string> = {
                    "Activo/a": "active",
                    "Parcial": "partial",
                    "Inactivo/a": "inactive",
                    "Bloqueado/a": "blocked",
                    "Baja": "deleted"
                };
                if (statusMap[statusFilter]) {
                    query = query.eq("status", statusMap[statusFilter]);
                }
            }

            if (dependencyId) {
                query = query.eq("dependency_id", dependencyId);
            }

            const { data, count, error } = await query
                .order("first_name", { ascending: true })
                .range(from, to);

            if (error) throw error;

            const mappedData = (data || []).map(p => {
                const activeCards = (p.cards || []).filter((c: any) => c.status === "active");
                const hasActiveCards = activeCards.length > 0;
                let displayStatus = "Baja";

                if (p.status === "active") {
                    if (!hasActiveCards) {
                        displayStatus = "Inactivo/a";
                    } else {
                        const readyCards = activeCards.filter(
                            (c: any) => c.programming_status === "done" && (c.responsiva_status === "signed" || c.responsiva_status === "legacy")
                        );
                        if (readyCards.length === activeCards.length) {
                            displayStatus = "Activo/a";
                        } else if (readyCards.length > 0) {
                            displayStatus = "Parcial";
                        } else {
                            displayStatus = "Inactivo/a";
                        }
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
                    // Map joined fields
                    building: p.buildings?.name || "N/A",
                    dependency: p.dependencies?.name || "N/A",
                    schedule: p.schedules ? {
                        days: p.schedules.name,
                        entry: p.entry_time || p.schedules.default_entry || "09:00",
                        exit: p.exit_time || p.schedules.default_exit || "18:00"
                    } : null,
                    // Raw and Computed Status
                    status_raw: p.status,
                    status: displayStatus,
                    // Arrays
                    cards: p.cards || [],
                    floors_p2000: p.floors_p2000 || [],
                    floors_kone: p.floors_kone || [],
                    specialAccesses: p.special_accesses || []
                } as Person;
            });

            return { data: mappedData, count: count || 0 };
        } catch (error) {
            handleError(error, "Fetch Personnel");
            return { data: [], count: 0 };
        }
    },

    async fetchForExport(search: string = "", statusFilter: string = "Todos", dependencyId: string = ""): Promise<Person[]> {
        try {
            let query = supabase
                .from("personnel")
                .select("*, cards(*), buildings(name), dependencies(name), schedules(*)");

            if (search) {
                const searchTerm = `%${search}%`;
                query = query.or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},employee_no.ilike.${searchTerm}`);
            }

            if (statusFilter !== "Todos") {
                const statusMap: Record<string, string> = {
                    "Activo/a": "active",
                    "Parcial": "partial",
                    "Inactivo/a": "inactive",
                    "Bloqueado/a": "blocked",
                    "Baja": "deleted"
                };
                if (statusMap[statusFilter]) {
                    query = query.eq("status", statusMap[statusFilter]);
                }
            }

            if (dependencyId) {
                query = query.eq("dependency_id", dependencyId);
            }

            const { data, error } = await query.order("first_name", { ascending: true });

            if (error) throw error;

            return (data || []).map(p => {
                const activeCards = (p.cards || []).filter((c: any) => c.status === "active");
                const hasActiveCards = activeCards.length > 0;
                let displayStatus = "Baja";

                if (p.status === "active") {
                    if (!hasActiveCards) {
                        displayStatus = "Inactivo/a";
                    } else {
                        const readyCards = activeCards.filter(
                            (c: any) => c.programming_status === "done" && (c.responsiva_status === "signed" || c.responsiva_status === "legacy")
                        );
                        if (readyCards.length === activeCards.length) {
                            displayStatus = "Activo/a";
                        } else if (readyCards.length > 0) {
                            displayStatus = "Parcial";
                        } else {
                            displayStatus = "Inactivo/a";
                        }
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
            });
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

            // Map single person (reuse logic if possible, but distinct here for simplicity)
            const p = data;
            const activeCards = (p.cards || []).filter((c: any) => c.status === "active");
            const hasActiveCards = activeCards.length > 0;
            let displayStatus = "Baja";

            if (p.status === "active") {
                if (!hasActiveCards) {
                    displayStatus = "Inactivo/a";
                } else {
                    const readyCards = activeCards.filter(
                        (c: any) => c.programming_status === "done" && (c.responsiva_status === "signed" || c.responsiva_status === "legacy")
                    );
                    if (readyCards.length === activeCards.length) {
                        displayStatus = "Activo/a";
                    } else if (readyCards.length > 0) {
                        displayStatus = "Parcial";
                    } else {
                        displayStatus = "Inactivo/a";
                    }
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
                .neq("status", "deleted")
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
                employee_no: data.employee_no || data.noEmpleado,
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
                await HistoryService.log("PERSONNEL", personId, "UPDATE", { message: `Actualización de ${payload.first_name}` });
            } else {
                const { data: newPerson, error } = await withTimeout(supabase.from("personnel").insert([payload]).select().single());
                if (error) throw error;
                personId = newPerson.id;
                await HistoryService.log("PERSONNEL", personId, "CREATE", { message: `Registro de ${payload.first_name}` });
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

            await HistoryService.log("PERSONNEL", id, "UPDATE_STATUS", { message: `Estado actualizado a ${status} (y sus tarjetas)` });
        } catch (error) {
            handleError(error, "Update Personnel Status");
            throw error;
        }
    },

    async delete(id: string) {
        try {
            // Log deletion BEFORE removing data
            await HistoryService.log("PERSONNEL", id, "DELETE", { message: `Registro eliminado permanentemente` });

            // Delete the person
            const { error } = await supabase.from("personnel").delete().eq("id", id);
            if (error) throw error;
        } catch (error) {
            handleError(error, "Delete Personnel");
            throw error;
        }
    }
};

export const catalogService = {
    // --- Fetch ---
    async fetchDependencies() {
        try {
            const { data, error } = await supabase.from("dependencies").select("*");
            if (error) throw error;
            return data || [];
        } catch (error) {
            handleError(error, "Fetch Dependencies");
            return [];
        }
    },
    async fetchBuildings() {
        try {
            const { data, error } = await supabase.from("buildings").select("*");
            if (error) throw error;
            return data || [];
        } catch (error) {
            handleError(error, "Fetch Buildings");
            return [];
        }
    },
    async fetchAccesses() {
        try {
            const { data, error } = await supabase.from("special_accesses").select("*");
            if (error) throw error;
            return data || [];
        } catch (error) {
            handleError(error, "Fetch Accesses");
            return [];
        }
    },
    async fetchSchedules() {
        try {
            const { data, error } = await supabase.from("schedules").select("*");
            if (error) throw error;
            return data || [];
        } catch (error) {
            handleError(error, "Fetch Schedules");
            return [];
        }
    },

    // --- Save (Create/Update) ---
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
