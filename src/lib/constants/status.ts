/**
 * status.ts
 *
 * Constantes centralizadas para estados de personal, tarjetas, tickets y
 * seguimiento de fallas. Todas las vistas y componentes deben usar estas
 * constantes en lugar de definir sus propios mapeos.
 */

/** Variantes soportadas por el componente Badge. */
export type StatusVariant =
    'emerald' | 'green' | 'amber' | 'blue' | 'sky' | 'indigo' | 'violet' | 'slate' | 'rose';

// ─── Personal Status ───────────────────────────────────────────

export type PersonnelStatusMeta = {
    key: string;
    label: string;
    variant: StatusVariant;
    /** Clase de punto de color (para leyendas/donuts). */
    dot: string;
    /** Hex para gráficos (Chart.js). */
    hex: string;
};

/** Fuente única de verdad para el estado de personal (dashboard, listas, leyendas). */
export const PERSONNEL_STATUS_META: PersonnelStatusMeta[] = [
    { key: 'activo', label: 'Activo/a', variant: 'emerald', dot: 'bg-emerald-500', hex: '#10b981' },
    { key: 'parcial', label: 'Parcial', variant: 'amber', dot: 'bg-amber-500', hex: '#f59e0b' },
    { key: 'en_proceso', label: 'En proceso', variant: 'sky', dot: 'bg-sky-500', hex: '#0ea5e9' },
    {
        key: 'media_otro_edificio',
        label: 'Media de otro edificio',
        variant: 'violet',
        dot: 'bg-violet-500',
        hex: '#8b5cf6',
    },
    {
        key: 'media_otro_edificio_pendiente',
        label: 'Otro edificio en proceso',
        variant: 'violet',
        dot: 'bg-violet-300',
        hex: '#c4b5fd',
    },
    { key: 'sin_acceso', label: 'Sin Acceso', variant: 'slate', dot: 'bg-slate-400', hex: '#94a3b8' },
    { key: 'bloqueado', label: 'Bloqueado/a', variant: 'rose', dot: 'bg-rose-500', hex: '#f43f5e' },
    { key: 'baja', label: 'Baja', variant: 'slate', dot: 'bg-slate-300', hex: '#cbd5e1' },
];

const PERSONNEL_STATUS_BY_LABEL: Record<string, PersonnelStatusMeta> = Object.fromEntries(
    PERSONNEL_STATUS_META.map((m) => [m.label, m]),
);

/** Variante de Badge para cada estado de personal. */
export function getPersonnelStatusVariant(status: string): StatusVariant {
    const meta = PERSONNEL_STATUS_BY_LABEL[status];
    if (meta) return meta.variant;
    if (status === 'Sin Acceso') return 'slate';
    return 'slate';
}

/** Devuelve la metadata completa del estado de personal. */
export function getPersonnelStatusMeta(status: string): PersonnelStatusMeta | undefined {
    return PERSONNEL_STATUS_BY_LABEL[status];
}

// ─── Card Status ─────────────────────────────────────────────

const CARD_STATUS_LABELS: Record<string, string> = {
    active: 'Activa',
    blocked: 'Bloqueada',
    inactive: 'Baja',
    available: 'Disponible',
};

export function getCardStatusVariant(status: string): 'emerald' | 'rose' | 'slate' | 'blue' {
    if (status === 'active') return 'emerald';
    if (status === 'blocked') return 'rose';
    if (status === 'inactive') return 'slate';
    if (status === 'available') return 'blue';
    return 'blue';
}

export function getCardStatusLabel(status: string): string {
    return CARD_STATUS_LABELS[status] || status;
}

// ─── Ticket Status ────────────────────────────────────────────

const TICKET_STATUS_LABELS: Record<string, string> = {
    completed: 'Completado',
    cancelled: 'Rechazado',
    rejected: 'Rechazado',
    in_progress: 'En gestión',
    pending: 'Pendiente',
};

/** Variante de Badge para el estado de un ticket. */
export function getTicketStatusVariant(status?: string | null): StatusVariant {
    if (status === 'completed') return 'emerald';
    if (status === 'cancelled' || status === 'rejected') return 'rose';
    if (status === 'in_progress') return 'blue';
    return 'amber';
}

/** Etiqueta legible para el estado de un ticket. */
export function getTicketStatusLabel(status?: string | null): string {
    return TICKET_STATUS_LABELS[status ?? ''] ?? 'Pendiente';
}

// ─── Fallas / Seguimiento ─────────────────────────────────────

export type FollowupMeta = { label: string; variant: StatusVariant };

/** Estado de seguimiento de reportes de falla (payload.estado). */
export function getFollowupMeta(followup?: string | null): FollowupMeta {
    if (followup === 'Resolver' || followup === 'Falla Resuelta' || followup === 'Resuelto') {
        return { label: 'Resuelto', variant: 'emerald' };
    }
    if (followup === 'Requiere reposición' || followup === 'Requiere Reposición') {
        return { label: 'Requiere reposición', variant: 'blue' };
    }
    return { label: 'En revisión', variant: 'amber' };
}

// ─── Ticket Priority ──────────────────────────────────────

/** Variantes de Badge para prioridades de tickets */
export function getTicketPriorityVariant(priority: string): 'rose' | 'amber' | 'blue' | 'slate' {
    const p = priority?.toLowerCase();
    if (p === 'urgente') return 'rose';
    if (p === 'alta') return 'rose';
    if (p === 'media') return 'amber';
    if (p === 'baja') return 'blue';
    return 'slate';
}
