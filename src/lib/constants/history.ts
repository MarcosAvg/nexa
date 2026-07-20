export const ACTION_NAMES: Record<string, string> = {
    CREATE: "Registro",
    UPDATE: "Actualización",
    DELETE: "Eliminación",
    BLOCK: "Bloqueo de Acceso",
    ACTIVATE: "Activación de Acceso",
    DEACTIVATE: "Desactivación de Personal",
    ASSIGN_CARD: "Asignación de Tarjeta",
    UNASSIGN_CARD: "Desvinculación de Tarjeta",
    SIGN_RESPONSIVA: "Firma de Responsiva",
    DELETE_RESPONSIVA: "Eliminación de Responsiva",
    UPSERT: "Guardado/Actualización",
    UPDATE_STATUS: "Cambio de Estado",
    UNASSIGN: "Desvinculación",
    UPDATE_PROGRAMMING: "Programación de Acceso",
    UPDATE_RESPONSIVA: "Estatus de Responsiva",
    REPLACE_CARD: "Reposición de Tarjeta",
    TICKET: "Ticket de Sistema",
    CREATE_TICKET: "Creación de Ticket",
    COMPLETE_TICKET: "Ticket Completado",
    APPLY_MODIFICATION: "Modificación Aprobada",
    REJECT_MODIFICATION: "Modificación Rechazada",
    UPDATE_ROLE: "Cambio de Rol",
    REPLACE_OLD: "Baja por Reposición",
    DELETE_TICKET_CASCADE: "Eliminación en Cascada",
    CREATE_CATALOG: "Catálogo Creado",
    UPDATE_CATALOG: "Catálogo Actualizado",
    DELETE_CATALOG: "Catálogo Eliminado",
    CANCEL: "Cancelación",
    COMPLETE: "Completado",
    // Agregados que se usan pero faltaban:
    REJECT_ALTA: "Alta Rechazada",
};

/**
 * Solo las acciones que efectivamente se registran en HistoryService.log().
 * Usado en el dropdown del filtro para evitar opciones que siempre devuelven 0.
 */
export const FILTERED_ACTIONS: [string, string][] = [
    ["CREATE", "Registro"],
    ["UPDATE", "Actualización"],
    ["DELETE", "Eliminación"],
    ["ASSIGN_CARD", "Asignación de Tarjeta"],
    ["REPLACE_CARD", "Reposición de Tarjeta"],
    ["REPLACE_OLD", "Baja por Reposición"],
    ["UNASSIGN", "Desvinculación"],
    ["SIGN_RESPONSIVA", "Firma de Responsiva"],
    ["DELETE_RESPONSIVA", "Eliminación de Responsiva"],
    ["UPDATE_STATUS", "Cambio de Estado"],
    ["CREATE_CATALOG", "Catálogo Creado"],
    ["UPDATE_CATALOG", "Catálogo Actualizado"],
    ["DELETE_CATALOG", "Catálogo Eliminado"],
    ["APPLY_MODIFICATION", "Modificación Aprobada"],
    ["REJECT_MODIFICATION", "Modificación Rechazada"],
    ["COMPLETE", "Completado"],
    ["CANCEL", "Cancelación"],
    ["UPDATE_ROLE", "Cambio de Rol"],
    ["REJECT_ALTA", "Alta Rechazada"],
];

export const ACTION_COLORS: Record<string, string> = {
    CREATE: "emerald",
    UPDATE: "blue",
    DELETE: "rose",
    BLOCK: "rose",
    ACTIVATE: "green",
    DEACTIVATE: "rose",
    ASSIGN_CARD: "violet",
    UNASSIGN_CARD: "amber",
    UPSERT: "emerald",
    UPDATE_STATUS: "blue",
    UNASSIGN: "amber",
    UPDATE_PROGRAMMING: "violet",
    UPDATE_RESPONSIVA: "violet",
    REPLACE_CARD: "amber",
    SIGN_RESPONSIVA: "violet",
    DELETE_RESPONSIVA: "rose",
    TICKET: "sky",
    CREATE_TICKET: "sky",
    COMPLETE_TICKET: "emerald",
    APPLY_MODIFICATION: "emerald",
    REJECT_MODIFICATION: "rose",
    UPDATE_ROLE: "blue",
    REPLACE_OLD: "rose",
    DELETE_TICKET_CASCADE: "orange",
    CREATE_CATALOG: "emerald",
    UPDATE_CATALOG: "blue",
    DELETE_CATALOG: "rose",
    CANCEL: "rose",
    COMPLETE: "emerald",
    REJECT_ALTA: "rose",
};

export function translateDetails(text: string) {
    if (!text) return text;
    return text
        .replace(/\bblocked\b/gi, "bloqueado/a")
        .replace(/\bactive\b/gi, "activo/a")
        .replace(/\binactive\b/gi, "inactivo/a")
        .replace(/\bcomplete\b/gi, "completado")
        .replace(/\bcompleted\b/gi, "completado")
        .replace(/\bpending\b/gi, "pendiente")
        .replace(/\bdone\b/gi, "realizada")
        .replace(/\bsigned\b/gi, "firmado/a")
        .replace(/\bunsigned\b/gi, "sin firmar")
        .replace(/\bavailable\b/gi, "disponible")
        .replace(/\blegacy\b/gi, "heredada")
        .replace(/\burgente\b/gi, "URGENTE")
        .replace(/\balta\b/gi, "alta")
        .replace(/\bmedia\b/gi, "media")
        .replace(/\bbaja\b/gi, "baja")
        .replace(/\bnull\b/gi, "N/A");
}

