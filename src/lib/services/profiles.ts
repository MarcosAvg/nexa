import { supabase } from "../supabase";
import { HistoryService } from "./history";
import { withErrorHandling, withErrorHandlingSafe } from "../utils";

export const profileService = {
    async fetchAll() {
        return withErrorHandlingSafe(async () => {
            const { data, error } = await supabase.from('profiles').select('*').order('email');
            if (error) throw error;
            return data || [];
        }, "Fetch Profiles", []);
    },
    async updateRole(userId: string, role: string) {
        return withErrorHandling(async () => {
            const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
            if (error) throw error;
            await HistoryService.log('SYSTEM', userId, 'UPDATE_ROLE', {
                message: `Rol actualizado a ${role}`,
                entityName: `Usuario (${userId.slice(0, 8)}...) — ${role}`
            });
        }, "Update Role");
    }
};
