/**
 * matchAnalysis.ts
 *
 * Analiza conflictos entre lo solicitado en una fila de la plantilla
 * de importación y lo que la persona coincidente ya tiene en el sistema.
 *
 * ─── ALTAS ─────────────────────────────────────────────────
 * Detecta si la persona ya tiene una tarjeta P2000/KONE activa
 * y sugiere resoluciones: skip_card, convert_to_reposicion, proceed.
 *
 * ─── MODIFICACIONES ─────────────────────────────────────────
 * Compara campo por campo los datos actuales vs. los propuestos
 * y detecta qué campos cambiarían realmente.
 */

import type { Person } from "../types";
import { floorsForKey } from "../services/accessAssignments";

// ─── Types ──────────────────────────────────────────────────

/** Acción de resolución para un conflicto de tarjeta en ALTAS */
export type CardConflictAction = "proceed" | "skip_card" | "convert_to_reposicion";

/** Análisis individual por tipo de tarjeta (ALTAS) */
export interface AltaCardConflict {
    cardType: "P2000" | "KONE" | "AccessPRO";
    /** Si la persona solicitó esta tarjeta en la plantilla */
    requested: boolean;
    /** Si la persona ya tiene una tarjeta de este tipo activa */
    hasCard: boolean;
    /** Folio de la tarjeta existente (si aplica) */
    existingFolio?: string;
    /** ID de la tarjeta existente (si aplica) */
    existingCardId?: string;
    /** Estado de la tarjeta existente */
    existingStatus?: string;
    /** Pisos solicitados en la plantilla para esta tarjeta */
    requestedFloors?: string;
    /** true si hay conflicto (solicitada pero ya existe) */
    conflict: boolean;
    /** Descripción legible del conflicto */
    description: string;
    /** Resolución elegida por el usuario */
    resolution: CardConflictAction;
}

/** Análisis completo para una fila de ALTAS */
export interface AltaConflictAnalysis {
    type: "altas";
    rowKey: string;
    person: Person;
    conflicts: AltaCardConflict[];
    hasConflicts: boolean;
}

/** Cambio de campo individual (MODIFICACIONES) */
export interface ModificacionFieldChange {
    field: string;
    label: string;
    /** Valor actual en BD */
    currentValue: string;
    /** Valor propuesto en la plantilla */
    newValue: string;
    /** true si el valor realmente cambia */
    changed: boolean;
}

/** Resolución para una modificación */
export type ModificacionResolution = "apply" | "reject" | null;

/** Análisis completo para una fila de MODIFICACIONES */
export interface ModificacionConflictAnalysis {
    type: "modificaciones";
    rowKey: string;
    person: Person;
    changes: ModificacionFieldChange[];
    /** Cambios de pisos/accesos (derivados) */
    floorChanges?: {
        p2000?: { added: string[]; removed: string[]; kept: string[] };
        kone?: { added: string[]; removed: string[]; kept: string[] };
        accesses?: { added: string[]; removed: string[]; kept: string[] };
    };
    hasChanges: boolean;
    /** Resolución elegida */
    resolution: ModificacionResolution;
}

/** Unión de todos los análisis posibles */
export type RowAnalysis = AltaConflictAnalysis | ModificacionConflictAnalysis;

// ─── Helpers ────────────────────────────────────────────────

const YES_VALUES = ["sí", "si"];

/**
 * Detecta si una fila de alta solicita tarjeta AccessPRO.
 * Puede ser explícito (columna accesspro_req = sí) o implícito
 * (la hoja ALTAS ACCESSPRO solo pide el folio de la tarjeta).
 */
export function wantsAccessProCard(fields: Record<string, string>): boolean {
    return (
        YES_VALUES.includes((fields.accesspro_req ?? "").toLowerCase()) ||
        (fields.folio_accesspro ?? "").trim().length > 0
    );
}

function parseFloors(floorsStr: string | null | undefined): string[] {
    if (!floorsStr) return [];
    return String(floorsStr)
        .replace(/\by\b/gi, ",")
        .split(/[,;|.]/)
        .map((s) => s.trim())
        .filter(Boolean);
}

// ─── Alta Analysis ──────────────────────────────────────────

/**
 * Analiza conflictos entre lo que se solicita en la fila de ALTAS
 * y lo que la persona coincidente ya tiene.
 *
 * @param onlyTypes Si se pasa, solo se analizan esos tipos de tarjeta
 * (útil para la hoja ALTAS ACCESSPRO, que solo solicita AccessPRO).
 */
