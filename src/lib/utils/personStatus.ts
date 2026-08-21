/**
 * personStatus.ts
 *
 * Cálculo centralizado del estado mostrado de una persona a partir de sus
 * medios de acceso y su estado en base de datos.
 *
 * Reglas (generalizadas por `has_floors`):
 *  - "Activo/a": al menos 2 tipos con pisos listos (programados + firmados),
 *    O la persona SOLO tiene tipos sin pisos (ej. AccessPRO) y tiene al menos
 *    uno asignado (activo).
 *  - "Parcial": exactamente 1 tipo con pisos listo.
 *  - Los tipos sin pisos NUNCA cuentan para el umbral de 2 tipos (son accesos
 *    secundarios), pero una persona cuyo único acceso es de ese tipo se ve Activa.
 */

export interface StatusCardInput {
    type: string;
    status: string;
    programming_status: string | null;
    responsiva_status: string | null;
    has_floors?: boolean;
}

export function computePersonStatus(
    dbStatus: string,
    allCards: StatusCardInput[],
): string {
    const activeCards = allCards.filter((c) => c.status === "active");
    const readyCards = activeCards.filter(
        (c) =>
            c.programming_status === "done" &&
            (c.responsiva_status === "signed" ||
                c.responsiva_status === "legacy"),
    );

    // Solo los tipos con pisos cuentan para el umbral de 2 tipos.
    const coreReadyTypes = new Set(
        readyCards.filter((c) => c.has_floors).map((c) => c.type),
    );

    const hasCoreCards = allCards.some((c) => c.has_floors);
    const hasActiveNonCore = allCards.some(
        (c) => !c.has_floors && c.status === "active",
    );

    if (dbStatus === "active") {
        if (coreReadyTypes.size >= 2) return "Activo/a";
        if (coreReadyTypes.size === 1) return "Parcial";
        // Solo tipos sin pisos y asignados → Activa
        if (!hasCoreCards && hasActiveNonCore) return "Activo/a";
        if (allCards.length > 0) return "Bloqueado/a";
        return "Sin Acceso";
    }
    if (dbStatus === "blocked") return "Bloqueado/a";
    return "Baja";
}