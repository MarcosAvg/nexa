import { supabase } from '../supabase';
import { HistoryService } from './history';
import { handleError } from '../utils/error';
import type { Enlace } from '../types';

export const enlaceService = {
    async fetchAll(): Promise<Enlace[]> {
        try {
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
                        dependency_id,
                        employee_no,
                        status
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as any[];
        } catch (error) {
            handleError(error, 'Fetch Enlaces');
            return [];
        }
    },

    async add(personId: string, extension: string): Promise<Enlace> {
        try {
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
        } catch (error) {
            handleError(error, 'Add Enlace');
            throw error;
        }
    },

    async remove(id: string, personName: string) {
        try {
            const { error } = await supabase
                .from('enlaces')
                .delete()
                .eq('id', id);

            if (error) throw error;

            await HistoryService.log("ENLACE", id, "DELETE", {
                message: `Enlace administrativo removido`,
                entityName: `Enlace: ${personName}`
            });
        } catch (error) {
            handleError(error, 'Remove Enlace');
            throw error;
        }
    }
};
