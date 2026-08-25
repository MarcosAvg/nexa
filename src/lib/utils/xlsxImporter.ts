import ExcelJS from 'exceljs';
import { TICKET_TYPES } from '../constants/tickets';
import {
    activeMediaTypes,
    altasMediaCols,
    modifMediaCols,
    reposMediaCols,
    type MediaInfo,
} from './mediaContract';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────

export type SheetKey =
    | 'altas'
    | 'modificaciones'
    | 'baja_persona'
    | 'reposicion'
    | 'reporte_falla';

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

type ColDef = { field: string; label: string; required?: boolean };

// ─────────────────────────────────────────
// Mapeo de tipo de ticket
// ─────────────────────────────────────────

export const SHEET_TO_TICKET_TYPE: Record<SheetKey, string> = {
    altas: 'Alta de Persona',
    modificaciones: TICKET_TYPES.modificacion,
    baja_persona: 'Baja de Persona',
    reposicion: 'Reposición',
    reporte_falla: 'Reporte de Falla',
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
};

// ─────────────────────────────────────────
// Configuración por hoja (base + columnas de medio dinámicas)
// ─────────────────────────────────────────

type BaseSheetCols = {
    name: string;
    label: string;
    dataStartRow: number;
    base: ColDef[];
    /** Posición (índice 1-based) donde se inserta el bloque de columnas de medio. */
    mediaInsertAfter: number;
    /** Bloques que van DESPUÉS del bloque de medio. */
    trailing: ColDef[];
    /** Columnas de medio a generar. Por defecto TODAS. */
    mediaKind: 'altas' | 'modif' | 'repos' | 'none';
};

const SHEET_DEFS: Record<SheetKey, BaseSheetCols> = {
    altas: {
        name: '✅ ALTAS',
        label: 'Altas',
        dataStartRow: 5,
        mediaInsertAfter: 9, // tras "Puesto"
        mediaKind: 'altas',
        base: [
            { field: 'apellidos', label: 'Apellidos', required: true },
            { field: 'nombres', label: 'Nombres', required: true },
            { field: 'tipo_personal', label: 'Tipo de Personal', required: true },
            { field: 'no_empleado', label: 'No. Empleado' },
            { field: 'dependencia', label: 'Dependencia', required: true },
            { field: 'edificio', label: 'Edificio', required: true },
            { field: 'piso_base', label: 'Piso Base', required: true },
            { field: 'area', label: 'Área / Equipo', required: true },
            { field: 'puesto', label: 'Puesto', required: true },
        ],
        trailing: [
            { field: 'acceso1', label: 'Acceso Especial 1' },
            { field: 'acceso2', label: 'Acceso Especial 2' },
            { field: 'acceso3', label: 'Acceso Especial 3' },
            { field: 'horario', label: 'Horario', required: true },
            { field: 'hora_entrada', label: 'Hora Entrada', required: true },
            { field: 'hora_salida', label: 'Hora Salida', required: true },
            { field: 'correo', label: 'Correo Electrónico' },
        ],
    },
    modificaciones: {
        name: '✏️ MODIFICACIONES',
        label: 'Modificaciones',
        dataStartRow: 5,
        mediaInsertAfter: 10, // tras "Nuevo Puesto"
        mediaKind: 'modif',
        base: [
            { field: 'apellidos', label: 'Apellidos (como aparece en sistema)', required: true },
            { field: 'nombres', label: 'Nombres (como aparece en sistema)', required: true },
            { field: 'no_empleado', label: 'No. Empleado' },
            { field: 'nuevo_apellido', label: 'Nuevo Apellido' },
            { field: 'nuevo_nombre', label: 'Nuevo Nombre' },
            { field: 'nueva_dep', label: 'Nueva Dependencia' },
            { field: 'nuevo_edificio', label: 'Nuevo Edificio' },
            { field: 'nuevo_piso', label: 'Nuevo Piso Base' },
            { field: 'nueva_area', label: 'Nueva Área' },
            { field: 'nuevo_puesto', label: 'Nuevo Puesto' },
        ],
        trailing: [
            { field: 'accion_acc', label: 'Acción Acc. Esp.' },
            { field: 'acceso1', label: 'Acceso Esp. 1' },
            { field: 'acceso2', label: 'Acceso Esp. 2' },
            { field: 'acceso3', label: 'Acceso Esp. 3' },
            { field: 'horario', label: 'Horario' },
            { field: 'hora_entrada', label: 'Hora Entrada' },
            { field: 'hora_salida', label: 'Hora Salida' },
            { field: 'observacion', label: 'Observaciones' },
        ],
    },
    baja_persona: {
        name: '🚫 BAJA DE PERSONA',
        label: 'Bajas de Persona',
        dataStartRow: 5,
        mediaInsertAfter: 0,
        mediaKind: 'none',
        base: [
            { field: 'apellidos', label: 'Apellidos', required: true },
            { field: 'nombres', label: 'Nombres', required: true },
            { field: 'no_empleado', label: 'No. Empleado' },
            { field: 'dependencia', label: 'Dependencia', required: true },
            { field: 'tipo_baja', label: 'Tipo de Baja', required: true },
            { field: 'motivo', label: 'Motivo de la Baja', required: true },
            { field: 'observaciones', label: 'Observaciones' },
        ],
        trailing: [],
    },
    reposicion: {
        name: '🔄 REPOSICIÓN DE TARJETA',
        label: 'Reposiciones',
        dataStartRow: 5,
        mediaInsertAfter: 4, // tras "Dependencia"
        mediaKind: 'repos',
        base: [
            { field: 'apellidos', label: 'Apellidos', required: true },
            { field: 'nombres', label: 'Nombres', required: true },
            { field: 'no_empleado', label: 'No. Empleado' },
            { field: 'dependencia', label: 'Dependencia', required: true },
        ],
        trailing: [
            { field: 'motivo', label: 'Motivo', required: true },
            { field: 'observaciones', label: 'Observaciones' },
        ],
    },
    reporte_falla: {
        name: '🔧 REPORTE DE FALLA',
        label: 'Reportes de Falla',
        dataStartRow: 5,
        mediaInsertAfter: 0,
        mediaKind: 'none',
        base: [
            { field: 'apellidos', label: 'Apellidos', required: true },
            { field: 'nombres', label: 'Nombres', required: true },
            { field: 'no_empleado', label: 'No. Empleado' },
            { field: 'dependencia', label: 'Dependencia', required: true },
            { field: 'tipo_tarjeta', label: 'Tipo de Tarjeta', required: true },
            { field: 'folio', label: 'Folio de Tarjeta' },
            { field: 'ubicacion', label: 'Edificio / Lugar donde falla', required: true },
            { field: 'descripcion', label: 'Descripción del Problema', required: true },
            { field: 'desde_cuando', label: '¿Desde cuándo ocurre?' },
            { field: 'urgencia', label: 'Urgencia', required: true },
            { field: 'observaciones', label: 'Observaciones adicionales' },
        ],
        trailing: [],
    },
};

