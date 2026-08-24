/**
 * appearance.ts — Catálogo de apariencia (variantes/colores) compartido, para
 * evitar mapeos inline duplicados en vistas/componentes.
 */

type BadgeVariant = "slate" | "amber" | "emerald" | "blue" | "rose" | "violet";

/** Clases de color de hover/acción por tipo de acción en tarjetas. */
export const ACTION_BUTTON_CLASSES: Record<string, { hover: string; active: string }> = {
    default: { hover: "hover:text-blue-600 hover:bg-blue-50", active: "text-slate-400" },
    danger: { hover: "hover:text-rose-600 hover:bg-rose-50", active: "text-slate-400" },
    success: { hover: "hover:text-emerald-600 hover:bg-emerald-50", active: "text-slate-400" },
    watch: { hover: "hover:text-amber-600 hover:bg-amber-50", active: "text-slate-400" },
};

/**
 * Variante de Badge por motivo de "registro sin tarjeta".
 * Misma lógica que tenía RegistroSinTarjetaView.getReasonVariant.
 */
export function reasonVariant(reason: string): BadgeVariant {
    if (
        reason.includes("Olvidada") ||
        reason === "No la porta" ||
        reason === "En resguardo de Enlace Administrativo"
    ) {
        return "amber";
    }
    if (reason === "Extraviada" || reason === "Robada") return "rose";
    if (
        reason === "Dañada" ||
        reason === "Desmagnetizada / No funciona" ||
        reason === "Bloqueada por Seguridad"
    ) {
        return "slate";
    }
    if (
        reason === "No se le ha entregado" ||
        reason.includes("proceso") ||
        reason.includes("ingreso") ||
        reason.includes("Reposición")
    ) {
        return "blue";
    }
    return "slate";
}
