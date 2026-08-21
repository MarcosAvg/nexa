import { supabase } from "../supabase";
import { withErrorHandlingSafe } from "../utils";
import type { AccessMedia, AccessMediaType } from "../types";

export const accessMediaService = {
    async fetchTypes(throwOnError: boolean = false): Promise<AccessMediaType[]> {
        return withErrorHandlingSafe(async () => {
            const { data, error } = await supabase
                .from("access_media_types")
                .select("*")
                .eq("active", true)
                .order("sort_order", { ascending: true })
                .order("name", { ascending: true });
            if (error) throw error;
            return (data || []) as AccessMediaType[];
        }, "Fetch Access Media Types", []);
    },

    async fetchAll(
        page: number = 1,
        limit: number = 50,
        search: string = "",
        typeName: string = "Todos",
        statusFilter: string = "Todas",
        depId: string = ""
    ): Promise<{ data: AccessMedia[]; count: number }> {
        return withErrorHandlingSafe(async () => {
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            let query = supabase
                .from("access_media")
                .select("*, access_media_types(*), personnel(first_name, last_name, status)", { count: "exact" });

            if (search) {
                const terms = search.trim().split(/\s+/).filter(Boolean);
                const searchTerm = `%${search}%`;

                let peopleQuery = supabase.from("personnel").select("id");
                for (const term of terms) {
                    const termPattern = `%${term}%`;
                    peopleQuery = peopleQuery.or(`first_name.ilike.${termPattern},last_name.ilike.${termPattern}`);
                }
                const { data: people } = await peopleQuery;
                const personIds = people?.map((p) => p.id) || [];

                if (personIds.length > 0) {
                    query = query.or(`identifier.ilike.${searchTerm},person_id.in.(${personIds.join(",")})`);
                } else {
                    query = query.ilike("identifier", searchTerm);
                }
            }

            if (typeName !== "Todos") {
                query = query.eq("access_media_types.name", typeName);
            }

            if (statusFilter !== "Todas") {
                const map: Record<string, string> = {
                    "Activa": "active",
                    "Bloqueada": "blocked",
                    "Baja": "inactive",
                    "Disponible": "available",
                };
                if (map[statusFilter]) query = query.eq("status", map[statusFilter]);
            }

            if (depId) {
                const { data: people } = await supabase
                    .from("personnel")
                    .select("id")
                    .eq("dependency_id", depId);
                const personIds = people?.map((p) => p.id) || [];
                if (personIds.length > 0) {
                    query = query.in("person_id", personIds);
                } else {
                    return { data: [], count: 0 };
                }
            }

            const { data, count, error } = await query.range(from, to);
            if (error) throw error;

            const mapped = ((data || []) as AccessMedia[]).map((m) => ({
                ...m,
                personName: m.personnel
                    ? `${m.personnel.first_name} ${m.personnel.last_name}`
                    : "Sin asignar",
                personStatus: m.personnel?.status,
            }));

            return { data: mapped, count: count || 0 };
        }, "Fetch Access Media", { data: [], count: 0 });
    },

    async fetchExtra(throwOnError: boolean = false): Promise<AccessMedia[]> {
        return withErrorHandlingSafe(async () => {
            const { data, error } = await supabase
                .from("access_media")
                .select("*, access_media_types(*)")
                .is("person_id", null);
            if (error) throw error;
            return ((data || []) as AccessMedia[]).map((m) => ({ ...m, personName: "Sin asignar" }));
        }, "Fetch Extra Access Media", []);
    },

    async fetchById(id: string): Promise<AccessMedia | null> {
        return withErrorHandlingSafe(async () => {
            const { data, error } = await supabase
                .from("access_media")
                .select("*, access_media_types(*), personnel(first_name, last_name)")
                .eq("id", id)
                .single();
            if (error) throw error;
            return (data || null) as AccessMedia | null;
        }, "Fetch Access Media By Id", null);
    },
};
