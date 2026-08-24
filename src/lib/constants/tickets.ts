/** Tipos de ticket funcionales del sistema. No son un catálogo editable. */
export const TICKET_TYPES = {
    alta: "Alta de Persona",
    modificacion: "Modificación de datos",
    baja: "Baja de Persona",
    reposicion: "Reposición",
    reporteFalla: "Reporte de Falla",
    programacion: "Programación",
    firmaResponsiva: "Firma Responsiva",
    otro: "Otro",
} as const;

/** Tipos que deben aparecer en el filtro de la sección General. */
export const GENERAL_TICKET_TYPES = [
    TICKET_TYPES.alta,
    TICKET_TYPES.modificacion,
    "Modificación",
    TICKET_TYPES.baja,
    TICKET_TYPES.reposicion,
    TICKET_TYPES.reporteFalla,
    TICKET_TYPES.programacion,
    TICKET_TYPES.otro,
];

export const RESPONSIVA_TICKET_TYPES = [TICKET_TYPES.firmaResponsiva];
