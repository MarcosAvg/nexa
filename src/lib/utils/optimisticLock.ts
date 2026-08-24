import { supabase } from "../supabase";

export type UpdateWithLockResult = { ok: true } | { ok: false; conflict: true };

/**
 * Actualiza una fila con "optimistic locking": incluye `eq("updated_at", versión)`
 * para que solo se aplique si nadie más la modificó desde que se cargó.
 * Devuelve conflict=true si la versión no coincide (0 filas actualizadas),
 * para que la UI ofrezca recargar en lugar de sobrescribir a ciegas.
 */
export async function updateWithLock(
    table: string,
    id: string | number,
    patch: Record<string, unknown>,
    expectedUpdatedAt: string | null | undefined,
): Promise<UpdateWithLockResult> {
    let q = supabase.from(table).update(patch).eq("id", id);
    if (expectedUpdatedAt) q = q.eq("updated_at", expectedUpdatedAt);

    const { data, error } = await q.select("id").maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, conflict: true };
    return { ok: true };
}
