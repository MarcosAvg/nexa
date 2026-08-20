import { supabase } from "../supabase";
import { withErrorHandlingSafe } from "../utils";
import type { Floor } from "../types";

export const floorsService = {
    async fetchAll(throwOnError: boolean = false): Promise<Floor[]> {
        return withErrorHandlingSafe(async () => {
            const { data, error } = await supabase
                .from("floors")
                .select("*")
                .order("sort_order", { ascending: true, nullsFirst: false })
                .order("label", { ascending: true });
            if (error) throw error;
            return (data || []) as Floor[];
        }, "Fetch Floors", []);
    },
};
