/**
 * historyFormat.ts — Funciones compartidas de formateo para el historial.
 *
 * Usadas tanto por HistoryView.svelte (UI) como por xlsxHistory.ts (exportación Excel).
 * Centraliza la lógica para mantener consistencia entre ambas salidas.
 */
import type { HistoryLog } from "../types";
import {
    ACTION_NAMES,
    ACTION_COLORS,
    translateDetails,
} from "../constants/history";

export { ACTION_NAMES, ACTION_COLORS, translateDetails };

// ── TIPOS ───────────────────────────────────────────────────────────

/** Mínimo necesario de un registro de historial para las funciones de formateo. */
export interface HistoryFormatRow {
    entity_type: string;
    entity_name: string | null;
    entity_id: string | null;
    details: Record<string, unknown> | string | null;
    action?: string;
}

// ── ENTIDAD AFECTADA ────────────────────────────────────────────────

/** Etiqueta legible para el tipo de entidad. */
export function entityTypeLabel(type: string): string {
    if (type === "PERSONNEL" || type === "PERSON") return "PERSONAL";
    if (type === "CARD") return "TARJETA";
    if (type === "TICKET") return "TICKET";
    if (type === "ENLACE") return "ENLACE";
    if (type === "SYSTEM") return "SISTEMA";
    return type;
}

/**
 * Muestra la entidad afectada en formato limpio y estandarizado.
 * Cada tipo de entidad tiene su propio formato legible por humanos.
 */
export function displayEntityName(row: HistoryFormatRow): string {
    const et = row.entity_type;
    const name = row.entity_name;
    if (!name && !row.entity_id) return "—";

    // PERSONAL: el entity_name es el nombre completo
    if (et === "PERSONNEL" || et === "PERSON") {
        return name || `${row.entity_id?.slice(0, 8) ?? "?"}`;
    }

    // TARJETA: entity_name = "Tipo (Folio: FOLIO)" → "Tipo · FOLIO"
    if (et === "CARD") {
        if (name) {
            const match = name.match(/^(.+?)\s*\(Folio:\s*(.+?)\)$/);
            if (match) return `${match[1]} · ${match[2]}`;
        }
        return name || `Tarjeta ${row.entity_id?.slice(0, 8) ?? ""}`;
    }

    // TICKET: entity_name = "Ticket #ID: título" → "#ID · título"
    if (et === "TICKET") {
        if (name) {
            const match = name.match(/^Ticket\s*#(\d+):\s*(.+)$/);
            if (match) return `#${match[1]} · ${match[2]}`;
        }
        return name || `Ticket #${row.entity_id ?? "?"}`;
    }

    // ENLACE: entity_name = "Enlace: Nombre" — limpiar prefijo
    if (et === "ENLACE") {
        if (name) {
            return name.replace(/^Enlace:\s*/i, "");
        }
        return name || `Enlace #${row.entity_id?.slice(0, 8) ?? "?"}`;
    }

    // SYSTEM: catálogos, roles — entity_name suele ser null
    if (et === "SYSTEM") {
        const msg = typeof row.details === "object" && row.details
            ? (row.details as Record<string, any>)?.message ?? ""
            : typeof row.details === "string"
                ? row.details
                : "";
        const itemMatch = msg.match(/(?:actualizado|creado|eliminado)\s*(?::|de)\s*(.+)$/i);
        if (itemMatch) return itemMatch[1].trim();
        return name || "Sistema";
    }

    return name || `${et} ${row.entity_id?.slice(0, 8) ?? "?"}`;
}

// ── DESCRIPCIÓN ─────────────────────────────────────────────────────

/**
 * Extrae el mensaje legible desde details, eliminando:
 * - Redundancia con la columna Acción ("Registro de", "Actualización de")
 * - UUIDs e IDs técnicos
 * - Prefijos de tipo "Tarjeta X" cuando la entidad ya es CARD
 */
export function cleanMessage(row: HistoryFormatRow): string {
    const raw = typeof row.details === "object" && row.details
        ? (row.details as Record<string, any>)?.message ?? ""
        : typeof row.details === "string"
            ? row.details
            : "";

    if (!raw) return "";

    let msg = raw;

    // Quitar UUIDs
    msg = msg.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "");

    // Si la entidad ya se muestra en la columna "Entidad Afectada",
    // quitar el prefijo redundante del mensaje.
    if (row.entity_type === "CARD") {
        // "Tarjeta P2K-001 (P2000) asignada" → "Asignada"
        // "Tarjeta desvinculada de la persona" → "Desvinculada de la persona"
        msg = msg.replace(/^Tarjeta\s+\S+\s+\([^)]+\)\s+/i, "");
        msg = msg.replace(/^Tarjeta\s+/i, "");
    }

    if (row.entity_type === "PERSONNEL" || row.entity_type === "PERSON") {
        // "Actualización de Juan" → ""
        // "Registro de Juan" → ""
        msg = msg.replace(/^Actualización de\s+/i, "");
        msg = msg.replace(/^Registro de\s+/i, "");
    }

    if (row.entity_type === "ENLACE") {
        msg = msg.replace(/^Enlace administrativo\s+/i, "");
    }

    // Normalizar whitespace
    msg = msg.replace(/\s{2,}/g, " ").trim();

    return translateDetails(msg);
}

/** Nombre de acción legible. */
export function actionLabel(action: string): string {
    return ACTION_NAMES[action] || action;
}
