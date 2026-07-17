import { supabase } from "../supabase";
import { handleError } from "../utils/error";
import type { CardlessRegistry } from "../types";
import { networkStore } from "../stores/network.svelte";
import {
    exportCardlessRegistryToExcel,
    type CardlessRegistryExportFilters,
} from "../utils/xlsxExport";

const REASONS = [
    "No se le ha entregado",
    "Nuevo ingreso (trámite pendiente)",
    "Credencial en proceso de emisión",
    "Reposición en proceso",
    "Olvidada en casa",
    "Olvidada en el área de trabajo",
    "Extraviada",
    "Robada",
    "Dañada",
    "Desmagnetizada / No funciona",
    "En resguardo de Enlace Administrativo",
    "Bloqueada por Seguridad",
    "Olvidada en otro sitio",
    "No la porta",
    "Cambio de área o nivel de acceso",
    "Otro"
] as const;

export type CardlessRegistryReason = (typeof REASONS)[number];

export type CardlessRegistryFilters = {
    startDate?: string;
    endDate?: string;
    reason?: string;
    search?: string;
    dependencyId?: string | number;
};

export type CardlessRegistryInput = {
    person_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    employee_no?: string | null;
    building_id?: number | null;
    dependency_id?: number | null;
    floor?: string | null;
    reason: string;
    comments?: string | null;
    recorded_at?: string;
    /**
     * Snapshot of the KONE responsiva status at the moment of registration.
     * true  = had a pending "Firma Responsiva" ticket for a KONE card.
     * false = no pending ticket (card already delivered or no KONE card).
     * null  = unknown / pre-migration record.
     */
    kone_status_at_registration?: boolean | null;
};

const SELECT_WITH_RELATIONS = `
    *,
    personnel!person_id(first_name, last_name, employee_no),
    buildings!building_id(name),
    dependencies!dependency_id(name),
    profiles!recorded_by(full_name)
`;

/**
 * Returns the set of person IDs that have at least one pending "Firma Responsiva"
 * ticket linked to a KONE card.
 */
async function fetchPendingKoneResponsivaSet(personIds: string[]): Promise<Set<string>> {
    const unique = [...new Set(personIds.filter(Boolean))];
    if (unique.length === 0) return new Set();

    const { data, error } = await supabase
        .from("tickets")
        .select("person_id, cards!card_id(type)")
        .eq("type", "Firma Responsiva")
        .eq("status", "pending")
        .in("person_id", unique);

    if (error || !data) return new Set();

    return new Set(
        data
            .filter((t: any) => t.cards?.type === "KONE")
            .map((t: any) => t.person_id as string)
    );
}


const mapCardlessRegistryRecord = (r: any): CardlessRegistry => {
    const personName = r.personnel
        ? `${r.personnel.first_name} ${r.personnel.last_name}`
        : [r.first_name, r.last_name].filter(Boolean).join(" ") || undefined;

    return {
        id: r.id,
        person_id: r.person_id,
        first_name: r.first_name ?? r.personnel?.first_name ?? null,
        last_name: r.last_name ?? r.personnel?.last_name ?? null,
        employee_no: r.employee_no ?? r.personnel?.employee_no ?? null,
        building_id: r.building_id,
        dependency_id: r.dependency_id,
        floor: r.floor,
        reason: r.reason,
        comments: r.comments,
        recorded_at: r.recorded_at,
        recorded_by: r.recorded_by,
        kone_status_at_registration: r.kone_status_at_registration ?? null,
        personName,
        buildingName: r.buildings?.name || undefined,
        dependencyName: r.dependencies?.name || undefined,
        recordedByName: r.profiles?.full_name || undefined
    };
};

async function enrichWithKoneResponsiva(registries: CardlessRegistry[]): Promise<CardlessRegistry[]> {
    // Only query current ticket status for records that don't have a stored snapshot
    // (i.e. pre-migration records where kone_status_at_registration is null).
    const legacyIds = registries
        .filter(r => r.person_id && r.kone_status_at_registration === null)
        .map(r => r.person_id as string);

    let koneSet = new Set<string>();
    if (legacyIds.length > 0) {
        koneSet = await fetchPendingKoneResponsivaSet(legacyIds);
    }

    return registries.map(r => {
        // If snapshot is already stored, use it directly.
        if (r.kone_status_at_registration !== null) {
            return { ...r, pendingKoneResponsiva: r.kone_status_at_registration ?? false };
        }
        // Legacy record: fall back to live lookup.
        return {
            ...r,
            pendingKoneResponsiva: r.person_id ? koneSet.has(r.person_id) : false,
        };
    });
}

