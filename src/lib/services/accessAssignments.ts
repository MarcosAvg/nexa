import { supabase } from "../supabase";
import { withErrorHandlingSafe, withErrorHandling } from "../utils";
import type { AccessAssignment, AccessAssignmentPermission } from "../types";

/**
 * Grupos de pisos por clave de tipo de medio (ej. `{ p2000: [...], kone: [...] }`).
 * Las claves son las keys reales de los medios con pisos del catálogo.
 */
export type FloorGroups = Record<string, string[]>;

export interface PersonAccessData {
    floorsByBuilding: Record<number, FloorGroups>;
    specialAccesses: string[];
}

/**
 * Edificio al que apunta todo el acceso del personal (pisos + accesos
 * especiales). De momento la asignación de accesos es exclusiva de Torre
 * Administrativa; los demás edificios solo marcan la radicación.
 */
export const TORRE_BUILDING_ID = 1;

/**
 * Deriva pisos agrupados por clave de tipo de medio y accesos especiales desde
 * el arreglo anidado de access_assignments + access_assignment_permissions
 * (modelo normalizado).
 */
export function deriveAccessFromAssignments(assignments: any[] | null | undefined): {
    floorsByMedia: FloorGroups;
    specialAccesses: string[];
} {
    const floorsByMedia: FloorGroups = {};
    const specialSet = new Set<string>();
    for (const a of assignments || []) {
        const key = a.access_media_types?.key;
        for (const p of a.access_assignment_permissions || []) {
            if (p.resource_type === "floor") {
                if (!key) continue;
                if (!floorsByMedia[key]) floorsByMedia[key] = [];
                if (!floorsByMedia[key].includes(p.resource_key)) {
                    floorsByMedia[key].push(p.resource_key);
                }
            } else if (p.resource_type === "special_access") {
                specialSet.add(p.resource_key);
            }
        }
    }
    return { floorsByMedia, specialAccesses: Array.from(specialSet) };
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
     * Devuelve los pisos por clave de tipo de medio para una persona
     * (agrupados por edificio). Fuente: el nuevo modelo de permisos.
     */
    async fetchPersonAccess(personId: string): Promise<PersonAccessData> {
        return withErrorHandlingSafe(async () => {
            const { data, error } = await supabase
                .from("access_assignments")
                .select(
                    "id, access_media_types(key), access_assignment_permissions(resource_type, resource_key, building_id)"
                )
                .eq("person_id", personId)
                .eq("status", "active");
            if (error) throw error;

            const floorsByBuilding: Record<number, FloorGroups> = {};
            const specialSet = new Set<string>();

            for (const assignment of (data || []) as any[]) {
                const mediaKey = assignment.access_media_types?.key;
                for (const p of (assignment.access_assignment_permissions || []) as any[]) {
                    if (p.resource_type === "floor") {
                        const bid = p.building_id;
                        if (!bid || !mediaKey) continue;
                        if (!floorsByBuilding[bid]) floorsByBuilding[bid] = {};
                        if (!floorsByBuilding[bid][mediaKey]) floorsByBuilding[bid][mediaKey] = [];
                        if (!floorsByBuilding[bid][mediaKey].includes(p.resource_key)) {
                            floorsByBuilding[bid][mediaKey].push(p.resource_key);
                        }
                    } else if (p.resource_type === "special_access") {
                        specialSet.add(p.resource_key);
                    }
                }
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
     * De momento todo el acceso asignado al personal (pisos de cualquier
     * edificio + accesos especiales) se escribe bajo Torre Administrativa:
     * los demás edificios solo diferencian radicación y piso base. Cuando se
     * requieran accesos a pisos de otros edificios, esta función se revisita.
     */
    async savePersonAccess(
        personId: string,
        floorsByBuilding: Record<number, FloorGroups>,
        specialAccesses: string[],
    ): Promise<void> {
        return withErrorHandling(async () => {
            // Resolver referencias estables (floors.id / special_accesses.id).
            const { data: torreFloors } = await supabase
                .from("floors")
                .select("id, label")
                .eq("building_id", TORRE_BUILDING_ID);
            const floorIdByLabel = new Map<string, number>((torreFloors || []).map((f) => [f.label, f.id]));

            const { data: specials } = await supabase
                .from("special_accesses")
                .select("id, name");
            const specialIdByName = new Map<string, number>();
            for (const s of specials || []) {
                if (!specialIdByName.has(s.name)) specialIdByName.set(s.name, s.id);
            }

            const assignments = await this.fetchForPerson(personId);
            for (const assignment of assignments) {
                const mediaKey = (assignment as any).access_media_types?.key;

                const rows: {
                    assignment_id: string;
                    resource_type: string;
                    resource_key: string;
                    building_id: number;
                    floor_id?: number | null;
                    special_access_id?: number | null;
                }[] = [];

                // Pisos del medio de esta asignación (cualquier key con pisos).
                if (mediaKey) {
                    const seen = new Set<string>();
                    for (const floors of Object.values(floorsByBuilding)) {
                        const list = floors[mediaKey] || [];
                        for (const f of list) {
                            const key = f.trim();
                            if (!key || seen.has(key)) continue;
                            seen.add(key);
                            rows.push({
                                assignment_id: assignment.id,
                                resource_type: "floor",
                                resource_key: key,
                                building_id: TORRE_BUILDING_ID,
                                floor_id: floorIdByLabel.get(key) ?? null,
                            });
                        }
                    }
                }

                for (const s of specialAccesses) {
                    if (!s || !s.trim()) continue;
                    const name = s.trim();
                    rows.push({
                        assignment_id: assignment.id,
                        resource_type: "special_access",
                        resource_key: name,
                        building_id: TORRE_BUILDING_ID,
                        special_access_id: specialIdByName.get(name) ?? null,
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
        await this.savePersonAccess(personId, access.floorsByBuilding, access.specialAccesses);
    },

    /**
     * Devuelve los pisos por clave de tipo de medio para una persona.
     * Reemplaza gradualmente a personnel.floors_p2000 / floors_kone.
     */
    async fetchFloorsForPerson(personId: string): Promise<Record<string, string[]>> {
        return withErrorHandlingSafe(async () => {
            const { data, error } = await supabase
                .from("access_assignments")
                .select(
                    "media_type_id, access_media_types(key), access_assignment_permissions(resource_type, resource_key)"
                )
                .eq("person_id", personId)
                .eq("status", "active");
            if (error) throw error;

            const result: Record<string, string[]> = {};
            for (const assignment of (data || []) as any[]) {
                const key = assignment.access_media_types?.key;
                if (!key) continue;
                const floors = (assignment.access_assignment_permissions || [])
                    .filter((p: any) => p.resource_type === "floor")
                    .map((p: any) => p.resource_key);
                if (floors.length > 0) result[key] = floors;
            }
            return result;
        }, "Fetch Person Floors", {});
    },
};