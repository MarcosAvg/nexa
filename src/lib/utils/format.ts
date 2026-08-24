/**
 * format.ts — Helpers de presentación compartidos.
 */

/** Capitaliza la primera letra de una cadena. */
export function capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Nombre completo de una persona (primero + apellido). */
export function fullName(first?: string | null, last?: string | null): string {
    return [first, last].filter(Boolean).join(" ");
}

/** Devuelve el nombre legible de una persona desde un objeto persona/payload. */
export function personDisplayName(
    p: { first_name?: string; last_name?: string; nombres?: string; apellidos?: string; name?: string } | null | undefined,
): string {
    if (!p) return "—";
    if (p.name) return p.name;
    if (p.nombres || p.apellidos) return fullName(p.apellidos, p.nombres);
    return fullName(p.first_name, p.last_name) || "—";
}

/** Formatea una fecha ISO a Date (o null si es inválido). */
function toDate(iso?: string | null): Date | null {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
}

/** Formatea una fecha como DD/MM/YYYY (es-MX) o "—" si no hay valor. */
export function formatDate(iso?: string | null): string {
    const d = toDate(iso);
    if (!d) return "—";
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Formatea una fecha/hora como DD/MM/YYYY HH:MM (es-MX) o "—" si no hay valor. */
export function formatDateTime(iso?: string | null): string {
    const d = toDate(iso);
    if (!d) return "—";
    return d.toLocaleString("es-MX", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}