export function analyzeAltaConflicts(
    rowKey: string,
    person: Person,
    fields: Record<string, string>,
    onlyTypes?: Array<"P2000" | "KONE" | "AccessPRO">,
): AltaConflictAnalysis {
    const activeCards = (person.cards ?? []).filter((c) => c.status === "active");

    const wantsP2000 = YES_VALUES.includes((fields.p2000_req ?? "").toLowerCase());
    const wantsKONE = YES_VALUES.includes((fields.kone_req ?? "").toLowerCase());
    // En la hoja ALTAS ACCESSPRO la tarjeta se solicita SIEMPRE
    // (la hoja está dedicada a ese tipo); el folio es opcional.
    const wantsAccessPro = onlyTypes?.includes("AccessPRO")
        ? true
        : wantsAccessProCard(fields);

    const p2000Card = activeCards.find((c) => c.type === "P2000");
    const koneCard = activeCards.find((c) => c.type === "KONE");
    const accessproCard = activeCards.find((c) => c.type === "AccessPRO");

    const conflicts: AltaCardConflict[] = [];

    // P2000 analysis
    if (!onlyTypes || onlyTypes.includes("P2000")) {
        const hasP2000Conflict = wantsP2000 && !!p2000Card;
        conflicts.push({
            cardType: "P2000",
            requested: wantsP2000,
            hasCard: !!p2000Card,
            existingFolio: p2000Card?.folio,
            existingCardId: p2000Card?.id,
            existingStatus: p2000Card?.status,
            requestedFloors: fields.pisos_p2000,
            conflict: hasP2000Conflict,
            description: hasP2000Conflict
                ? `Ya tiene P2000 activa (${p2000Card!.folio})`
                : wantsP2000
                  ? "No tiene P2000 — sin conflicto"
                  : "No solicitó P2000",
            resolution: hasP2000Conflict ? "skip_card" : "proceed",
        });
    }

    // KONE analysis
    if (!onlyTypes || onlyTypes.includes("KONE")) {
        const hasKONEConflict = wantsKONE && !!koneCard;
        conflicts.push({
            cardType: "KONE",
            requested: wantsKONE,
            hasCard: !!koneCard,
            existingFolio: koneCard?.folio,
            existingCardId: koneCard?.id,
            existingStatus: koneCard?.status,
            requestedFloors: fields.pisos_kone,
            conflict: hasKONEConflict,
            description: hasKONEConflict
                ? `Ya tiene KONE activa (${koneCard!.folio})`
                : wantsKONE
                  ? "No tiene KONE — sin conflicto"
                  : "No solicitó KONE",
            resolution: hasKONEConflict ? "skip_card" : "proceed",
        });
    }

    // AccessPRO analysis
    if (!onlyTypes || onlyTypes.includes("AccessPRO")) {
        const hasAccessProConflict = wantsAccessPro && !!accessproCard;
        conflicts.push({
            cardType: "AccessPRO",
            requested: wantsAccessPro,
            hasCard: !!accessproCard,
            existingFolio: accessproCard?.folio,
            existingCardId: accessproCard?.id,
            existingStatus: accessproCard?.status,
            requestedFloors: fields.folio_accesspro,
            conflict: hasAccessProConflict,
            description: hasAccessProConflict
                ? `Ya tiene AccessPRO activa (${accessproCard!.folio})`
                : wantsAccessPro
                  ? "No tiene AccessPRO — sin conflicto"
                  : "No solicitó AccessPRO",
            resolution: hasAccessProConflict ? "skip_card" : "proceed",
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
 * Analiza los cambios solicitados en una fila de MODIFICACIONES
 * comparándolos con los datos actuales de la persona.
 */
export function analyzeModificacionConflicts(
    rowKey: string,
    person: Person,
    fields: Record<string, string>,
): ModificacionConflictAnalysis {
    const changes: ModificacionFieldChange[] = [];

    // Campos básicos de persona
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

    // Horario
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

    // Análisis de pisos / accesos
    const floorChanges: ModificacionConflictAnalysis["floorChanges"] = {};

    if (fields.accion_p2000) {
        const currentFloors = floorsForKey(person.floors, "p2000");
        const requestedFloors = parseFloors(fields.pisos_p2000);
        const added = requestedFloors.filter((f) => !currentFloors.includes(f));
        const removed = currentFloors.filter((f) => !requestedFloors.includes(f));
        const kept = requestedFloors.filter((f) => currentFloors.includes(f));
        floorChanges.p2000 = { added, removed, kept };
    }

    if (fields.accion_kone) {
        const currentFloors = floorsForKey(person.floors, "kone");
        const requestedFloors = parseFloors(fields.pisos_kone);
        const added = requestedFloors.filter((f) => !currentFloors.includes(f));
        const removed = currentFloors.filter((f) => !requestedFloors.includes(f));
        const kept = requestedFloors.filter((f) => currentFloors.includes(f));
        floorChanges.kone = { added, removed, kept };
    }

    if (fields.accion_acc) {
        const currentAccesses = person.specialAccesses || [];
        const requestedAccesses = [fields.acceso1, fields.acceso2, fields.acceso3]
            .map((s) => s?.trim())
            .filter(Boolean);
        const added = requestedAccesses.filter((a) => !currentAccesses.includes(a));
        const removed = currentAccesses.filter((a) => !requestedAccesses.includes(a));
        const kept = requestedAccesses.filter((a) => currentAccesses.includes(a));
        floorChanges.accesses = { added, removed, kept };
    }

    return {
        type: "modificaciones",
        rowKey,
        person,
        changes,
        floorChanges: Object.keys(floorChanges).length > 0 ? floorChanges : undefined,
        hasChanges: changes.some((c) => c.changed) ||
            !!floorChanges.p2000?.added.length ||
            !!floorChanges.p2000?.removed.length ||
            !!floorChanges.kone?.added.length ||
            !!floorChanges.kone?.removed.length ||
            !!floorChanges.accesses?.added.length ||
            !!floorChanges.accesses?.removed.length,
        resolution: null,
    };
}
