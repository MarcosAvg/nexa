import { supabase } from "../supabase";
import { handleError } from "../utils/error";

export const HistoryService = {
    /**
     * Log an action to the history table.
     * @param entityType - 'PERSONNEL', 'CARD', 'TICKET', 'SYSTEM'
     * @param entityId - The ID of the entity (string or number, converted to string)
     * @param action - Short action name e.g. 'CREATE', 'UPDATE', 'BLOCK'
     * @param details - Object or string with details
     * @param performedBy - Optional user UUID (defaults to auth user if not provided, or handling in RLS)
     */
    async log(entityType: string, entityId: string | number | undefined, action: string, details: any, performedBy?: string) {
        if (!entityId) {
            console.warn("HistoryService: No entityId provided for log", { entityType, action });
            // We allow logging without entityId for system events?
            // defined in schema as nullable, so yes.
        }

        let entityName: string | null = null;
        const idStr = entityId ? String(entityId) : null;

        // Proactively capture entity name/folio
        try {
            if (idStr) {
                if (entityType === "CARD") {
                    const { data } = await supabase.from("cards").select("folio, type").eq("id", idStr).single();
                    if (data) entityName = `Tarjeta: ${data.folio} (${data.type})`;
                } else if (entityType === "PERSONNEL" || entityType === "PERSON") {
                    const { data } = await supabase.from("personnel").select("first_name, last_name").eq("id", idStr).single();
                    if (data) entityName = `${data.first_name} ${data.last_name}`;
                } else if (entityType === "TICKET") {
                    const { data } = await supabase.from("tickets").select("id, title").eq("id", idStr).single();
                    if (data) entityName = `Ticket #${data.id}: ${data.title}`;
                }
            }
        } catch (e) {
            console.warn("HistoryService: Could not capture entity snapshot name", e);
        }

        const payload = {
            entity_type: entityType,
            entity_id: idStr,
            entity_name: entityName,
            action,
            details: typeof details === 'string' ? { message: details } : details,
            // performed_by is handled by RLS 'default: auth.uid()' usually? 
            // In our schema we didn't set default. 
            // Let's try to set it if we have it, or let supabase auth context handle it if we had a trigger.
            // Since we are inserting from client, we should probably let RLS handle it or pass it.
            // But 'performed_by' is a column. If we don't send it, it's null unless default. 
            // Our schema: "performed_by uuid references auth.users(id)". No default.
            // So we must send it, or use a trigger. 
            // For now, let's try to get it from current session if not passed.
            // Actually, best practice: Let Supabase handle 'auth.uid()' via default value or trigger.
            // But we didn't add that in migration. 
            // We can try fetching session here, or rely on the caller passing it.
            // For simplicity/robustness, let's fetch session if not present.
        };

        // Helper to get user if needed
        let userId = performedBy;
        if (!userId) {
            const { data: { session } } = await supabase.auth.getSession();
            userId = session?.user?.id;
        }

        const { error } = await supabase
            .from("history_logs")
            .insert([{ ...payload, performed_by: userId }]);

        if (error) {
            console.error("Failed to log history:", error);
        }
    },

    async fetchAll(
        page: number = 1,
        limit: number = 50,
        filters: {
            person?: string;
            cardType?: string;
            folio?: string;
            action?: string;
        } = {}
    ) {
        try {
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            let query = supabase
                .from("history_logs")
                .select("*", { count: "exact" });

            // Apply Filters
            if (filters.person) {
                // Search in entity_name (snapshot) primarily
                query = query.ilike("entity_name", `%${filters.person}%`);
            }

            if (filters.cardType && filters.cardType !== "Todos") {
                query = query.ilike("entity_name", `%${filters.cardType}%`);
            }

            if (filters.folio) {
                query = query.ilike("entity_name", `%${filters.folio}%`);
            }

            if (filters.action && filters.action !== "Todas") {
                query = query.eq("action", filters.action);
            }

            const { data, count, error } = await query
                .order("timestamp", { ascending: false })
                .range(from, to);

            if (error) throw error;
            return { data: data || [], count: count || 0 };
        } catch (error) {
            handleError(error, "Fetch History");
            return { data: [], count: 0 };
        }
    },

    async fetchForExport(
        filters: {
            person?: string;
            cardType?: string;
            folio?: string;
            action?: string;
        } = {}
    ) {
        try {
            let query = supabase
                .from("history_logs")
                .select("*");

            // Apply Filters
            if (filters.person) {
                query = query.ilike("entity_name", `%${filters.person}%`);
            }

            if (filters.cardType && filters.cardType !== "Todos") {
                query = query.ilike("entity_name", `%${filters.cardType}%`);
            }

            if (filters.folio) {
                query = query.ilike("entity_name", `%${filters.folio}%`);
            }

            if (filters.action && filters.action !== "Todas") {
                query = query.eq("action", filters.action);
            }

            const { data, error } = await query
                .order("timestamp", { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            handleError(error, "Fetch History for Export");
            return [];
        }
    },

    async fetchMore(offset: number, limit: number = 200) {
        try {
            const { data, error } = await supabase
                .from("history_logs")
                .select("*")
                .order("timestamp", { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;
            return data || [];
        } catch (error) {
            handleError(error, "Fetch More History");
            return [];
        }
    },

    async deleteByEntity(entityType: string, entityId: string) {
        try {
            const { error } = await supabase
                .from("history_logs")
                .delete()
                .eq("entity_type", entityType)
                .eq("entity_id", entityId);

            if (error) throw error;
        } catch (error) {
            handleError(error, "Delete History By Entity");
            throw error;
        }
    },

    async fetchByEntity(entityType: string, entityId: string) {
        try {
            const { data, error } = await supabase
                .from("history_logs")
                .select("*")
                .eq("entity_type", entityType)
                .eq("entity_id", entityId)
                .order("timestamp", { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Fetch History By Entity Error", error);
            return [];
        }
    }
};
