import { supabase } from "../supabase";
import { withErrorHandlingSafe } from "../utils";
import type { AccessAssignment, AccessAssignmentPermission } from "../types";

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
