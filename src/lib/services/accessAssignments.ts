import { supabase } from "../supabase";
import { withErrorHandlingSafe, withErrorHandling } from "../utils";
import type { AccessAssignment, AccessAssignmentPermission, FloorGroup } from "../types";

/** Mapa de pisos por id de tipo de medio (entrada de savePersonAccess). */
export type FloorGroups = Record<string, string[]>;

export interface PersonAccessData {
    floorsByBuilding: Record<number, FloorGroup[]>;
    specialAccesses: string[];
}

/**
 * Deriva los pisos agrupados por tipo de medio concreto (media_type_id) y los
 * accesos especiales, desde el arreglo anidado de access_assignments +
 * access_assignment_permissions (modelo normalizado).
 */
export function deriveAccessFromAssignments(assignments: any[] | null | undefined): {
    floors: FloorGroup[];
    specialAccesses: string[];
} {
    const byType = new Map<string, FloorGroup>();
    const specialSet = new Set<string>();
    for (const a of assignments || []) {
        const mediaTypeId = a.media_type_id;
        if (!mediaTypeId) continue;
        for (const p of a.access_assignment_permissions || []) {
            if (p.resource_type === "floor") {
                const label = p.floors?.label ?? "";
                if (!label) continue;
                if (!byType.has(mediaTypeId)) {
                    byType.set(mediaTypeId, {
                        mediaTypeId,
                        mediaKey: a.access_media_types?.key ?? "",
                        mediaName: a.access_media_types?.name ?? "",
                        floors: [],
                    });
                }
                const group = byType.get(mediaTypeId)!;
                if (!group.floors.includes(label)) {
                    group.floors.push(label);
                }
            } else if (p.resource_type === "special_access") {
                const name = p.special_accesses?.name ?? "";
                if (name) specialSet.add(name);
            }
        }
    }
    return { floors: Array.from(byType.values()), specialAccesses: Array.from(specialSet) };
}

/** Pisos de un grupo por clave de medio (compatibilidad con flujos keyed). */
export function floorsForKey(groups: FloorGroup[] | null | undefined, key: string): string[] {
    return groups?.find((g) => g.mediaKey === key)?.floors ?? [];
}

/** Convierte grupos a mapa id→pisos (para selectores y savePersonAccess). */
export function floorGroupsToIdMap(groups: FloorGroup[] | null | undefined): FloorGroups {
    const out: FloorGroups = {};
    for (const g of groups || []) out[g.mediaTypeId] = g.floors;
    return out;
}

/** Datos de radicación usados para inyectar el piso base en los accesos de pisos. */
export interface BaseFloorInput {
    buildingId: number | null;
    floor?: string | null;
}

/**
 * Si la persona radica en un edificio que se está solicitando (presente en
 * floorsByBuilding) y ese edificio gestiona medios CON pisos, inyecta el piso
 * base en los pisos de cada medio con pisos que aplica a ese edificio.
 */
async function applyBaseFloor(
    floorsByBuilding: Record<number, FloorGroups>,
    base: BaseFloorInput | undefined,
    mediaApplies: (mediaTypeId: string, bid: number) => boolean,
): Promise<Record<number, FloorGroups>> {
    if (!base || !base.buildingId || !base.floor) return floorsByBuilding;
    const bid = base.buildingId;
    // Si no se está solicitando acceso en el edificio de radicación, no se inyecta.
    if (!floorsByBuilding[bid]) return floorsByBuilding;

    const { data: types } = await supabase
        .from("access_media_types")
        .select("id, has_floors");
    const hasFloors = new Set<string>(
        (types || []).filter((m: any) => m.has_floors).map((m: any) => m.id),
    );
    const floorLabel = base.floor;
    const next = { ...floorsByBuilding };
    const floorsForBid = { ...next[bid] };
    for (const mediaTypeId of Object.keys(floorsForBid)) {
        if (!hasFloors.has(mediaTypeId)) continue;
        if (!mediaApplies(mediaTypeId, bid)) continue;
        const list = floorsForBid[mediaTypeId] || [];
        if (!list.includes(floorLabel)) {
            floorsForBid[mediaTypeId] = [...list, floorLabel];
        }
    }
    next[bid] = floorsForBid;
    return next;
}

