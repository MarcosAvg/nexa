export const ACTION_NAMES: Record<string, string> = {
    CREATE: "Registro de Personal",
    UPDATE: "Actualización de Datos",
    DELETE: "Eliminación Permanente",
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
};

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
        .replace(/\bdone\b/gi, "listo")
        .replace(/\bsigned\b/gi, "firmado/a")
        .replace(/\bunsigned\b/gi, "sin firmar")
        .replace(/\bavailable\b/gi, "disponible");
}
