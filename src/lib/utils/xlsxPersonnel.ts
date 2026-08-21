import type * as ExcelJSTypes from 'exceljs';
import {
    addLogoToSheet,
    addBorder,
    calcPct,
    addSectionTitle,
    addKpiCard,
    addTableHeader,
    addTableRow,
    autoRowHeight,
} from './xlsxShared';    // Re-exportar tipos desde aquí

export type CardType = string;

const ALL_CARD_TYPES: CardType[] = ["P2000", "KONE", "AccessPRO"];

/**
 * Configuración de columnas por tipo de tarjeta para la hoja Directorio.
 * P2000/KONE incluyen folio + pisos; AccessPRO solo folio (no usa pisos).
 */
export const CARD_TYPE_COLUMNS: Record<
    CardType,
    { groupLabel: string; colors: { head: string; sub: string; fill: string }; headers: { key: string; width: number; label: string }[] }
> = {
    P2000: {
        groupLabel: 'ACCESO PUERTAS (P2000)',
        colors: { head: 'FFFEF3C7', sub: 'FF92400E', fill: 'FFFEFCE8' },
        headers: [
            { key: 'folioP2000', width: 20, label: 'FOLIO ACCESO' },
            { key: 'pisosP2000Text', width: 25, label: 'PISOS ASIGNADOS' },
        ],
    },
    KONE: {
        groupLabel: 'ACCESO ELEVADORES (KONE)',
        colors: { head: 'FFE0F2FE', sub: 'FF075985', fill: 'FFF0F9FF' },
        headers: [
            { key: 'folioKone', width: 22, label: 'FOLIO ACCESO' },
            { key: 'pisosKoneText', width: 25, label: 'PISOS ASIGNADOS' },
        ],
    },
    AccessPRO: {
        groupLabel: 'ACCESO ENTRADA (ACCESSPRO)',
        colors: { head: 'FFD1FAE5', sub: 'FF065F46', fill: 'FFF0FDF4' },
        headers: [
            { key: 'folioAccesspro', width: 20, label: 'FOLIO ACCESPRO' },
        ],
    },
};

export interface ExportPersonnelData {
    first_name: string;
    last_name: string;
    employee_no: string;
    building: string;
    dependency: string;
    area: string;
    position: string;
    floor: string;
    /** Pisos asignados agrupados por clave de tipo de medio. */
    floorsByMedia: Record<string, string[]>;
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
     * Vacío u omitido = todos (P2000 + KONE + AccessPRO).
     */
    cardTypes?: CardType[];
}