export const accessAssignmentService = {
    async fetchForPerson(personId: string): Promise<AccessAssignment[]> {
        return withErrorHandlingSafe(async () => {
            const { data, error } = await supabase
                .from("access_assignments")
                .select("*, access_media_types(*)")
                .eq("person_id", personId)
                .eq("status", "active");
            if (error) throw error;
            return (data || []) as AccessAssignment[];
        }, "Fetch Person Access Assignments", []);
    },

    async fetchPermissions(assignmentId: string): Promise<AccessAssignmentPermission[]> {
        return withErrorHandlingSafe(async () => {
            const { data, error } = await supabase
                .from("access_assignment_permissions")
                .select("*")
                .eq("assignment_id", assignmentId);
            if (error) throw error;
            return (data || []) as AccessAssignmentPermission[];
        }, "Fetch Access Assignment Permissions", []);
    },

    /**
     * Devuelve los pisos agrupados por tipo de medio concreto para una persona
     * (agrupados por edificio). Fuente: el nuevo modelo de permisos.
     */
    async fetchPersonAccess(personId: string): Promise<PersonAccessData> {
        return withErrorHandlingSafe(async () => {
            const { data, error } = await supabase
                .from("access_assignments")
                .select(
                    "id, media_type_id, access_media_types(id, key, name), access_assignment_permissions(resource_type, floors(label), special_accesses(name), building_id)"
                )
                .eq("person_id", personId)
                .eq("status", "active");
            if (error) throw error;

            const byBuilding = new Map<number, Map<string, FloorGroup>>();
            const specialSet = new Set<string>();

            for (const assignment of (data || []) as any[]) {
                const mediaTypeId = assignment.media_type_id;
                if (!mediaTypeId) continue;
                for (const p of (assignment.access_assignment_permissions || []) as any[]) {
                    if (p.resource_type === "floor") {
                        const bid = p.building_id;
                        if (!bid) continue;
                        const label = p.floors?.label ?? "";
                        if (!label) continue;
                        if (!byBuilding.has(bid)) byBuilding.set(bid, new Map());
                        const typesMap = byBuilding.get(bid)!;
                        if (!typesMap.has(mediaTypeId)) {
                            typesMap.set(mediaTypeId, {
                                mediaTypeId,
                                mediaKey: assignment.access_media_types?.key ?? "",
                                mediaName: assignment.access_media_types?.name ?? "",
                                floors: [],
                            });
                        }
                        const group = typesMap.get(mediaTypeId)!;
                        if (!group.floors.includes(label)) {
                            group.floors.push(label);
                        }
                    } else if (p.resource_type === "special_access") {
                        const name = p.special_accesses?.name ?? "";
                        if (name) specialSet.add(name);
                    }
                }
            }

            const floorsByBuilding: Record<number, FloorGroup[]> = {};
            for (const [bid, typesMap] of byBuilding) {
                floorsByBuilding[bid] = Array.from(typesMap.values());
            }

            return {
                floorsByBuilding,
                specialAccesses: Array.from(specialSet),
            };
        }, "Fetch Person Access", { floorsByBuilding: {}, specialAccesses: [] });
    },

    /**
     * Reconstruye los permisos de las asignaciones activas de una persona.
     *
     * Cada edificio seleccionado aporta sus pisos con su building_id real;
     * los accesos especiales heredan el edificio de su propio catálogo.
     */
    async savePersonAccess(
        personId: string,
        floorsByBuilding: Record<number, FloorGroups>,
        specialAccessIds: number[],
        base?: BaseFloorInput,
    ): Promise<void> {
        return withErrorHandling(async () => {
            // Resolver referencias estables por edificio.
            const { data: allFloors } = await supabase
                .from("floors")
                .select("id, label, building_id");
            const floorIdByBuilding = new Map<number, Map<string, number>>();
            for (const f of allFloors || []) {
                if (!floorIdByBuilding.has(f.building_id)) {
                    floorIdByBuilding.set(f.building_id, new Map());
                }
                floorIdByBuilding.get(f.building_id)!.set(f.label, f.id);
            }

            const { data: specials } = await supabase
                .from("special_accesses")
                .select("id, building_id");
            const specialById = new Map<number, number | null>(
                (specials || []).map((s) => [s.id, s.building_id]),
            );

            // Relaciones medio-edificio: un medio solo aplica en los edificios asignados.
            const { data: mediaBuildings } = await supabase
                .from("access_media_type_buildings")
                .select("media_type_id, building_id");
            const mediaBuildingsSet = new Set<string>(
                (mediaBuildings || []).map((r) => `${r.media_type_id}:${r.building_id}`),
            );
            const mediaApplies = (mediaTypeId: string, bid: number) =>
                mediaBuildingsSet.has(`${mediaTypeId}:${bid}`);

            // Regla de negocio: inyectar el piso base a los pisos del edificio de radicación.
            floorsByBuilding = await applyBaseFloor(floorsByBuilding, base, mediaApplies);

            const assignments = await this.fetchForPerson(personId);
            const allRows: {
                assignment_id: string;
                resource_type: string;
                building_id: number;
                floor_id?: number | null;
                special_access_id?: number | null;
            }[] = [];

            for (const assignment of assignments) {
                const seenFloors = new Set<string>();
                const seenSpecials = new Set<string>();

                // Pisos por edificio seleccionado, con el building_id real.
                // Solo se escriben si el medio de la asignación aplica a ese edificio.
                for (const [bidStr, typeMap] of Object.entries(floorsByBuilding)) {
                    const bid = Number(bidStr);
                    if (!Number.isFinite(bid)) continue;
                    const list = typeMap[assignment.media_type_id] || [];
                    if (list.length === 0) continue;
                    if (!mediaApplies(assignment.media_type_id, bid)) continue;
                    const labelMap = floorIdByBuilding.get(bid);
                    for (const f of list) {
                        const key = f.trim();
                        const dedupeKey = `${bid}:${key.toLowerCase()}`;
                        if (!key || seenFloors.has(dedupeKey)) continue;
                        seenFloors.add(dedupeKey);
                        allRows.push({
                            assignment_id: assignment.id,
                            resource_type: "floor",
                            building_id: bid,
                            floor_id: labelMap?.get(key) ?? null,
                        });
                    }
                }

                // Accesos especiales: heredan el edificio de su catálogo.
                // Se resuelven por id (sin ambigüedad entre edificios).
                for (const id of specialAccessIds) {
                    if (seenSpecials.has(String(id))) continue;
                    seenSpecials.add(String(id));
                    const buildingId = specialById.get(id);
                    if (buildingId === undefined) continue; // acceso no catalogado: omitir
                    allRows.push({
                        assignment_id: assignment.id,
                        resource_type: "special_access",
                        building_id: buildingId ?? 0,
                        special_access_id: id,
                    });
                }
            }

            // Escritura atómica: delete + insert en un solo RPC transaccional.
            const { error } = await supabase.rpc("set_person_access_permissions", {
                p_person_id: personId,
                p_rows: allRows,
            });
            if (error) throw error;
        }, "Save Person Access");
    },

    /**
     * Crea (o reactiva) la asignación de un medio de acceso a una persona.
     * Reemplaza la parte de `sync_access_media_from_card` que insertaba
     * access_assignments al asignar una tarjeta.
     */
    async assignMedia(personId: string, mediaTypeId: string, accessMediaId: string): Promise<void> {
        return withErrorHandling(async () => {
            const { error } = await supabase
                .from("access_assignments")
                .upsert(
                    {
                        person_id: personId,
                        media_type_id: mediaTypeId,
                        access_media_id: accessMediaId,
                        assigned_at: new Date().toISOString(),
                        revoked_at: null,
                        status: "active",
                    },
                    { onConflict: "access_media_id" },
                );
            if (error) throw error;
        }, "Assign Access Media");
    },

    /**
     * Revoca la asignación vinculada a un medio de acceso.
     * Reemplaza la revocación que hacía `sync_access_media_from_card`
     * al desvincular/eliminar una tarjeta.
     */
    async revokeByMedia(accessMediaId: string): Promise<void> {
        return withErrorHandling(async () => {
            const { error } = await supabase
                .from("access_assignments")
                .update({ revoked_at: new Date().toISOString(), status: "revoked" })
                .eq("access_media_id", accessMediaId)
                .eq("status", "active");
            if (error) throw error;
        }, "Revoke Access Media");
    },

    /**
     * Reconstruye los permisos (pisos + accesos especiales) de una persona a
     * partir de su acceso actual en el modelo nuevo. Se usa al asignar un medio
     * para heredar el acceso ya configurado a la nueva asignación.
     */
    async rebuildPersonAccess(personId: string): Promise<void> {
        const access = await this.fetchPersonAccess(personId);
        const idKeyed: Record<number, FloorGroups> = {};
        for (const [bid, groups] of Object.entries(access.floorsByBuilding)) {
            idKeyed[Number(bid)] = floorGroupsToIdMap(groups);
        }
        // access.specialAccesses son nombres; resolver a ids del catálogo.
        const { data: specials } = await supabase
            .from("special_accesses")
            .select("id, name");
        const idByName = new Map<string, number>(
            (specials || []).map((s: any) => [s.name, s.id]),
        );
        const specialIds = access.specialAccesses
            .map((n) => idByName.get(n))
            .filter((id): id is number => id !== undefined);
        // Base de radicación de la persona (para inyectar el piso base si aplica).
        const { data: person } = await supabase
            .from("personnel")
            .select("building_id, floor")
            .eq("id", personId)
            .maybeSingle();
        const base: BaseFloorInput = {
            buildingId: person?.building_id ?? null,
            floor: person?.floor || null,
        };
        await this.savePersonAccess(personId, idKeyed, specialIds, base);
    },
};

