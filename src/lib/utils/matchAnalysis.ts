/**
 * matchAnalysis.ts
 *
 * Analiza conflictos entre lo solicitado en una fila de la plantilla
 * de importación y lo que la persona coincidente ya tiene en el sistema.
 *
 * Es agnóstico a los medios: itera sobre el catálogo de medios (`mediaTypes`)
 * y deriva las claves de columnas del contrato (`<key>_req`, `pisos_<key>`,
 * `accion_<key>`, `reponer_<key>`, `<key>_folio`) de `mediaContract`.
 */

import type { Person } from "../types";
import { floorsForKey } from "../services/accessAssignments";
import { activeMediaTypes, type MediaInfo } from "./mediaContract";
import { parseFloors } from "./xlsxImporter";
import { applyFloorAction } from "./floorActions";

// ─── Types ──────────────────────────────────────────────────

export type CardConflictAction = "proceed" | "skip_card" | "convert_to_reposicion";

export interface AltaCardConflict {
    mediaKey: string;
    mediaName: string;
    has_floors: boolean;
    requested: boolean;
    hasCard: boolean;
    existingFolio?: string;
    existingCardId?: string;
    existingStatus?: string;
    /** Pisos (medio con pisos) o folio (medio sin pisos) solicitados. */
    requestedValue?: string;
    conflict: boolean;
    description: string;
    resolution: CardConflictAction;
}

export interface AltaConflictAnalysis {
    type: "altas";
    rowKey: string;
    person: Person;
    conflicts: AltaCardConflict[];
    hasConflicts: boolean;
}

export interface ModificacionFieldChange {
    field: string;
    label: string;
    currentValue: string;
    newValue: string;
    changed: boolean;
}

export type ModificacionResolution = "apply" | "reject" | null;

export interface FloorChange {
    added: string[];
    removed: string[];
    kept: string[];
}

export interface ModificacionConflictAnalysis {
    type: "modificaciones";
    rowKey: string;
    person: Person;
    changes: ModificacionFieldChange[];
    /**
     * Cambios de pisos por clave de medio (solo medios con pisos), más la clave
     * especial `accesses` para los accesos especiales cuando `accion_acc` está
     * presente.
     */
    floorChanges?: Record<string, FloorChange>;
    hasChanges: boolean;
    resolution: ModificacionResolution;
}

export type RowAnalysis = AltaConflictAnalysis | ModificacionConflictAnalysis;

// ─── Helpers ────────────────────────────────────────────────

const YES_VALUES = ["sí", "si"];

/**
 * Detecta si una fila solicita un medio concreto (hoja ALTAS).
 * Para medios SIN pisos, un folio relleno también implica solicitud.
 */
export function wantsCard(fields: Record<string, string>, media: MediaInfo): boolean {
    if (YES_VALUES.includes((fields[`${media.key}_req`] ?? "").toLowerCase())) return true;
    if (!media.has_floors && (fields[`${media.key}_folio`] ?? "").trim().length > 0) return true;
    return false;
}

// ─── Alta Analysis ──────────────────────────────────────────

/**
 * Analiza conflictos entre lo que se solicita en la fila de ALTAS y lo que la
 * persona coincidente ya tiene, para cada medio activo del catálogo.
 *
 * @param onlyKeys Si se pasa, solo se analizan esas claves de medio.
 */
export function analyzeAltaConflicts(
    rowKey: string,
    person: Person,
    fields: Record<string, string>,
    mediaTypes?: any[],
    onlyKeys?: string[],
): AltaConflictAnalysis {
    const medias = activeMediaTypes(mediaTypes);
    const activeCards = (person.cards ?? []).filter((c) => c.status === "active");

    const conflicts: AltaCardConflict[] = [];

    for (const media of medias) {
        if (onlyKeys && !onlyKeys.includes(media.key)) continue;

        const requested = wantsCard(fields, media);
        const requestedValue = media.has_floors
            ? fields[`pisos_${media.key}`]
            : fields[`${media.key}_folio`];
        const existing = activeCards.find((c) => c.type === media.name);
        const conflict = requested && !!existing;

        conflicts.push({
            mediaKey: media.key,
            mediaName: media.name,
            has_floors: media.has_floors,
            requested,
            hasCard: !!existing,
            existingFolio: existing?.folio,
            existingCardId: existing?.id,
            existingStatus: existing?.status,
            requestedValue,
            conflict,
            description: conflict
                ? `Ya tiene ${media.name} activa (${existing!.folio})`
                : requested
                  ? `No tiene ${media.name} — sin conflicto`
                  : `No solicitó ${media.name}`,
            resolution: conflict ? "skip_card" : "proceed",
        });
    }

    return {
        type: "altas",
        rowKey,
        person,
        conflicts,
        hasConflicts: conflicts.some((c) => c.conflict),
    };
}

