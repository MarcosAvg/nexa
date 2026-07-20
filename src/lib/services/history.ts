import { supabase } from "../supabase";
import { withErrorHandling, withErrorHandlingSafe, withErrorHandlingConditional, batchPaginate } from "../utils";

// Caché de userId a nivel de módulo — evita llamar a getSession() en cada registro
let _cachedUserId: string | undefined;

/** Filtros comunes aceptados por fetchAll y fetchForExport. */
export type HistoryFilters = {
    person?: string;
    cardType?: string;
    folio?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
};

/**
 * Aplica filtros de historial a una query de Supabase.
 * Función standalone para evitar duplicación entre fetchAll y fetchForExport.
 */
function applyFilters(q: any, filters: HistoryFilters) {
    if (filters.person) {
        q = q.ilike('entity_name', `%${filters.person}%`);
    }
    if (filters.cardType && filters.cardType !== 'Todos') {
        q = q
            .eq('entity_type', 'CARD')
            .ilike('entity_name', `${filters.cardType}%`);
    }
    if (filters.folio) {
        q = q.ilike('entity_name', `%${filters.folio}%`);
    }
    if (filters.action && filters.action !== 'Todas') {
        q = q.eq('action', filters.action);
    }
    if (filters.startDate) {
        q = q.gte('timestamp', filters.startDate);
    }
    if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setDate(end.getDate() + 1);
        q = q.lt('timestamp', end.toISOString());
    }
    return q;
}

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

        // Extraer entityName de details si el llamante lo provee, evitando consultas extras
        const entityName: string | null = (detailsObj?.entityName as string) || null;
        // Eliminar entityName de los detalles persistidos para mantenerlos limpios
        if (detailsObj?.entityName) {
            delete detailsObj.entityName;
        }

        // Cachear userId tras la primera llamada para evitar viajes repetidos a getSession()
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
            // Manejar errores de registro de historial silenciosamente - no crítico para el flujo
        }
    },

    /** Reset cached userId (call on logout) */
    clearCache() {
        _cachedUserId = undefined;
    },

    async fetchAll(
        page: number = 1,
        limit: number = 50,
        filters: HistoryFilters = {},
        throwOnError: boolean = false
    ) {
        return withErrorHandlingConditional(async () => {
            const from = (page - 1) * limit;
            let query = supabase
                .from("history_logs")
                .select("id, timestamp, entity_type, entity_id, entity_name, action, details, performed_by", { count: "exact" });

            query = applyFilters(query, filters);

            const { data, count, error } = await query
                .order("timestamp", { ascending: false })
                .range(from, from + limit - 1);

            if (error) throw error;
            return { data: data || [], count: count || 0 };
        }, "Fetch History", throwOnError, { data: [], count: 0 });
    },

    async fetchForExport(
        filters: HistoryFilters = {}
    ) {
        return withErrorHandlingSafe(async () => {
            return await batchPaginate<any>(async (from, to) => {
                let q = supabase.from("history_logs").select("*");
                q = applyFilters(q, filters);
                return q.order("timestamp", { ascending: false }).range(from, to);
            });
        }, "Fetch History for Export", []);
    },


};
