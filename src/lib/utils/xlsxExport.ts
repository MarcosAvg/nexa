/**
 * xlsxExport.ts
 *
 * Punto de entrada para exportación a Excel.
 * Re-exporta funciones desde módulos especializados.
 * Mantiene exportKoneUsageToExcel aquí porque es importado
 * por xlsxKoneUsage.ts para evitar dependencia circular.
 */

export type {
    ExportPersonnelData,
    ExportOptions,
} from './xlsxPersonnel';

export {
    exportPersonnelToExcel,
} from './xlsxPersonnel';

export {
    exportResponsivasToExcel,
} from './xlsxResponsivas';

export {
    exportCardsToExcel,
} from './xlsxCards';

export {
    exportHistoryToExcel,
} from './xlsxHistory';

export type {
    CardlessRegistryExportRow,
    CardlessRegistryExportFilters,
} from './xlsxRegistry';

export {
    exportCardlessRegistryToExcel,
} from './xlsxRegistry';

// ─── KONE Usage Export (stays here — used by xlsxKoneUsage.ts) ────────

import type * as ExcelJSTypes from 'exceljs';
import type { KoneUsageMatchResult, KoneUsageMatchedEntry } from './xlsxKoneUsage';
import {
    addLogoToSheet,
    addBorder,
    calcPct,
    addSectionTitle,
    addKpiCard,
    addTableHeader,
    addTableRow,
} from './xlsxShared';

