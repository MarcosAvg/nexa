/**
 * filters.ts
 *
 * Constructores de filtros PostgREST para los filtros de selección múltiple.
 */

/**
 * Escapa y comilla un valor para usarlo dentro de `.in.(...)` / `.or(...)`.
 * PostgREST requiere comillas dobles para valores con espacios, comas, etc.
 */
export function quotePostgrestValue(value: string | number): string {
    return `"${String(value).replace(/"/g, '\\"')}"`;
}

/** Lista `("a","b")` lista para un `.in.(...)` de PostgREST. */
export function postgrestInList(values: (string | number)[]): string {
    return `(${values.map(quotePostgrestValue).join(',')})`;
}

/**
 * Construye una expresión `.or(...)` que combina el centinela `__none__`
 * (valor NULL) con valores reales sobre una columna.
 *
 * @example
 * orWithNone('building_id', ['1', '__none__'])
 * // → 'building_id.is.null,building_id.in.("1")'
 */
export function orWithNone(column: string, values: (string | number)[]): string {
    const parts: string[] = [];
    if (values.includes('__none__')) parts.push(`${column}.is.null`);
    const real = values.filter((v) => v !== '__none__');
    if (real.length > 0) parts.push(`${column}.in.${postgrestInList(real)}`);
    return parts.join(',');
}
