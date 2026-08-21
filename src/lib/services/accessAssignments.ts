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
        specialAccesses: string[],
    ): Promise<void> {
        return withErrorHandling(async () => {
            // Resolver referencias estables por edificio:
            // floors.label -> floors.id (por edificio) y special_accesses.name -> id + building.
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
                .select("id, name, building_id");
            const specialByName = new Map<string, { id: number; buildingId: number | null }>();
            for (const s of specials || []) {
                if (!specialByName.has(s.name)) {
                    specialByName.set(s.name, { id: s.id, buildingId: s.building_id });
                }
            }

            const assignments = await this.fetchForPerson(personId);
            for (const assignment of assignments) {
                const rows: {
                    assignment_id: string;
                    resource_type: string;
                    building_id: number;
                    floor_id?: number | null;
                    special_access_id?: number | null;
                }[] = [];
                const seenFloors = new Set<string>();
                const seenSpecials = new Set<string>();

                // Pisos por edificio seleccionado, con el building_id real.
                for (const [bidStr, typeMap] of Object.entries(floorsByBuilding)) {
                    const bid = Number(bidStr);
                    if (!Number.isFinite(bid)) continue;
                    const labelMap = floorIdByBuilding.get(bid);
                    const list = typeMap[assignment.media_type_id] || [];
                    for (const f of list) {
                        const key = f.trim();
                        const dedupeKey = `${bid}:${key.toLowerCase()}`;
                        if (!key || seenFloors.has(dedupeKey)) continue;
                        seenFloors.add(dedupeKey);
                        rows.push({
                            assignment_id: assignment.id,
                            resource_type: "floor",
                            building_id: bid,
                            floor_id: labelMap?.get(key) ?? null,
                        });
                    }
                }

                // Accesos especiales: heredan el edificio de su catálogo.
                for (const s of specialAccesses) {
                    if (!s || !s.trim()) continue;
                    const name = s.trim();
                    const dedupeKey = name.toLowerCase();
                    if (seenSpecials.has(dedupeKey)) continue;
                    seenSpecials.add(dedupeKey);
                    const sp = specialByName.get(name);
                    rows.push({
                        assignment_id: assignment.id,
                        resource_type: "special_access",
                        building_id: sp?.buildingId ?? 0,
                        special_access_id: sp?.id ?? null,
                    });
                }

                const { error: delError } = await supabase
                    .from("access_assignment_permissions")
                    .delete()
                    .eq("assignment_id", assignment.id);
                if (delError) throw delError;

                if (rows.length > 0) {
                    const { error: insError } = await supabase
                        .from("access_assignment_permissions")
                        .insert(rows);
                    if (insError) throw insError;
                }
            }
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
        await this.savePersonAccess(personId, idKeyed, access.specialAccesses);
    },
};