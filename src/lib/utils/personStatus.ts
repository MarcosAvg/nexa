/**
 * personStatus.ts
 *
 * Cálculo centralizado del estado mostrado de una persona a partir de sus
 * medios de acceso y su estado en base de datos.
 *
 * Reglas (generalizadas por `has_floors`):
 *  - "Activo/a": al menos N tipos con pisos listos (programados + firmados),
 *    donde N es configurable en app_settings (`coreTypesRequired`),
 *    O la persona SOLO tiene tipos sin pisos (ej. AccessPRO) y tiene al menos
 *    uno asignado (activo).
 *  - "Parcial": menos de N tipos con pisos listos (al menos uno).
 *  - Los tipos sin pisos NUNCA cuentan para el umbral (son accesos
 *    secundarios), pero una persona cuyo único acceso es de ese tipo se ve Activa.
 */

import { settingsState } from "../stores/settings.svelte";

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
    const coreRequired = settingsState.coreTypesRequired || 2;
    const activeCards = allCards.filter((c) => c.status === "active");
    const readyCards = activeCards.filter(
        (c) =>
            c.programming_status === "done" &&
            (c.responsiva_status === "signed" ||
                c.responsiva_status === "legacy"),
    );

    // Solo los tipos con pisos cuentan para el umbral de tipos "core".
    const coreReadyTypes = new Set(
        readyCards.filter((c) => c.has_floors).map((c) => c.type),
    );

    const hasCoreCards = allCards.some((c) => c.has_floors);
    const hasActiveNonCore = allCards.some(
        (c) => !c.has_floors && c.status === "active",
    );

    if (dbStatus === "active") {
        if (coreReadyTypes.size >= coreRequired) return "Activo/a";
        if (coreReadyTypes.size > 0) return "Parcial";
        // Solo tipos sin pisos y asignados → Activa
        if (!hasCoreCards && hasActiveNonCore) return "Activo/a";
        if (allCards.length > 0) return "Bloqueado/a";
        return "Sin Acceso";
    }
    if (dbStatus === "blocked") return "Bloqueado/a";
    return "Baja";
}
