import { supabase } from "../supabase";
import { HistoryService } from "./history";
import { withErrorHandling, withErrorHandlingConditional, catalogCache } from "../utils";

/** Tablas de catálogo que soportan orden personalizado. */
const CATALOG_TABLES = ["buildings", "dependencies", "schedules", "special_accesses"] as const;
export type CatalogTable = (typeof CATALOG_TABLES)[number];

/**
 * TTL corto para la caché de catálogos: permite que reordenamientos y
 * ediciones se propaguen al resto de usuarios en pocos minutos.
 */
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

/** Retorna el siguiente valor de sort_order (max + 1) para que los nuevos items vayan al final. */
async function getNextSortOrder(table: CatalogTable): Promise<number> {
    const { data, error } = await supabase
        .from(table)
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1);
    if (error) throw error;
    return ((data?.[0]?.sort_order as number | null | undefined) ?? 0) + 1;
}

export const catalogService = {
    // --- Fetch (with localStorage 24h cache) ---
    async fetchDependencies(throwOnError: boolean = false) {
        const cached = catalogCache.get<any[]>('dependencies');
        if (cached) return cached;
        return withErrorHandlingConditional(async () => {
            const { data, error } = await supabase
                .from("dependencies")
                .select("*")
                .order("sort_order", { ascending: true })
                .order("id", { ascending: true });
            if (error) throw error;
            const result = data || [];
            catalogCache.set('dependencies', result, CATALOG_CACHE_TTL_MS);
            return result;
        }, "Fetch Dependencies", throwOnError, []);
    },
    async fetchBuildings(throwOnError: boolean = false) {
        const cached = catalogCache.get<any[]>('buildings');
        if (cached) return cached;
        return withErrorHandlingConditional(async () => {
            const { data, error } = await supabase
                .from("buildings")
                .select("*")
                .order("sort_order", { ascending: true })
                .order("id", { ascending: true });
            if (error) throw error;
            const result = data || [];
            catalogCache.set('buildings', result, CATALOG_CACHE_TTL_MS);
            return result;
        }, "Fetch Buildings", throwOnError, []);
    },
    async fetchAccesses(throwOnError: boolean = false) {
        const cached = catalogCache.get<any[]>('special_accesses');
        if (cached) return cached;
        return withErrorHandlingConditional(async () => {
            const { data, error } = await supabase
                .from("special_accesses")
                .select("*")
                .order("sort_order", { ascending: true })
                .order("id", { ascending: true });
            if (error) throw error;
            const result = data || [];
            catalogCache.set('special_accesses', result, CATALOG_CACHE_TTL_MS);
            return result;
        }, "Fetch Accesses", throwOnError, []);
    },
    async fetchSchedules(throwOnError: boolean = false) {
        const cached = catalogCache.get<any[]>('schedules');
        if (cached) return cached;
        return withErrorHandlingConditional(async () => {
            const { data, error } = await supabase
                .from("schedules")
                .select("*")
                .order("sort_order", { ascending: true })
                .order("id", { ascending: true });
            if (error) throw error;
            const result = data || [];
            catalogCache.set('schedules', result, CATALOG_CACHE_TTL_MS);
            return result;
        }, "Fetch Schedules", throwOnError, []);
    },

    /**
     * Reordena un catálogo completo según el arreglo de items proporcionado.
     * Actualiza sort_order en una sola llamada RPC y refresca la caché local.
     */
    async reorderCatalog(table: CatalogTable, items: { id: number | string }[]) {
        return withErrorHandling(async () => {
            const { error } = await supabase.rpc("reorder_catalog", {
                p_table: table,
                p_ids: items.map((item) => Number(item.id)),
            });
            if (error) throw error;
            await HistoryService.log("SYSTEM", undefined, "UPDATE_CATALOG", {
                message: `Orden del catálogo de ${table} actualizado`,
            });
            catalogCache.invalidate(table);
        }, "Reorder Catalog");
    },

    // --- Save (Create/Update) ---
    async saveBuilding(id: number | null, payload: { name: string; floors: string[] }) {
        return withErrorHandling(async () => {
            if (id) {
                const { error } = await supabase.from("buildings").update(payload).eq("id", id);
                if (error) throw error;
                await HistoryService.log("SYSTEM", id, "UPDATE_CATALOG", { message: `Edificio actualizado: ${payload.name}`, entityName: `Edificio: ${payload.name}` });
            } else {
                const sortOrder = await getNextSortOrder("buildings");
                const { data, error } = await supabase.from("buildings").insert([{ ...payload, sort_order: sortOrder }]).select().single();
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
                const sortOrder = await getNextSortOrder("dependencies");
                const { data, error } = await supabase.from("dependencies").insert([{ ...payload, sort_order: sortOrder }]).select().single();
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
                const sortOrder = await getNextSortOrder("special_accesses");
                const { data, error } = await supabase.from("special_accesses").insert([{ ...payload, sort_order: sortOrder }]).select().single();
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
                const sortOrder = await getNextSortOrder("schedules");
                const { data, error } = await supabase.from("schedules").insert([{ ...payload, sort_order: sortOrder }]).select().single();
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
