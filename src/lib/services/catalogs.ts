import { supabase } from "../supabase";
import { HistoryService } from "./history";
import { withErrorHandling, withErrorHandlingConditional, catalogCache } from "../utils";

export const catalogService = {
    // --- Fetch (with localStorage 24h cache) ---
    async fetchDependencies(throwOnError: boolean = false) {
        const cached = catalogCache.get<any[]>('dependencies');
        if (cached) return cached;
        return withErrorHandlingConditional(async () => {
            const { data, error } = await supabase.from("dependencies").select("*");
            if (error) throw error;
            const result = data || [];
            catalogCache.set('dependencies', result);
            return result;
        }, "Fetch Dependencies", throwOnError, []);
    },
    async fetchBuildings(throwOnError: boolean = false) {
        const cached = catalogCache.get<any[]>('buildings');
        if (cached) return cached;
        return withErrorHandlingConditional(async () => {
            const { data, error } = await supabase.from("buildings").select("*");
            if (error) throw error;
            const result = data || [];
            catalogCache.set('buildings', result);
            return result;
        }, "Fetch Buildings", throwOnError, []);
    },
    async fetchAccesses(throwOnError: boolean = false) {
        const cached = catalogCache.get<any[]>('special_accesses');
        if (cached) return cached;
        return withErrorHandlingConditional(async () => {
            const { data, error } = await supabase.from("special_accesses").select("*");
            if (error) throw error;
            const result = data || [];
            catalogCache.set('special_accesses', result);
            return result;
        }, "Fetch Accesses", throwOnError, []);
    },
    async fetchSchedules(throwOnError: boolean = false) {
        const cached = catalogCache.get<any[]>('schedules');
        if (cached) return cached;
        return withErrorHandlingConditional(async () => {
            const { data, error } = await supabase.from("schedules").select("*");
            if (error) throw error;
            const result = data || [];
            catalogCache.set('schedules', result);
            return result;
        }, "Fetch Schedules", throwOnError, []);
    },

    // --- Save (Create/Update) ---
    async saveBuilding(id: number | null, payload: { name: string; floors: string[] }) {
        return withErrorHandling(async () => {
            if (id) {
                const { error } = await supabase.from("buildings").update(payload).eq("id", id);
                if (error) throw error;
                await HistoryService.log("SYSTEM", id, "UPDATE_CATALOG", { message: `Edificio actualizado: ${payload.name}`, entityName: `Edificio: ${payload.name}` });
            } else {
                const { data, error } = await supabase.from("buildings").insert([payload]).select().single();
                if (error) throw error;
                await HistoryService.log("SYSTEM", data.id, "CREATE_CATALOG", { message: `Edificio creado: ${payload.name}`, entityName: `Edificio: ${payload.name}` });
            }
            catalogCache.invalidate('buildings');
        }, "Save Building");
    },

    async saveDependency(id: number | null, payload: { name: string }) {
        return withErrorHandling(async () => {
            if (id) {
                const { error } = await supabase.from("dependencies").update(payload).eq("id", id);
                if (error) throw error;
                await HistoryService.log("SYSTEM", id, "UPDATE_CATALOG", { message: `Dependencia actualizada: ${payload.name}`, entityName: `Dependencia: ${payload.name}` });
            } else {
                const { data, error } = await supabase.from("dependencies").insert([payload]).select().single();
                if (error) throw error;
                await HistoryService.log("SYSTEM", data.id, "CREATE_CATALOG", { message: `Dependencia creada: ${payload.name}`, entityName: `Dependencia: ${payload.name}` });
            }
            catalogCache.invalidate('dependencies');
        }, "Save Dependency");
    },

    async saveAccess(id: number | null, payload: { name: string }) {
        return withErrorHandling(async () => {
            if (id) {
                const { error } = await supabase.from("special_accesses").update(payload).eq("id", id);
                if (error) throw error;
                await HistoryService.log("SYSTEM", id, "UPDATE_CATALOG", { message: `Acceso especial actualizado: ${payload.name}`, entityName: `Acceso especial: ${payload.name}` });
            } else {
                const { data, error } = await supabase.from("special_accesses").insert([payload]).select().single();
                if (error) throw error;
                await HistoryService.log("SYSTEM", data.id, "CREATE_CATALOG", { message: `Acceso especial creado: ${payload.name}`, entityName: `Acceso especial: ${payload.name}` });
            }
            catalogCache.invalidate('special_accesses');
        }, "Save Access");
    },

    async saveSchedule(id: number | null, payload: { name: string; days: string[] }) {
        return withErrorHandling(async () => {
            if (id) {
                const { error } = await supabase.from("schedules").update(payload).eq("id", id);
                if (error) throw error;
                await HistoryService.log("SYSTEM", id, "UPDATE_CATALOG", { message: `Horario actualizado: ${payload.name}`, entityName: `Horario: ${payload.name}` });
            } else {
                const { data, error } = await supabase.from("schedules").insert([payload]).select().single();
                if (error) throw error;
                await HistoryService.log("SYSTEM", data.id, "CREATE_CATALOG", { message: `Horario creado: ${payload.name}`, entityName: `Horario: ${payload.name}` });
            }
            catalogCache.invalidate('schedules');
        }, "Save Schedule");
    },

    // --- Delete ---
    async deleteCatalogItem(table: string, id: number, itemName: string) {
        return withErrorHandling(async () => {
            const { error } = await supabase.from(table).delete().eq("id", id);
            if (error) throw error;
            await HistoryService.log("SYSTEM", id, "DELETE_CATALOG", { message: `Eliminado de ${table}: ${itemName}`, entityName: `${table}: ${itemName}` });
            catalogCache.invalidate(table);
        }, "Delete Catalog Item");
    }
};
