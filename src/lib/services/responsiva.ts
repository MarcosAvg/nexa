import { supabase } from "../supabase";
import { HistoryService } from "./history";

export const responsivaService = {
    async fetchByPerson(personId: string) {
        const { data, error } = await supabase
            .from("signed_responsivas")
            .select("*")
            .eq("person_id", personId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data;
    },

    async save(payload: {
        person_id: string;
        folio: string;
        card_type: string;
        data: any;
        signature: string;
        legal_hash?: string;
        legal_snapshot?: string;
    }) {
        const { data, error } = await supabase
            .from("signed_responsivas")
            .insert([payload])
            .select()
            .single();

        if (error) throw error;

        // Fetch person name for history
        const { data: person } = await supabase.from("personnel").select("first_name, last_name").eq("id", payload.person_id).single();
        const personName = person ? `${person.first_name} ${person.last_name}` : `Personal (${payload.person_id})`;

        await HistoryService.log("PERSONNEL", payload.person_id, "SIGN_RESPONSIVA", {
            message: `Responsiva firmada para tarjeta ${payload.folio}`,
            responsiva_id: data.id,
            entityName: personName
        });

        // Noise reduction: Internal card status updates already happen elsewhere

        return data;
    },

    async delete(id: string, personId: string) {
        const { data, error } = await supabase
            .from("signed_responsivas")
            .delete()
            .eq("id", id)
            .select();

        if (error) throw error;

        // Supabase RLS can silently block deletes (returns no error, 0 rows affected).
        // If data array is empty, the row was NOT deleted.
        if (!data || data.length === 0) {
            throw new Error("No se pudo eliminar la responsiva. Verifique permisos (RLS).");
        }

        // Fetch person name for history BEFORE deleting
        const { data: person } = await supabase.from("personnel").select("first_name, last_name").eq("id", personId).single();
        const personName = person ? `${person.first_name} ${person.last_name}` : `Personal (${personId})`;

        await HistoryService.log("PERSONNEL", personId, "DELETE_RESPONSIVA", {
            message: `Responsiva eliminada`,
            entityName: personName
        });
    }
};
