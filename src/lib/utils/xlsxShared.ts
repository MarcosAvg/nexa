import type * as ExcelJSTypes from 'exceljs';

// ─── Shared Color Palette ──────────────────────────────────────────
// Every export function used to define its own COLORS object.
// Now they all share this single source of truth.

export const XLSX_COLORS = {
    title: 'FF1E293B',
    meta: 'FF64748B',
    separator: 'FF94A3B8',
    white: 'FFFFFFFF',
    black: 'FF111827',
    red: 'FFB91C1C',
    redBg: 'FFFEE2E2',
    personal: { head: 'FFDBEAFE', sub: 'FF1E40AF', fill: 'FFEFF6FF' },
    location: { head: 'FFF1F5F9', sub: 'FF334155', fill: 'FFF8FAFC' },
    amber: { head: 'FFFEF3C7', sub: 'FF92400E', fill: 'FFFEFCE8' },
    sky: { head: 'FFE0F2FE', sub: 'FF075985', fill: 'FFF0F9FF' },
    emerald: { head: 'FFD1FAE5', sub: 'FF065F46', fill: 'FFF0FDF4' },
    rose: { head: 'FFFEE2E2', sub: 'FF991B1B', fill: 'FFFFF1F2' },
    slate: { head: 'FFF1F5F9', sub: 'FF334155', fill: 'FFF8FAFC' },
    violet: { head: 'FFEDE9FE', sub: 'FF5B21B6', fill: 'FFFAF5FF' },
    indigo: { head: 'FFE0E7FF', sub: 'FF3730A3', fill: 'FFEEF2FF' },
    status: { head: 'FFEDE9FE', sub: 'FF5B21B6', fill: 'FFFAF5FF' },
    additional: { head: 'FFFCE7F3', sub: 'FF9D174D', fill: 'FFFFF1F2' },
    pink: { bg: 'FFFCE7F3', fg: 'FF9D174D' },
    blue: { bg: 'FFDBEAFE', fg: 'FF1E40AF' },
} as const;

export const BORDER_COLOR = 'FFCBD5E1';

// ─── Workbook Factory ──────────────────────────────────────────────

export interface ExcelWorkbookResult {
    workbook: ExcelJSTypes.Workbook;
    save: (filename: string) => Promise<void>;
    saveAsBuffer: () => Promise<{ buffer: ArrayBuffer; filename: string }>;
    filename: string;
}

/**
 * Dynamic imports for exceljs + file-saver, then creates a new Workbook.
 * Keeps the lazy-load pattern that was already in use.
 */
export async function createExcelWorkbook(): Promise<{
    workbook: ExcelJSTypes.Workbook;
    saveAsFunction: typeof import('file-saver').saveAs;
}> {
    const [ExcelJSModule, { saveAs: saveAsFunction }] = await Promise.all([
        import('exceljs'),
        import('file-saver')
    ]);
    const Workbook = ExcelJSModule.default || ExcelJSModule;
    const workbook = new Workbook();
    return { workbook, saveAsFunction };
}

/**
 * Saves a workbook buffer — either returns it or triggers a browser download.
 */
export async function saveWorkbook(
    workbook: ExcelJSTypes.Workbook,
    filename: string,
    returnBuffer?: false
): Promise<void>;
export async function saveWorkbook(
    workbook: ExcelJSTypes.Workbook,
    filename: string,
    returnBuffer: true
): Promise<{ buffer: ArrayBuffer; filename: string }>;
export async function saveWorkbook(
    workbook: ExcelJSTypes.Workbook,
    filename: string,
    returnBuffer?: boolean
): Promise<void | { buffer: ArrayBuffer; filename: string }> {
    const buffer = await workbook.xlsx.writeBuffer();
    if (returnBuffer) {
        return { buffer: buffer as ArrayBuffer, filename };
    }
    const { saveAs: saveAsFunction } = await import('file-saver');
    saveAsFunction(new Blob([buffer]), filename);
}

// ─── Title + Meta Row Generator ────────────────────────────────────

export interface TitleRowConfig {
    worksheet: ExcelJSTypes.Worksheet;
    workbook: ExcelJSTypes.Workbook;
    title: string;
    lastCol: string;
    /** Optional subtitle shown in row 2 */
    metaLines?: string[];
}

/**
 * Adds rows 1 (title + logo) and 2 (date / meta) to any worksheet.
 * Follows the exact same styling as the original inline code.
 */