// ─── Modificación Analysis ──────────────────────────────────

/**
 * Analiza los cambios solicitados en una fila de MODIFICACIONES comparándolos
 * con los datos actuales de la persona, incluyendo pisos por medio con pisos.
 */
export function analyzeModificacionConflicts(
    rowKey: string,
    person: Person,
    fields: Record<string, string>,
    mediaTypes?: any[],
): ModificacionConflictAnalysis {
    const changes: ModificacionFieldChange[] = [];

    const fieldMap: [string, string, keyof Person | undefined][] = [
        ["nuevo_apellido", "Apellidos", "last_name"],
        ["nuevo_nombre", "Nombres", "first_name"],
        ["nueva_dep", "Dependencia", "dependency"],
        ["nuevo_edificio", "Edificio", "building"],
        ["nuevo_piso", "Piso Base", "floor"],
        ["nueva_area", "Área", "area"],
        ["nuevo_puesto", "Puesto", "position"],
    ];

    for (const [field, label, personKey] of fieldMap) {
        const newVal = fields[field]?.trim();
        if (newVal) {
            const currentVal = personKey
                ? String((person as any)[personKey] ?? "")
                : "";
            changes.push({
                field,
                label,
                currentValue: currentVal || "—",
                newValue: newVal,
                changed: currentVal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") !==
                    newVal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
            });
        }
    }

    if (fields.hora_entrada?.trim()) {
        const currentEntry = person.schedule?.entry || "—";
        changes.push({
            field: "hora_entrada",
            label: "Hora Entrada",
            currentValue: currentEntry,
            newValue: fields.hora_entrada,
            changed: currentEntry !== fields.hora_entrada,
        });
    }
    if (fields.hora_salida?.trim()) {
        const currentExit = person.schedule?.exit || "—";
        changes.push({
            field: "hora_salida",
            label: "Hora Salida",
            currentValue: currentExit,
            newValue: fields.hora_salida,
            changed: currentExit !== fields.hora_salida,
        });
    }

    // Pisos por medio con pisos + accesos especiales
    const floorChanges: Record<string, FloorChange> = {};
    const addFloorChange = (groupKey: string, current: string[], requested: string[]) => {
        floorChanges[groupKey] = {
            added: requested.filter((f) => !current.includes(f)),
            removed: current.filter((f) => !requested.includes(f)),
            kept: requested.filter((f) => current.includes(f)),
        };
    };

    const medias = activeMediaTypes(mediaTypes).filter((m) => m.has_floors);
    for (const media of medias) {
        const action = fields[`accion_${media.key}`];
        if (action) {
            const current = floorsForKey(person.floors, media.key);
            const final = applyFloorAction(
                action,
                current,
                parseFloors(fields[`pisos_${media.key}`]),
            );
            addFloorChange(media.key, current, final);
        }
    }

    if (fields.accion_acc) {
        const currentAccesses = person.specialAccesses || [];
        const requestedAccesses = [fields.acceso1, fields.acceso2, fields.acceso3]
            .map((s) => s?.trim())
            .filter(Boolean);
        const final = applyFloorAction(fields.accion_acc, currentAccesses, requestedAccesses);
        addFloorChange("accesses", currentAccesses, final);
    }

    const anyFloorChange = Object.values(floorChanges).some(
        (f) => f.added.length > 0 || f.removed.length > 0,
    );

    return {
        type: "modificaciones",
        rowKey,
        person,
        changes,
        floorChanges: Object.keys(floorChanges).length > 0 ? floorChanges : undefined,
        hasChanges: changes.some((c) => c.changed) || anyFloorChange,
        resolution: null,
    };
}
