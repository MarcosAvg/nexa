import { supabase } from "../supabase";
import { HistoryService } from "./history";

export const personnelService = {
    async fetchAll() {
        const { data, error } = await supabase
            .from("personnel")
            .select("*, cards(*), buildings(name), dependencies(name), schedules(*)");

        if (error) throw error;

        return (data || []).map(p => {
            const hasCards = p.cards && p.cards.length > 0;
            let displayStatus = "Baja";

            if (p.status === "active") {
                displayStatus = hasCards ? "Activo/a" : "Inactivo/a";
            } else if (p.status === "blocked") {
                displayStatus = "Bloqueado/a";
            }

            return {
                ...p,
                name: `${p.first_name} ${p.last_name}`,
                employeeNo: p.employee_no,
                building: p.buildings?.name || "N/A",
                dependency: p.dependencies?.name || "N/A",
                schedule: p.schedules ? {
                    days: p.schedules.name,
                    entry: p.entry_time || p.schedules.default_entry || "09:00",
                    exit: p.exit_time || p.schedules.default_exit || "18:00"
                } : null,
                status_raw: p.status,
                status: displayStatus,
                floors_p2000: p.floors_p2000 || [],
                floors_kone: p.floors_kone || [],
                specialAccesses: p.special_accesses || []
            };
        });
    },

    async save(data: any) {
        const payload = {
            first_name: data.nombres,
            last_name: data.apellidos,
            employee_no: data.noEmpleado,
            area: data.areaEquipo,
            position: data.puestoFuncion,
            dependency_id: data.dependencyId,
            building_id: data.buildingId,
            floor: data.pisoBase,
            floors_p2000: data.pisosP2000 || [],
            floors_kone: data.pisosKone || [],
            schedule_id: data.scheduleId,
            entry_time: data.horario?.entrada,
            exit_time: data.horario?.salida,
            special_accesses: data.accesosEspeciales || [],
            status: data.status === "Activo/a" || data.status === "Inactivo/a" ? "active" : data.status === "Bloqueado/a" ? "blocked" : data.status === "Baja" ? "inactive" : data.status || "active",
            email: data.email || null,
        };

        let personId = data.id;

        if (personId) {
            const { error } = await supabase
                .from("personnel")
                .update(payload)
                .eq("id", personId);
            if (error) throw error;
            await HistoryService.log("PERSONNEL", personId, "UPDATE", {
                message: `Actualización de datos de ${payload.first_name} ${payload.last_name}`
            });
        } else {
            const { data: newPerson, error } = await supabase
                .from("personnel")
                .insert([payload])
                .select()
                .single();
            if (error) throw error;
            personId = newPerson.id;
            await HistoryService.log("PERSONNEL", personId, "CREATE", {
                message: `Registro de ${payload.first_name} ${payload.last_name}`
            });
        }

        // Handle Card Assignment
        if (data.tarjetas) {
            const { data: currentCards } = await supabase.from("cards").select("folio").eq("person_id", personId);
            const currentFolios = currentCards?.map(c => c.folio) || [];
            const newFolios = (data.tarjetas as any[]).map(t => t.folio);

            const toUnlink = currentFolios.filter(f => !newFolios.includes(f));
            if (toUnlink.length > 0) {
                await supabase.from("cards").update({ person_id: null, status: "available" }).in("folio", toUnlink);
                await HistoryService.log("PERSONNEL", personId, "UNASSIGN_CARD", {
                    message: `Tarjetas desvinculadas: ${toUnlink.join(", ")}`
                });
            }

            if (newFolios.length > 0) {
                // If the person is blocked, assign new cards as blocked too
                const personStatus = payload.status;
                const cardStatus = personStatus === "blocked" ? "blocked" : "active";

                const cardPayloads = (data.tarjetas as any[]).map(t => ({
                    folio: t.folio,
                    type: t.type || "P2000",
                    person_id: personId,
                    status: cardStatus
                }));

                const { error: upsertError } = await supabase
                    .from("cards")
                    .upsert(cardPayloads, { onConflict: "folio, type" });

                if (upsertError) throw upsertError;

                // Only log new assignments
                const newAssignments = newFolios.filter(f => !currentFolios.includes(f));
                if (newAssignments.length > 0) {
                    await HistoryService.log("PERSONNEL", personId, "ASSIGN_CARD", {
                        message: `Tarjetas asignadas: ${newAssignments.join(", ")}`
                    });
                }
            }
        }
    },

    async updateStatus(id: string, newStatus: string) {
        const { error } = await supabase
            .from("personnel")
            .update({ status: newStatus })
            .eq("id", id);
        if (error) throw error;

        let action = "UPDATE_STATUS";
        if (newStatus === "blocked") action = "BLOCK";
        else if (newStatus === "active") action = "ACTIVATE";
        else if (newStatus === "inactive") action = "DEACTIVATE";

        await HistoryService.log("PERSONNEL", id, action, { message: `Cambio de estado a ${newStatus}` });

        // If deactivating, unlink all cards
        if (newStatus === "inactive") {
            const { error: cardError } = await supabase
                .from("cards")
                .update({ person_id: null, status: "available" })
                .eq("person_id", id);
            if (cardError) throw cardError;
        }
        // If blocking, block all assigned cards
        else if (newStatus === "blocked") {
            await supabase.from("cards").update({ status: "blocked" }).eq("person_id", id);
        }
        // If activating (from blocked), activate all assigned cards
        else if (newStatus === "active") {
            await supabase.from("cards").update({ status: "active" }).eq("person_id", id);
        }
    },

    async delete(id: string) {
        // 1. Unlink all assigned cards
        await supabase
            .from("cards")
            .update({ person_id: null, status: "available" })
            .eq("person_id", id);

        // 2. Unlink tickets to avoid FK constraint errors
        await supabase
            .from("tickets")
            .update({ person_id: null })
            .eq("person_id", id);

        // N/A: History logs now have loose coupling (text id), so NO NEED TO NULLIFY them manually if we removed FK.
        // But our new schema does NOT have FK to personnel for entity_id.
        // So we don't need step 3 from before.

        // 4. Finally delete the person
        const { error } = await supabase.from("personnel").delete().eq("id", id);
        if (error) throw error;

        await HistoryService.log("PERSONNEL", id, "DELETE", { message: `Eliminación permanente de personal` });
    }
};

export const catalogService = {
    async fetchDependencies() {
        const { data, error } = await supabase.from("dependencies").select("*");
        if (error) throw error;
        return data || [];
    },

    async fetchBuildings() {
        const { data, error } = await supabase.from("buildings").select("*");
        if (error) throw error;
        return data || [];
    },

    async fetchAccesses() {
        const { data, error } = await supabase.from("special_accesses").select("*");
        if (error) throw error;
        return data || [];
    },

    async fetchSchedules() {
        const { data, error } = await supabase.from("schedules").select("*");
        if (error) throw error;
        return data || [];
    }
};

export const profileService = {
    async fetchAll() {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('email');
        if (error) throw error;
        return data || [];
    },
    async updateRole(userId: string, role: string) {
        const { error } = await supabase
            .from('profiles')
            .update({ role })
            .eq('id', userId);
        if (error) throw error;
        await HistoryService.log('SYSTEM', userId, 'UPDATE_ROLE', {
            message: `Rol de usuario actualizado a ${role}`
        });
    }
};
