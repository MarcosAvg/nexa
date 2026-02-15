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

        await HistoryService.log("PERSONNEL", payload.person_id, "SIGN_RESPONSIVA", {
            message: `Responsiva firmada para tarjeta ${payload.folio}`,
            responsiva_id: data.id
        });

        return data;
    },

    async delete(id: string, personId: string) {
        const { error } = await supabase
            .from("signed_responsivas")
            .delete()
            .eq("id", id);

        if (error) throw error;

        await HistoryService.log("PERSONNEL", personId, "DELETE_RESPONSIVA", {
            message: `Responsiva eliminada`
        });
    }
};
