import { supabase } from "../supabase";
import { HistoryService } from "./history";
import { withErrorHandling, withErrorHandlingConditional, catalogCache } from "../utils";

/** Tablas de catálogo que soportan orden personalizado. */
const CATALOG_TABLES = ["buildings", "dependencies", "schedules", "special_accesses", "access_media_types"] as const;
export type CatalogTable = (typeof CATALOG_TABLES)[number];

/**
 * TTL corto para la caché de catálogos: permite que reordenamientos y
 * ediciones se propaguen al resto de usuarios en pocos minutos.
 */
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

/** Retorna el siguiente valor de sort_order (max + 1) para que los nuevos items vayan al final. */
async function getNextSortOrder(table: CatalogTable, buildingId?: number): Promise<number> {
    let query = supabase
        .from(table)
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1);
    // special_accesses es un catálogo por edificio: el orden se calcula dentro
    // de cada edificio para no intercalar los items.
    if (buildingId) query = query.eq("building_id", buildingId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data?.[0]?.sort_order as number | null | undefined) ?? 0) + 1;
}

/** Sincroniza la tabla floors (fuente canónica) con el array de pisos de un edificio. */
async function syncBuildingFloors(buildingId: number, floors: string[]) {
    const labels = (floors || []).map((f) => f.trim()).filter(Boolean);

    // Preserva los IDs de pisos existentes: los permisos referencian floors.id,
    // así que solo se eliminan los que dejaron de existir y se insertan los nuevos.
    const { data: existing } = await supabase
        .from("floors")
        .select("id, label")
        .eq("building_id", buildingId);
    const idByLabel = new Map<string, number>((existing || []).map((f) => [f.label, f.id]));

    if (labels.length > 0) {
        await supabase.from("floors").upsert(
            labels.map((label, i) => ({
                ...(idByLabel.has(label) ? { id: idByLabel.get(label) } : {}),
                building_id: buildingId,
                label,
                sort_order: i,
            })),
            { onConflict: "building_id,label" },
        );
    }

    const kept = new Set(labels);
    for (const [label, id] of idByLabel) {
        if (!kept.has(label)) {
            await supabase.from("floors").delete().eq("id", id);
        }
    }
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

            // Pisos derivados de la tabla canónica floors (no del array legacy).
            const { data: floorsData } = await supabase
                .from("floors")
                .select("building_id, label")
                .order("sort_order", { ascending: true });
            const floorsByBuilding = new Map<number, string[]>();
            for (const f of floorsData || []) {
                if (!floorsByBuilding.has(f.building_id)) floorsByBuilding.set(f.building_id, []);
                floorsByBuilding.get(f.building_id)!.push(f.label);
            }

            const result = (data || []).map((b: any) => ({
                ...b,
                floors: floorsByBuilding.get(b.id) || [],
            }));
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
    async fetchMediaTypes(throwOnError: boolean = false) {
        const cached = catalogCache.get<any[]>('access_media_types_v2');
        if (cached) return cached;
        return withErrorHandlingConditional(async () => {
            const { data, error } = await supabase
                .from("access_media_types")
                .select("*, access_media_type_buildings(building_id)")
                .order("sort_order", { ascending: true })
                .order("name", { ascending: true });
            if (error) throw error;
            const result = data || [];
            catalogCache.set('access_media_types_v2', result, CATALOG_CACHE_TTL_MS);
            return result;
        }, "Fetch Media Types", throwOnError, []);
    },

    /**
     * Reordena un catálogo completo según el arreglo de items proporcionado.
     * Actualiza sort_order en una sola llamada RPC y refresca la caché local.
     * access_media_types usa ids uuid (RPC dedicada); el resto usa bigint.
     */
    async reorderCatalog(table: CatalogTable, items: { id: number | string }[]) {
        return withErrorHandling(async () => {
            if (table === "access_media_types") {
                const { error } = await supabase.rpc("reorder_media_types", {
                    p_ids: items.map((item) => String(item.id)),
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.rpc("reorder_catalog", {
                    p_table: table,
                    p_ids: items.map((item) => Number(item.id)),
                });
                if (error) throw error;
            }
            await HistoryService.log("SYSTEM", undefined, "UPDATE_CATALOG", {
                message: `Orden del catálogo de ${table} actualizado`,
            });
            catalogCache.invalidate(table);
        }, "Reorder Catalog");
    },

    // --- Save (Create/Update) ---
    async saveBuilding(id: number | null, payload: { name: string; floors: string[] }) {
        return withErrorHandling(async () => {
            let buildingId = id;
            if (id) {
                const { error } = await supabase.from("buildings").update({ name: payload.name }).eq("id", id);
                if (error) throw error;
                await HistoryService.log("SYSTEM", id, "UPDATE_CATALOG", { message: `Edificio actualizado: ${payload.name}`, entityName: `Edificio: ${payload.name}` });
            } else {
                const sortOrder = await getNextSortOrder("buildings");
                const { data, error } = await supabase.from("buildings").insert([{ name: payload.name, sort_order: sortOrder }]).select().single();
                if (error) throw error;
                buildingId = data.id;
                await HistoryService.log("SYSTEM", data.id, "CREATE_CATALOG", { message: `Edificio creado: ${payload.name}`, entityName: `Edificio: ${payload.name}` });
            }
            await syncBuildingFloors(buildingId as number, payload.floors);
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

    async saveAccess(id: number | null, payload: { name: string; buildingId?: number }) {
        return withErrorHandling(async () => {
            if (id) {
                const { error } = await supabase.from("special_accesses").update({ name: payload.name }).eq("id", id);
                if (error) throw error;
                await HistoryService.log("SYSTEM", id, "UPDATE_CATALOG", { message: `Acceso especial actualizado: ${payload.name}`, entityName: `Acceso especial: ${payload.name}` });
            } else {
                const sortOrder = await getNextSortOrder("special_accesses", payload.buildingId);
                const { data, error } = await supabase.from("special_accesses").insert([{ name: payload.name, sort_order: sortOrder, building_id: payload.buildingId ?? null }]).select().single();
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

    /**
     * Crea o actualiza un tipo de medio de acceso por edificio.
     * La creación acepta cualquier key/nombre (la app deriva pisos y estado
     * dinámicamente de `has_floors`); la key se normaliza a slug.
     */
    async saveMediaType(
        id: string | null,
        payload: { key?: string; name?: string; has_floors?: boolean; active?: boolean; buildingIds?: number[]; color?: string; requires_programming?: boolean; requires_responsiva?: boolean; requires_identifier?: boolean },
    ) {
        return withErrorHandling(async () => {
            const slugify = (s: string) =>
                s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

            const buildingIds = (payload.buildingIds || []).filter((b) => Number.isFinite(b));
            let mediaTypeId = id;

            if (id) {
                const update: Record<string, unknown> = {};
                if (payload.name !== undefined) update.name = payload.name;
                if (payload.has_floors !== undefined) update.has_floors = payload.has_floors;
                if (payload.active !== undefined) update.active = payload.active;
                if (payload.color !== undefined) update.color = payload.color;
                if (payload.requires_programming !== undefined) update.requires_programming = payload.requires_programming;
                if (payload.requires_responsiva !== undefined) update.requires_responsiva = payload.requires_responsiva;
                if (payload.requires_identifier !== undefined) update.requires_identifier = payload.requires_identifier;
                const { error } = await supabase.from("access_media_types").update(update).eq("id", id);
                if (error) throw error;
                await HistoryService.log("SYSTEM", id, "UPDATE_CATALOG", { message: `Medio de acceso actualizado: ${payload.name}`, entityName: `Medio de acceso: ${payload.name}` });
            } else {
                const name = payload.name?.trim();
                if (!name) throw new Error("El nombre del medio es requerido");
                if (buildingIds.length === 0) throw new Error("Selecciona al menos un edificio");
                const key = slugify(payload.key?.trim() || name);
                if (!key) throw new Error("La clave del medio es inválida");
                const sortOrder = await getNextSortOrder("access_media_types");
                const { data, error } = await supabase
                    .from("access_media_types")
                    .insert([{
                        key,
                        name,
                        has_floors: payload.has_floors ?? false,
                        requires_programming: payload.requires_programming ?? true,
                        requires_responsiva: payload.requires_responsiva ?? true,
                        requires_identifier: payload.requires_identifier ?? true,
                        active: true,
                        color: payload.color ?? null,
                        sort_order: sortOrder,
                    }])
                    .select()
                    .single();
                if (error) throw error;
                mediaTypeId = data.id;
                await HistoryService.log("SYSTEM", data.id, "CREATE_CATALOG", { message: `Medio de acceso creado: ${data.name}`, entityName: `Medio de acceso: ${data.name}` });
            }

            // Sincronizar edificios donde aplica el medio (N:M).
            if (mediaTypeId && buildingIds.length > 0) {
                await supabase
                    .from("access_media_type_buildings")
                    .delete()
                    .eq("media_type_id", mediaTypeId);
                const { error: jError } = await supabase
                    .from("access_media_type_buildings")
                    .insert(buildingIds.map((buildingId) => ({ media_type_id: mediaTypeId, building_id: buildingId })));
                if (jError) throw jError;
            }
            catalogCache.invalidate('access_media_types_v2');
        }, "Save Media Type");
    },

    // --- Delete ---
    async deleteCatalogItem(table: string, id: number | string, itemName: string) {
        return withErrorHandling(async () => {
            const { error } = await supabase.from(table).delete().eq("id", id);
            if (error) throw error;
            await HistoryService.log("SYSTEM", String(id), "DELETE_CATALOG", { message: `Eliminado de ${table}: ${itemName}`, entityName: `${table}: ${itemName}` });
            catalogCache.invalidate(table);
        }, "Delete Catalog Item");
    }
};
