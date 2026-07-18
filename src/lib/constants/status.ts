/**
 * status.ts
 *
 * Constantes centralizadas para estados de personal y tarjetas.
 * Todas las vistas y componentes deben usar estas constantes
 * en lugar de definir sus propios mapeos.
 */

// ─── Personal Status ───────────────────────────────────────────

export const PERSONNEL_STATUS = {
    ACTIVO: "Activo/a",
    PARCIAL: "Parcial",
    SIN_ACCESO: "Sin Acceso",
    BLOQUEADO: "Bloqueado/a",
    BAJA: "Baja",
} as const;

export const PERSONNEL_STATUS_RAW = {
    ACTIVE: "active",
    BLOCKED: "blocked",
    INACTIVE: "inactive",
} as const;

/** Mapeo de status display → status raw de BD */
export const PERSONNEL_STATUS_TO_RAW: Record<string, string> = {
    [PERSONNEL_STATUS.BLOQUEADO]: PERSONNEL_STATUS_RAW.BLOCKED,
    [PERSONNEL_STATUS.BAJA]: PERSONNEL_STATUS_RAW.INACTIVE,
};

/** Mapeo de status raw de BD → status display para computed_status */
export const RAW_TO_PERSONNEL_DISPLAY: Record<string, string> = {
    [PERSONNEL_STATUS_RAW.ACTIVE]: PERSONNEL_STATUS.ACTIVO,
    [PERSONNEL_STATUS_RAW.BLOCKED]: PERSONNEL_STATUS.BLOQUEADO,
    [PERSONNEL_STATUS_RAW.INACTIVE]: PERSONNEL_STATUS.BAJA,
};

/** Estados que requieren filtrado post-query (no existen en BD) */
export const COMPUTED_STATUSES = [
    PERSONNEL_STATUS.ACTIVO,
    PERSONNEL_STATUS.PARCIAL,
    PERSONNEL_STATUS.SIN_ACCESO,
];

/** Variantes de Badge para cada estado de personal */
export function getPersonnelStatusVariant(status: string): string {
    if (status === PERSONNEL_STATUS.ACTIVO) return "emerald";
    if (status === PERSONNEL_STATUS.PARCIAL) return "amber";
    if (status === PERSONNEL_STATUS.SIN_ACCESO) return "slate";
    if (status === PERSONNEL_STATUS.BLOQUEADO) return "rose";
    if (status === PERSONNEL_STATUS.BAJA) return "slate";
    return "slate";
}

// ─── Card Status ─────────────────────────────────────────────

export const CARD_STATUS = {
    ACTIVE: "active",
    BLOCKED: "blocked",
    INACTIVE: "inactive",
    AVAILABLE: "available",
} as const;

export const CARD_STATUS_LABELS: Record<string, string> = {
    [CARD_STATUS.ACTIVE]: "Activa",
    [CARD_STATUS.BLOCKED]: "Bloqueada",
    [CARD_STATUS.INACTIVE]: "Baja",
    [CARD_STATUS.AVAILABLE]: "Disponible",
};

/** Mapeo de labels de filtro → status raw */
export const CARD_STATUS_FILTER_MAP: Record<string, string> = {
    "Activa": CARD_STATUS.ACTIVE,
    "Bloqueada": CARD_STATUS.BLOCKED,
    "Baja": CARD_STATUS.INACTIVE,
    "Disponible": CARD_STATUS.AVAILABLE,
};

export function getCardStatusVariant(status: string): string {
    if (status === CARD_STATUS.ACTIVE) return "emerald";
    if (status === CARD_STATUS.BLOCKED) return "rose";
    if (status === CARD_STATUS.INACTIVE) return "slate";
    if (status === CARD_STATUS.AVAILABLE) return "blue";
    return "blue";
}

export function getCardStatusLabel(status: string): string {
    return CARD_STATUS_LABELS[status] || status;
}

// ─── Card Type ─────────────────────────────────────────────

export const CARD_TYPES = {
    KONE: "KONE",
    P2000: "P2000",
} as const;

export function getCardTypeVariant(type: string): string {
    if (type === CARD_TYPES.KONE) return "blue";
    if (type === CARD_TYPES.P2000) return "amber";
    return "slate";
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
