/**
 * mediaKeys.ts — Helpers puros para filtrar por medios de acceso configurados.
 *
 * Se usan para que "Sin Tarjeta" (y otros módulos) tomen el estado de
 * responsiva solo de los medios elegidos en Configuración → Módulos.
 * Sin dependencias de Supabase: aptos para tests unitarios.
 */

/** Resuelve keys de medios (`access_media_types.key`) a sus ids. */
export function resolveMediaTypeIds(
    keys: string[],
    mediaTypes: { key: string; id: string | number }[],
): string[] {
    const byKey = new Map(mediaTypes.map((m) => [String(m.key), String(m.id)]));
    return keys.map((k) => byKey.get(String(k))).filter((id): id is string => id !== undefined);
}

/**
 * Indica si una tarjeta pertenece a los medios configurados.
 * Lista vacía = sin filtro (todos los medios), preservando el
 * comportamiento anterior cuando no hay configuración.
 */
export function isMediaAllowed(mediaKey: string | null | undefined, keys: string[]): boolean {
    if (!keys || keys.length === 0) return true;
    if (!mediaKey) return false;
    return keys.includes(String(mediaKey));
}
