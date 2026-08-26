import type * as ExcelJSTypes from 'exceljs';
import {
    addLogoToSheet,
    calcPct,
    addTableHeader,
    addTableRow,
    autoRowHeight,
} from './xlsxShared';    // Re-exportar tipos desde aquí
import { floorsForKey } from '../services/accessAssignments';
import type { FloorGroup } from '../types';
import { settingsState } from '../stores';

export type CardType = string;

/** Configuración de columnas por tipo de medio para la hoja Directorio. */
export interface MediaExportConfig {
    key: string;
    name: string;
    has_floors: boolean;
    colors: { head: string; sub: string; fill: string };
    groupLabel: string;
    headers: { key: string; width: number; label: string }[];
    /** Campo donde se guarda el folio (ej. folioP2000). */
    folioField: string;
    /** Campo donde se guardan los pisos (medios con pisos). */
    floorsField?: string;
}

const DEFAULT_MEDIAS: { key: string; name: string; has_floors: boolean }[] = [
    { key: 'p2000', name: 'P2000', has_floors: true },
    { key: 'kone', name: 'KONE', has_floors: true },
    { key: 'accesspro', name: 'AccessPRO', has_floors: false },
];

const MEDIA_PALETTE: { head: string; sub: string; fill: string }[] = [
    { head: 'FFFEF3C7', sub: 'FF92400E', fill: 'FFFEFCE8' }, // ámbar
    { head: 'FFE0F2FE', sub: 'FF075985', fill: 'FFF0F9FF' }, // sky
    { head: 'FFD1FAE5', sub: 'FF065F46', fill: 'FFF0FDF4' }, // esmeralda
    { head: 'FFDBEAFE', sub: 'FF1E40AF', fill: 'FFEFF6FF' }, // azul
    { head: 'FFEDE9FE', sub: 'FF5B21B6', fill: 'FFFAF5FF' }, // violeta
    { head: 'FFFCE7F3', sub: 'FF9D174D', fill: 'FFFFF1F2' }, // rosa
    { head: 'FFFED7AA', sub: 'FF9A3412', fill: 'FFFFF7ED' }, // naranja
];

const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function buildMediaConfig(media: { key: string; name: string; has_floors: boolean }, idx: number): MediaExportConfig {
    const colors = MEDIA_PALETTE[idx % MEDIA_PALETTE.length];
    const base = pascal(media.key);
    const headers: MediaExportConfig['headers'] = media.has_floors
        ? [
            { key: `folio${base}`, width: 20, label: 'FOLIO ACCESO' },
            { key: `pisos${base}Text`, width: 25, label: 'PISOS ASIGNADOS' },
        ]
        : [
            { key: `folio${base}`, width: 20, label: 'FOLIO ACCESO' },
        ];
    return {
        key: media.key,
        name: media.name,
        has_floors: media.has_floors,
        colors,
        groupLabel: `ACCESO ${media.name.toUpperCase()}${media.has_floors ? ' (PISOS)' : ''}`,
        headers,
        folioField: `folio${base}`,
        floorsField: media.has_floors ? `pisos${base}Text` : undefined,
    };
}

/**
 * Construye la configuración de columnas por medio a partir del catálogo.
 * Si no se pasan `mediaTypes`, usa la configuración conocida por defecto
 * (P2000/KONE/AccessPRO) para preservar el comportamiento anterior.
 */
function buildMediaConfigs(mediaTypes?: any[]): MediaExportConfig[] {
    if (mediaTypes && mediaTypes.length > 0) {
        return mediaTypes.map((m, i) =>
            buildMediaConfig({ key: m.key, name: m.name || m.key, has_floors: m.has_floors === true }, i),
        );
    }
    return DEFAULT_MEDIAS.map((m, i) => buildMediaConfig(m, i));
}

/** Configuración por defecto (compatibilidad con exportaciones previas). */
export const CARD_TYPE_COLUMNS: Record<CardType, MediaExportConfig> = Object.fromEntries(
    buildMediaConfigs().map((c) => [c.name, c]),
);

export interface ExportPersonnelData {
    first_name: string;
    last_name: string;
    employee_no: string;
    building: string;
    dependency: string;
    area: string;
    position: string;
    floor: string;
    /** Pisos asignados agrupados por tipo de medio concreto. */
    floors: FloorGroup[];
    status: string;
    specialAccesses: string[];
    schedule: {
        days: string;
        entry: string;
        exit: string;
    } | null;
    email?: string | null;
    cards?: { type: string; folio: string }[];
    // Permitir cualquier otra prop de Person para evitar errores de casting estrictos durante desarrollo
    [key: string]: any;
}

