/**
 * personStatus.ts
 *
 * Cálculo centralizado del estado mostrado de una persona a partir de sus
 * tarjetas y su estado en base de datos.
 *
 * Reglas (aplica a P2000, KONE y AccessPRO):
 *  - "Activo/a": al menos 2 tipos P2000/KONE listos (programados + firmados),
 *    O la persona SOLO tiene tarjetas AccessPRO (sin P2000/KONE) y tiene al
 *    menos una AccessPRO asignada (activa).
 *  - "Parcial": exactamente 1 tipo P2000/KONE listo.
 *  - AccessPRO NUNCA cuenta para el umbral de 2 tipos (es un acceso secundario
 *    de otro edificio), pero una persona cuya única tarjeta es AccessPRO debe
 *    verse como Activa.
 */

export interface StatusCardInput {
    type: string;
    status: string;
    programming_status: string | null;
    responsiva_status: string | null;
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

    // Solo P2000/KONE cuentan para el umbral de 2 tipos
    const coreReadyTypes = new Set(
        readyCards
            .filter((c) => c.type === "P2000" || c.type === "KONE")
            .map((c) => c.type),
    );

    const hasCoreCards = allCards.some(
        (c) => c.type === "P2000" || c.type === "KONE",
    );
    const hasActiveAccessPro = allCards.some(
        (c) => c.type === "AccessPRO" && c.status === "active",
    );

    if (dbStatus === "active") {
        if (coreReadyTypes.size >= 2) return "Activo/a";
        if (coreReadyTypes.size === 1) return "Parcial";
        // Solo AccessPRO (sin P2000/KONE) y asignada → Activa
        if (!hasCoreCards && hasActiveAccessPro) return "Activo/a";
        if (allCards.length > 0) return "Bloqueado/a";
        return "Sin Acceso";
    }
    if (dbStatus === "blocked") return "Bloqueado/a";
    return "Baja";
}
