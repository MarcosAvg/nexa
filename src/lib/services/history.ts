import { supabase } from "../supabase";
import { withErrorHandling, withErrorHandlingSafe, withErrorHandlingConditional, batchPaginate } from "../utils";

// Module-level userId cache — avoids calling getSession() on every log
let _cachedUserId: string | undefined;

export const HistoryService = {
    /**
     * Log an action to the history table.
     * 
     * PERF: Entity name is now accepted as an optional parameter so callers
     * can pass it directly (they almost always have it). This eliminates
     * 1-3 extra SELECT queries that the old implementation used to resolve names.
     * 
     * @param entityType - 'PERSONNEL', 'CARD', 'TICKET', 'SYSTEM'
     * @param entityId - The ID of the entity (string or number, converted to string)
     * @param action - Short action name e.g. 'CREATE', 'UPDATE', 'BLOCK'
     * @param details - Object or string with details. If details.entityName is set, it's used as the entity_name.
     * @param performedBy - Optional user UUID (cached after first call)
     */
    async log(entityType: string, entityId: string | number | undefined, action: string, details: Record<string, unknown> | string, performedBy?: string) {
        if (!entityId) {
            console.warn("HistoryService: No entityId provided for log", { entityType, action });
        }

        const idStr = entityId ? String(entityId) : null;
        const detailsObj = typeof details === 'string' ? { message: details } : details;

        // Extract entityName from details if provided by caller, avoiding extra queries
        const entityName: string | null = detailsObj?.entityName || null;
        // Remove entityName from persisted details to keep them clean
        if (detailsObj?.entityName) {
            delete detailsObj.entityName;
        }

        // Cache userId after first call to avoid repeated getSession() round-trips
        let userId = performedBy;
        if (!userId) {
            if (!_cachedUserId) {
                const { data: { session } } = await supabase.auth.getSession();
                _cachedUserId = session?.user?.id;
            }
            userId = _cachedUserId;
        }

        const { error } = await supabase
            .from("history_logs")
            .insert([{
                entity_type: entityType,
                entity_id: idStr,
                entity_name: entityName,
                action,
                details: detailsObj,
                performed_by: userId,
            }]);

        if (error) {
            // Silently handle history logging errors - not critical for user flow
        }
    },

    /** Reset cached userId (call on logout) */
    clearCache() {
        _cachedUserId = undefined;
    },

    async fetchAll(
        page: number = 1,
        limit: number = 50,
        filters: {
            person?: string;
            cardType?: string;
            folio?: string;
            action?: string;
        } = {},
        throwOnError: boolean = false
    ) {
        return withErrorHandlingConditional(async () => {
            const from = (page - 1) * limit;
            let query = supabase
                .from("history_logs")
                .select("id, timestamp, entity_type, entity_id, entity_name, action, details, performed_by", { count: "exact" });

            if (filters.person) query = query.ilike("entity_name", `%${filters.person}%`);
            if (filters.cardType && filters.cardType !== "Todos") query = query.ilike("entity_name", `%${filters.cardType}%`);
            if (filters.folio) query = query.ilike("entity_name", `%${filters.folio}%`);
            if (filters.action && filters.action !== "Todas") query = query.eq("action", filters.action);

            const { data, count, error } = await query
                .order("timestamp", { ascending: false })
                .range(from, from + limit - 1);

            if (error) throw error;
            return { data: data || [], count: count || 0 };
        }, "Fetch History", throwOnError, { data: [], count: 0 });
    },

    async fetchForExport(
        filters: {
            person?: string;
            cardType?: string;
            folio?: string;
            action?: string;
        } = {}
    ) {
        return withErrorHandlingSafe(async () => {
            return await batchPaginate<any>(async (from, to) => {
                let q = supabase.from("history_logs").select("*");
                if (filters.person) q = q.ilike("entity_name", `%${filters.person}%`);
                if (filters.cardType && filters.cardType !== "Todos") q = q.ilike("entity_name", `%${filters.cardType}%`);
                if (filters.folio) q = q.ilike("entity_name", `%${filters.folio}%`);
                if (filters.action && filters.action !== "Todas") q = q.eq("action", filters.action);
                return q.order("timestamp", { ascending: false }).range(from, to);
            });
        }, "Fetch History for Export", []);
    },

    async fetchMore(offset: number, limit: number = 200) {
        return withErrorHandlingSafe(async () => {
            const { data, error } = await supabase
                .from("history_logs")
                .select("*").order("timestamp", { ascending: false })
                .range(offset, offset + limit - 1);
            if (error) throw error;
            return data || [];
        }, "Fetch More History", []);
    },

    async deleteByEntity(entityType: string, entityId: string) {
        return withErrorHandling(async () => {
            const { error } = await supabase
                .from("history_logs").delete()
                .eq("entity_type", entityType)
                .eq("entity_id", entityId);
            if (error) throw error;
        }, "Delete History By Entity");
    },

    async fetchByEntity(entityType: string, entityId: string) {
        return withErrorHandlingSafe(async () => {
            const { data, error } = await supabase
                .from("history_logs").select("*")
                .eq("entity_type", entityType).eq("entity_id", entityId)
                .order("timestamp", { ascending: false });
            if (error) throw error;
            return data || [];
        }, "Fetch History By Entity", []);
    },

    async fetchCardHistoryByRange(type: string) {
        return withErrorHandlingSafe(async () => {
            return await batchPaginate<any>(async (from, to) => {
                return supabase.from("history_logs")
                    .select("entity_id, entity_name, action, details, timestamp")
                    .eq("entity_type", "CARD").ilike("entity_name", `${type}%`)
                    .in("action", ["REPLACE_OLD", "DELETE", "BLOCK", "UNASSIGN", "UPDATE_STATUS", "CREATE"])
                    .order("timestamp", { ascending: false }).range(from, to);
            });
        }, "Fetch Card History By Range", []);
    }
};
