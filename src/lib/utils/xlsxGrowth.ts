import type * as ExcelJSTypes from 'exceljs';
import type { DashboardGrowth } from '../types';
import {
    addTitleAndMetaRow,
    addTableHeader,
    addTableRow,
    createExcelWorkbook,
    saveWorkbook,
    XLSX_COLORS,
} from './xlsxShared';
import {
    buildGrowthBuildingRows,
    buildGrowthDependencyRows,
    buildGrowthFloorRows,
    buildGrowthSummary,
    growthExportFileName,
    growthPeriodLabel,
} from './growthExportRows';

interface ExportColumn<T> {
    label: string;
    width: number;
    value: (row: T) => string | number | null;
    numFmt?: string;
    align?: 'left' | 'center';
}

function tableColors(colors: { head: string; sub: string }): { bg: string; fg: string } {
    return { bg: colors.head, fg: colors.sub };
}

function colLetter(n: number): string {
    let s = '';
    while (n > 0) {
        const r = (n - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

function writeTable<T>(
    ws: ExcelJSTypes.Worksheet,
    startRow: number,
    columns: ExportColumn<T>[],
    rows: T[],
    colors: { bg: string; fg: string },
): void {
    ws.columns = columns.map((column) => ({ width: column.width }));

    addTableHeader(
        ws,
        startRow,
        columns.map((column, i) => ({ col: colLetter(i + 1), label: column.label })),
        colors,
        XLSX_COLORS.white,
    );

    rows.forEach((row, index) => {
        const rowNumber = startRow + 1 + index;
        addTableRow(
            ws,
            rowNumber,
            columns.map((column, i) => ({
                col: colLetter(i + 1),
                value: column.value(row) ?? '—',
            })),
            colors,
            XLSX_COLORS.title,
            XLSX_COLORS.white,
        );

        columns.forEach((column, i) => {
            const cell = ws.getCell(`${colLetter(i + 1)}${rowNumber}`);
            if (column.numFmt) cell.numFmt = column.numFmt;
            if (column.align === 'left') {
                cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            }
        });
    });

    ws.autoFilter = `A${startRow}:${colLetter(columns.length)}${startRow}`;
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: startRow }];
}

export interface GrowthExportOptions {
    /** Nombre de la organización mostrado en títulos y nombre del archivo. */
    orgName?: string;
    /** Tipo de tarjeta aplicado como filtro (vacío = todos). */
    mediaTypeName?: string;
}

function orgLabel(options?: GrowthExportOptions): string {
    return (options?.orgName || 'Nexa').toUpperCase();
}

function mediaFilterLabel(options?: GrowthExportOptions): string {
    return `Tipo de tarjeta: ${options?.mediaTypeName || 'Todos'}`;
}

async function addSummarySheet(
    workbook: ExcelJSTypes.Workbook,
    growth: DashboardGrowth,
    options?: GrowthExportOptions,
): Promise<void> {
    const ws = workbook.addWorksheet('Resumen general');
    const summary = buildGrowthSummary(growth);
    const meta = [
        `Periodo: ${growthPeriodLabel(growth)}`,
        `Plantilla inicial: ${summary.initial}`,
        `Plantilla final: ${summary.final}`,
        `Incremento: ${summary.increment >= 0 ? '+' : ''}${summary.increment}`,
        mediaFilterLabel(options),
    ];

    await addTitleAndMetaRow({
        worksheet: ws,
        workbook,
        title: `CRECIMIENTO DE PERSONAL - ${orgLabel(options)}`,
        lastCol: 'C',
        metaLines: meta,
    });

    writeTable(
        ws,
        4,
        [
            { label: 'INDICADOR', width: 34, value: (row: { label: string }) => row.label, align: 'left' },
            { label: 'VALOR', width: 18, value: (row: { value: number | string }) => row.value },
            { label: 'DETALLE', width: 38, value: (row: { detail: string }) => row.detail },
        ],
        [
            {
                label: 'Plantilla inicial',
                value: summary.initial,
                detail: 'Personas al inicio del periodo',
            },
            {
                label: 'Plantilla final',
                value: summary.final,
                detail: 'Personas al final del periodo',
            },
            {
                label: 'Incremento',
                value: summary.increment,
                detail: summary.increment >= 0 ? 'Altas netas' : 'Bajas netas',
            },
            {
                label: '% de crecimiento',
                value: summary.percent ?? '—',
                detail: 'Sobre la plantilla inicial',
            },
        ],
        tableColors(XLSX_COLORS.emerald),
    );

    // Formatos numéricos de las filas de resumen (encabezado en 4, datos 5-8).
    ws.getCell('B5').numFmt = '#,##0';
    ws.getCell('B6').numFmt = '#,##0';
    ws.getCell('B7').numFmt = '+#,##0;-#,##0;0';
    ws.getCell('B8').numFmt = '0.0%';

    ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1 };
}