async function addKoneSummarySheet(
    workbook: ExcelJSTypes.Workbook,
    matchedData: KoneUsageMatchedEntry[],
    sheetName: string,
    title: string,
    usageThreshold: number
) {
    const ws = workbook.addWorksheet(sheetName);

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
        cyan: { bg: 'FFCFFAFE', fg: 'FF155E75' },
    };

    ws.columns = [
        { width: 4 },
        { width: 30 },
        { width: 16 },
        { width: 14 },
        { width: 30 },
        { width: 16 },
        { width: 14 },
    ];

    let row = 1;

    const total = matchedData.length;
    const conteos = matchedData.map(m => m.conteo);
    const totalUsos = conteos.reduce((sum, c) => sum + c, 0);
    const promedio = total > 0 ? (totalUsos / total) : 0;
    const mediana = (() => {
        if (total === 0) return 0;
        const sorted = [...conteos].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    })();

    const ranges = [
        { label: '0 usos', filter: (c: number) => c === 0 },
        { label: '1 – 10 usos', filter: (c: number) => c >= 1 && c <= 10 },
        { label: '11 – 50 usos', filter: (c: number) => c >= 11 && c <= 50 },
        { label: '51 – 100 usos', filter: (c: number) => c >= 51 && c <= 100 },
        { label: '101+ usos', filter: (c: number) => c > 100 },
    ];

    const noUtilizadas = matchedData.filter(m => m.conteo === 0);
    const bajoUsoData = matchedData.filter(m => m.conteo > 0 && m.conteo < usageThreshold);

    const depMap: Record<string, { count: number; totalUsos: number }> = {};
    matchedData.forEach(m => {
        const dep = m.person.dependency || 'Sin Dependencia';
        if (!depMap[dep]) depMap[dep] = { count: 0, totalUsos: 0 };
        depMap[dep].count++;
        depMap[dep].totalUsos += m.conteo;
    });
    const depEntries = Object.entries(depMap).sort((a, b) => b[1].totalUsos - a[1].totalUsos);

    const buildMap: Record<string, { count: number; totalUsos: number }> = {};
    matchedData.forEach(m => {
        const bld = m.person.building || 'Sin Edificio';
        if (!buildMap[bld]) buildMap[bld] = { count: 0, totalUsos: 0 };
        buildMap[bld].count++;
        buildMap[bld].totalUsos += m.conteo;
    });
    const buildEntries = Object.entries(buildMap).sort((a, b) => b[1].totalUsos - a[1].totalUsos);

    ws.mergeCells('A1:G1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `       ${title}`;
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: C.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(1).height = 40;

    await addLogoToSheet(workbook, ws);

    ws.mergeCells('A2:G2');
    const metaCell = ws.getCell('A2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaCell.value = `Reporte generado: ${dateStr}  |  Personal en esta hoja: ${total}`;
    metaCell.font = { name: 'Arial', size: 9, color: { argb: C.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(2).height = 20;

    row = 4;    row = addSectionTitle(ws, row, '📊  INDICADORES CLAVE DE USO', 'G', C);
    ws.getRow(row).height = 32;
    addKpiCard(ws, row, 'B', 'PERSONAL REGISTRADO', total, C.blue);
    addKpiCard(ws, row, 'E', 'TOTAL DE USOS', totalUsos, C.sky);
    row++;

    ws.getRow(row).height = 28;
    addKpiCard(ws, row, 'B', 'Promedio de usos', promedio.toFixed(1), C.emerald);
    addKpiCard(ws, row, 'E', 'Mediana de usos', mediana.toFixed(1), C.emerald);
    row++;

    ws.getRow(row).height = 28;
    addKpiCard(ws, row, 'B', 'Tarjetas No Utilizadas', noUtilizadas.length, noUtilizadas.length > 0 ? C.rose : C.emerald, calcPct(noUtilizadas.length, total));
    addKpiCard(ws, row, 'E', 'Personal bajo uso', bajoUsoData.length, bajoUsoData.length > 0 ? C.amber : C.emerald, calcPct(bajoUsoData.length, total));
    row++; row++;

    row = addSectionTitle(ws, row, '📈  DISTRIBUCIÓN POR RANGO DE USO', 'G', C);
    addTableHeader(ws, row, [
        { col: 'B', label: 'RANGO' },
        { col: 'C', label: 'PERSONAS' },
        { col: 'D', label: '% DEL TOTAL' },
        { col: 'E', label: 'USOS EN RANGO' },
        { col: 'F', label: '% DE USOS' },
    ], C.cyan, C.white);
    row++;

    ranges.forEach(range => {
        const personas = matchedData.filter(m => range.filter(m.conteo));
        const usosEnRango = personas.reduce((sum, m) => sum + m.conteo, 0);
        addTableRow(ws, row, [
            { col: 'B', value: range.label },
            { col: 'C', value: personas.length },
            { col: 'D', value: calcPct(personas.length, total) },
            { col: 'E', value: usosEnRango },
            { col: 'F', value: calcPct(usosEnRango, totalUsos) },
        ], C.cyan, C.sectionHead, C.white);
        row++;
    });

    row = addSectionTitle(ws, row, '🏢  DISTRIBUCIÓN POR DEPENDENCIAS', 'G', C);
    addTableHeader(ws, row, [
        { col: 'B', label: 'DEPENDENCIA' },
        { col: 'C', label: 'PERSONAS' },
        { col: 'D', label: 'TOTAL USOS' },
        { col: 'E', label: 'PROMEDIO USOS' },
        { col: 'F', label: '% DEL TOTAL' },
    ], C.violet, C.white);
    row++;

    depEntries.forEach(([dep, stats], i) => {
        const avgUsos = stats.count > 0 ? (stats.totalUsos / stats.count).toFixed(1) : '0';
        addTableRow(ws, row, [
            { col: 'B', value: dep },
            { col: 'C', value: stats.count },
            { col: 'D', value: stats.totalUsos },
            { col: 'E', value: avgUsos },
            { col: 'F', value: calcPct(stats.totalUsos, totalUsos) },
        ], i % 2 === 0 ? C.violet : C.slate, C.sectionHead, C.white);
        row++;
    });

    if (buildEntries.length > 0) {
        row = addSectionTitle(ws, row, '🏗️  DISTRIBUCIÓN POR EDIFICIO', 'G', C);
        addTableHeader(ws, row, [
            { col: 'B', label: 'EDIFICIO' },
            { col: 'C', label: 'PERSONAS' },
            { col: 'D', label: 'USOS TOTALES' },
            { col: 'E', label: 'PROMEDIO' },
            { col: 'F', label: '% DE USOS' },
        ], C.sky, C.white);
        row++;

        buildEntries.forEach(([bld, stats]) => {
            addTableRow(ws, row, [
                { col: 'B', value: bld },
                { col: 'C', value: stats.count },
                { col: 'D', value: stats.totalUsos },
                { col: 'E', value: (stats.totalUsos / stats.count).toFixed(1) },
                { col: 'F', value: calcPct(stats.totalUsos, totalUsos) },
            ], C.sky, C.sectionHead, C.white);
            row++;
        });
    }

    const statusMap: Record<string, { count: number; totalUsos: number; noUtilizadas: number }> = {};
    matchedData.forEach(m => {
        const st = m.person.status || 'Sin Estado';
        if (!statusMap[st]) statusMap[st] = { count: 0, totalUsos: 0, noUtilizadas: 0 };
        statusMap[st].count++;
        statusMap[st].totalUsos += m.conteo;
        if (m.conteo === 0) statusMap[st].noUtilizadas++;
    });
    const statusEntries = Object.entries(statusMap).sort((a, b) => b[1].count - a[1].count);

    if (statusEntries.length > 0) {
        row = addSectionTitle(ws, row, '👤  USO POR ESTADO DEL PERSONAL', 'G', C);
        addTableHeader(ws, row, [
            { col: 'B', label: 'ESTADO' },
            { col: 'C', label: 'PERSONAS' },
            { col: 'D', label: 'TOTAL USOS' },
            { col: 'E', label: 'PROMEDIO' },
            { col: 'F', label: 'NO UTILIZADAS' },
        ], C.amber, C.white);
        row++;

        statusEntries.forEach(([status, stats]) => {
            const avg = stats.count > 0 ? (stats.totalUsos / stats.count).toFixed(1) : '0';
            addTableRow(ws, row, [
                { col: 'B', value: status },
                { col: 'C', value: stats.count },
                { col: 'D', value: stats.totalUsos },
                { col: 'E', value: avg },
                { col: 'F', value: stats.noUtilizadas },
            ], C.amber, C.sectionHead, C.white);
            row++;
        });
    }

    const inactivityRanges = [
        { label: '0 – 7 días', filter: (d: number | null) => d !== null && d >= 0 && d <= 7 },
        { label: '8 – 30 días', filter: (d: number | null) => d !== null && d >= 8 && d <= 30 },
        { label: '31 – 60 días', filter: (d: number | null) => d !== null && d >= 31 && d <= 60 },
        { label: '61 – 90 días', filter: (d: number | null) => d !== null && d >= 61 && d <= 90 },
        { label: '90+ días', filter: (d: number | null) => d !== null && d > 90 },
        { label: 'Sin registro de uso', filter: (d: number | null) => d === null },
    ];

    row = addSectionTitle(ws, row, '🕐  DISTRIBUCIÓN POR DÍAS SIN USO', 'G', C);
    addTableHeader(ws, row, [
        { col: 'B', label: 'RANGO INACTIVIDAD' },
        { col: 'C', label: 'PERSONAS' },
        { col: 'D', label: '% DEL TOTAL' },
    ], C.rose, C.white);
    row++;

    inactivityRanges.forEach(range => {
        const personas = matchedData.filter(m => range.filter(m.diasInactividad));
        addTableRow(ws, row, [
            { col: 'B', value: range.label },
            { col: 'C', value: personas.length },
            { col: 'D', value: calcPct(personas.length, total) },
        ], C.rose, C.sectionHead, C.white);
        row++;
    });

    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
    ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1 };
}

export async function exportKoneUsageToExcel(
    matchResult: KoneUsageMatchResult,
    usageThreshold?: number,
    dependencyFilter?: string,
    returnBuffer?: false
): Promise<void>;
export async function exportKoneUsageToExcel(
    matchResult: KoneUsageMatchResult,
    usageThreshold: number | undefined,
    dependencyFilter: string | undefined,
    returnBuffer: true
): Promise<{ buffer: ArrayBuffer; filename: string }>;
export async function exportKoneUsageToExcel(
    matchResult: KoneUsageMatchResult,
    usageThreshold: number = 10,
    dependencyFilter?: string,
    returnBuffer?: boolean
): Promise<void | { buffer: ArrayBuffer; filename: string }> {
    const [ExcelJSModule, { saveAs: saveAsFunction }] = await Promise.all([
        import('exceljs'),
        import('file-saver')
    ]);
    const workbook = new (ExcelJSModule.default || ExcelJSModule).Workbook();
    const worksheet = workbook.addWorksheet('Guía');

    const COLORS = {
        title: 'FF1E293B',
        meta: 'FF64748B',
        separator: 'FF94A3B8',
        personal: { head: 'FFDBEAFE', sub: 'FF1E40AF', fill: 'FFEFF6FF' },
        amber: { head: 'FFFEF3C7', sub: 'FF92400E', fill: 'FFFEFCE8' },
        sky: { head: 'FFE0F2FE', sub: 'FF075985', fill: 'FFF0F9FF' },
        emerald: { head: 'FFD1FAE5', sub: 'FF065F46', fill: 'FFF0FDF4' },
        rose: { head: 'FFFEE2E2', sub: 'FF991B1B', fill: 'FFFFF1F2' },
        slate: { head: 'FFF1F5F9', sub: 'FF334155', fill: 'FFF8FAFC' },
        violet: { head: 'FFEDE9FE', sub: 'FF5B21B6', fill: 'FFFAF5FF' },
        indigo: { head: 'FFE0E7FF', sub: 'FF3730A3', fill: 'FFEEF2FF' },
    };

    const LAST_COL = 'O';

    // ─── Filter Data ───
    let filteredMatched = matchResult.matched;
    let filterSuffix = '';

    if (dependencyFilter && dependencyFilter !== 'Todas') {
        filteredMatched = matchResult.matched.filter(
            m => m.person.dependency === dependencyFilter
        );
        filterSuffix = ` — ${dependencyFilter}`;
    }

    // ─── Column Config ───
    worksheet.columns = [
        { key: 'num', width: 6 },
        { key: 'last_name', width: 20 },
        { key: 'first_name', width: 20 },
        { key: 'employee_no', width: 14 },
        { key: 'dependency', width: 28 },
        { key: 'building', width: 20 },
        { key: 'area', width: 20 },
        { key: 'position', width: 24 },
        { key: 'floor', width: 10 },
        { key: 'folio', width: 18 },
        { key: 'conteo', width: 12 },
        { key: 'daysInactive', width: 16 },
        { key: 'usageLevel', width: 16 },
        { key: 'status', width: 14 },
        { key: 'specialAccesses', width: 28 },
    ];

    // ── Row 1: Title ──
    worksheet.mergeCells(`A1:${LAST_COL}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `       REPORTE DE USO DE ELEVADORES (KONE)${filterSuffix}`;
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 40;

    await addLogoToSheet(workbook, worksheet);

    // ── Row 2: Meta ──
    worksheet.mergeCells(`A2:${LAST_COL}2`);
    const metaCell = worksheet.getCell('A2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaCell.value = [
        `Reporte generado: ${dateStr}`,
        `Registros: ${filteredMatched.length}`,
        `Importados: ${matchResult.totalImported} folios únicos`,
        `Umbral bajo uso: ${usageThreshold} usos`,
    ].join('  |  ');
    metaCell.font = { name: 'Arial', size: 9, color: { argb: COLORS.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(2).height = 20;

    // ── Row 3: Sub-header note ──
    worksheet.mergeCells(`A3:${LAST_COL}3`);
    const legendCell = worksheet.getCell('A3');
    legendCell.value = '  🟢 Alto uso (≥50)  |  🟡 Uso moderado (10-49)  |  🟠 Bajo uso (1-9)  |  🔴 Sin uso (0)  |  ⚪ Sin datos de uso';
    legendCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: COLORS.meta } };
    legendCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.slate.head } };
    legendCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(3).height = 18;

    // ── Row 4: Super-Headers ──
    const groups = [
        { label: '#', range: 'A4:A4', colors: COLORS.slate, endCol: 1 },
        { label: 'DATOS PERSONALES', range: 'B4:D4', colors: COLORS.personal, endCol: 4 },
        { label: 'UBICACIÓN Y PUESTO', range: 'E4:I4', colors: COLORS.amber, endCol: 9 },
        { label: 'TARJETA KONE', range: 'J4:J4', colors: COLORS.sky, endCol: 10 },
        { label: 'USO DE ELEVADORES', range: 'K4:M4', colors: COLORS.emerald, endCol: 13 },
        { label: 'PERSONAL', range: 'N4:O4', colors: COLORS.violet, endCol: 15 },
    ];

    groups.forEach((group) => {
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
            right: { style: 'medium', color: { argb: COLORS.separator } },
        };
    });
    worksheet.getRow(4).height = 24;

    // ── Row 5: Sub-Headers ──
    const subHeaders = [
        { label: 'NO.', group: groups[0], col: 1 },
        { label: 'APELLIDOS', group: groups[1], col: 2 },
        { label: 'NOMBRES', group: groups[1], col: 3 },
        { label: '# EMPLEADO', group: groups[1], col: 4 },
        { label: 'DEPENDENCIA', group: groups[2], col: 5 },
        { label: 'EDIFICIO', group: groups[2], col: 6 },
        { label: 'EQUIPO / ÁREA', group: groups[2], col: 7 },
        { label: 'PUESTO', group: groups[2], col: 8 },
        { label: 'PISO', group: groups[2], col: 9 },
        { label: 'FOLIO KONE', group: groups[3], col: 10 },
        { label: 'CONTEO', group: groups[4], col: 11 },
        { label: 'INACTIVIDAD', group: groups[4], col: 12 },
        { label: 'NIVEL DE USO', group: groups[4], col: 13 },
        { label: 'ESTADO', group: groups[5], col: 14 },
        { label: 'ACCESOS ESP.', group: groups[5], col: 15 },
    ];
    const groupEndCols = new Set(groups.map((g) => g.endCol));

    const subHeaderRow = worksheet.getRow(5);
    subHeaderRow.height = 32;
    subHeaders.forEach(({ label, group, col }) => {
        const cell = subHeaderRow.getCell(col);
        cell.value = label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.sub } };
        cell.font = { name: 'Arial', bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
            right: {
                style: groupEndCols.has(col) ? 'medium' : 'thin',
                color: { argb: groupEndCols.has(col) ? COLORS.separator : 'FFFFFFFF' },
            },
        };
    });

    worksheet.autoFilter = `A5:${LAST_COL}5`;

    // ── Data Rows ──
    filteredMatched.forEach((entry, idx) => {
        const usageLevel = entry.conteo === 0 ? 'Sin uso' :
            entry.conteo < usageThreshold ? 'Bajo uso' :
            entry.conteo < 50 ? 'Moderado' : 'Alto uso';

        let usageColors = COLORS.emerald;
        if (entry.conteo === 0) usageColors = COLORS.rose;
        else if (entry.conteo < usageThreshold) usageColors = COLORS.amber;

        const rowData = {
            num: idx + 1,
            last_name: entry.person.last_name || '',
            first_name: entry.person.first_name || '',
            employee_no: entry.person.employee_no || '',
            dependency: entry.person.dependency || '',
            building: entry.person.building || '',
            area: entry.person.area || '',
            position: entry.person.position || '',
            floor: entry.person.floor || '',
            folio: entry.folio,
            conteo: entry.conteo,
            daysInactive: entry.diasInactividad !== null ? `${entry.diasInactividad} días` : 'Sin datos',
            usageLevel,
            status: entry.person.status || '',
            specialAccesses: entry.person.specialAccesses?.join(', ') || '',
        };

        const row = worksheet.addRow(rowData);
        row.height = 24;

        row.eachCell((cell, colNumber) => {
            const subHeader = subHeaders.find((s) => s.col === colNumber);
            const group = subHeader?.group ?? groups[0];

            cell.font = { name: 'Arial', size: 9, color: { argb: 'FF111827' } };
            cell.alignment = {
                vertical: 'middle',
                horizontal: [1, 4, 9, 10, 11, 12, 13, 14].includes(colNumber) ? 'center' : 'left',
                indent: [2, 3, 5, 6, 7, 8, 15].includes(colNumber) ? 1 : 0,
                wrapText: colNumber === 8 || colNumber === 15,
            };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.fill } };
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: {
                    style: groupEndCols.has(colNumber) ? 'medium' : 'thin',
                    color: { argb: groupEndCols.has(colNumber) ? COLORS.separator : 'FFCBD5E1' },
                },
            };

            // Columna de conteo (11) — badge de uso
            if (colNumber === 11) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: usageColors.head } };
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: usageColors.sub } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }

            // Columna de nivel de uso (13) — badge de etiqueta
            if (colNumber === 13) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: usageColors.head } };
                cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: usageColors.sub } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }

            // Columna de estado (14) — badge
            if (colNumber === 14) {
                let stColors = COLORS.slate;
                if (entry.person.status === 'Activo/a') stColors = COLORS.emerald;
                else if (entry.person.status === 'Bloqueado/a') stColors = COLORS.rose;
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stColors.head } };
                cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: stColors.sub } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }
        });
    });

    // ── Summary Row ──
    const summaryIdx = worksheet.rowCount + 1;
    const summaryRow = worksheet.getRow(summaryIdx);
    summaryRow.height = 28;
    const summaryData: (string | number)[] = [
        '', 'TOTAL', '', `${filteredMatched.length}`,
        '', '', '', '', '',
        '', filteredMatched.reduce((sum, m) => sum + m.conteo, 0),
        '', '', '', '',
    ];
    summaryData.forEach((value, i) => {
        const cell = summaryRow.getCell(i + 1);
        cell.value = value;
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLORS.title } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.slate.head } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'medium', color: { argb: COLORS.separator } },
            bottom: { style: 'medium', color: { argb: COLORS.separator } },
        };
    });

    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }];
    worksheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };

    // ─── Summary sheet ───
    await addKoneSummarySheet(workbook, filteredMatched, 'Resumen — Uso KONE', `RESUMEN DE USO — ELEVADORES KONE${filterSuffix}`, usageThreshold);

    // ─── "Directorio con Conteo" sheet ───
    const ws2 = workbook.addWorksheet('Directorio con Conteo');
    ws2.columns = [
        // ... same as the "Guía" sheet columns
        { key: 'num', width: 6 },
        { key: 'last_name', width: 20 },
        { key: 'first_name', width: 20 },
        { key: 'employee_no', width: 14 },
        { key: 'dependency', width: 28 },
        { key: 'building', width: 20 },
        { key: 'area', width: 20 },
        { key: 'position', width: 24 },
        { key: 'floor', width: 10 },
        { key: 'folio', width: 18 },
        { key: 'conteo', width: 12 },
        { key: 'daysInactive', width: 16 },
        { key: 'usageLevel', width: 16 },
        { key: 'status', width: 14 },
        { key: 'specialAccesses', width: 28 },
    ];

    // Fila 1: Título + Logo para esta hoja
    ws2.mergeCells('A1:O1');
    const titleCell2 = ws2.getCell('A1');
    titleCell2.value = `       DIRECTORIO CON CONTEO DE USO ${filterSuffix}`;
    titleCell2.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
    titleCell2.alignment = { vertical: 'middle', horizontal: 'left' };
    ws2.getRow(1).height = 40;

    await addLogoToSheet(workbook, ws2);

    // Fila 2: Meta
    ws2.mergeCells('A2:O2');
    const metaCell2 = ws2.getCell('A2');
    metaCell2.value = `Reporte generado: ${dateStr}  |  Registros: ${filteredMatched.length}  |  Umbral bajo uso: ${usageThreshold}`;
    metaCell2.font = { name: 'Arial', size: 9, color: { argb: COLORS.meta } };
    metaCell2.alignment = { vertical: 'middle', horizontal: 'left' };
    ws2.getRow(2).height = 20;

    // Filas de datos (mismos datos, diseño diferente — hoja tipo directorio enriquecido)
    // Super-encabezado Fila 3
    const groups2 = [
        { label: '#', range: 'A3:A3', colors: COLORS.slate, endCol: 1 },
        { label: 'DATOS PERSONALES', range: 'B3:D3', colors: COLORS.personal, endCol: 4 },
        { label: 'UBICACIÓN Y PUESTO', range: 'E3:I3', colors: COLORS.amber, endCol: 9 },
        { label: 'TARJETA KONE', range: 'J3:J3', colors: COLORS.sky, endCol: 10 },
        { label: 'USO DE ELEVADORES', range: 'K3:M3', colors: COLORS.emerald, endCol: 13 },
        { label: 'PERSONAL', range: 'N3:O3', colors: COLORS.violet, endCol: 15 },
    ];

    groups2.forEach((group) => {
        ws2.mergeCells(group.range);
        const cell = ws2.getCell(group.range.split(':')[0]);
        cell.value = group.label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.head } };
        cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: group.colors.sub } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'medium', color: { argb: COLORS.separator } },
        };
    });
    ws2.getRow(3).height = 24;

    // Sub-encabezado Fila 4
    const subHeaders2 = [
        { label: 'NO.', group: groups2[0], col: 1 },
        { label: 'APELLIDOS', group: groups2[1], col: 2 },
        { label: 'NOMBRES', group: groups2[1], col: 3 },
        { label: '# EMPLEADO', group: groups2[1], col: 4 },
        { label: 'DEPENDENCIA', group: groups2[2], col: 5 },
        { label: 'EDIFICIO', group: groups2[2], col: 6 },
        { label: 'EQUIPO / ÁREA', group: groups2[2], col: 7 },
        { label: 'PUESTO', group: groups2[2], col: 8 },
        { label: 'PISO', group: groups2[2], col: 9 },
        { label: 'FOLIO KONE', group: groups2[3], col: 10 },
        { label: 'CONTEO', group: groups2[4], col: 11 },
        { label: 'INACTIVIDAD', group: groups2[4], col: 12 },
        { label: 'NIVEL DE USO', group: groups2[4], col: 13 },
        { label: 'ESTADO', group: groups2[5], col: 14 },
        { label: 'ACCESOS ESP.', group: groups2[5], col: 15 },
    ];
    const groupEndCols2 = new Set(groups2.map((g) => g.endCol));

    const subHeaderRow2 = ws2.getRow(4);
    subHeaderRow2.height = 32;
    subHeaders2.forEach(({ label, group, col }) => {
        const cell = subHeaderRow2.getCell(col);
        cell.value = label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.sub } };
        cell.font = { name: 'Arial', bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
            right: {
                style: groupEndCols2.has(col) ? 'medium' : 'thin',
                color: { argb: groupEndCols2.has(col) ? COLORS.separator : 'FFFFFFFF' },
            },
        };
    });

    ws2.autoFilter = 'A4:O4';

    filteredMatched.forEach((entry, idx) => {
        const usageLevel = entry.conteo === 0 ? 'Sin uso' :
            entry.conteo < usageThreshold ? 'Bajo uso' :
            entry.conteo < 50 ? 'Moderado' : 'Alto uso';

        const usageColors = entry.conteo === 0 ? COLORS.rose :
            entry.conteo < usageThreshold ? COLORS.amber : COLORS.emerald;

        const rowData = {
            num: idx + 1,
            last_name: entry.person.last_name || '',
            first_name: entry.person.first_name || '',
            employee_no: entry.person.employee_no || '',
            dependency: entry.person.dependency || '',
            building: entry.person.building || '',
            area: entry.person.area || '',
            position: entry.person.position || '',
            floor: entry.person.floor || '',
            folio: entry.folio,
            conteo: entry.conteo,
            daysInactive: entry.diasInactividad !== null ? `${entry.diasInactividad} días` : 'Sin datos',
            usageLevel,
            status: entry.person.status || '',
            specialAccesses: entry.person.specialAccesses?.join(', ') || '',
        };

        const row = ws2.addRow(rowData);
        row.height = 24;

        row.eachCell((cell, colNumber) => {
            const subHeader = subHeaders2.find((s) => s.col === colNumber);
            const group = subHeader?.group ?? groups2[0];

            cell.font = { name: 'Arial', size: 9, color: { argb: 'FF111827' } };
            cell.alignment = {
                vertical: 'middle',
                horizontal: [1, 4, 9, 10, 11, 12, 13, 14].includes(colNumber) ? 'center' : 'left',
                indent: [2, 3, 5, 6, 7, 8, 15].includes(colNumber) ? 1 : 0,
                wrapText: colNumber === 8 || colNumber === 15,
            };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.fill } };
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: {
                    style: groupEndCols2.has(colNumber) ? 'medium' : 'thin',
                    color: { argb: groupEndCols2.has(colNumber) ? COLORS.separator : 'FFCBD5E1' },
                },
            };

            if (colNumber === 11) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: usageColors.head } };
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: usageColors.sub } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }

            if (colNumber === 13) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: usageColors.head } };
                cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: usageColors.sub } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }

            if (colNumber === 14) {
                let stColors = COLORS.slate;
                if (entry.person.status === 'Activo/a') stColors = COLORS.emerald;
                else if (entry.person.status === 'Bloqueado/a') stColors = COLORS.rose;
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stColors.head } };
                cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: stColors.sub } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }
        });
    });

    const summaryIdx2 = ws2.rowCount + 1;
    const summaryRow2 = ws2.getRow(summaryIdx2);
    summaryRow2.height = 28;
    const summaryData2: (string | number)[] = [
        '', 'TOTAL', '', `${filteredMatched.length}`,
        '', '', '', '', '',
        '', filteredMatched.reduce((sum, m) => sum + m.conteo, 0),
        '', '', '', '',
    ];
    summaryData2.forEach((value, i) => {
        const cell = summaryRow2.getCell(i + 1);
        cell.value = value;
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLORS.title } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.slate.head } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'medium', color: { argb: COLORS.separator } },
            bottom: { style: 'medium', color: { argb: COLORS.separator } },
        };
    });

    ws2.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
    ws2.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };

    // ─── Unmatched sheet ───
    if (matchResult.unmatched.length > 0) {
        const unmatchedSheet = workbook.addWorksheet('No Encontrados');

        unmatchedSheet.columns = [
            { key: 'folio', width: 22 },
            { key: 'conteo', width: 12 },
            { key: 'diasInactividad', width: 18 },
        ];

        unmatchedSheet.mergeCells('A1:C1');
        const umTitle = unmatchedSheet.getCell('A1');
        umTitle.value = '       FOLIOS NO ENCONTRADOS EN BASE DE DATOS';
        umTitle.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
        umTitle.alignment = { vertical: 'middle', horizontal: 'left' };
        unmatchedSheet.getRow(1).height = 40;

        await addLogoToSheet(workbook, unmatchedSheet);

        unmatchedSheet.mergeCells('A2:C2');
        const umMeta = unmatchedSheet.getCell('A2');
        umMeta.value = `Reporte generado: ${dateStr}  |  Folios sin coincidencia: ${matchResult.unmatched.length}`;
        umMeta.font = { name: 'Arial', size: 9, color: { argb: COLORS.meta } };
        umMeta.alignment = { vertical: 'middle', horizontal: 'left' };
        unmatchedSheet.getRow(2).height = 20;

        const umHeaders = ['FOLIO', 'CONTEO', 'DÍAS INACTIVIDAD'];
        const umRow3 = unmatchedSheet.getRow(3);
        umHeaders.forEach((label, i) => {
            const cell = umRow3.getCell(i + 1);
            cell.value = label;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.slate.sub } };
            cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        unmatchedSheet.getRow(3).height = 24;

        matchResult.unmatched.forEach((entry) => {
            unmatchedSheet.addRow({
                folio: entry.folio,
                conteo: entry.conteo,
                diasInactividad: entry.diasInactividad !== null ? `${entry.diasInactividad} días` : 'Sin datos',
            });
        });
    }

    // ── Save ──
    let fileNameParts = ['Reporte_Uso_KONE'];
    if (dependencyFilter && dependencyFilter !== 'Todas') {
        fileNameParts.push(dependencyFilter.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').replace(/ /g, '_'));
    }
    fileNameParts.push(new Date().toISOString().split('T')[0]);
    const finalFileName = `${fileNameParts.join('_')}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    if (returnBuffer) {
        return { buffer: buffer as ArrayBuffer, filename: finalFileName };
    }
    saveAsFunction(new Blob([buffer]), finalFileName);
}