/** Genera el conjunto de columnas de medio según el tipo de hoja. */
function mediaColsFor(key: SheetKey, medias: MediaInfo[]): ColDef[] {
    const from = (cols: { key: string; label: string; required?: boolean }[]): ColDef[] =>
        cols.map((c) => ({ field: c.key, label: c.label, required: c.required }));
    switch (key) {
        case 'altas':
            return from(medias.flatMap((m) => altasMediaCols(m)));
        case 'modificaciones':
            return from(medias.filter((m) => m.has_floors).flatMap((m) => modifMediaCols(m)));
        case 'reposicion':
            return from(medias.flatMap((m) => reposMediaCols(m)));
        default:
            return [];
    }
}

/** Construye la lista lógica de columnas (base + medios + trailing) para una hoja. */
function buildCols(key: SheetKey, medias: MediaInfo[]): ColDef[] {
    const def = SHEET_DEFS[key];
    const media = mediaColsFor(key, medias);
    const insert = def.mediaInsertAfter;
    if (insert <= 0) return [...def.base, ...def.trailing];
    return [
        ...def.base.slice(0, insert),
        ...media,
        ...def.base.slice(insert),
        ...def.trailing,
    ];
}

// ─────────────────────────────────────────
// Utilidades de celda/encabezado
// ─────────────────────────────────────────

