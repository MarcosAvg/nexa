/**
 * floorActions.ts
 *
 * Lógica compartida para interpretar las acciones de pisos/accesos de la
 * plantilla ("Reemplazar", "Sumar", "Quitar", y variantes) y calcular el
 * conjunto resultante de forma agnóstica al medio.
 *
 * Se usa tanto en la revisión previa (matchAnalysis) como al construir el
 * ticket de modificación (TicketImportedDetailsModal), de modo que lo que se
 * previsualiza siempre coincide con lo que se guarda.
 */

export type FloorAction = "replace" | "add" | "remove" | "clear";

/** Reconoce si una acción corresponde a un tipo, tolerando variantes en mayúsculas/acentos. */
export function isAction(act: string | null | undefined, type: FloorAction): boolean {
    const a = (act ?? "").toLowerCase();
    if (type === "clear")
        return a.includes("todo") || a.includes("vaciar") || a.includes("limpiar");
    if (type === "replace")
        return a.includes("reemplazar") || a.includes("remplazar") || a.includes("sustituir");
    if (type === "add")
        return a.includes("añadir") || a.includes("anadir") || a.includes("sumar") || a.includes("agregar");
    if (type === "remove")
        return a.includes("quitar") || a.includes("eliminar") || a.includes("borrar") || a.includes("remover");
    return false;
}

/**
 * Aplica una acción de la plantilla sobre la colección actual y devuelve la
 * colección resultante.
 *
 * - `replace`: sustituye todos los pisos por los indicados.
 * - `add`: agrega los indicados a los ya existentes (sin duplicados).
 * - `remove`: elimina solo los indicados.
 * - `clear`: devuelve una lista vacía.
 *
 * El array resultante mantiene el orden de entrada y sin duplicados.
 */
export function applyFloorAction(
    action: string | null | undefined,
    current: string[],
    requested: string[],
): string[] {
    const cur = Array.from(new Set(current || []));
    const req = Array.from(new Set(requested || []));

    if (isAction(action, "clear")) return [];
    if (isAction(action, "replace")) return [...req];
    if (isAction(action, "add")) {
        return [...new Set([...cur, ...req])];
    }
    if (isAction(action, "remove")) {
        return cur.filter((f) => !req.includes(f));
    }
    // Sin acción reconocida: devolver lo actual (sin cambios).
    return cur;
}
