import { supabase } from "../supabase";
import { withErrorHandlingSafe, withErrorHandling } from "../utils";
import type { AccessAssignment, AccessAssignmentPermission } from "../types";

export interface PersonBuildingFloors {
    p2000: string[];
    kone: string[];
}

export interface PersonAccessData {
    floorsByBuilding: Record<number, PersonBuildingFloors>;
    specialAccesses: string[];
}

/**
 * Edificio al que apunta todo el acceso del personal (pisos + accesos
 * especiales). De momento la asignación de accesos es exclusiva de Torre
 * Administrativa; los demás edificios solo marcan la radicación.
 */
export const TORRE_BUILDING_ID = 1;

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

            const floorsByBuilding: Record<number, PersonBuildingFloors> = {};
            const specialSet = new Set<string>();

            for (const assignment of (data || []) as any[]) {
                const mediaKey = assignment.access_media_types?.key;
                for (const p of (assignment.access_assignment_permissions || []) as any[]) {
                    if (p.resource_type === "floor") {
                        const bid = p.building_id;
                        if (!bid) continue;
                        if (!floorsByBuilding[bid]) {
                            floorsByBuilding[bid] = { p2000: [], kone: [] };
                        }
                        const target =
                            mediaKey === "p2000"
                                ? floorsByBuilding[bid].p2000
                                : mediaKey === "kone"
                                  ? floorsByBuilding[bid].kone
                                  : null;
                        if (target && !target.includes(p.resource_key)) {
                            target.push(p.resource_key);
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
        floorsByBuilding: Record<number, PersonBuildingFloors>,
        specialAccesses: string[],
    ): Promise<void> {
        return withErrorHandling(async () => {
            const assignments = await this.fetchForPerson(personId);
            for (const assignment of assignments) {
                const mediaKey = (assignment as any).access_media_types?.key;
                const isP2000 = mediaKey === "p2000";
                const isKone = mediaKey === "kone";

                const rows: {
                    assignment_id: string;
                    resource_type: string;
                    resource_key: string;
                    building_id: number;
                }[] = [];

                if (isP2000 || isKone) {
                    const seen = new Set<string>();
                    for (const floors of Object.values(floorsByBuilding)) {
                        const list = isP2000 ? floors.p2000 : floors.kone;
                        for (const f of list) {
                            const key = f.trim();
                            if (!key || seen.has(key)) continue;
                            seen.add(key);
                            rows.push({
                                assignment_id: assignment.id,
                                resource_type: "floor",
                                resource_key: key,
                                building_id: TORRE_BUILDING_ID,
                            });
                        }
                    }
                }

                for (const s of specialAccesses) {
                    if (!s || !s.trim()) continue;
                    rows.push({
                        assignment_id: assignment.id,
                        resource_type: "special_access",
                        resource_key: s.trim(),
                        building_id: TORRE_BUILDING_ID,
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