export async function addTitleAndMetaRow(config: TitleRowConfig): Promise<void> {
    const { worksheet, workbook, title, lastCol, metaLines } = config;

    // Row 1: Title + Logo
    worksheet.mergeCells(`A1:${lastCol}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `       ${title}`;
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: XLSX_COLORS.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 40;

    await addLogoToSheet(workbook, worksheet);

    // Row 2: Meta
    worksheet.mergeCells(`A2:${lastCol}2`);
    const metaCell = worksheet.getCell('A2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const metaText = [`Reporte generado: ${dateStr}`, ...(metaLines || [])].join('  |  ');
    metaCell.value = metaText;
    metaCell.font = { name: 'Arial', size: 9, color: { argb: XLSX_COLORS.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(2).height = 20;
}

// ─── Logo Helper ───────────────────────────────────────────────────

export async function addLogoToSheet(workbook: ExcelJSTypes.Workbook, worksheet: ExcelJSTypes.Worksheet): Promise<void> {
    try {
        const response = await fetch('/favicon.svg');
        if (response.ok) {
            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();
            const imageId = workbook.addImage({ buffer, extension: 'svg' as any });
            worksheet.addImage(imageId, { tl: { col: 0.15, row: 0.2 }, ext: { width: 32, height: 32 } });
        }
    } catch { /* logo optional */ }
}

// ─── Header Group Helpers ──────────────────────────────────────────

export interface HeaderGroup {
    label: string;
    range: string;
    colors: { head: string; sub: string; fill: string };
}

/**
 * Applies merge, label, fill, font, and border for a super-header group.
 */
export function applyHeaderGroup(worksheet: ExcelJSTypes.Worksheet, group: HeaderGroup): void {
    worksheet.mergeCells(group.range);
    const cell = worksheet.getCell(group.range.split(':')[0]);
    cell.value = group.label;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.head } };
    cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: group.colors.sub } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'medium', color: { argb: XLSX_COLORS.separator } }
    };
}

/**
 * Applies sub-header cell styling (white text on colored background).
 */
export function styleSubHeaderCell(
    cell: ExcelJSTypes.Cell,
    group: { colors: { sub: string } },
    isGroupEnd: boolean,
    label: string
): void {
    cell.value = label;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.sub } };
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 8 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
        bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
        right: { style: isGroupEnd ? 'medium' : 'thin', color: { argb: isGroupEnd ? XLSX_COLORS.separator : 'FFFFFFFF' } }
    };
}

// ─── Cell Styling Helpers ──────────────────────────────────────────

export interface CellBorderConfig {
    isGroupEnd: boolean;
    borderColor?: string;
    separatorColor?: string;
}

/**
 * Applies bottom + right borders typical of ExcelJS data tables.
 */
export function applyDataCellBorder(
    cell: ExcelJSTypes.Cell,
    config: CellBorderConfig
): void {
    const sep = config.separatorColor || XLSX_COLORS.separator;
    const border = config.borderColor || BORDER_COLOR;
    cell.border = {
        bottom: { style: 'thin', color: { argb: border } },
        right: { style: config.isGroupEnd ? 'medium' : 'thin', color: { argb: config.isGroupEnd ? sep : border } }
    };
}

/**
 * Determines which header group a column letter belongs to.
 */
export function findGroupForColumn(colLetter: string, groups: HeaderGroup[]): HeaderGroup {
    return groups.find(g => {
        const parts = g.range.replace(/[0-9]/g, '').split(':');
        return colLetter >= parts[0] && colLetter <= (parts[1] || parts[0]);
    }) || groups[0];
}

/**
 * Default data cell styling.
 */
export function styleDataCell(
    cell: ExcelJSTypes.Cell,
    groupColors: { fill: string },
    isGroupEnd: boolean,
    horizontal: 'left' | 'center' | 'right' = 'center'
): void {
    cell.font = { name: 'Arial', size: 9, color: { argb: XLSX_COLORS.black } };
    cell.alignment = { vertical: 'middle', horizontal, wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: groupColors.fill } };
    applyDataCellBorder(cell, { isGroupEnd });
}

// ═════════════════════════════════════════════════════════════════════
// Summary Sheet Helpers (used by addStatsSheet and addKoneSummarySheet)
// ═════════════════════════════════════════════════════════════════════

/** Applies thin borders to all 4 sides of a cell. */
export function addBorder(cell: ExcelJSTypes.Cell, color = BORDER_COLOR): void {
    const thin = (argb: string): ExcelJSTypes.Border => ({ style: 'thin', color: { argb } });
    cell.border = { top: thin(color), bottom: thin(color), left: thin(color), right: thin(color) };
}

/** Returns a percentage string like "45.2%". */
export function calcPct(n: number, total: number): string {
    return total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%';
}

/**
 * Adds a section title row + separator line. Returns the updated row number.
 * @example
 *   row = addSectionTitle(ws, row, '📊 KPIs', 'H', { sectionHead: '...', separator: '...' });
 */
export function addSectionTitle(
    ws: ExcelJSTypes.Worksheet,
    row: number,
    text: string,
    lastCol: string,
    colors: { sectionHead: string; separator: string }
): number {
    ws.mergeCells(`B${row}:${lastCol}${row}`);
    const cell = ws.getCell(`B${row}`);
    cell.value = text;
    cell.font = { name: 'Arial', bold: true, size: 12, color: { argb: colors.sectionHead } };
    cell.alignment = { vertical: 'middle' };
    ws.getRow(row).height = 30;
    row++;
    ws.mergeCells(`B${row}:${lastCol}${row}`);
    const sep = ws.getCell(`B${row}`);
    sep.border = { top: { style: 'medium', color: { argb: colors.separator } } };
    ws.getRow(row).height = 6;
    row++;
    return row;
}

/**
 * Adds a KPI card on a single row: label column, value column, optional pct column.
 * Does NOT increment the row — the caller is responsible for that.
 */
export function addKpiCard(
    ws: ExcelJSTypes.Worksheet,
    row: number,
    col: string,
    label: string,
    value: number | string,
    colors: { bg: string; fg: string },
    pctStr?: string
): void {
    const valCol = String.fromCharCode(col.charCodeAt(0) + 1);
    const pctCol = String.fromCharCode(col.charCodeAt(0) + 2);

    const lCell = ws.getCell(`${col}${row}`);
    lCell.value = label;
    lCell.font = { name: 'Arial', bold: true, size: 10, color: { argb: colors.fg } };
    lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
    lCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    addBorder(lCell);

    const vCell = ws.getCell(`${valCol}${row}`);
    vCell.value = value;
    vCell.font = { name: 'Arial', bold: true, size: 14, color: { argb: colors.fg } };
    vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
    vCell.alignment = { vertical: 'middle', horizontal: 'center' };
    addBorder(vCell);

    if (pctStr !== undefined) {
        const pCell = ws.getCell(`${pctCol}${row}`);
        pCell.value = pctStr;
        pCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: colors.fg } };
        pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
        pCell.alignment = { vertical: 'middle', horizontal: 'center' };
        addBorder(pCell);
    }
}

/**
 * Adds a styled table header row (white text on colored background).
 * Does NOT increment the row — the caller is responsible for that.
 */
export function addTableHeader(
    ws: ExcelJSTypes.Worksheet,
    row: number,
    cols: { col: string; label: string }[],
    colors: { bg: string; fg: string },
    whiteColor: string
): void {
    cols.forEach(({ col, label }) => {
        const cell = ws.getCell(`${col}${row}`);
        cell.value = label;
        cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: whiteColor } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.fg } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        addBorder(cell, colors.fg);
    });
    ws.getRow(row).height = 26;
}

/**
 * Adds a styled table data row (first column colored, rest white).
 * Does NOT increment the row — the caller is responsible for that.
 */
export function addTableRow(
    ws: ExcelJSTypes.Worksheet,
    row: number,
    cols: { col: string; value: string | number }[],
    colors: { bg: string; fg: string },
    sectionHeadColor: string,
    whiteColor: string,
    bold = false
): void {
    cols.forEach(({ col, value }, i) => {
        const cell = ws.getCell(`${col}${row}`);
        cell.value = value;
        cell.font = { name: 'Arial', size: 9, color: { argb: sectionHeadColor }, bold };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i === 0 ? colors.bg : whiteColor } };
        cell.alignment = {
            vertical: 'middle',
            horizontal: i === 0 ? 'left' : 'center',
            indent: i === 0 ? 1 : 0
        };
        addBorder(cell);
    });
    ws.getRow(row).height = 22;
}