function cellText(cell: ExcelJS.Cell): string {
    const v = cell.value;
    if (v === null || v === undefined) return '';

    if (typeof v === 'object' && 'result' in v) {
        return cellText({ ...cell, value: (v as any).result } as ExcelJS.Cell);
    }

    if (v instanceof Date) {
        const y = v.getUTCFullYear();
        if (y <= 1900) {
            const hh = String(v.getUTCHours()).padStart(2, '0');
            const mm = String(v.getUTCMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
        }
        const dd = String(v.getUTCDate()).padStart(2, '0');
        const mo = String(v.getUTCMonth() + 1).padStart(2, '0');
        return `${dd}/${mo}/${y}`;
    }

    return String(v).trim();
}

/** Normaliza el texto de un encabezado: quita el asterisco de obligatorio y recorta. */
function normalizeHeader(text: string): string {
    return text.replace(/\s*\*\s*$/, '').trim().toLowerCase();
}

// ─────────────────────────────────────────
// Paráseo de una hoja por encabezados
// ─────────────────────────────────────────

function parseSheet(ws: ExcelJS.Worksheet, key: SheetKey, cols: ColDef[]): ParsedSheet {
    const def = SHEET_DEFS[key];
    const rows: ParsedRow[] = [];

    // Mapa: (col index 1-based → texto de cabecera normalizada)
    const headerByCol = new Map<number, string>();
    const headerRow = def.dataStartRow - 1;
    ws.getRow(headerRow).eachCell((cell, col) => {
        const txt = normalizeHeader(cellText(cell));
        if (txt) headerByCol.set(col, txt);
    });

    // Mapa: (col index 1-based → ColDef) resolviendo por etiqueta normalizada.
    // Primero por igualdad exacta; luego por contenido (encabezado empieza/contiene label).
    const colToDef = new Map<number, ColDef>();
    const usedCols = new Set<number>();

    const labelOf = (c: ColDef) => normalizeHeader(c.label);
    const available = () => Array.from(headerByCol.entries()).filter(([c]) => !usedCols.has(c));

    // Pase 1: igualdad exacta
    for (const c of cols) {
        const exact = available().find(([, h]) => h === labelOf(c));
        if (exact) {
            colToDef.set(exact[0], c);
            usedCols.add(exact[0]);
        }
    }
    // Pase 2: encabezado que contiene la etiqueta (o es contenida por ella)
    for (const c of cols) {
        if (Array.from(colToDef.values()).includes(c)) continue;
        const lbl = labelOf(c);
        const loose = available().find(([, h]) =>
            h === lbl || (lbl.length > 3 && h.includes(lbl)) || (h.length > 3 && lbl.includes(h)),
        );
        if (loose) {
            colToDef.set(loose[0], c);
            usedCols.add(loose[0]);
        }
    }

    // Soportar plantillas que descartan medios del catálogo actual: si una
    // columna de medio obligatoria (${key}_req / reponer_${key}) NO está presente
    // en el archivo, no exigirla (ese medio simplemente no aplica a esta plantilla).
    // Las columnas base obligatorias (apellidos, dependencia, etc.) no se relajan.
    const presentFields = new Set(Array.from(colToDef.values()).map((c) => c.field));
    for (const c of cols) {
        if (
            c.required &&
            (c.field.endsWith('_req') || c.field.startsWith('reponer_')) &&
            !presentFields.has(c.field)
        ) {
            c.required = false;
        }
    }

    ws.eachRow((row, rowNumber) => {
        if (rowNumber < def.dataStartRow) return;

        const fields: Record<string, string> = {};
        let hasData = false;

        for (const [colIdx, c] of colToDef) {
            let val = cellText(row.getCell(colIdx));
            if (c.field === 'correo' && val.toLowerCase().startsWith('mailto:')) {
                val = val.replace(/^mailto:\s*/i, '').trim();
            }
            fields[c.field] = val;
            if (val) hasData = true;
        }

        if (!hasData) return;

        const missingRequired = cols
            .filter((c) => c.required && !fields[c.field])
            .map((c) => FIELD_LABELS[c.field] ?? c.label);

        rows.push({
            rowNumber,
            fields,
            missingRequired,
            isValid: missingRequired.length === 0,
        });
    });

    const validCount = rows.filter((r) => r.isValid).length;
    return {
        key,
        label: def.label,
        rows,
        validCount,
        invalidCount: rows.length - validCount,
    };
}

// ─────────────────────────────────────────
// Parsing of floors
// ─────────────────────────────────────────

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

// ─────────────────────────────────────────
// Exportación principal
// ─────────────────────────────────────────

/**
 * Parsea el archivo de plantilla en hojas/personas.
 *
 * - `mediaTypes` indica los medios activos del catálogo; define qué columnas de
 *   medio esperar (acorde al contrato de `mediaContract`) y sus claves.
 * - La lectura es por encabezado (no posición), por lo que el orden de medios
 *   al importar puede diferir del de generación sin romper el mapeo.
 */
export async function parseTemplateFile(file: File, mediaTypes?: any[]): Promise<ImportParseResult> {
    const medias = activeMediaTypes(mediaTypes);

    const buffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const sheets: ParsedSheet[] = [];

    for (const key of Object.keys(SHEET_DEFS) as SheetKey[]) {
        const def = SHEET_DEFS[key];
        const ws = wb.getWorksheet(def.name) ?? wb.getWorksheet(def.label);
        if (!ws) continue;

        const cols = buildCols(key, medias);
        const parsed = parseSheet(ws, key, cols);
        if (parsed.rows.length > 0) {
            sheets.push(parsed);
        }
    }

    const totalValid = sheets.reduce((s, sh) => s + sh.validCount, 0);
    const totalInvalid = sheets.reduce((s, sh) => s + sh.invalidCount, 0);

    return {
        sheets,
        totalValid,
        totalInvalid,
        hasAnyData: sheets.length > 0,
    };
}
