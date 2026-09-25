import { TICKET_TYPES } from '../constants/tickets';

/**
 * xlsxFields.ts
 *
 * Tipos, etiquetas, constantes y parsers ligeros de las plantillas XLSX.
 * Vive separado de `xlsxImporter.ts` (que importa ExcelJS) para que estos
 * símbolos se puedan usar sin cargar ExcelJS en el bundle inicial.
 */

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────

export type SheetKey =
    'altas' | 'modificaciones' | 'baja_persona' | 'reposicion' | 'reporte_falla' | 'medios';

export interface ParsedRow {
    rowNumber: number;
    fields: Record<string, string>;
    /** Campos obligatorios que están vacíos */
    missingRequired: string[];
    isValid: boolean;
}

export interface ParsedSheet {
    key: SheetKey;
    label: string;
    rows: ParsedRow[];
    validCount: number;
    invalidCount: number;
}

export interface ImportParseResult {
    sheets: ParsedSheet[];
    totalValid: number;
    totalInvalid: number;
    hasAnyData: boolean;
}

// ─────────────────────────────────────────
// Mapeo de tipo de ticket
// ─────────────────────────────────────────

export const SHEET_TO_TICKET_TYPE: Record<SheetKey, string> = {
    altas: 'Alta de Persona',
    modificaciones: TICKET_TYPES.modificacion,
    baja_persona: 'Baja de Persona',
    reposicion: 'Reposición',
    reporte_falla: 'Reporte de Falla',
    medios: 'Alta de Medio',
};

export const FIELD_LABELS: Record<string, string> = {
    apellidos: 'Apellidos',
    nombres: 'Nombres',
    tipo_personal: 'Tipo de Personal',
    no_empleado: 'No. Empleado',
    dependencia: 'Dependencia',
    edificio: 'Edificio',
    piso_base: 'Piso Base',
    area: 'Área / Equipo',
    puesto: 'Puesto',
    nuevo_apellido: 'Nuevo Apellido',
    nuevo_nombre: 'Nuevo Nombre',
    nueva_dep: 'Nueva Dependencia',
    nuevo_edificio: 'Nuevo Edificio',
    nuevo_piso: 'Nuevo Piso Base',
    nueva_area: 'Nueva Área',
    nuevo_puesto: 'Nuevo Puesto',
    acceso1: 'Acceso Especial 1',
    acceso2: 'Acceso Especial 2',
    acceso3: 'Acceso Especial 3',
    accion_acc: 'Acción Acc. Esp.',
    horario: 'Horario',
    hora_entrada: 'Hora Entrada',
    hora_salida: 'Hora Salida',
    correo: 'Correo Electrónico',
    tipo_baja: 'Tipo de Baja',
    motivo: 'Motivo',
    observaciones: 'Observaciones',
    observacion: 'Observaciones',
    tipo_tarjeta: 'Tipo de Tarjeta',
    folio: 'Folio de Tarjeta',
    ubicacion: 'Edificio / Lugar donde falla',
    descripcion: 'Descripción del Problema',
    desde_cuando: '¿Desde cuándo ocurre?',
    urgencia: 'Urgencia',
    tipo: 'Tipo',
};

// ─────────────────────────────────────────
// Helpers de normalización
// ─────────────────────────────────────────

/**
 * Normaliza un correo que pudo llegar como texto, enlace o hipervínculo
 * ("mailto:user@dom.com", "<mailto:...>", "mailto:?subject=...", etc.) a solo
 * la dirección de correo en texto plano.
 */
export function normalizeEmailText(raw: string | null | undefined): string {
    if (!raw) return '';
    let v = String(raw).trim();

    if (v.toLowerCase().startsWith('mailto:')) {
        v = v.slice('mailto:'.length);
        // Recorta cualquier query/param que acompañe al mailto (ej. ?subject=...).
        const q = v.search(/[?#]/);
        if (q !== -1) v = v.slice(0, q);
    }

    // Quita comillas/ángulos comunes en enlaces o celdas con formato.
    v = v.replace(/[<>"']/g, '').trim();

    // Aísla la dirección si quedó envuelta en un URI o texto extra.
    const at = v.lastIndexOf('@');
    if (at !== -1) {
        let start = at;
        while (start > 0 && /[A-Za-z0-9._%+-]/.test(v[start - 1])) start--;
        let end = at + 1;
        while (end < v.length && /[A-Za-z0-9.-]/.test(v[end])) end++;
        v = v.slice(start, end);
    }

    return v;
}

/** Parses a string of floors into a naturally sorted array of strings. */
export function parseFloors(floorsStr: string | null | undefined): string[] {
    if (!floorsStr) return [];

    const parsed = String(floorsStr)
        .replace(/\by\b/gi, ',')
        .split(/[,;|.]/)
        .map((s) => s.trim())
        .filter(Boolean);

    return [...new Set(parsed)].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    );
}
