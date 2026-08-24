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

/**
 * Lee la versión (updated_at) actual de un registro en la BD. Se usa al abrir un
 * modal de edición para detectar si el registro cambió desde que se cargó en la
 * lista (aviso temprano de concurrencia), sin reemplazar los datos del editor.
 */
export async function fetchCurrentVersion(
    table: string,
    id: string | number,
): Promise<string | null> {
    const { data, error } = await supabase
        .from(table)
        .select("updated_at")
        .eq("id", id)
        .maybeSingle();
    if (error) return null;
    return (data?.updated_at as string) ?? null;
}

