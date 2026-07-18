/**
 * batchPaginate.ts
 *
 * Utilidad genérica para paginación por lotes (batch) usando Supabase.
 * Centraliza el patrón while-loop con page + pageSize + hasMore que se repite
 * en múltiples servicios.
 *
 * Ejemplo de uso:
 *
 *   const items = await batchPaginate(async (from, to) => {
 *       return supabase.from("cards").select("*").eq("type", "KONE").range(from, to);
 *   });
 */

const DEFAULT_PAGE_SIZE = 1000;

/**
 * Itera todas las páginas de una consulta Supabase y recolecta los resultados.
 *
/** Interfaz que coincide con PostgrestError de Supabase */
export interface DbError {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
}

/**
 * Itera todas las páginas de una consulta Supabase y recolecta los resultados.
 *
 * @param fetchPage - Función que recibe (from, to) y devuelve una promesa con { data, error }
 * @param pageSize - Tamaño de página (default 1000, el máximo de PostgREST)
 * @returns Array con todos los items de todas las páginas
 */
export async function batchPaginate<T>(
    fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error?: DbError | null }>,
    pageSize: number = DEFAULT_PAGE_SIZE
): Promise<T[]> {
    const allData: T[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        const from = page * pageSize;
        const to = (page + 1) * pageSize - 1;

        const { data, error } = await fetchPage(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
            allData.push(...data);
            page++;
            hasMore = data.length >= pageSize;
        } else {
            hasMore = false;
        }
    }

    return allData;
}

/**
 * Versión eficiente de batchPaginate que ejecuta un callback por página
 * sin acumular los datos en memoria. Útil cuando solo se necesita procesar
 * los resultados sin almacenarlos (ej: coleccionar IDs en un Set).
 *
 * @param fetchPage - Función que recibe (from, to) y devuelve { data, error }
 * @param processPage - Callback ejecutado con los datos de cada página
 * @param pageSize - Tamaño de página
 */
export async function batchForEach<T>(
    fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error?: DbError | null }>,
    processPage: (items: T[]) => void,
    pageSize: number = DEFAULT_PAGE_SIZE
): Promise<void> {
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        const from = page * pageSize;
        const to = (page + 1) * pageSize - 1;

        const { data, error } = await fetchPage(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
            processPage(data);
            page++;
            hasMore = data.length >= pageSize;
        } else {
            hasMore = false;
        }
    }
}

/**
 * Recolecta IDs únicos de una consulta paginada sin almacenar los datos completos.
 * Usa batchForEach internamente para ser eficiente en memoria.
 *
 * @param fetchPage - Función que recibe (from, to) y devuelve items con un campo ID
 * @param idField - Nombre del campo que contiene el ID (default: "id")
 * @param pageSize - Tamaño de página
 * @returns Set con todos los IDs únicos
 */
export async function batchCollectIds<T extends Record<string, any>>(
    fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error?: DbError | null }>,
    idField: string = "id",
    pageSize: number = DEFAULT_PAGE_SIZE
): Promise<Set<string>> {
    const ids = new Set<string>();

    await batchForEach(fetchPage, (items) => {
        for (const item of items) {
            const id = item[idField];
            if (id != null) ids.add(String(id));
        }
    }, pageSize);

    return ids;
}
