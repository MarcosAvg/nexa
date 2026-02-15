import { supabase } from "../supabase";
import { HistoryService } from "./history";
import { handleError } from "../utils/error";
import type { Person, Card } from "../types";

export const personnelService = {
    async fetchAll(): Promise<Person[]> {
        try {
            const { data, error } = await supabase
                .from("personnel")
                .select("*, cards(*), buildings(name), dependencies(name), schedules(*)");

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
                            (c: any) => c.programming_status === "done" && c.responsiva_status === "signed"
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
        } catch (error) {
            handleError(error, "Fetch Personnel");
            return [];
        }
    },

    async save(data: any) { // Keeping 'any' for input data to be flexible with form binding, but logic inside is safer
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
                const { error } = await supabase.from("personnel").update(payload).eq("id", personId);
                if (error) throw error;
                await HistoryService.log("PERSONNEL", personId, "UPDATE", { message: `Actualización de ${payload.first_name}` });
            } else {
                const { data: newPerson, error } = await supabase.from("personnel").insert([payload]).select().single();
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
            const { error } = await supabase.from("personnel").update({ status }).eq("id", id);
            if (error) throw error;

            // Cascade to Cards
            // If the person is blocked/inactive, cards should reflect that.
            // If reactivated, cards should become active (since they are assigned).
            const cardStatus = status;
            const { error: cardError } = await supabase
                .from("cards")
                .update({ status: cardStatus })
                .eq("person_id", id);

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
            const { error } = await supabase.from("personnel").delete().eq("id", id);
            if (error) throw error;
            await HistoryService.log("PERSONNEL", id, "DELETE", { message: `Registro eliminado permanentemente` });
        } catch (error) {
            handleError(error, "Delete Personnel");
            throw error;
        }
    }
};

// Keeping other services here for now, but they should ideally be moved or typed too
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