/**
 * Construye el "plan" de permisos (filas de access_assignment_permissions) para
 * un alta transaccional, referenciando las asignaciones por índice (0-based) de
 * `mediaTypeIds` en lugar de por id. Reutiliza la lógica de savePersonAccess
 * (pisos por edificio + accesos especiales) pero sin leer las asignaciones,
 * porque estas aún no existen (las crea el RPC create_person_with_access).
 */
export async function buildPermissionPlan(
    mediaTypeIds: string[],
    floorsByBuilding: Record<number, FloorGroups>,
    specialAccessIds: number[],
    base?: BaseFloorInput,
): Promise<{
    assignment_index: number;
    resource_type: string;
    building_id: number;
    floor_id?: number | null;
    special_access_id?: number | null;
}[]> {
    const { data: allFloors } = await supabase
        .from("floors")
        .select("id, label, building_id");
    const floorIdByBuilding = new Map<number, Map<string, number>>();
    for (const f of allFloors || []) {
        if (!floorIdByBuilding.has(f.building_id)) {
            floorIdByBuilding.set(f.building_id, new Map());
        }
        floorIdByBuilding.get(f.building_id)!.set(f.label, f.id);
    }

    const { data: specials } = await supabase
        .from("special_accesses")
        .select("id, building_id");
    const specialById = new Map<number, number | null>(
        (specials || []).map((s) => [s.id, s.building_id]),
    );

    const { data: mediaBuildings } = await supabase
        .from("access_media_type_buildings")
        .select("media_type_id, building_id");
    const mediaBuildingsSet = new Set<string>(
        (mediaBuildings || []).map((r) => `${r.media_type_id}:${r.building_id}`),
    );
    const mediaApplies = (mediaTypeId: string, bid: number) =>
        mediaBuildingsSet.has(`${mediaTypeId}:${bid}`);

    // Regla de negocio: inyectar el piso base a los pisos del edificio de radicación.
    floorsByBuilding = await applyBaseFloor(floorsByBuilding, base, mediaApplies);

    const rows: {
        assignment_index: number;
        resource_type: string;
        building_id: number;
        floor_id?: number | null;
        special_access_id?: number | null;
    }[] = [];

    mediaTypeIds.forEach((mediaTypeId, index) => {
        const seenFloors = new Set<string>();
        const seenSpecials = new Set<string>();

        for (const [bidStr, typeMap] of Object.entries(floorsByBuilding)) {
            const bid = Number(bidStr);
            if (!Number.isFinite(bid)) continue;
            const list = typeMap[mediaTypeId] || [];
            if (list.length === 0) continue;
            if (!mediaApplies(mediaTypeId, bid)) continue;
            const labelMap = floorIdByBuilding.get(bid);
            for (const f of list) {
                const key = f.trim();
                const dedupeKey = `${bid}:${key.toLowerCase()}`;
                if (!key || seenFloors.has(dedupeKey)) continue;
                seenFloors.add(dedupeKey);
                rows.push({
                    assignment_index: index,
                    resource_type: "floor",
                    building_id: bid,
                    floor_id: labelMap?.get(key) ?? null,
                });
            }
        }

        for (const id of specialAccessIds) {
            if (seenSpecials.has(String(id))) continue;
            seenSpecials.add(String(id));
            const buildingId = specialById.get(id);
            if (buildingId === undefined) continue;
            rows.push({
                assignment_index: index,
                resource_type: "special_access",
                building_id: buildingId ?? 0,
                special_access_id: id,
            });
        }
    });

    return rows;
}