function applyFilters(query: any, filters: CardlessRegistryFilters) {
    const start = filters.startDate;
    const end = filters.endDate;

    if (start && end && start > end) {
        throw new Error("La fecha de inicio no puede ser posterior a la fecha fin");
    }

    if (start) {
        query = query.gte("recorded_at", `${start}T00:00:00`);
    }

    // Incluir el día completo de fecha fin (date input es YYYY-MM-DD)
    if (end) {
        query = query.lte("recorded_at", `${end}T23:59:59.999`);
    }

    if (filters.reason) {
        query = query.eq("reason", filters.reason);
    }

    if (filters.search && filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        query = query.or(
            `first_name.ilike.${term},last_name.ilike.${term},employee_no.ilike.${term}`
        );
    }

    if (filters.dependencyId !== undefined && filters.dependencyId !== "" && filters.dependencyId !== null) {
        query = query.eq("dependency_id", filters.dependencyId);
    }

    return query;
}

export const cardlessRegistryService = {
    REASONS: [...REASONS],

    async fetchAll(
        page: number = 1,
        limit: number = 50,
        filters: CardlessRegistryFilters = {}
    ): Promise<{ data: CardlessRegistry[]; count: number }> {
        try {
            if (!networkStore.isOnline) {
                return { data: [], count: 0 };
            }

            let query = supabase
                .from("cardless_registry")
                .select(SELECT_WITH_RELATIONS, { count: "exact" });

            query = applyFilters(query, filters);

            const from = (page - 1) * limit;
            const to = from + limit - 1;

            const { data, error, count } = await query
                .order("recorded_at", { ascending: false })
                .range(from, to);

            if (error) throw error;

            return {
                data: data ? await enrichWithKoneResponsiva(data.map(mapCardlessRegistryRecord)) : [],
                count: count || 0
            };

        } catch (error) {
            handleError(error);
            throw error;
        }
    },

    /** Todas las filas que cumplen filtros (para exportar). */
    async fetchAllMatching(filters: CardlessRegistryFilters = {}): Promise<CardlessRegistry[]> {
        const pageSize = 1000;
        let page = 1;
        let all: CardlessRegistry[] = [];
        let total = Infinity;

        while (all.length < total) {
            const { data, count } = await this.fetchAll(page, pageSize, filters);
            total = count;
            all = all.concat(data);
            if (data.length === 0) break;
            page++;
        }

        return all;
    },

    async create(data: CardlessRegistryInput): Promise<CardlessRegistry | null> {
        try {
            if (!networkStore.isOnline) {
                throw new Error("Sin conexión a internet");
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No autenticado");

            const { data: result, error } = await supabase
                .from("cardless_registry")
                .insert({
                    ...data,
                    recorded_by: user.id
                })
                .select(SELECT_WITH_RELATIONS)
                .single();

            if (error) throw error;

            const mapped = mapCardlessRegistryRecord(result);

            return mapped;
        } catch (error) {
            handleError(error);
            return null;
        }
    },

    async update(id: number, data: Partial<CardlessRegistryInput>): Promise<CardlessRegistry | null> {
        try {
            if (!networkStore.isOnline) {
                throw new Error("Sin conexión a internet");
            }

            const { data: result, error } = await supabase
                .from("cardless_registry")
                .update(data)
                .eq("id", id)
                .select(SELECT_WITH_RELATIONS)
                .single();

            if (error) throw error;

            const mapped = mapCardlessRegistryRecord(result);

            return mapped;
        } catch (error) {
            handleError(error);
            return null;
        }
    },

    async delete(id: number): Promise<boolean> {
        try {
            if (!networkStore.isOnline) {
                throw new Error("Sin conexión a internet");
            }

            const { error } = await supabase
                .from("cardless_registry")
                .delete()
                .eq("id", id);

            if (error) throw error;

            return true;
        } catch (error) {
            handleError(error);
            return false;
        }
    },

    async exportToExcel(
        registries: CardlessRegistry[],
        filters?: CardlessRegistryExportFilters
    ): Promise<void> {
        try {
            await exportCardlessRegistryToExcel(registries, filters);
        } catch (error) {
            handleError(error);
            throw error;
        }
    }
};
