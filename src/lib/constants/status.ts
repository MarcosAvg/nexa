/**
 * status.ts
 *
 * Constantes centralizadas para estados de personal y tarjetas.
 * Todas las vistas y componentes deben usar estas constantes
 * en lugar de definir sus propios mapeos.
 */

// ─── Personal Status ───────────────────────────────────────────

/** Variantes de Badge para cada estado de personal */
export function getPersonnelStatusVariant(status: string): "emerald" | "amber" | "slate" | "rose" {
    if (status === "Activo/a") return "emerald";
    if (status === "Parcial") return "amber";
    if (status === "Sin Acceso") return "slate";
    if (status === "Bloqueado/a") return "rose";
    if (status === "Baja") return "slate";
    return "slate";
}

// ─── Card Status ─────────────────────────────────────────────

const CARD_STATUS_LABELS: Record<string, string> = {
    active: "Activa",
    blocked: "Bloqueada",
    inactive: "Baja",
    available: "Disponible",
};

export function getCardStatusVariant(status: string): "emerald" | "rose" | "slate" | "blue" {
    if (status === "active") return "emerald";
    if (status === "blocked") return "rose";
    if (status === "inactive") return "slate";
    if (status === "available") return "blue";
    return "blue";
}

export function getCardStatusLabel(status: string): string {
    return CARD_STATUS_LABELS[status] || status;
}

// ─── Ticket Priority ──────────────────────────────────────

/** Variantes de Badge para prioridades de tickets */
export function getTicketPriorityVariant(
    priority: string,
): "rose" | "amber" | "blue" | "slate" {
    const p = priority?.toLowerCase();
    if (p === "urgente") return "rose";
    if (p === "alta") return "rose";
    if (p === "media") return "amber";
    if (p === "baja") return "blue";
    return "slate";
}
