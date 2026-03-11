import ExcelJS from 'exceljs';

// ─────────────────────────────────────────
// Types
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

// ─────────────────────────────────────────
// Config per sheet
// ─────────────────────────────────────────

type ColDef = { field: string; label: string; required?: boolean };

const SHEET_CONFIG: Record<SheetKey, {
    name: string;
    label: string;
    dataStartRow: number;
    cols: ColDef[];
}> = {
    altas: {
        name: '✅ ALTAS',
        label: 'Altas',
        dataStartRow: 5,
        cols: [
            { field: 'apellidos', label: 'Apellidos', required: true },
            { field: 'nombres', label: 'Nombres', required: true },
            { field: 'tipo_personal', label: 'Tipo de Personal', required: true },
            { field: 'no_empleado', label: 'No. Empleado' },
            { field: 'dependencia', label: 'Dependencia', required: true },
            { field: 'edificio', label: 'Edificio', required: true },
            { field: 'piso_base', label: 'Piso Base', required: true },
            { field: 'area', label: 'Área / Equipo', required: true },
            { field: 'puesto', label: 'Puesto', required: true },
            { field: 'p2000_req', label: '¿Require P2000?', required: true },
            { field: 'pisos_p2000', label: 'Pisos P2000' },
            { field: 'kone_req', label: '¿Requiere KONE?', required: true },
            { field: 'pisos_kone', label: 'Pisos KONE' },
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
        cols: [
            { field: 'apellidos', label: 'Apellidos', required: true },
            { field: 'nombres', label: 'Nombres', required: true },
            { field: 'no_empleado', label: 'No. Empleado' },
            { field: 'nuevo_apellido', label: 'Nuevo Apellido' },
            { field: 'nuevo_nombre', label: 'Nuevo Nombre' },
            { field: 'nueva_dep', label: 'Nueva Dependencia' },
            { field: 'nuevo_edificio', label: 'Nuevo Edificio' },
            { field: 'nuevo_piso', label: 'Nuevo Piso Base' },
            { field: 'nueva_area', label: 'Nueva Área' },
            { field: 'nuevo_puesto', label: 'Nuevo Puesto' },
            { field: 'accion_p2000', label: 'Acción P2000' },
            { field: 'pisos_p2000', label: 'Pisos P2000' },
            { field: 'accion_kone', label: 'Acción KONE' },
            { field: 'pisos_kone', label: 'Pisos KONE' },
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
        label: 'Bajas',
        dataStartRow: 5,
        cols: [
            { field: 'apellidos', label: 'Apellidos', required: true },
            { field: 'nombres', label: 'Nombres', required: true },
            { field: 'no_empleado', label: 'No. Empleado' },
            { field: 'dependencia', label: 'Dependencia', required: true },
            { field: 'tipo_baja', label: 'Tipo de Baja', required: true },
            { field: 'motivo', label: 'Motivo de la Baja', required: true },
            { field: 'observaciones', label: 'Observaciones' },
        ],
    },
    reposicion: {
        name: '🔄 REPOSICIÓN DE TARJETA',
        label: 'Reposiciones',
        dataStartRow: 5,
        cols: [
            { field: 'apellidos', label: 'Apellidos', required: true },
            { field: 'nombres', label: 'Nombres', required: true },
            { field: 'no_empleado', label: 'No. Empleado' },
            { field: 'dependencia', label: 'Dependencia', required: true },
            { field: 'reponer_p2000', label: '¿Reponer P2000?', required: true },
            { field: 'folio_p2000', label: 'Folio P2000' },
            { field: 'reponer_kone', label: '¿Reponer KONE?', required: true },
            { field: 'folio_kone', label: 'Folio KONE' },
            { field: 'motivo', label: 'Motivo', required: true },
            { field: 'observaciones', label: 'Observaciones' },
        ],
    },
    reporte_falla: {
        name: '🔧 REPORTE DE FALLA',
        label: 'Reportes de Falla',
        dataStartRow: 5,
        cols: [
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
    },
};

// ─────────────────────────────────────────
// Ticket type mapping
// ─────────────────────────────────────────

export const SHEET_TO_TICKET_TYPE: Record<SheetKey, string> = {
    altas: 'Alta de Persona',
    modificaciones: 'Modificación',
    baja_persona: 'Baja de Persona',
    reposicion: 'Reposición',
    reporte_falla: 'Reporte de Falla',
};

/** Formats an Excel cell value as a clean string.
 * - Date objects with year 1899/1900 → time: "HH:MM" (Excel stores times as day fractions with 1899-12-30 as epoch)
 * - Other Date objects → "DD/MM/YYYY HH:MM"
 * - Formula cells → their computed result
 * - Everything else → trimmed string
 */
function cellText(cell: ExcelJS.Cell): string {
    const v = cell.value;
    if (v === null || v === undefined) return '';

    // Formula: use computed result
    if (typeof v === 'object' && 'result' in v) {
        return cellText({ ...cell, value: (v as any).result } as ExcelJS.Cell);
    }

    // Date object (ExcelJS returns times & dates as JS Date)
    if (v instanceof Date) {
        const y = v.getUTCFullYear();
        // Excel time-only values have date 1899-12-30 (year 1899 or 1900 after rounding)
        if (y <= 1900) {
            const hh = String(v.getUTCHours()).padStart(2, '0');
            const mm = String(v.getUTCMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
        }
        // Full date
        const dd = String(v.getUTCDate()).padStart(2, '0');
        const mo = String(v.getUTCMonth() + 1).padStart(2, '0');
        return `${dd}/${mo}/${y}`;
    }

    return String(v).trim();
}

// ─────────────────────────────────────────
// Field label lookup (field key → human-readable label)
// ─────────────────────────────────────────

export const FIELD_LABELS: Record<string, string> = {};
for (const cfg of Object.values(SHEET_CONFIG)) {
    for (const col of cfg.cols) {
        FIELD_LABELS[col.field] = col.label;
    }
}

function parseSheet(ws: ExcelJS.Worksheet, key: SheetKey): ParsedSheet {

    const cfg = SHEET_CONFIG[key];
    const rows: ParsedRow[] = [];

    ws.eachRow((row, rowNumber) => {
        if (rowNumber < cfg.dataStartRow) return;

        const fields: Record<string, string> = {};
        let hasData = false;

        cfg.cols.forEach((col, idx) => {
            let val = cellText(row.getCell(idx + 1));

            // Sanitization: Strip mailto: from emails
            if (col.field === "correo" && val.toLowerCase().startsWith("mailto:")) {
                val = val.replace(/^mailto:\s*/i, "").trim();
            }

            fields[col.field] = val;
            if (val) hasData = true;
        });

        if (!hasData) return; // skip empty rows

        const missingRequired = cfg.cols
            .filter(c => c.required && !fields[c.field])
            .map(c => c.label);

        rows.push({
            rowNumber,
            fields,
            missingRequired,
            isValid: missingRequired.length === 0,
        });
    });

    const validCount = rows.filter(r => r.isValid).length;
    return {
        key,
        label: cfg.label,
        rows,
        validCount,
        invalidCount: rows.length - validCount,
    };
}

// ─────────────────────────────────────────
// Utils
// ─────────────────────────────────────────

/** Parses a string of floors into a naturally sorted array of strings. */
export function parseFloors(floorsStr: string | null | undefined): string[] {
    if (!floorsStr) return [];
    
    // Excel may convert "13,14" into a decimal number 13.14
    // We replace the word " y " with a comma and split by natural delimiters
    const parsed = String(floorsStr)
        .replace(/\by\b/gi, ',')
        .split(/[,;|.]/)
        .map((s) => s.trim())
        .filter(Boolean);
        
    return [...new Set(parsed)].sort((a, b) => 
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
}

// ─────────────────────────────────────────
// Main export
// ─────────────────────────────────────────

export async function parseTemplateFile(file: File): Promise<ImportParseResult> {
    const buffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const sheets: ParsedSheet[] = [];

    for (const key of Object.keys(SHEET_CONFIG) as SheetKey[]) {
        const cfg = SHEET_CONFIG[key];
        const ws = wb.getWorksheet(cfg.name);
        if (!ws) continue;
        const parsed = parseSheet(ws, key);
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