async function addBuildingSheet(
    workbook: ExcelJSTypes.Workbook,
    growth: DashboardGrowth,
    options?: GrowthExportOptions,
): Promise<void> {
    const ws = workbook.addWorksheet('Por edificio');
    const rows = buildGrowthBuildingRows(growth);

    await addTitleAndMetaRow({
        worksheet: ws,
        workbook,
        title: `CRECIMIENTO POR EDIFICIO - ${orgLabel(options)}`,
        lastCol: 'E',
        metaLines: [
            `Periodo: ${growthPeriodLabel(growth)}`,
            `Edificios: ${rows.length}`,
            mediaFilterLabel(options),
        ],
    });

    writeTable(
        ws,
        4,
        [
            { label: 'EDIFICIO', width: 34, value: (row) => row.name, align: 'left' },
            { label: 'INICIAL', width: 12, value: (row) => row.initial, numFmt: '#,##0' },
            { label: 'FINAL', width: 12, value: (row) => row.final, numFmt: '#,##0' },
            {
                label: 'INCREMENTO',
                width: 14,
                value: (row) => row.increment,
                numFmt: '+#,##0;-#,##0;0',
            },
            { label: '% CRECIMIENTO', width: 16, value: (row) => row.percent, numFmt: '0.0%' },
        ],
        rows,
        tableColors(XLSX_COLORS.sky),
    );

    ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1 };
}

async function addDependencySheet(
    workbook: ExcelJSTypes.Workbook,
    growth: DashboardGrowth,
    options?: GrowthExportOptions,
): Promise<void> {
    const ws = workbook.addWorksheet('Por dependencia');
    const rows = buildGrowthDependencyRows(growth);

    await addTitleAndMetaRow({
        worksheet: ws,
        workbook,
        title: `CRECIMIENTO POR DEPENDENCIA - ${orgLabel(options)}`,
        lastCol: 'F',
        metaLines: [
            `Periodo: ${growthPeriodLabel(growth)}`,
            `Dependencias: ${rows.length}`,
            mediaFilterLabel(options),
        ],
    });

    writeTable(
        ws,
        4,
        [
            { label: 'DEPENDENCIA', width: 44, value: (row) => row.name, align: 'left' },
            { label: 'EDIFICIO(S)', width: 44, value: (row) => row.buildings, align: 'left' },
            { label: 'INICIAL', width: 12, value: (row) => row.initial, numFmt: '#,##0' },
            { label: 'FINAL', width: 12, value: (row) => row.final, numFmt: '#,##0' },
            {
                label: 'INCREMENTO',
                width: 14,
                value: (row) => row.increment,
                numFmt: '+#,##0;-#,##0;0',
            },
            { label: '% CRECIMIENTO', width: 16, value: (row) => row.percent, numFmt: '0.0%' },
        ],
        rows,
        tableColors(XLSX_COLORS.violet),
    );

    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
}

async function addFloorSheet(
    workbook: ExcelJSTypes.Workbook,
    growth: DashboardGrowth,
    options?: GrowthExportOptions,
): Promise<void> {
    const ws = workbook.addWorksheet('Por piso');
    const rows = buildGrowthFloorRows(growth);

    await addTitleAndMetaRow({
        worksheet: ws,
        workbook,
        title: `CRECIMIENTO POR PISO - ${orgLabel(options)}`,
        lastCol: 'F',
        metaLines: [
            `Periodo: ${growthPeriodLabel(growth)}`,
            `Pisos: ${rows.length}`,
            mediaFilterLabel(options),
        ],
    });

    writeTable(
        ws,
        4,
        [
            { label: 'EDIFICIO', width: 34, value: (row) => row.building, align: 'left' },
            { label: 'PISO', width: 22, value: (row) => row.floor, align: 'left' },
            { label: 'INICIAL', width: 12, value: (row) => row.initial, numFmt: '#,##0' },
            { label: 'FINAL', width: 12, value: (row) => row.final, numFmt: '#,##0' },
            {
                label: 'INCREMENTO',
                width: 14,
                value: (row) => row.increment,
                numFmt: '+#,##0;-#,##0;0',
            },
            { label: '% CRECIMIENTO', width: 16, value: (row) => row.percent, numFmt: '0.0%' },
        ],
        rows,
        tableColors(XLSX_COLORS.personal),
    );

    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
}

/**
 * Exporta el indicador de crecimiento de personal en un libro con una hoja
 * por corte (resumen, edificio, dependencia y piso).
 */
export async function exportDashboardGrowthToExcel(
    growth: DashboardGrowth,
    options?: GrowthExportOptions,
    returnBuffer?: false,
): Promise<void>;
export async function exportDashboardGrowthToExcel(
    growth: DashboardGrowth,
    options: GrowthExportOptions | undefined,
    returnBuffer: true,
): Promise<{ buffer: ArrayBuffer; filename: string }>;
export async function exportDashboardGrowthToExcel(
    growth: DashboardGrowth,
    options?: GrowthExportOptions,
    returnBuffer?: boolean,
): Promise<void | { buffer: ArrayBuffer; filename: string }> {
    const { workbook } = await createExcelWorkbook();

    await addSummarySheet(workbook, growth, options);
    await addBuildingSheet(workbook, growth, options);
    await addDependencySheet(workbook, growth, options);
    await addFloorSheet(workbook, growth, options);

    const filename = growthExportFileName(growth, options?.orgName || 'Nexa', options?.mediaTypeName);
    return saveWorkbook(workbook, filename, returnBuffer as false);
}
