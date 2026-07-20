import { supabase } from '../supabase';
import { HistoryService } from './history';
import { withErrorHandling, withErrorHandlingSafe } from '../utils';
import type { Enlace } from '../types';

export const enlaceService = {
    async fetchAll(): Promise<Enlace[]> {
        return withErrorHandlingSafe(async () => {
            const { data, error } = await supabase
                .from('enlaces')
                .select(`
                    id, 
                    person_id, 
                    extension, 
                    created_at,
                    personnel!inner (
                        id, 
                        first_name, 
                        last_name, 
                        email, 
                        floor, 
                        building_id, 
                        dependency_id,
                        employee_no,
                        status
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as any[];
        }, 'Fetch Enlaces', []);
    },

    async add(personId: string, extension: string): Promise<Enlace> {
        return withErrorHandling(async () => {
            const { data, error } = await supabase
                .from('enlaces')
                .insert([{ person_id: personId, extension }])
                .select(`
                    id, 
                    person_id, 
                    extension, 
                    created_at,
                    personnel!inner (
                        id, 
                        first_name, 
                        last_name, 
                        email, 
                        floor, 
                        building_id, 
                        dependency_id,
                        employee_no,
                        status
                    )
                `)
                .single();

            if (error) throw error;

            const personnelData: any = data.personnel;
            await HistoryService.log("ENLACE", data.id, "CREATE", {
                message: `Enlace administrativo asignado (Ext: ${extension})`,
                entityName: `Enlace: ${personnelData.first_name} ${personnelData.last_name}`
            });

            return data as any;
        }, 'Add Enlace');
    },

    async update(id: string, extension: string, personName: string) {
        return withErrorHandling(async () => {
            const { data, error } = await supabase
                .from('enlaces')
                .update({ extension })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            await HistoryService.log("ENLACE", id, "UPDATE", {
                message: `Extensión actualizada a "${extension}"`,
                entityName: `Enlace: ${personName}`
            });

            return data;
        }, 'Update Enlace');
    },

    async remove(id: string, personName: string) {
        return withErrorHandling(async () => {
            const { error } = await supabase
                .from('enlaces')
                .delete()
                .eq('id', id);

            if (error) throw error;

            await HistoryService.log("ENLACE", id, "DELETE", {
                message: `Enlace administrativo removido`,
                entityName: `Enlace: ${personName}`
            });
        }, 'Remove Enlace');
    }
};
