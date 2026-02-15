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

        const payload = {
            entity_type: entityType,
            entity_id: entityId ? String(entityId) : null,
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

    async fetchAll() {
        try {
            const { data, error } = await supabase
                .from("history_logs")
                .select("*")
                .order("timestamp", { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            handleError(error, "Fetch History");
            return [];
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
