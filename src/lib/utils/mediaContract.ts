/**
 * mediaContract.ts
 *
 * Fuente única de verdad del contrato de columnas de "medio de acceso" en la
 * plantilla Excel. Tanto el generador (xlsxTemplate) como el importador
 * (xlsxImporter) y el análisis (matchAnalysis) derivan las columnas de esta
 * definición, de modo que añadir un medio al catálogo no requiere tocar código.
 */

export interface MediaInfo {
    key: string;
    name: string;
    has_floors: boolean;
    requires_responsiva: boolean;
    requires_programming: boolean;
    /** Si el medio usa un identificador/folio (por defecto true). */
    requires_identifier: boolean;
    /** Etiqueta del identificador (por ejemplo "Folio"). */
    identifier_label: string;
}

/** Extrae los medios activos del catálogo, normalizados. */
export function activeMediaTypes(mediaTypes: any[] | null | undefined): MediaInfo[] {
    const seen = new Set<string>();
    const out: MediaInfo[] = [];
    for (const m of mediaTypes || []) {
        if ((m as any).active === false) continue;
        const key = m.key as string;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({
            key,
            name: (m.name as string) || key,
            has_floors: m.has_floors === true,
            requires_responsiva: m.requires_responsiva !== false,
            requires_programming: m.requires_programming !== false,
            requires_identifier: m.requires_identifier !== false,
            identifier_label: (m.identifier_label as string) || 'Folio',
        });
    }
    return out;
}

/** Columna base + contenido de datos personales de la hoja ALTAS. */
export const ALTAS_BASE: { key: string; label: string; required?: boolean; sig: string }[] = [
    { key: 'apellidos', label: 'Apellidos', required: true, sig: 'A' },
    { key: 'nombres', label: 'Nombres', required: true, sig: 'B' },
    { key: 'tipo_personal', label: 'Tipo de Personal', required: true, sig: 'C' },
    { key: 'no_empleado', label: 'No. Empleado', sig: 'D' },
    { key: 'dependencia', label: 'Dependencia', required: true, sig: 'E' },
    { key: 'edificio', label: 'Edificio', required: true, sig: 'F' },
    { key: 'piso_base', label: 'Piso Base', required: true, sig: 'G' },
    { key: 'area', label: 'Área / Equipo', required: true, sig: 'H' },
    { key: 'puesto', label: 'Puesto', required: true, sig: 'I' },
];

/** Columnas de "requiere medio + pisos/folio" por medio (hoja ALTAS). */
export function altasMediaCols(media: MediaInfo): { key: string; label: string; required?: boolean }[] {
    if (media.has_floors) {
        return [
            { key: `${media.key}_req`, label: `¿Requiere Tarjeta ${media.name}?`, required: true },
            { key: `pisos_${media.key}`, label: `Pisos ${media.name} (separados por coma)` },
        ];
    }
    const cols: { key: string; label: string; required?: boolean }[] = [
        { key: `${media.key}_req`, label: `¿Requiere Tarjeta ${media.name}?`, required: true },
    ];
    if (media.requires_identifier) {
        cols.push({ key: `${media.key}_folio`, label: `${media.identifier_label} ${media.name} (opcional)` });
    }
    return cols;
}

/** Columnas de modificación de pisos por medio (solo medios con pisos). */
export function modifMediaCols(media: MediaInfo): { key: string; label: string; required?: boolean; accion?: boolean }[] {
    if (!media.has_floors) return [];
    return [
        { key: `accion_${media.key}`, label: `Acción ${media.name}`, accion: true },
        { key: `pisos_${media.key}`, label: `Pisos ${media.name} (coma)` },
    ];
}

/** Columnas de reposición por medio (todos los medios). */
export function reposMediaCols(media: MediaInfo): { key: string; label: string; required?: boolean }[] {
    const cols: { key: string; label: string; required?: boolean }[] = [
        { key: `reponer_${media.key}`, label: `¿Reponer ${media.name}?`, required: true },
    ];
    if (media.requires_identifier) {
        cols.push({ key: `folio_${media.key}`, label: `${media.identifier_label} ${media.name} Anterior (si lo conoce)` });
    }
    return cols;
}