// ─── Statistics Sheet Helper ───────────────────────────────────────────
async function addStatsSheet(workbook: ExcelJSTypes.Workbook, data: ExportPersonnelData[], filterInfo: string, cardTypes?: CardType[]) {
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

    // Anchos de columna
    ws.columns = [
        { width: 4 },    // A espaciador
        { width: 30 },    // B etiqueta
        { width: 16 },    // C valor
        { width: 14 },    // D porcentaje
        { width: 4 },    // E espaciador
        { width: 30 },    // F etiqueta
        { width: 16 },    // G valor
        { width: 14 },    // H porcentaje
    ];

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
    const selected = cardTypes && cardTypes.length > 0 ? cardTypes : ALL_CARD_TYPES;
    const conP2000 = operativos.filter(p => p.cards?.some(c => c.type.toUpperCase() === 'P2000')).length;
    const conKone = operativos.filter(p => p.cards?.some(c => c.type.toUpperCase() === 'KONE')).length;
    const conAccesspro = operativos.filter(p => p.cards?.some(c => c.type.toUpperCase() === 'ACCESSPRO')).length;
    const sinP2000 = activosOperativos - conP2000;
    const sinKone = activosOperativos - conKone;
    const sinAccesspro = activosOperativos - conAccesspro;
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

    // Fila 1: Título
    ws.mergeCells('A1:H1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `       RESUMEN EJECUTIVO — DIRECTORIO DE PERSONAL${filterInfo}`;
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: C.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(1).height = 40;

    await addLogoToSheet(workbook, ws);

    // Fila 2: Meta
    ws.mergeCells('A2:H2');
    const metaCell = ws.getCell('A2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaCell.value = `Reporte generado: ${dateStr}  |  Total de registros: ${total}`;
    metaCell.font = { name: 'Arial', size: 9, color: { argb: C.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(2).height = 20;

    row = 4;

    // Sección 1: KPIs
    row = addSectionTitle(ws, row, '📊  INDICADORES CLAVE POR ESTADO', 'H', C);
    ws.getRow(row).height = 32;    addKpiCard(ws, row, 'B', 'TOTAL PERSONAL', total, C.blue);
    addKpiCard(ws, row, 'F', 'ACTIVOS OPERATIVOS', activosOperativos, C.emerald, calcPct(activosOperativos, total));
    row++;

    ws.getRow(row).height = 28;
    addKpiCard(ws, row, 'B', 'Activo/a', activos, C.emerald, calcPct(activos, total));
    addKpiCard(ws, row, 'F', 'Parcial', parciales, C.amber, calcPct(parciales, total));
    row++;

    ws.getRow(row).height = 28;
    addKpiCard(ws, row, 'B', 'Bloqueado/a', bloqueados, C.rose, calcPct(bloqueados, total));
    addKpiCard(ws, row, 'F', 'Sin Acceso', sinAcceso, C.slate, calcPct(sinAcceso, total));
    row++;

    ws.getRow(row).height = 28;
    addKpiCard(ws, row, 'B', 'Baja', bajas, C.slate, calcPct(bajas, total));
    row++; row++;

    // Sección 2: Cobertura de tarjetas
    row = addSectionTitle(ws, row, '🪪  COBERTURA DE TARJETAS DE ACCESO', 'H', C);
    ws.mergeCells(`B${row}:H${row}`);
    const noteCell = ws.getCell(`B${row}`);
    const typesLabel = selected.map((t) => (t === 'AccessPRO' ? 'AccessPRO' : t)).join(' + ');
    noteCell.value = `Calculado sobre personal operativo (Activo/a + Parcial): ${activosOperativos} personas  |  Tipos incluidos: ${typesLabel}`;
    noteCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: C.meta } };
    ws.getRow(row).height = 18;
    row++;

    const coverage: { label: string; con: number; sin: number; colors: { bg: string; fg: string } }[] = selected.map((t) => {
        if (t === 'P2000') return { label: 'P2000', con: conP2000, sin: sinP2000, colors: C.amber };
        if (t === 'KONE') return { label: 'KONE', con: conKone, sin: sinKone, colors: C.sky };
        return { label: 'AccessPRO', con: conAccesspro, sin: sinAccesspro, colors: C.emerald };
    });

    coverage.forEach((k) => {
        ws.getRow(row).height = 28;
        addKpiCard(ws, row, 'B', `Con tarjeta ${k.label}`, k.con, k.colors, calcPct(k.con, activosOperativos));
        addKpiCard(ws, row, 'F', `Sin tarjeta ${k.label}`, k.sin, k.sin > 0 ? C.rose : k.colors, calcPct(k.sin, activosOperativos));
        row++;
    });

    // "Sin ninguna tarjeta" ocupa el hueco cuando la cantidad de tipos seleccionados
    // es impar (1 o 3): mide personas sin NINGUNA tarjeta de los tipos seleccionados.
    const conCualquiera = operativos.filter((p) =>
        p.cards?.some((c) => selected.some((s) => s.toUpperCase() === c.type.toUpperCase()))
    ).length;
    const sinNinguna = activosOperativos - conCualquiera;

    for (let i = 0; i < coverage.length; i += 2) {
        const a = coverage[i];
        const b = coverage[i + 1];
        ws.getRow(row).height = 28;
        addKpiCard(ws, row, 'B', `% Cobertura ${a.label}`, calcPct(a.con, activosOperativos), activosOperativos > 0 && a.con / activosOperativos >= 0.9 ? C.emerald : a.colors);
        if (b) {
            addKpiCard(ws, row, 'F', `% Cobertura ${b.label}`, calcPct(b.con, activosOperativos), activosOperativos > 0 && b.con / activosOperativos >= 0.9 ? C.emerald : b.colors);
        } else {
            addKpiCard(ws, row, 'F', 'Sin ninguna tarjeta', sinNinguna, sinNinguna > 0 ? C.rose : C.emerald);
        }
        row++;
    }
    row++;

    // Sección 3: Por dependencia
    row = addSectionTitle(ws, row, '🏢  DISTRIBUCIÓN POR DEPENDENCIA', 'H', C);
    addTableHeader(ws, row, [{ col: 'B', label: 'DEPENDENCIA' }, { col: 'C', label: 'TOTAL' }, { col: 'D', label: '% DEL TOTAL' }, { col: 'F', label: 'ACTIVOS' }, { col: 'G', label: 'INACTIVOS' }, { col: 'H', label: '% ACTIVOS' }], C.violet, C.white);
    row++;
    depEntries.forEach(([dep, stats]) => {
        addTableRow(ws, row, [{ col: 'B', value: dep }, { col: 'C', value: stats.total }, { col: 'D', value: calcPct(stats.total, total) }, { col: 'F', value: stats.activos }, { col: 'G', value: stats.inactivos }, { col: 'H', value: calcPct(stats.activos, stats.total) }], C.violet, C.sectionHead, C.white);
        row++;
    });

    // Sección 4: Por edificio
    if (buildEntries.length > 0) {
        row = addSectionTitle(ws, row, '🏗️  DISTRIBUCIÓN POR EDIFICIO', 'H', C);
        addTableHeader(ws, row, [{ col: 'B', label: 'EDIFICIO' }, { col: 'C', label: 'TOTAL' }, { col: 'D', label: '% DEL TOTAL' }], C.sky, C.white);
        row++;
        buildEntries.forEach(([building, count]) => {
            addTableRow(ws, row, [{ col: 'B', value: building }, { col: 'C', value: count }, { col: 'D', value: calcPct(count, total) }], C.sky, C.sectionHead, C.white);
            row++;
        });
    }

    // Sección 5: Calidad de datos
    row = addSectionTitle(ws, row, '⚠️  CALIDAD DE DATOS — CAMPOS INCOMPLETOS', 'H', C);
    addTableHeader(ws, row, [{ col: 'B', label: 'CAMPO' }, { col: 'C', label: 'SIN DATO' }, { col: 'D', label: '% INCOMPLETO' }], C.rose, C.white);
    row++;
    const qualityRows: [string, number][] = [
        ['Correo Electrónico', sinEmail],
        ['Jornada Laboral', sinSchedule],
        ['Puesto', sinPosition],
        ['Equipo / Área', sinArea],
        ['Piso Base', sinFloor],
    ];
    qualityRows.forEach(([label, count]) => {
        const colors = count > 0 ? C.rose : C.emerald;
        addTableRow(ws, row, [{ col: 'B', value: label }, { col: 'C', value: count }, { col: 'D', value: calcPct(count, total) }], colors, C.sectionHead, C.white);
        row++;
    });
    const totalMissing = qualityRows.reduce((sum, [, c]) => sum + c, 0);
    const maxPossible = total * qualityRows.length;
    ws.getRow(row).height = 24;
    const summCols = [
        { col: 'B', value: 'TOTAL CAMPOS VACÍOS' },
        { col: 'C', value: `${totalMissing} / ${maxPossible}` },
        { col: 'D', value: calcPct(totalMissing, maxPossible) },
    ];
    summCols.forEach(({ col, value }, i) => {
        const cell = ws.getCell(`${col}${row}`);
        cell.value = value;
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: C.sectionHead } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.slate.bg } };
        cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0 };
        addBorder(cell);
    });
    row++; row++;

    // Sección 6: Accesos especiales
    if (accessEntries.length > 0) {
        row = addSectionTitle(ws, row, '🔐  ACCESOS ESPECIALES', 'H', C);
        ws.getRow(row).height = 28;
        addKpiCard(ws, row, 'B', 'Personas con acceso especial', conAccesoEspecial, C.pink, calcPct(conAccesoEspecial, total));
        row++;
        addTableHeader(ws, row, [{ col: 'B', label: 'TIPO DE ACCESO' }, { col: 'C', label: 'PERSONAS' }, { col: 'D', label: '% DEL TOTAL' }], C.pink, C.white);
        row++;
        accessEntries.forEach(([access, count]) => {
            addTableRow(ws, row, [{ col: 'B', value: access }, { col: 'C', value: count }, { col: 'D', value: calcPct(count, total) }], C.pink, C.sectionHead, C.white);
            row++;
        });
    }

    // Sección 7: Horario
    if (schedEntries.length > 0) {
        row = addSectionTitle(ws, row, '🕐  DISTRIBUCIÓN DE JORNADA LABORAL', 'H', C);
        addTableHeader(ws, row, [{ col: 'B', label: 'JORNADA' }, { col: 'C', label: 'PERSONAS' }, { col: 'D', label: '% DEL TOTAL' }], C.emerald, C.white);
        row++;
        schedEntries.forEach(([sched, count]) => {
            addTableRow(ws, row, [{ col: 'B', value: sched }, { col: 'C', value: count }, { col: 'D', value: calcPct(count, total) }], C.emerald, C.sectionHead, C.white);
            row++;
        });
    }

    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
    ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1 };
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

    const addDataSheet = async (sheetName: string, sheetData: ExportPersonnelData[], filterInfo: string, cardTypes?: CardType[]) => {
        const safeName = sheetName.replace(/[:\\/?*[\]]/g, '').substring(0, 31) || 'Hoja';
        const worksheet = workbook.addWorksheet(safeName);
        const selected = cardTypes && cardTypes.length > 0 ? cardTypes : ALL_CARD_TYPES;
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
        const cardColumns = selected.flatMap((t) =>
            CARD_TYPE_COLUMNS[t].headers.map((h) => ({ key: h.key, width: h.width }))
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
        titleCell.value = `       DIRECTORIO DE PERSONAL - NEXA${filterInfo}`;
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
        selected.forEach((t) => {
            const cfg = CARD_TYPE_COLUMNS[t];
            const start = typeCol;
            const end = typeCol + cfg.headers.length - 1;
            groups.push({ label: cfg.groupLabel, range: `${colLetter(start)}3:${colLetter(end)}3`, colors: cfg.colors });
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
            ...selected.flatMap((t) => CARD_TYPE_COLUMNS[t].headers.map((h) => h.label)),
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
            const folioP2000 = person.cards?.filter(c => c.type.toUpperCase() === 'P2000').map(c => c.folio).join(', ') || '-';
            const folioKone = person.cards?.filter(c => c.type.toUpperCase() === 'KONE').map(c => c.folio).join(', ') || '-';
            const folioAccesspro = person.cards?.filter(c => c.type.toUpperCase() === 'ACCESSPRO').map(c => c.folio).join(', ') || '-';

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
            if (selected.includes('P2000')) {
                rowData.folioP2000 = folioP2000;
                rowData.pisosP2000Text = person.floorsByMedia?.p2000?.join(', ') || '-';
            }
            if (selected.includes('KONE')) {
                rowData.folioKone = folioKone;
                rowData.pisosKoneText = person.floorsByMedia?.kone?.join(', ') || '-';
            }
            if (selected.includes('AccessPRO')) {
                rowData.folioAccesspro = folioAccesspro;
            }

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

    await addStatsSheet(workbook, data, filterDescription, options?.cardTypes);

    if (options?.splitByDependency) {
        const groupedData: Record<string, ExportPersonnelData[]> = {};
        data.forEach(person => {
            const dep = person.dependency || 'Sin Dependencia';
            if (!groupedData[dep]) groupedData[dep] = [];
            groupedData[dep].push(person);
        });
        const deps = Object.keys(groupedData).sort();
        for (const dep of deps) {
            await addDataSheet(dep, groupedData[dep], filterDescription, options?.cardTypes);
        }
        fileNameParts.push('Por_Dependencia');
    } else {
        await addDataSheet('Directorio', data, filterDescription, options?.cardTypes);
    }

    const finalFileName = `${fileNameParts.join('_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    if (returnBuffer) {
        return { buffer: buffer as ArrayBuffer, filename: finalFileName };
    }
    saveAsFunction(new Blob([buffer]), finalFileName);
}