export interface ExportOptions {
    filters?: {
        status?: string;
        dependency?: string;
        building?: string;
        search?: string;
    },
    splitByDependency?: boolean;
    /**
     * Tipos de tarjeta cuyas columnas (Directorio) y KPIs (Resumen) se incluyen.
     * Vacío u omitido = todos (según el catálogo o la config por defecto).
     */
    cardTypes?: CardType[];
    /**
     * Catálogo de medios del sistema (`{key, name, has_floors, ...}`).
     * Define las columnas por medio; si se omite se usa la config por defecto.
     */
    mediaTypes?: any[];
}

// ─── Statistics Sheet Helper ───────────────────────────────────────────
async function addStatsSheet(workbook: ExcelJSTypes.Workbook, data: ExportPersonnelData[], filterInfo: string, cardTypes?: CardType[], mediaTypes?: any[]) {
    const ws = workbook.addWorksheet('Resumen Ejecutivo');

    const C = {
        title: 'FF1E293B',
        meta: 'FF64748B',
        separator: 'FF94A3B8',
        white: 'FFFFFFFF',
        sectionHead: 'FF0F172A',
        emerald: { bg: 'FFD1FAE5', fg: 'FF065F46' },
        rose: { bg: 'FFFEE2E2', fg: 'FF991B1B' },
        amber: { bg: 'FFFEF3C7', fg: 'FF92400E' },
        sky: { bg: 'FFE0F2FE', fg: 'FF075985' },
        violet: { bg: 'FFEDE9FE', fg: 'FF5B21B6' },
        slate: { bg: 'FFF1F5F9', fg: 'FF334155' },
        blue: { bg: 'FFDBEAFE', fg: 'FF1E40AF' },
        pink: { bg: 'FFFCE7F3', fg: 'FF9D174D' },
    };

    // Rejilla en landscape: paneles contiguos de (etiqueta | valor | %) separados por columnas delgadas.
    // PANELES[i] = [colEtiqueta, colValor, colPct]
    const PANELS: string[][] = [
        ['B', 'C', 'D'],
        ['F', 'G', 'H'],
        ['J', 'K', 'L'],
    ];
    ws.columns = [
        { width: 2 },    // A margen
        { width: 22 },   // B
        { width: 12 },   // C
        { width: 10 },   // D
        { width: 3 },    // E separador
        { width: 22 },   // F
        { width: 12 },   // G
        { width: 10 },   // H
        { width: 3 },    // I separador
        { width: 22 },   // J
        { width: 12 },   // K
        { width: 10 },   // L
        { width: 3 },    // M separador
        { width: 2 },    // N margen
    ];

    // Stat de hero: etiqueta + valor + % en un panel (3 celdas, sin merge).
    const stat = (row: number, panel: number, label: string, value: number | string, pct?: string, colors?: { bg: string; fg: string }): void => {
        const [lc, vc, pc] = PANELS[panel];
        const c = colors || { bg: 'FFDBEAFE', fg: 'FF1E40AF' };
        [
            { col: lc, value: label, size: 9, bold: false, align: 'left', indent: 1 },
            { col: vc, value: value, size: 18, bold: true, align: 'center' },
            { col: pc, value: pct || '', size: 9, bold: false, align: 'center' },
        ].forEach(({ col, value: v, size, bold, align, indent }) => {
            const cell = ws.getCell(`${col}${row}`);
            cell.value = v;
            cell.font = { name: 'Arial', size, bold, color: { argb: c.fg } };
            cell.alignment = { vertical: 'middle', horizontal: align as any, indent: indent ?? 0 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.bg } };
            cell.border = { top: { style: 'thin', color: { argb: c.fg } }, bottom: { style: 'thin', color: { argb: c.fg } }, left: { style: 'thin', color: { argb: c.fg } }, right: { style: 'thin', color: { argb: c.fg } } };
        });
        ws.getRow(row).height = 46;
    };

    // Título de panel (sin merge): texto en el primer col + línea separadora en el panel.
    const panelTitle = (row: number, panel: number, text: string, colors: { sectionHead: string; separator: string }): void => {
        const [lc, vc, pc] = PANELS[panel];
        const cell = ws.getCell(`${lc}${row}`);
        cell.value = text;
        cell.font = { name: 'Arial', bold: true, size: 11, color: { argb: colors.sectionHead } };
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        [lc, vc, pc].forEach((col) => {
            const x = ws.getCell(`${col}${row}`);
            x.border = { top: { style: 'medium', color: { argb: colors.separator } }, left: { style: 'thin', color: { argb: colors.separator } }, right: { style: 'thin', color: { argb: colors.separator } } };
        });
        ws.getRow(row).height = 26;
    };

    // Cabecera de tabla en un panel (a partir de una lista de etiquetas).
    const tableHeader = (row: number, panel: number, labels: string[], colors: { bg: string; fg: string }): void => {
        const cols = PANELS[panel].slice(0, labels.length).map((col, i) => ({ col, label: labels[i] }));
        addTableHeader(ws, row, cols, colors, '#FFFFFFFF');
    };

    // Fila de tabla en un panel (valores, usa los N primeros cols del panel).
    const tableRow = (row: number, panel: number, values: (string | number)[], colors: { bg: string; fg: string }): void => {
        const cols = PANELS[panel].slice(0, values.length).map((col, i) => ({ col, value: values[i] }));
        addTableRow(ws, row, cols, colors, '#0F172A', '#FFFFFFFF');
    };

    // Colores por estado (máquina de 8).
    const stateColors = (status: string): { bg: string; fg: string } => {
        switch (status) {
            case 'Activo/a': return { bg: 'FFD1FAE5', fg: 'FF065F46' };
            case 'Parcial': return { bg: 'FFFEF3C7', fg: 'FF92400E' };
            case 'En proceso': return { bg: 'FFE0F2FE', fg: 'FF075985' };
            case 'Media de otro edificio': return { bg: 'FFEDE9FE', fg: 'FF5B21B6' };
            case 'Otro edificio en proceso': return { bg: 'FFE0E7FF', fg: 'FF3730A3' };
            case 'Sin Acceso': return { bg: 'FFF1F5F9', fg: 'FF334155' };
            case 'Bloqueado/a': return { bg: 'FFFEE2E2', fg: 'FF991B1B' };
            case 'Baja': return { bg: 'FFE2E8F0', fg: 'FF475569' };
            default: return { bg: 'FFF1F5F9', fg: 'FF334155' };
        }
    };

    let row = 1;

    // ── Compute all stats ──
    const total = data.length;
    const activos = data.filter(p => p.status === 'Activo/a').length;
    const parciales = data.filter(p => p.status === 'Parcial').length;
    const bloqueados = data.filter(p => p.status === 'Bloqueado/a').length;
    const sinAcceso = data.filter(p => p.status === 'Sin Acceso').length;
    const bajas = data.filter(p => p.status === 'Baja').length;
    const activosOperativos = activos + parciales;
    const operativos = data.filter(p => p.status === 'Activo/a' || p.status === 'Parcial');
    const enProceso = data.filter(p => p.status === 'En proceso').length;
    const mediaOtro = data.filter(p => p.status === 'Media de otro edificio').length;
    const otroEnProceso = data.filter(p => p.status === 'Otro edificio en proceso').length;
    const noActivos = Math.max(0, total - activosOperativos);
    const selected = (cardTypes && cardTypes.length > 0 ? cardTypes : null);
    const mediaConfigs = buildMediaConfigs(mediaTypes).filter((m) => !selected || selected.includes(m.name));
    const conByMedia = (name: string) => operativos.filter(p => p.cards?.some(c => c.type.toUpperCase() === name.toUpperCase())).length;
    const sinByMedia = (name: string) => activosOperativos - conByMedia(name);
    const sinEmail = data.filter(p => !p.email).length;
    const sinSchedule = data.filter(p => !p.schedule?.days).length;
    const sinPosition = data.filter(p => !p.position).length;
    const sinArea = data.filter(p => !p.area).length;
    const sinFloor = data.filter(p => !p.floor).length;

    const depMap: Record<string, { total: number; activos: number; inactivos: number }> = {};
    data.forEach(p => {
        const dep = p.dependency || 'Sin Dependencia';
        if (!depMap[dep]) depMap[dep] = { total: 0, activos: 0, inactivos: 0 };
        depMap[dep].total++;
        if (p.status === 'Activo/a' || p.status === 'Parcial') depMap[dep].activos++;
        else depMap[dep].inactivos++;
    });
    const depEntries = Object.entries(depMap).sort((a, b) => b[1].total - a[1].total);

    const accessMap: Record<string, number> = {};
    data.forEach(p => {
        (p.specialAccesses || []).forEach(a => {
            accessMap[a] = (accessMap[a] || 0) + 1;
        });
    });
    const conAccesoEspecial = data.filter(p => p.specialAccesses?.length > 0).length;
    const accessEntries = Object.entries(accessMap).sort((a, b) => b[1] - a[1]);

    const schedMap: Record<string, number> = {};
    data.forEach(p => {
        const key = p.schedule?.days || null;
        if (key) schedMap[key] = (schedMap[key] || 0) + 1;
    });
    const schedEntries = Object.entries(schedMap).sort((a, b) => b[1] - a[1]);

    const buildMap: Record<string, number> = {};
    data.forEach(p => {
        const key = p.building || 'Sin Edificio';
        buildMap[key] = (buildMap[key] || 0) + 1;
    });
    const buildEntries = Object.entries(buildMap).sort((a, b) => b[1] - a[1]);

    // Fila 1: Título (sin merge)
    const titleCell = ws.getCell('B1');
    titleCell.value = `RESUMEN EJECUTIVO — DIRECTORIO DE PERSONAL${filterInfo}`;
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: C.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(1).height = 40;

    await addLogoToSheet(workbook, ws);

    // Fila 2: Meta (sin merge)
    const metaCell = ws.getCell('B2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaCell.value = `Reporte generado: ${dateStr}  |  Total de registros: ${total}`;
    metaCell.font = { name: 'Arial', size: 9, color: { argb: C.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    ws.getRow(2).height = 20;
    row = 4;

    // Hero KPIs (3 stats lado a lado, sin merge)
    stat(row, 0, 'TOTAL PERSONAL', total, calcPct(total, total), { bg: 'FFDBEAFE', fg: 'FF1E40AF' });
    stat(row, 1, 'ACTIVOS OPERATIVOS', activosOperativos, calcPct(activosOperativos, total), { bg: 'FFD1FAE5', fg: 'FF065F46' });
    stat(row, 2, 'NO ACTIVOS', noActivos, calcPct(noActivos, total), { bg: 'FFFEE2E2', fg: 'FF991B1B' });
    row += 3;

    const stateOrder = [
        'Activo/a', 'Parcial', 'En proceso', 'Media de otro edificio',
        'Otro edificio en proceso', 'Sin Acceso', 'Bloqueado/a', 'Baja',
    ];
    const stateCounts: Record<string, number> = {
        'Activo/a': activos,
        'Parcial': parciales,
        'En proceso': enProceso,
        'Media de otro edificio': mediaOtro,
        'Otro edificio en proceso': otroEnProceso,
        'Sin Acceso': sinAcceso,
        'Bloqueado/a': bloqueados,
        'Baja': bajas,
    };

    const qualityRows: [string, number][] = [
        ['Correo Electrónico', sinEmail],
        ['Jornada Laboral', sinSchedule],
        ['Puesto', sinPosition],
        ['Equipo / Área', sinArea],
        ['Piso Base', sinFloor],
    ];

    // ── Fila de tablas cortas lado a lado: Estado | Edificio | Calidad de datos ──
    const bandStart = row;
    // Panel 0: Distribución por Estado
    let rEstado = bandStart;
    panelTitle(rEstado, 0, '📊 DISTRIBUCIÓN POR ESTADO', C); rEstado++;
    tableHeader(rEstado, 0, ['ESTADO', 'PERSONAS', '%'], C.violet); rEstado++;
    stateOrder.forEach((s, i) => {
        const colors = stateColors(s);
        tableRow(rEstado, 0, [s, stateCounts[s], stateCounts[s] > 0 ? calcPct(stateCounts[s], total) : '0%'], colors);
        ws.getCell(`B${rEstado}`).font = { name: 'Arial', size: 9, bold: false, color: { argb: colors.fg } };
        rEstado++;
    });
    // Panel 1: Por Edificio
    let rEdificio = bandStart;
    panelTitle(rEdificio, 1, '🏗️ POR EDIFICIO', C); rEdificio++;
    tableHeader(rEdificio, 1, ['EDIFICIO', 'TOTAL', '%'], C.sky); rEdificio++;
    buildEntries.forEach(([building, count]) => { tableRow(rEdificio, 1, [building, count, calcPct(count, total)], { bg: 'FFE0F2FE', fg: 'FF075985' }); rEdificio++; });
    // Panel 2: Calidad de datos
    let rCalidad = bandStart;
    panelTitle(rCalidad, 2, '⚠️ CALIDAD DE DATOS', C); rCalidad++;
    tableHeader(rCalidad, 2, ['CAMPO', 'SIN DATO', '%'], C.rose); rCalidad++;
    qualityRows.forEach(([label, count]) => {
        const colors = count > 0 ? { bg: 'FFFEE2E2', fg: 'FF991B1B' } : { bg: 'FFD1FAE5', fg: 'FF065F46' };
        tableRow(rCalidad, 2, [label, count, calcPct(count, total)], colors); rCalidad++;
    });
    const totalMissing = qualityRows.reduce((sum, [, c]) => sum + c, 0);
    const maxPossible = total * qualityRows.length;
    tableRow(rCalidad, 2, ['TOTAL VACÍOS', `${totalMissing} / ${maxPossible}`, calcPct(totalMissing, maxPossible)], { bg: 'FFF1F5F9', fg: 'FF334155' }); rCalidad++;
    row = Math.max(rEstado, rEdificio, rCalidad) + 3;

    // ── Fila de tablas medianas lado a lado: Cobertura | Jornada | Accesos especiales ──
    const band2 = row;
    // Panel 0: Cobertura de tarjetas
    let rCob = band2;
    panelTitle(rCob, 0, '🪪 COBERTURA DE TARJETAS', C); rCob++;
    tableHeader(rCob, 0, ['MEDIO', 'CON', '%'], C.sky); rCob++;
    mediaConfigs.forEach((m) => {
        const con = conByMedia(m.name);
        tableRow(rCob, 0, [`Tienen ${m.name}`, con, calcPct(con, activosOperativos)], { bg: m.colors.fill, fg: m.colors.sub }); rCob++;
    });
    const conCualquiera = operativos.filter((p) =>
        p.cards?.some((c) => mediaConfigs.some((m) => m.name.toUpperCase() === c.type.toUpperCase()))
    ).length;
    const sinNinguna = activosOperativos - conCualquiera;
    tableRow(rCob, 0, ['Sin ninguna tarjeta', sinNinguna, calcPct(sinNinguna, activosOperativos)], { bg: 'FFF1F5F9', fg: 'FF334155' }); rCob++;
    // Panel 1: Jornada laboral
    let rJor = band2;
    panelTitle(rJor, 1, '🕐 JORNADA LABORAL', C); rJor++;
    tableHeader(rJor, 1, ['JORNADA', 'PERSONAS', '%'], C.emerald); rJor++;
    schedEntries.forEach(([sched, count]) => { tableRow(rJor, 1, [sched, count, calcPct(count, total)], { bg: 'FFD1FAE5', fg: 'FF065F46' }); rJor++; });
    if (schedEntries.length === 0) { tableRow(rJor, 1, ['—', 0, '0%'], { bg: 'FFF1F5F9', fg: 'FF334155' }); rJor++; }
    // Panel 2: Accesos especiales
    let rAcc = band2;
    panelTitle(rAcc, 2, '🔐 ACCESOS ESPECIALES', C); rAcc++;
    tableHeader(rAcc, 2, ['TIPO', 'PERSONAS', '%'], C.pink); rAcc++;
    accessEntries.forEach(([access, count]) => { tableRow(rAcc, 2, [access, count, calcPct(count, total)], { bg: 'FFFCE7F3', fg: 'FF9D174D' }); rAcc++; });
    if (accessEntries.length === 0) { tableRow(rAcc, 2, ['—', 0, '0%'], { bg: 'FFF1F5F9', fg: 'FF334155' }); rAcc++; }
    row = Math.max(rCob, rJor, rAcc) + 2;

    // ── Banda ancha al fondo: Por dependencia (B..H, con E como separador interno; sin merge) ──
    const depTitle = ws.getCell(`B${row}`);
    depTitle.value = '🏢 DISTRIBUCIÓN POR DEPENDENCIA';
    depTitle.font = { name: 'Arial', bold: true, size: 11, color: { argb: C.sectionHead } };
    depTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ['B', 'C', 'D', 'F', 'G', 'H'].forEach((col) => {
        const x = ws.getCell(`${col}${row}`);
        x.border = { top: { style: 'medium', color: { argb: C.separator } }, left: { style: 'thin', color: { argb: C.separator } }, right: { style: 'thin', color: { argb: C.separator } } };
    });
    ws.getRow(row).height = 26;
    row++;
    addTableHeader(ws, row, [{ col: 'B', label: 'DEPENDENCIA' }, { col: 'C', label: 'TOTAL' }, { col: 'D', label: '% DEL TOTAL' }, { col: 'F', label: 'ACTIVOS' }, { col: 'G', label: 'INACTIVOS' }, { col: 'H', label: '% ACTIVOS' }], C.violet, C.white);
    row++;
    depEntries.forEach(([dep, stats]) => {
        addTableRow(ws, row, [{ col: 'B', value: dep }, { col: 'C', value: stats.total }, { col: 'D', value: calcPct(stats.total, total) }, { col: 'F', value: stats.activos }, { col: 'G', value: stats.inactivos }, { col: 'H', value: calcPct(stats.activos, stats.total) }], C.violet, C.sectionHead, C.white);
        row++;
    });
    row++;

    // ── Banda amplia: Personas por Piso (Edificio | Piso | Personas | %) ──
    const floorMap = new Map<string, { building: string; floor: string; count: number }>();
    data.forEach((p) => {
        const b = p.building || 'Sin Edificio';
        const f = p.floor || 'Sin Piso';
        const key = `${b}|${f}`;
        const cur = floorMap.get(key);
        if (cur) cur.count++;
        else floorMap.set(key, { building: b, floor: f, count: 1 });
    });
    const floorEntries = [...floorMap.values()].sort((a, b) =>
        a.building.localeCompare(b.building)
        || a.floor.localeCompare(b.floor, undefined, { numeric: true, sensitivity: 'base' }),
    );

    const floorTitle = ws.getCell(`B${row}`);
    floorTitle.value = '🏢 PERSONAS POR PISO';
    floorTitle.font = { name: 'Arial', bold: true, size: 11, color: { argb: C.sectionHead } };
    floorTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ['B', 'C', 'D', 'F', 'G', 'H'].forEach((col) => {
        const x = ws.getCell(`${col}${row}`);
        x.border = { top: { style: 'medium', color: { argb: C.separator } }, left: { style: 'thin', color: { argb: C.separator } }, right: { style: 'thin', color: { argb: C.separator } } };
    });
    ws.getRow(row).height = 26;
    row++;
    addTableHeader(ws, row, [{ col: 'B', label: 'EDIFICIO' }, { col: 'C', label: 'PISO' }, { col: 'D', label: 'PERSONAS' }, { col: 'F', label: '% DEL TOTAL' }], C.sky, C.white);
    row++;
    floorEntries.forEach(({ building, floor, count }) => {
        addTableRow(ws, row, [{ col: 'B', value: building }, { col: 'C', value: floor }, { col: 'D', value: count }, { col: 'F', value: calcPct(count, total) }], { bg: 'FFE0F2FE', fg: 'FF075985' }, C.sectionHead, C.white);
        row++;
    });

    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
}

export async function exportPersonnelToExcel(data: ExportPersonnelData[], options?: ExportOptions, returnBuffer?: false): Promise<void>;
export async function exportPersonnelToExcel(data: ExportPersonnelData[], options: ExportOptions | undefined, returnBuffer: true): Promise<{ buffer: ArrayBuffer; filename: string }>;
export async function exportPersonnelToExcel(data: ExportPersonnelData[], options?: ExportOptions, returnBuffer?: boolean): Promise<void | { buffer: ArrayBuffer; filename: string }> {
    const [ExcelJSModule, { saveAs: saveAsFunction }] = await Promise.all([
        import('exceljs'),
        import('file-saver')
    ]);
    const workbook = new (ExcelJSModule.default || ExcelJSModule).Workbook();

    const COLORS = {
        title: 'FF1E293B',
        meta: 'FF64748B',
        separator: 'FF94A3B8',
        personal: { head: 'FFDBEAFE', sub: 'FF1E40AF', fill: 'FFEFF6FF' },
        location: { head: 'FFF1F5F9', sub: 'FF334155', fill: 'FFF8FAFC' },
        amber: { head: 'FFFEF3C7', sub: 'FF92400E', fill: 'FFFEFCE8' },
        sky: { head: 'FFE0F2FE', sub: 'FF075985', fill: 'FFF0F9FF' },
        status: { head: 'FFEDE9FE', sub: 'FF5B21B6', fill: 'FFFAF5FF' },
        additional: { head: 'FFFCE7F3', sub: 'FF9D174D', fill: 'FFFFF1F2' },
        emerald: { head: 'FFD1FAE5', sub: 'FF065F46', fill: 'FFF0FDF4' },
    };

    const addDataSheet = async (sheetName: string, sheetData: ExportPersonnelData[], filterInfo: string, cardTypes?: CardType[], mediaTypes?: any[]) => {
        const safeName = sheetName.replace(/[:\\/?*[\]]/g, '').substring(0, 31) || 'Hoja';
        const worksheet = workbook.addWorksheet(safeName);
        const selected = (cardTypes && cardTypes.length > 0 ? cardTypes : null);
        const mediaConfigs = buildMediaConfigs(mediaTypes).filter((m) => !selected || selected.includes(m.name));
        // Conversor base-26 (A, B, …, Z, AA, AB) para columnas más allá de la Z.
        const colLetter = (n: number) => {
            let s = '';
            while (n > 0) {
                const r = (n - 1) % 26;
                s = String.fromCharCode(65 + r) + s;
                n = Math.floor((n - 1) / 26);
            }
            return s;
        };

        const baseColumns: { key: string; width: number }[] = [
            { key: 'last_name', width: 25 },
            { key: 'first_name', width: 25 },
            { key: 'employee_no', width: 15 },
            { key: 'building', width: 22 },
            { key: 'dependency', width: 28 },
            { key: 'area', width: 22 },
            { key: 'position', width: 28 },
            { key: 'floor', width: 12 },
        ];
        const cardColumns = mediaConfigs.flatMap((m) =>
            m.headers.map((h) => ({ key: h.key, width: h.width }))
        );
        const tailColumns: { key: string; width: number }[] = [
            { key: 'status', width: 15 },
            { key: 'specialAccessesText', width: 28 },
            { key: 'days', width: 22 },
            { key: 'entry', width: 14 },
            { key: 'exit', width: 14 },
            { key: 'email', width: 35 },
        ];
        worksheet.columns = [...baseColumns, ...cardColumns, ...tailColumns];
        const lastCol = colLetter(worksheet.columns.length);

        worksheet.mergeCells(`A1:${lastCol}1`);
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `       DIRECTORIO DE PERSONAL - ${settingsState.orgName.toUpperCase()}${filterInfo}`;
        titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
        worksheet.getRow(1).height = 40;

        await addLogoToSheet(workbook, worksheet);

        worksheet.mergeCells(`A2:${lastCol}2`);
        const metaCell = worksheet.getCell('A2');
        const dateStr = new Date().toLocaleDateString('es-MX', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        metaCell.value = `Reporte generado: ${dateStr}  |  Registros en esta hoja: ${sheetData.length}`;
        metaCell.font = { name: 'Arial', size: 9, color: { argb: COLORS.meta } };
        metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
        worksheet.getRow(2).height = 20;

        const groups: { label: string; range: string; colors: { head: string; sub: string; fill: string } }[] = [
            { label: 'DATOS PERSONALES', range: 'A3:C3', colors: COLORS.personal },
            { label: 'UBICACIÓN Y PUESTO', range: 'D3:H3', colors: COLORS.location },
        ];
        // Las columnas de tarjetas empiezan justo después de baseColumns (A–H).
        let typeCol = baseColumns.length + 1; // 9 → I
        mediaConfigs.forEach((m) => {
            const start = typeCol;
            const end = typeCol + m.headers.length - 1;
            groups.push({ label: m.groupLabel, range: `${colLetter(start)}3:${colLetter(end)}3`, colors: m.colors });
            typeCol = end + 1;
        });
        const tailStart = typeCol;
        groups.push({ label: 'ESTADO', range: `${colLetter(tailStart)}3:${colLetter(tailStart)}3`, colors: COLORS.status });
        groups.push({ label: 'ADICIONALES', range: `${colLetter(tailStart + 1)}3:${colLetter(tailStart + 1)}3`, colors: COLORS.additional });
        groups.push({ label: 'JORNADA LABORAL', range: `${colLetter(tailStart + 2)}3:${colLetter(tailStart + 4)}3`, colors: COLORS.emerald });
        groups.push({ label: 'CONTACTO', range: `${colLetter(tailStart + 5)}3:${colLetter(tailStart + 5)}3`, colors: COLORS.personal });

        // Inverso de colLetter: convierte letra(s) de columna a índice 1-based (A→1, Z→26, AA→27).
        const colNum = (letter: string) =>
            letter.split('').reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
        const groupEndCols = new Set<number>();
        groups.forEach((g) => {
            const [start, end] = g.range.replace(/[0-9]/g, '').split(':');
            groupEndCols.add(colNum(end || start));
        });

        groups.forEach(group => {
            worksheet.mergeCells(group.range);
            const cell = worksheet.getCell(group.range.split(':')[0]);
            cell.value = group.label;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.head } };
            cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: group.colors.sub } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'medium', color: { argb: COLORS.separator } }
            };
        });

        const headerRow = worksheet.getRow(4);
        headerRow.height = 30;
        const headerLabels = [
            'APELLIDOS', 'NOMBRES', 'NO. EMPLEADO', 'EDIFICIO', 'DEPENDENCIA', 'EQUIPO', 'PUESTO', 'PISO BASE',
            ...mediaConfigs.flatMap((m) => m.headers.map((h) => h.label)),
            'ESTADO', 'ACCESOS ESPECIALES', 'DIAS LABORALES', 'ENTRADA', 'SALIDA', 'CORREO ELECTRÓNICO'
        ];

        headerLabels.forEach((label, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = label;
            const group = groups.find(g => {
                const col = String.fromCharCode(65 + i);
                const [start, end] = g.range.replace(/[0-9]/g, '').split(':');
                return col >= (start || 'A') && col <= (end || start || 'A');
            }) || groups[0];

            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.sub } };
            cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 8 };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

            const isGroupEnd = groupEndCols.has(i + 1);
            cell.border = {
                bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
                right: { style: isGroupEnd ? 'medium' : 'thin', color: { argb: isGroupEnd ? COLORS.separator : 'FFFFFFFF' } }
            };
        });

        sheetData.forEach((person) => {
            const rowData: Record<string, string> = {
                last_name: person.last_name || '-',
                first_name: person.first_name || '-',
                employee_no: person.employee_no || '-',
                building: person.building || '-',
                dependency: person.dependency || '-',
                area: person.area || '-',
                position: person.position || '-',
                floor: person.floor || '-',
                status: person.status || '-',
                specialAccessesText: person.specialAccesses?.join(', ') || '-',
                days: person.schedule?.days || '-',
                entry: person.schedule?.entry || '-',
                exit: person.schedule?.exit || '-',
                email: person.email || '-'
            };
            mediaConfigs.forEach((m) => {
                const folio = person.cards?.filter(c => c.type.toUpperCase() === m.name.toUpperCase()).map(c => c.folio).join(', ') || '-';
                rowData[m.folioField] = folio;
                if (m.floorsField) {
                    rowData[m.floorsField] = floorsForKey(person.floors, m.key).join(', ') || "-";
                }
            });

            const row = worksheet.addRow(rowData);

            const isInactive = person.status === 'Baja' || person.status === 'Sin Acceso';

            row.eachCell((cell, colNumber) => {
                const colLetter = String.fromCharCode(64 + colNumber);
                const group = groups.find(g => {
                    const parts = g.range.replace(/[0-9]/g, '').split(':');
                    return colLetter >= parts[0] && colLetter <= (parts[1] || parts[0]);
                }) || groups[0];

                cell.font = {
                    name: 'Arial', size: 9,
                    color: { argb: isInactive ? 'FF64748B' : 'FF111827' },
                    italic: isInactive
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

                if (isInactive) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.fill } };
                }

                const isGroupEnd = groupEndCols.has(colNumber);
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: isGroupEnd ? 'medium' : 'thin', color: { argb: isGroupEnd ? COLORS.separator : 'FFCBD5E1' } }
                };

                if (cell.value === '-' || cell.value === 'N/A' || !cell.value) {
                    cell.value = '[SIN DATO]';
                    cell.font = { ...cell.font, color: { argb: 'FFB91C1C' }, italic: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                }
            });

            // Auto height: calculate row height based on wrapped text content
            autoRowHeight(worksheet, row.number, 22);

            const statusCell = row.getCell('status');
            if (person.status === 'Activo/a' && !isInactive) {
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
                statusCell.font = { color: { argb: 'FF166534' }, bold: true, name: 'Arial', size: 9 };
            } else if (person.status === 'Parcial' && !isInactive) {
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                statusCell.font = { color: { argb: 'FF92400E' }, bold: true, name: 'Arial', size: 9 };
            } else if (person.status === 'Bloqueado/a') {
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                statusCell.font = { color: { argb: 'FF991B1B' }, bold: true, name: 'Arial', size: 9 };
            } else if (isInactive) {
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                statusCell.font = { color: { argb: 'FF475569' }, italic: true, name: 'Arial', size: 9 };
            }
        });

        worksheet.autoFilter = `A4:${lastCol}4`;
        worksheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 4 }];
    };

    let filterDescription = '';
    let fileNameParts: string[] = ['Directorio'];

    if (options?.filters) {
        const { status, dependency, building, search } = options.filters;
        const activeFilters: string[] = [];
        if (status && status !== 'Todos') {
            activeFilters.push(`Estado: ${status}`);
            fileNameParts.push(status.replace('/', '-'));
        }
        if (dependency) {
            activeFilters.push(`Dep: ${dependency}`);
            fileNameParts.push(dependency);
        }
        if (building) {
            activeFilters.push(`Edificio: ${building}`);
            fileNameParts.push(building);
        }
        if (search) {
            activeFilters.push(`Búsqueda: "${search}"`);
            fileNameParts.push(`Busqueda_${search.substring(0, 10)}`);
        }
        if (activeFilters.length > 0) {
            filterDescription = `      -  Filtros: ${activeFilters.join(' - ')}`;
        }
    }

    await addStatsSheet(workbook, data, filterDescription, options?.cardTypes, options?.mediaTypes);

    if (options?.splitByDependency) {
        const groupedData: Record<string, ExportPersonnelData[]> = {};
        data.forEach(person => {
            const dep = person.dependency || 'Sin Dependencia';
            if (!groupedData[dep]) groupedData[dep] = [];
            groupedData[dep].push(person);
        });
        const deps = Object.keys(groupedData).sort();
        for (const dep of deps) {
            await addDataSheet(dep, groupedData[dep], filterDescription, options?.cardTypes, options?.mediaTypes);
        }
        fileNameParts.push('Por_Dependencia');
    } else {
        await addDataSheet('Directorio', data, filterDescription, options?.cardTypes, options?.mediaTypes);
    }

    const finalFileName = `${fileNameParts.join('_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    if (returnBuffer) {
        return { buffer: buffer as ArrayBuffer, filename: finalFileName };
    }
    saveAsFunction(new Blob([buffer]), finalFileName);
}
