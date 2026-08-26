/**
 * personStatus.ts
 *
 * Cálculo centralizado del estado mostrado de una persona a partir de sus
 * medios de acceso y su estado en base de datos.
 *
 * Estados (máquina de 8, anclada al edificio de radicación):
 *  - "Activo/a": tiene listos TODOS los medios requeridos de su edificio.
 *  - "Parcial": el edificio requiere ≥2 y tiene listos algunos (no todos).
 *  - "En proceso": tiene medio de SU edificio presente pero ninguno listo.
 *  - "Media de otro edificio": solo tiene accesos de OTRO edificio y al menos uno listo.
 *  - "Otro edificio en proceso": solo tiene accesos de OTRO edificio y ninguno listo.
 *  - "Sin Acceso": no tiene ningún acceso asignado.
 *  - "Bloqueado/a": estado BD blocked.
 *  - "Baja": estado BD inactive/baja.
 *
 * Los medios requeridos de un edificio se derivan de `access_media_type_buildings`
 * (catálogo de medios), no de un umbral global.
 */

import { settingsState } from "../stores/settings.svelte";
import { catalogState } from "../stores/catalogs.svelte";

export interface StatusCardInput {
    type: string;
    status: string;
    programming_status: string | null;
    responsiva_status: string | null;
    has_floors?: boolean;
}

function isReady(c: StatusCardInput): boolean {
    return (
        c.status === "active" &&
        c.programming_status === "done" &&
        (c.responsiva_status === "signed" ||
            c.responsiva_status === "legacy")
    );
}

export function computePersonStatus(
    dbStatus: string,
    allCards: StatusCardInput[],
    buildingId?: string | number | null,
): string {
    if (dbStatus === "blocked") return "Bloqueado/a";
    if (dbStatus !== "active") return "Baja";

    if (buildingId != null && buildingId !== "") {
        // Medio requerido por el edificio de radicación (desde el catálogo).
        const reqNames = new Set<string>(
            catalogState.mediaTypes
                .filter(
                    (m) =>
                        (m as any).active !== false &&
                        (m as any).access_media_type_buildings?.some(
                            (x: { building_id?: number | string }) =>
                                Number(x.building_id) === Number(buildingId),
                        ),
                )
                .map((m) => m.name),
        );

        const hasRequiredCard = allCards.some((c) => reqNames.has(c.type));
        const readyRequired = new Set(
            allCards.filter((c) => reqNames.has(c.type) && isReady(c)).map((c) => c.type),
        );
        const hasAnyCard = allCards.length > 0;
        const hasOtherReady = allCards.some(
            (c) => !reqNames.has(c.type) && isReady(c),
        );

        if (reqNames.size === 0) {
            if (!hasAnyCard) return "Sin Acceso";
            if (hasOtherReady) return "Media de otro edificio";
            return "Otro edificio en proceso";
        }

        if (readyRequired.size >= reqNames.size) return "Activo/a";
        if (readyRequired.size > 0) return "Parcial";
        if (hasRequiredCard) return "En proceso";
        if (hasOtherReady) return "Media de otro edificio";
        if (hasAnyCard) return "Otro edificio en proceso";
        return "Sin Acceso";
    }

    // Respaldo (sin edificio): comportamiento anterior con el umbral global.
    const coreRequired = settingsState.coreTypesRequired || 2;
    const activeCards = allCards.filter((c) => c.status === "active");
    const readyCards = activeCards.filter(
        (c) =>
            c.programming_status === "done" &&
            (c.responsiva_status === "signed" ||
                c.responsiva_status === "legacy"),
    );

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
        if (!hasCoreCards && hasActiveNonCore) return "Activo/a";
        return "Sin Acceso";
    }
    return "Baja";
}
