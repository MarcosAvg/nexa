import { supabase } from '../supabase';
import { HistoryService } from './history';
import { withErrorHandling, withErrorHandlingSafe } from '../utils';

export const profileService = {
    async fetchAll() {
        return withErrorHandlingSafe(
            async () => {
                const { data, error } = await supabase.from('profiles').select('*').order('email');
                if (error) throw error;
                return data || [];
            },
            'Fetch Profiles',
            [],
        );
    },
    /**
     * Invita un usuario por email con rol preasignado vía Edge Function
     * `invite-user` (solo admins). Lanza si el servidor lo rechaza.
     */
    async inviteUser(email: string, full_name: string, role: string) {
        return withErrorHandling(async () => {
            const { data, error } = await supabase.functions.invoke('invite-user', {
                body: { email, full_name, role },
            });
            if (error) throw error;
            if (data && (data as any).error) throw new Error((data as any).error);
            await HistoryService.log('SYSTEM', (data as any)?.id ?? email, 'INVITE_USER', {
                message: `Invitación enviada a ${email} (${role})`,
                entityName: `Invitación (${email}) — ${role}`,
            });
            return data;
        }, 'Invite User');
    },
    async setActive(userId: string, active: boolean) {
        return withErrorHandling(async () => {
            const { error } = await supabase.rpc('set_user_active', {
                target_id: userId,
                active,
            });
            if (error) throw error;
            await HistoryService.log('SYSTEM', userId, active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', {
                message: active ? 'Usuario activado' : 'Usuario desactivado',
                entityName: `Usuario (${userId.slice(0, 8)}...)`,
            });
        }, 'Update User Active');
    },
    /**
     * Cambia rol (+ nombre opcional) vía RPC `set_user_role` (SECURITY
     * DEFINER), que impide quedarse sin administradores. Toda la escritura
     * va por el RPC: el cliente no emite UPDATEs directos sobre profiles.
     * Lanza si el servidor lo rechaza.
     */
    async updateRole(userId: string, role: string, fullName?: string) {
        return withErrorHandling(async () => {
            const { error } = await supabase.rpc('set_user_role', {
                target_id: userId,
                new_role: role,
                p_full_name: fullName?.trim() ? fullName.trim() : null,
            });
            if (error) throw error;
            await HistoryService.log('SYSTEM', userId, 'UPDATE_ROLE', {
                message: `Rol actualizado a ${role}`,
                entityName: `Usuario (${userId.slice(0, 8)}...) — ${role}`,
            });
        }, 'Update Role');
    },
};
