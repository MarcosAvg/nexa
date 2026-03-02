import type * as ExcelJSTypes from 'exceljs';
import type { saveAs as saveAsType } from 'file-saver';

// Dynamic imports moved inside functions to reduce initial bundle size

export interface ExportPersonnelData {
    first_name: string;
    last_name: string;
    employee_no: string;
    building: string;
    dependency: string;
    area: string;
    position: string;
    floor: string;
    floors_p2000: string[];
    floors_kone: string[];
    status: string;
    specialAccesses: string[];
    schedule: {
        days: string;
        entry: string;
        exit: string;
    } | null;
    email?: string | null;
    cards?: { type: string; folio: string }[];
    // Allow any other props from Person to avoid strict casting errors during development
    [key: string]: any;
}

export interface ExportOptions {
    filters?: {
        status?: string;
        dependency?: string;
        search?: string;
    },
    splitByDependency?: boolean;
}

// ─── Statistics Sheet Helper ───────────────────────────────────────────
async function addStatsSheet(workbook: ExcelJSTypes.Workbook, data: ExportPersonnelData[], filterInfo: string) {
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

    // Column widths
    ws.columns = [
        { width: 4 },   // A spacer
        { width: 30 },  // B label
        { width: 16 },  // C value
        { width: 14 },  // D percent
        { width: 4 },   // E spacer
        { width: 30 },  // F label
        { width: 16 },  // G value
        { width: 14 },  // H percent
    ];

    let row = 1;

    // ── Helpers ──
    const thin = (argb: string): ExcelJSTypes.Border => ({ style: 'thin', color: { argb } });
    const setBorder = (cell: ExcelJSTypes.Cell, color = 'FFCBD5E1') => {
        cell.border = { top: thin(color), bottom: thin(color), left: thin(color), right: thin(color) };
    };

    const sectionTitle = (text: string) => {
        ws.mergeCells(`B${row}:H${row}`);
        const cell = ws.getCell(`B${row}`);
        cell.value = text;
        cell.font = { name: 'Arial', bold: true, size: 12, color: { argb: C.sectionHead } };
        cell.alignment = { vertical: 'middle' };
        ws.getRow(row).height = 30;
        row++;
        // Separator line
        ws.mergeCells(`B${row}:H${row}`);
        const sep = ws.getCell(`B${row}`);
        sep.border = { top: { style: 'medium', color: { argb: C.separator } } };
        ws.getRow(row).height = 6;
        row++;
    };

    const kpiCard = (col: string, label: string, value: number | string, colors: { bg: string; fg: string }, pct?: string) => {
        const colIdx = col.charCodeAt(0) - 64;
        const valCol = String.fromCharCode(col.charCodeAt(0) + 1);
        const pctCol = String.fromCharCode(col.charCodeAt(0) + 2);

        const lCell = ws.getCell(`${col}${row}`);
        lCell.value = label;
        lCell.font = { name: 'Arial', bold: true, size: 10, color: { argb: colors.fg } };
        lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
        lCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        setBorder(lCell);

        const vCell = ws.getCell(`${valCol}${row}`);
        vCell.value = value;
        vCell.font = { name: 'Arial', bold: true, size: 14, color: { argb: colors.fg } };
        vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
        vCell.alignment = { vertical: 'middle', horizontal: 'center' };
        setBorder(vCell);

        if (pct !== undefined) {
            const pCell = ws.getCell(`${pctCol}${row}`);
            pCell.value = pct;
            pCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: colors.fg } };
            pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
            pCell.alignment = { vertical: 'middle', horizontal: 'center' };
            setBorder(pCell);
        }
    };

    const tableHeader = (cols: { col: string; label: string }[], colors: { bg: string; fg: string }) => {
        cols.forEach(({ col, label }) => {
            const cell = ws.getCell(`${col}${row}`);
            cell.value = label;
            cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: C.white } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.fg } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            setBorder(cell, colors.fg);
        });
        ws.getRow(row).height = 26;
        row++;
    };

    const tableRow = (cols: { col: string; value: string | number }[], colors: { bg: string; fg: string }, bold = false) => {
        cols.forEach(({ col, value }, i) => {
            const cell = ws.getCell(`${col}${row}`);
            cell.value = value;
            cell.font = { name: 'Arial', size: 9, color: { argb: C.sectionHead }, bold };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i === 0 ? colors.bg : C.white } };
            cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0 };
            setBorder(cell);
        });
        ws.getRow(row).height = 22;
        row++;
    };

    const pct = (n: number, total: number) => total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%';

    // ── Compute all stats ──
    const total = data.length;
    const activos = data.filter(p => p.status === 'Activo/a').length;
    const parciales = data.filter(p => p.status === 'Parcial').length;
    const bloqueados = data.filter(p => p.status === 'Bloqueado/a').length;
    const sinAcceso = data.filter(p => p.status === 'Sin Acceso').length;
    const bajas = data.filter(p => p.status === 'Baja').length;
    const activosOperativos = activos + parciales; // personas con algún nivel de acceso

    // Card coverage (only for "operativos" — active + parcial)
    const operativos = data.filter(p => p.status === 'Activo/a' || p.status === 'Parcial');
    const conP2000 = operativos.filter(p => p.cards?.some(c => c.type.toUpperCase() === 'P2000')).length;
    const conKone = operativos.filter(p => p.cards?.some(c => c.type.toUpperCase() === 'KONE')).length;
    const sinP2000 = activosOperativos - conP2000;
    const sinKone = activosOperativos - conKone;

    // Data quality
    const sinEmail = data.filter(p => !p.email).length;
    const sinSchedule = data.filter(p => !p.schedule?.days).length;
    const sinPosition = data.filter(p => !p.position).length;
    const sinArea = data.filter(p => !p.area).length;
    const sinFloor = data.filter(p => !p.floor).length;

    // Dependency distribution
    const depMap: Record<string, { total: number; activos: number; inactivos: number }> = {};
    data.forEach(p => {
        const dep = p.dependency || 'Sin Dependencia';
        if (!depMap[dep]) depMap[dep] = { total: 0, activos: 0, inactivos: 0 };
        depMap[dep].total++;
        if (p.status === 'Activo/a' || p.status === 'Parcial') depMap[dep].activos++;
        else depMap[dep].inactivos++;
    });
    const depEntries = Object.entries(depMap).sort((a, b) => b[1].total - a[1].total);

    // Special accesses
    const accessMap: Record<string, number> = {};
    data.forEach(p => {
        (p.specialAccesses || []).forEach(a => {
            accessMap[a] = (accessMap[a] || 0) + 1;
        });
    });
    const conAccesoEspecial = data.filter(p => p.specialAccesses?.length > 0).length;
    const accessEntries = Object.entries(accessMap).sort((a, b) => b[1] - a[1]);

    // Schedule distribution (by days only, hours are free-form)
    const schedMap: Record<string, number> = {};
    data.forEach(p => {
        const key = p.schedule?.days || null;
        if (key) schedMap[key] = (schedMap[key] || 0) + 1;
    });
    const schedEntries = Object.entries(schedMap).sort((a, b) => b[1] - a[1]);

    // Building distribution
    const buildMap: Record<string, number> = {};
    data.forEach(p => {
        const key = p.building || 'Sin Edificio';
        buildMap[key] = (buildMap[key] || 0) + 1;
    });
    const buildEntries = Object.entries(buildMap).sort((a, b) => b[1] - a[1]);

    // ══════════════════════════════════════════════════════════════
    // ROW 1: Title
    // ══════════════════════════════════════════════════════════════
    ws.mergeCells('A1:H1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `       RESUMEN EJECUTIVO — DIRECTORIO DE PERSONAL${filterInfo}`;
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: C.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(1).height = 40;

    try {
        const response = await fetch('/favicon.svg');
        if (response.ok) {
            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();
            const imageId = workbook.addImage({ buffer, extension: 'svg' as any });
            ws.addImage(imageId, { tl: { col: 0.15, row: 0.2 }, ext: { width: 32, height: 32 } });
        }
    } catch { /* logo optional */ }

    // ROW 2: Meta
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

    // ══════════════════════════════════════════════════════════════
    // SECTION 1: KPIs por Estado
    // ══════════════════════════════════════════════════════════════
    sectionTitle('📊  INDICADORES CLAVE POR ESTADO');

    // Left column KPIs
    ws.getRow(row).height = 32;
    kpiCard('B', 'TOTAL PERSONAL', total, C.blue);
    kpiCard('F', 'ACTIVOS OPERATIVOS', activosOperativos, C.emerald, pct(activosOperativos, total));
    row++;

    ws.getRow(row).height = 28;
    kpiCard('B', 'Activo/a', activos, C.emerald, pct(activos, total));
    kpiCard('F', 'Parcial', parciales, C.amber, pct(parciales, total));
    row++;

    ws.getRow(row).height = 28;
    kpiCard('B', 'Bloqueado/a', bloqueados, C.rose, pct(bloqueados, total));
    kpiCard('F', 'Sin Acceso', sinAcceso, C.slate, pct(sinAcceso, total));
    row++;

    ws.getRow(row).height = 28;
    kpiCard('B', 'Baja', bajas, C.slate, pct(bajas, total));
    row++;
    row++;

    // ══════════════════════════════════════════════════════════════
    // SECTION 2: Cobertura de Tarjetas
    // ══════════════════════════════════════════════════════════════
    sectionTitle('🪪  COBERTURA DE TARJETAS DE ACCESO');

    // Sub header note
    ws.mergeCells(`B${row}:H${row}`);
    const noteCell = ws.getCell(`B${row}`);
    noteCell.value = `Calculado sobre personal operativo (Activo/a + Parcial): ${activosOperativos} personas`;
    noteCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: C.meta } };
    ws.getRow(row).height = 18;
    row++;

    ws.getRow(row).height = 28;
    kpiCard('B', 'Con tarjeta P2000', conP2000, C.amber, pct(conP2000, activosOperativos));
    kpiCard('F', 'Sin tarjeta P2000', sinP2000, sinP2000 > 0 ? C.rose : C.emerald, pct(sinP2000, activosOperativos));
    row++;

    ws.getRow(row).height = 28;
    kpiCard('B', 'Con tarjeta KONE', conKone, C.sky, pct(conKone, activosOperativos));
    kpiCard('F', 'Sin tarjeta KONE', sinKone, sinKone > 0 ? C.rose : C.emerald, pct(sinKone, activosOperativos));
    row++;

    ws.getRow(row).height = 28;
    kpiCard('B', '% Cobertura P2000', pct(conP2000, activosOperativos), activosOperativos > 0 && conP2000 / activosOperativos >= 0.9 ? C.emerald : C.amber);
    kpiCard('F', '% Cobertura KONE', pct(conKone, activosOperativos), activosOperativos > 0 && conKone / activosOperativos >= 0.9 ? C.emerald : C.amber);
    row++;
    row++;

    // ══════════════════════════════════════════════════════════════
    // SECTION 3: Distribución por Dependencia
    // ══════════════════════════════════════════════════════════════
    sectionTitle('🏢  DISTRIBUCIÓN POR DEPENDENCIA');
    tableHeader([
        { col: 'B', label: 'DEPENDENCIA' },
        { col: 'C', label: 'TOTAL' },
        { col: 'D', label: '% DEL TOTAL' },
        { col: 'F', label: 'ACTIVOS' },
        { col: 'G', label: 'INACTIVOS' },
        { col: 'H', label: '% ACTIVOS' },
    ], C.violet);

    depEntries.forEach(([dep, stats]) => {
        tableRow([
            { col: 'B', value: dep },
            { col: 'C', value: stats.total },
            { col: 'D', value: pct(stats.total, total) },
            { col: 'F', value: stats.activos },
            { col: 'G', value: stats.inactivos },
            { col: 'H', value: pct(stats.activos, stats.total) },
        ], C.violet);
    });
    row++;

    // ══════════════════════════════════════════════════════════════
    // SECTION 4: Distribución por Edificio
    // ══════════════════════════════════════════════════════════════
    if (buildEntries.length > 0) {
        sectionTitle('🏗️  DISTRIBUCIÓN POR EDIFICIO');
        tableHeader([
            { col: 'B', label: 'EDIFICIO' },
            { col: 'C', label: 'TOTAL' },
            { col: 'D', label: '% DEL TOTAL' },
        ], C.sky);

        buildEntries.forEach(([building, count]) => {
            tableRow([
                { col: 'B', value: building },
                { col: 'C', value: count },
                { col: 'D', value: pct(count, total) },
            ], C.sky);
        });
        row++;
    }

    // ══════════════════════════════════════════════════════════════
    // SECTION 5: Calidad de Datos
    // ══════════════════════════════════════════════════════════════
    sectionTitle('⚠️  CALIDAD DE DATOS — CAMPOS INCOMPLETOS');

    tableHeader([
        { col: 'B', label: 'CAMPO' },
        { col: 'C', label: 'SIN DATO' },
        { col: 'D', label: '% INCOMPLETO' },
    ], C.rose);

    const qualityRows: [string, number][] = [
        ['Correo Electrónico', sinEmail],
        ['Jornada Laboral', sinSchedule],
        ['Puesto', sinPosition],
        ['Equipo / Área', sinArea],
        ['Piso Base', sinFloor],
    ];
    qualityRows.forEach(([label, count]) => {
        const colors = count > 0 ? C.rose : C.emerald;
        tableRow([
            { col: 'B', value: label },
            { col: 'C', value: count },
            { col: 'D', value: pct(count, total) },
        ], colors);
    });

    // Totals row
    const totalMissing = qualityRows.reduce((sum, [, c]) => sum + c, 0);
    const maxPossible = total * qualityRows.length;
    ws.getRow(row).height = 24;
    const summCols = [
        { col: 'B', value: 'TOTAL CAMPOS VACÍOS' },
        { col: 'C', value: `${totalMissing} / ${maxPossible}` },
        { col: 'D', value: pct(totalMissing, maxPossible) },
    ];
    summCols.forEach(({ col, value }, i) => {
        const cell = ws.getCell(`${col}${row}`);
        cell.value = value;
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: C.sectionHead } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.slate.bg } };
        cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0 };
        setBorder(cell);
    });
    row++;
    row++;

    // ══════════════════════════════════════════════════════════════
    // SECTION 6: Accesos Especiales
    // ══════════════════════════════════════════════════════════════
    if (accessEntries.length > 0) {
        sectionTitle('🔐  ACCESOS ESPECIALES');

        ws.getRow(row).height = 28;
        kpiCard('B', 'Personas con acceso especial', conAccesoEspecial, C.pink, pct(conAccesoEspecial, total));
        row++;

        tableHeader([
            { col: 'B', label: 'TIPO DE ACCESO' },
            { col: 'C', label: 'PERSONAS' },
            { col: 'D', label: '% DEL TOTAL' },
        ], C.pink);

        accessEntries.forEach(([access, count]) => {
            tableRow([
                { col: 'B', value: access },
                { col: 'C', value: count },
                { col: 'D', value: pct(count, total) },
            ], C.pink);
        });
        row++;
    }

    // ══════════════════════════════════════════════════════════════
    // SECTION 7: Distribución de Jornada
    // ══════════════════════════════════════════════════════════════
    if (schedEntries.length > 0) {
        sectionTitle('🕐  DISTRIBUCIÓN DE JORNADA LABORAL');

        tableHeader([
            { col: 'B', label: 'JORNADA' },
            { col: 'C', label: 'PERSONAS' },
            { col: 'D', label: '% DEL TOTAL' },
        ], C.emerald);

        schedEntries.forEach(([sched, count]) => {
            tableRow([
                { col: 'B', value: sched },
                { col: 'C', value: count },
                { col: 'D', value: pct(count, total) },
            ], C.emerald);
        });
    }

    // Freeze and print setup
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
    ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1 };
}

export async function exportPersonnelToExcel(data: ExportPersonnelData[], options?: ExportOptions) {
    const [ExcelJSModule, { saveAs: saveAsFunction }] = await Promise.all([
        import('exceljs'),
        import('file-saver')
    ]);
    const workbook = new (ExcelJSModule.default || ExcelJSModule).Workbook();

    // Helper Colors
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

    // Helper to add a sheet with data
    const addDataSheet = async (sheetName: string, sheetData: ExportPersonnelData[], filterInfo: string) => {
        // Excel sheet names limit: 31 chars, no special chars : \ / ? * [ ]
        const safeName = sheetName.replace(/[:\\/?*[\]]/g, '').substring(0, 31) || 'Hoja';
        const worksheet = workbook.addWorksheet(safeName);

        worksheet.columns = [
            { key: 'last_name', width: 25 },
            { key: 'first_name', width: 25 },
            { key: 'employee_no', width: 15 },
            { key: 'building', width: 22 },
            { key: 'dependency', width: 28 },
            { key: 'area', width: 22 },
            { key: 'position', width: 28 },
            { key: 'floor', width: 12 },
            { key: 'folioP2000', width: 20 },
            { key: 'pisosP2000Text', width: 25 },
            { key: 'folioKone', width: 22 },
            { key: 'pisosKoneText', width: 25 },
            { key: 'status', width: 15 },
            { key: 'specialAccessesText', width: 28 },
            { key: 'days', width: 22 },
            { key: 'entry', width: 14 },
            { key: 'exit', width: 14 },
            { key: 'email', width: 35 },
        ];

        // Row 1: Header + Logo
        worksheet.mergeCells('A1:R1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `       DIRECTORIO DE PERSONAL - NEXA${filterInfo}`;
        titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
        worksheet.getRow(1).height = 40;

        try {
            const response = await fetch('/favicon.svg');
            if (response.ok) {
                const blob = await response.blob();
                const buffer = await blob.arrayBuffer();
                const imageId = workbook.addImage({ buffer: buffer, extension: 'svg' as any });
                worksheet.addImage(imageId, {
                    tl: { col: 0.15, row: 0.2 },
                    ext: { width: 32, height: 32 }
                });
            }
        } catch (e) {
            console.warn('Logo load failed');
        }

        // Row 2: Meta
        worksheet.mergeCells('A2:R2');
        const metaCell = worksheet.getCell('A2');
        const dateStr = new Date().toLocaleDateString('es-MX', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        metaCell.value = `Reporte generado: ${dateStr}  |  Registros en esta hoja: ${sheetData.length}`;
        metaCell.font = { name: 'Arial', size: 9, color: { argb: COLORS.meta } };
        metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
        worksheet.getRow(2).height = 20;

        // Row 3: Super-Headers
        const groups = [
            { label: 'DATOS PERSONALES', range: 'A3:C3', colors: COLORS.personal },
            { label: 'UBICACIÓN Y PUESTO', range: 'D3:H3', colors: COLORS.location },
            { label: 'ACCESO PUERTAS (P2000)', range: 'I3:J3', colors: COLORS.amber },
            { label: 'ACCESO ELEVADORES (KONE)', range: 'K3:L3', colors: COLORS.sky },
            { label: 'ESTADO', range: 'M3:M3', colors: COLORS.status },
            { label: 'ADICIONALES', range: 'N3:N3', colors: COLORS.additional },
            { label: 'JORNADA LABORAL', range: 'O3:Q3', colors: COLORS.emerald },
            { label: 'CONTACTO', range: 'R3:R3', colors: COLORS.personal }
        ];

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

        // Row 4: Sub-Headers
        const headerRow = worksheet.getRow(4);
        headerRow.height = 30;
        const headerLabels = [
            'APELLIDOS', 'NOMBRES', 'NO. EMPLEADO', 'EDIFICIO', 'DEPENDENCIA', 'EQUIPO', 'PUESTO', 'PISO BASE',
            'FOLIO ACCESO', 'PISOS ASIGNADOS', 'FOLIO ACCESO', 'PISOS ASIGNADOS', 'ESTADO', 'ACCESOS ESPECIALES',
            'DIAS LABORALES', 'ENTRADA', 'SALIDA', 'CORREO ELECTRÓNICO'
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

            const isGroupEnd = [3, 8, 10, 12, 13, 14, 17, 18].includes(i + 1);
            cell.border = {
                bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
                right: { style: isGroupEnd ? 'medium' : 'thin', color: { argb: isGroupEnd ? COLORS.separator : 'FFFFFFFF' } }
            };
        });

        // Data Rows
        sheetData.forEach((person) => {
            const folioP2000 = person.cards?.filter(c => c.type.toUpperCase() === 'P2000').map(c => c.folio).join(', ') || '-';
            const folioKone = person.cards?.filter(c => c.type.toUpperCase() === 'KONE').map(c => c.folio).join(', ') || '-';

            const rowData = {
                last_name: person.last_name || '-',
                first_name: person.first_name || '-',
                employee_no: person.employee_no || '-',
                building: person.building || '-',
                dependency: person.dependency || '-',
                area: person.area || '-',
                position: person.position || '-',
                floor: person.floor || '-',
                folioP2000,
                pisosP2000Text: person.floors_p2000?.join(', ') || '-',
                folioKone,
                pisosKoneText: person.floors_kone?.join(', ') || '-',
                status: person.status || '-',
                specialAccessesText: person.specialAccesses?.join(', ') || '-',
                days: person.schedule?.days || '-',
                entry: person.schedule?.entry || '-',
                exit: person.schedule?.exit || '-',
                email: person.email || '-'
            };

            const row = worksheet.addRow(rowData);
            row.height = 24;

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

                const isGroupEnd = [3, 8, 10, 12, 13, 14, 17, 18].includes(colNumber);
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: isGroupEnd ? 'medium' : 'thin', color: { argb: isGroupEnd ? COLORS.separator : 'FFCBD5E1' } }
                };

                if (cell.value === '-' || cell.value === 'N/A' || !cell.value) {
                    cell.value = '[SIN DATO]';
                    cell.font = { ...cell.font, color: { argb: 'FFB91C1C' }, italic: true };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFEE2E2' } // Light red background for missing data
                    };
                }
            });

            // Status Colors (Subtle: light background, dark text)
            const statusCell = row.getCell('status');
            if (person.status === 'Activo/a' && !isInactive) {
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // light-green-100
                statusCell.font = { color: { argb: 'FF166534' }, bold: true, name: 'Arial', size: 9 };   // dark-green-800
            } else if (person.status === 'Parcial' && !isInactive) {
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // light-amber-100
                statusCell.font = { color: { argb: 'FF92400E' }, bold: true, name: 'Arial', size: 9 };   // dark-amber-800
            } else if (person.status === 'Bloqueado/a') {
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // light-red-100
                statusCell.font = { color: { argb: 'FF991B1B' }, bold: true, name: 'Arial', size: 9 };   // dark-red-800
            } else if (isInactive) {
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // slate-100
                statusCell.font = { color: { argb: 'FF475569' }, italic: true, name: 'Arial', size: 9 }; // slate-600
            }
        });

        worksheet.autoFilter = 'A4:R4';
        worksheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 4 }];
    };

    // Construct Dynamic Filter Description
    let filterDescription = '';
    let fileNameParts: string[] = ['Directorio'];

    if (options?.filters) {
        const { status, dependency, search } = options.filters;
        const activeFilters: string[] = [];

        if (status && status !== 'Todos') {
            activeFilters.push(`Estado: ${status}`);
            fileNameParts.push(status.replace('/', '-'));
        }
        if (dependency) {
            activeFilters.push(`Dep: ${dependency}`);
            fileNameParts.push(dependency);
        }
        if (search) {
            activeFilters.push(`Búsqueda: "${search}"`);
            fileNameParts.push(`Busqueda_${search.substring(0, 10)}`);
        }

        if (activeFilters.length > 0) {
            filterDescription = `      -  Filtros: ${activeFilters.join(' - ')}`;
        }
    }

    // ── Stats sheet is always first ──
    await addStatsSheet(workbook, data, filterDescription);

    if (options?.splitByDependency) {
        // Group data by dependency
        const groupedData: Record<string, ExportPersonnelData[]> = {};
        data.forEach(person => {
            const dep = person.dependency || 'Sin Dependencia';
            if (!groupedData[dep]) groupedData[dep] = [];
            groupedData[dep].push(person);
        });

        // Add a sheet for each dependency
        const deps = Object.keys(groupedData).sort();
        for (const dep of deps) {
            await addDataSheet(dep, groupedData[dep], filterDescription);
        }
        fileNameParts.push('Por_Dependencia');
    } else {
        // Just one sheet as before
        await addDataSheet('Directorio', data, filterDescription);
    }

    // Filename construction
    const finalFileName = `${fileNameParts.join('_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    saveAsFunction(new Blob([buffer]), finalFileName);
}

export async function exportCardsToExcel(data: any[], options?: ExportOptions) {
    const [ExcelJSModule, { saveAs: saveAsFunction }] = await Promise.all([
        import('exceljs'),
        import('file-saver')
    ]);
    const workbook = new (ExcelJSModule.default || ExcelJSModule).Workbook();
    const worksheet = workbook.addWorksheet('Tarjetas');

    const COLORS = {
        title: 'FF1E293B',
        meta: 'FF64748B',
        separator: 'FF94A3B8',
        personal: { head: 'FFDBEAFE', sub: 'FF1E40AF', fill: 'FFEFF6FF' },
        amber: { head: 'FFFEF3C7', sub: 'FF92400E', fill: 'FFFEFCE8' },
        sky: { head: 'FFE0F2FE', sub: 'FF075985', fill: 'FFF0F9FF' },
        status: { head: 'FFEDE9FE', sub: 'FF5B21B6', fill: 'FFFAF5FF' },
        emerald: { head: 'FFD1FAE5', sub: 'FF065F46', fill: 'FFF0FDF4' },
        rose: { head: 'FFFEE2E2', sub: 'FF991B1B', fill: 'FFFFF1F2' },
        violet: { head: 'FFEDE9FE', sub: 'FF5B21B6', fill: 'FFFAF5FF' },
        slate: { head: 'FFF1F5F9', sub: 'FF334155', fill: 'FFF8FAFC' }
    };

    let filterDescription = '';
    if (options?.filters?.search) {
        filterDescription = `      -  Búsqueda: "${options.filters.search}"`;
    }
    if (options?.filters?.status && options.filters.status !== 'Todas') {
        filterDescription += `  |  Estado: ${options.filters.status}`;
    }

    worksheet.columns = [
        { key: 'type', width: 14 },
        { key: 'folio', width: 22 },
        { key: 'personName', width: 35 },
        { key: 'statusLabel', width: 18 },
        { key: 'programmingText', width: 22 },
        { key: 'responsivaText', width: 22 },
    ];

    // Row 1: Header + Logo
    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `       INVENTARIO DE TARJETAS Y ACCESOS - NEXA${filterDescription}`;
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 40;

    try {
        const response = await fetch('/favicon.svg');
        if (response.ok) {
            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();
            const imageId = workbook.addImage({ buffer: buffer, extension: 'svg' as any });
            worksheet.addImage(imageId, {
                tl: { col: 0.15, row: 0.2 },
                ext: { width: 32, height: 32 }
            });
        }
    } catch (e) {
        console.warn('Logo load failed');
    }

    // Row 2: Meta
    worksheet.mergeCells('A2:F2');
    const metaCell = worksheet.getCell('A2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaCell.value = `Reporte generado: ${dateStr}  |  Registros: ${data.length}`;
    metaCell.font = { name: 'Arial', size: 9, color: { argb: COLORS.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(2).height = 20;

    // Row 3: Super-Headers
    const groups = [
        { label: 'IDENTIFICACIÓN', range: 'A3:B3', colors: COLORS.amber },
        { label: 'USUARIO ASIGNADO', range: 'C3:C3', colors: COLORS.personal },
        { label: 'ESTADO ACTUAL', range: 'D3:D3', colors: COLORS.status },
        { label: 'MOVIMIENTOS / CONTROL', range: 'E3:F3', colors: COLORS.violet }
    ];

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

    // Row 4: Sub-Headers
    const headerRow = worksheet.getRow(4);
    headerRow.height = 30;
    const headerLabels = ['TIPO', 'FOLIO / NO. TARJETA', 'ASIGNADA A', 'ESTADO', 'PROGRAMACIÓN', 'RESPONSIVA'];

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

        const isGroupEnd = [2, 3, 4, 6].includes(i + 1);
        cell.border = {
            bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
            right: { style: isGroupEnd ? 'medium' : 'thin', color: { argb: isGroupEnd ? COLORS.separator : 'FFFFFFFF' } }
        };
    });

    worksheet.autoFilter = 'A4:F4';

    data.forEach((card) => {
        const rowData = {
            type: card.type,
            folio: card.folio,
            personName: card.personName || 'Sin asignar',
            statusLabel: card.status === 'active' ? 'Activa' : (card.status === 'blocked' ? 'Bloqueada' : (card.status === 'inactive' ? 'Baja' : 'Disponible')),
            programmingText: card.programming_status === 'done' ? 'Programada' : (card.person_id ? 'PENDIENTE' : 'N/A'),
            responsivaText: (card.responsiva_status === 'signed' || card.responsiva_status === 'legacy') ? 'Firmada' : (card.person_id ? 'PENDIENTE' : 'N/A')
        };

        const row = worksheet.addRow(rowData);
        row.height = 24;

        row.eachCell((cell, colNumber) => {
            const colLetter = String.fromCharCode(64 + colNumber);
            const group = groups.find(g => {
                const parts = g.range.replace(/[0-9]/g, '').split(':');
                return colLetter >= parts[0] && colLetter <= (parts[1] || parts[0]);
            }) || groups[0];

            cell.font = { name: 'Arial', size: 9 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.fill } };

            const isGroupEnd = [2, 3, 4, 6].includes(colNumber);
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: isGroupEnd ? 'medium' : 'thin', color: { argb: isGroupEnd ? COLORS.separator : 'FFCBD5E1' } }
            };

            // HIGHLIGHTS & STATUS BADGES
            if (cell.value === 'PENDIENTE' || cell.value === 'N/A' || !cell.value || cell.value === '[SIN DATO]' || cell.value === 'Sin asignar') {
                const label = cell.value === 'Sin asignar' ? 'SIN ASIGNAR' : (cell.value === 'PENDIENTE' ? '[PENDIENTE]' : (cell.value === 'N/A' ? 'N/A' : '[SIN DATO]'));
                cell.value = label;
                cell.font = { ...cell.font, color: { argb: 'FFB91C1C' }, italic: true, bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            } else if (cell.value === 'Programada' || cell.value === 'Firmada') {
                const isProg = cell.value === 'Programada';
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isProg ? COLORS.violet.head : COLORS.emerald.head } };
                cell.font = { ...cell.font, color: { argb: isProg ? COLORS.violet.sub : COLORS.emerald.sub }, bold: true };
            } else if (colNumber === 4) { // Status column badge system
                let statusColors = COLORS.slate; // Default for 'Baja'
                if (cell.value === 'Activa') statusColors = COLORS.emerald;
                else if (cell.value === 'Bloqueada') statusColors = COLORS.rose;
                else if (cell.value === 'Disponible') statusColors = COLORS.sky;

                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColors.head } };
                cell.font = { ...cell.font, color: { argb: statusColors.sub }, bold: true };
            }
        });
    });

    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
    const finalFileName = `Tarjetas_Nexa_${new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAsFunction(new Blob([buffer]), finalFileName);
}

export async function exportHistoryToExcel(data: any[], options?: ExportOptions) {
    const [ExcelJSModule, { saveAs: saveAsFunction }] = await Promise.all([
        import('exceljs'),
        import('file-saver')
    ]);
    const workbook = new (ExcelJSModule.default || ExcelJSModule).Workbook();
    const worksheet = workbook.addWorksheet('Historial');

    const COLORS = {
        title: 'FF1E293B',
        meta: 'FF64748B',
        separator: 'FF94A3B8',
        personal: { head: 'FFDBEAFE', sub: 'FF1E40AF', fill: 'FFEFF6FF' },
        amber: { head: 'FFFEF3C7', sub: 'FF92400E', fill: 'FFFEFCE8' },
        sky: { head: 'FFE0F2FE', sub: 'FF075985', fill: 'FFF0F9FF' },
        emerald: { head: 'FFD1FAE5', sub: 'FF065F46', fill: 'FFF0FDF4' },
        rose: { head: 'FFFEE2E2', sub: 'FF991B1B', fill: 'FFFFF1F2' },
        violet: { head: 'FFEDE9FE', sub: 'FF5B21B6', fill: 'FFFAF5FF' },
        slate: { head: 'FFF1F5F9', sub: 'FF334155', fill: 'FFF8FAFC' }
    };

    const actionNames: Record<string, string> = {
        CREATE: "Registro", UPDATE: "Actualización", DELETE: "Eliminación",
        BLOCK: "Bloqueo de Acceso", ACTIVATE: "Activación de Acceso", DEACTIVATE: "Desactivación de Personal",
        ASSIGN_CARD: "Asignación de Tarjeta", UNASSIGN_CARD: "Desvinculación de Tarjeta", UPSERT: "Guardado/Actualización",
        UPDATE_STATUS: "Cambio de Estado", UNASSIGN: "Desvinculación", UPDATE_PROGRAMMING: "Programación de Acceso",
        UPDATE_RESPONSIVA: "Estatus de Responsiva", REPLACE_CARD: "Reposición de Tarjeta", TICKET: "Ticket de Sistema",
        CREATE_TICKET: "Creación de Ticket", SIGN_RESPONSIVA: "Firma de Responsiva", DELETE_RESPONSIVA: "Eliminación de Responsiva",
        COMPLETE_TICKET: "Ticket Completado", APPLY_MODIFICATION: "Modificación Aprobada", REJECT_MODIFICATION: "Modificación Rechazada",
        REPLACE_OLD: "Baja por Reposición", DELETE_TICKET_CASCADE: "Eliminación en Cascada",
        CANCEL: "Cancelación", COMPLETE: "Completado"
    };

    function translateText(text: string) {
        if (!text) return text;
        return text
            .replace(/\bblocked\b/gi, "bloqueado/a")
            .replace(/\bactive\b/gi, "activo/a")
            .replace(/\binactive\b/gi, "inactivo/a")
            .replace(/\bcomplete\b/gi, "completado")
            .replace(/\bcompleted\b/gi, "completado")
            .replace(/\bpending\b/gi, "pendiente")
            .replace(/\bdone\b/gi, "listo")
            .replace(/\bsigned\b/gi, "firmado/a")
            .replace(/\bunsigned\b/gi, "sin firmar")
            .replace(/\bavailable\b/gi, "disponible")
            .replace(/\burgente\b/gi, "URGENTE")
            .replace(/\balta\b/gi, "ALTA")
            .replace(/\bmedia\b/gi, "MEDIA")
            .replace(/\bbaja\b/gi, "BAJA");
    }

    worksheet.columns = [
        { key: 'date', width: 24 },
        { key: 'entity', width: 45 },
        { key: 'actionLabel', width: 28 },
        { key: 'description', width: 65 },
    ];

    // Row 1: Header + Logo
    worksheet.mergeCells('A1:D1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `       HISTORIAL DE AUDITORÍA Y ACCIONES - NEXA`;
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 40;

    try {
        const response = await fetch('/favicon.svg');
        if (response.ok) {
            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();
            const imageId = workbook.addImage({ buffer: buffer, extension: 'svg' as any });
            worksheet.addImage(imageId, {
                tl: { col: 0.15, row: 0.2 },
                ext: { width: 32, height: 32 }
            });
        }
    } catch (e) {
        console.warn('Logo load failed');
    }

    // Row 2: Meta
    worksheet.mergeCells('A2:D2');
    const metaCell = worksheet.getCell('A2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaCell.value = `Reporte generado: ${dateStr}  |  Registros: ${data.length}`;
    metaCell.font = { name: 'Arial', size: 9, color: { argb: COLORS.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(2).height = 20;

    // Row 3: Super-Headers
    const groups = [
        { label: 'TEMPORALIDAD', range: 'A3:A3', colors: COLORS.slate },
        { label: 'AUDITORÍA', range: 'B3:B3', colors: COLORS.personal },
        { label: 'MOVIMIENTO', range: 'C3:C3', colors: COLORS.amber },
        { label: 'DETALLES DE LA ACCIÓN', range: 'D3:D3', colors: COLORS.violet }
    ];

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

    // Row 4: Sub-Headers
    const headerRow = worksheet.getRow(4);
    headerRow.height = 30;
    const headerLabels = ['FECHA / HORA', 'ENTIDAD AFECTADA', 'ACCIÓN REALIZADA', 'DESCRIPCIÓN'];
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
        cell.border = {
            bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
            right: { style: 'medium', color: { argb: COLORS.separator } }
        };
    });

    worksheet.autoFilter = 'A4:D4';

    data.forEach((log) => {
        const message = log.details?.message || (typeof log.details === 'string' ? log.details : JSON.stringify(log.details));
        let cleanMessage = (message || '').replace(/\sID:?\s?[a-f0-9-]{8,}/gi, '').replace(/\s(de|ID)\s?[a-f0-9-]{8,}/gi, '');
        cleanMessage = translateText(cleanMessage);

        const rowData = {
            date: new Date(log.timestamp).toLocaleString('es-MX'),
            entity: log.resolvedName || `${log.entity_type}: ${log.entity_id}`,
            actionLabel: actionNames[log.action] || log.action,
            description: cleanMessage
        };

        const row = worksheet.addRow(rowData);
        row.height = 24;

        row.eachCell((cell, colNumber) => {
            const colLetter = String.fromCharCode(64 + colNumber);
            const group = groups.find(g => {
                const parts = g.range.replace(/[0-9]/g, '').split(':');
                return colLetter >= parts[0] && colLetter <= (parts[1] || parts[0]);
            }) || groups[0];

            cell.font = { name: 'Arial', size: 9 };
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.fill } };

            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'medium', color: { argb: COLORS.separator } }
            };

            // ACTION COLUMN OVERRIDE (Subtle Badge Style)
            if (colNumber === 3) { // actionLabel
                let bgColor = COLORS.personal.head;
                let textColor = COLORS.personal.sub;
                const action = log.action;

                if (['CREATE', 'ACTIVATE', 'APPLY_MODIFICATION'].includes(action)) {
                    bgColor = COLORS.emerald.head;
                    textColor = COLORS.emerald.sub;
                } else if (['DELETE', 'BLOCK', 'DEACTIVATE', 'UNASSIGN', 'UNASSIGN_CARD', 'DELETE_RESPONSIVA', 'REPLACE_OLD', 'DELETE_TICKET_CASCADE', 'REJECT_MODIFICATION'].includes(action)) {
                    bgColor = COLORS.rose.head;
                    textColor = COLORS.rose.sub;
                } else if (['ASSIGN_CARD', 'REPLACE_CARD', 'SIGN_RESPONSIVA', 'COMPLETE_TICKET', 'TICKET', 'CREATE_TICKET'].includes(action)) {
                    bgColor = COLORS.violet.head;
                    textColor = COLORS.violet.sub;
                }

                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: textColor } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            }
        });

        row.getCell('date').alignment = { horizontal: 'center', vertical: 'middle' };
    });

    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
    const finalFileName = `Historial_Nexa_${new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAsFunction(new Blob([buffer]), finalFileName);
}

// ─── KONE Usage Export ─────────────────────────────────────────────────

import type { KoneUsageMatchResult, KoneUsageMatchedEntry } from './xlsxKoneUsage';

async function addKoneSummarySheet(workbook: ExcelJSTypes.Workbook, matchedData: KoneUsageMatchedEntry[], sheetName: string, title: string, usageThreshold: number) {
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
        { width: 4 },   // A spacer
        { width: 30 },  // B label
        { width: 16 },  // C value
        { width: 14 },  // D percent
        { width: 30 },  // E label
        { width: 16 },  // F value
        { width: 14 },  // G percent
    ];

    let row = 1;

    const thin = (argb: string): ExcelJSTypes.Border => ({ style: 'thin', color: { argb } });
    const setBorder = (cell: ExcelJSTypes.Cell, color = 'FFCBD5E1') => {
        cell.border = { top: thin(color), bottom: thin(color), left: thin(color), right: thin(color) };
    };

    const sectionTitle = (text: string) => {
        ws.mergeCells(`B${row}:G${row}`);
        const cell = ws.getCell(`B${row}`);
        cell.value = text;
        cell.font = { name: 'Arial', bold: true, size: 12, color: { argb: C.sectionHead } };
        cell.alignment = { vertical: 'middle' };
        ws.getRow(row).height = 30;
        row++;
        ws.mergeCells(`B${row}:G${row}`);
        const sep = ws.getCell(`B${row}`);
        sep.border = { top: { style: 'medium', color: { argb: C.separator } } };
        ws.getRow(row).height = 6;
        row++;
    };

    const kpiCard = (col: string, label: string, value: number | string, colors: { bg: string; fg: string }, pct?: string) => {
        const valCol = String.fromCharCode(col.charCodeAt(0) + 1);
        const pctCol = String.fromCharCode(col.charCodeAt(0) + 2);

        const lCell = ws.getCell(`${col}${row}`);
        lCell.value = label;
        lCell.font = { name: 'Arial', bold: true, size: 10, color: { argb: colors.fg } };
        lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
        lCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        setBorder(lCell);

        const vCell = ws.getCell(`${valCol}${row}`);
        vCell.value = value;
        vCell.font = { name: 'Arial', bold: true, size: 14, color: { argb: colors.fg } };
        vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
        vCell.alignment = { vertical: 'middle', horizontal: 'center' };
        setBorder(vCell);

        if (pct !== undefined) {
            const pCell = ws.getCell(`${pctCol}${row}`);
            pCell.value = pct;
            pCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: colors.fg } };
            pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
            pCell.alignment = { vertical: 'middle', horizontal: 'center' };
            setBorder(pCell);
        }
    };

    const tableHeader = (cols: { col: string; label: string }[], colors: { bg: string; fg: string }) => {
        cols.forEach(({ col, label }) => {
            const cell = ws.getCell(`${col}${row}`);
            cell.value = label;
            cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: C.white } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.fg } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            setBorder(cell, colors.fg);
        });
        ws.getRow(row).height = 26;
        row++;
    };

    const tableRow = (cols: { col: string; value: string | number }[], colors: { bg: string; fg: string }, bold = false) => {
        cols.forEach(({ col, value }, i) => {
            const cell = ws.getCell(`${col}${row}`);
            cell.value = value;
            cell.font = { name: 'Arial', size: 9, color: { argb: C.sectionHead }, bold };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i === 0 ? colors.bg : C.white } };
            cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0 };
            setBorder(cell);
        });
        ws.getRow(row).height = 22;
        row++;
    };

    const pct = (n: number, total: number) => total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%';

    // ── Compute stats ──
    const total = matchedData.length;
    const conteos = matchedData.map(m => m.conteo);
    const totalUsos = conteos.reduce((sum, c) => sum + c, 0);
    const promedio = total > 0 ? (totalUsos / total) : 0;
    const maximo = total > 0 ? Math.max(...conteos) : 0;
    const mediana = (() => {
        if (total === 0) return 0;
        const sorted = [...conteos].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    })();

    // Usage ranges
    const ranges = [
        { label: '0 usos', filter: (c: number) => c === 0 },
        { label: '1 – 10 usos', filter: (c: number) => c >= 1 && c <= 10 },
        { label: '11 – 50 usos', filter: (c: number) => c >= 11 && c <= 50 },
        { label: '51 – 100 usos', filter: (c: number) => c >= 51 && c <= 100 },
        { label: '101+ usos', filter: (c: number) => c > 100 },
    ];

    const bajoUsoData = matchedData.filter(m => m.conteo < usageThreshold);

    // Personal que solo usó torniquete (0 usos pero con días de inactividad)
    const soloTorniqueteData = matchedData.filter(m => m.conteo === 0 && m.diasInactividad !== null && m.diasInactividad > 0);
    const soloTorniqueteCount = soloTorniqueteData.length;

    // Dependency distribution
    const depMap: Record<string, { count: number; totalUsos: number }> = {};
    matchedData.forEach(m => {
        const dep = m.person.dependency || 'Sin Dependencia';
        if (!depMap[dep]) depMap[dep] = { count: 0, totalUsos: 0 };
        depMap[dep].count++;
        depMap[dep].totalUsos += m.conteo;
    });
    const depEntries = Object.entries(depMap).sort((a, b) => b[1].totalUsos - a[1].totalUsos);

    // Building distribution
    const buildMap: Record<string, { count: number; totalUsos: number }> = {};
    matchedData.forEach(m => {
        const bld = m.person.building || 'Sin Edificio';
        if (!buildMap[bld]) buildMap[bld] = { count: 0, totalUsos: 0 };
        buildMap[bld].count++;
        buildMap[bld].totalUsos += m.conteo;
    });
    const buildEntries = Object.entries(buildMap).sort((a, b) => b[1].totalUsos - a[1].totalUsos);

    // ══════ ROW 1: Title ══════
    ws.mergeCells('A1:G1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `       ${title}`;
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: C.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(1).height = 40;

    try {
        const response = await fetch('/favicon.svg');
        if (response.ok) {
            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();
            const imageId = workbook.addImage({ buffer, extension: 'svg' as any });
            ws.addImage(imageId, { tl: { col: 0.15, row: 0.2 }, ext: { width: 32, height: 32 } });
        }
    } catch { /* logo optional */ }

    ws.mergeCells('A2:G2');
    const metaCell = ws.getCell('A2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaCell.value = `Reporte generado: ${dateStr}  |  Personal en esta hoja: ${total}`;
    metaCell.font = { name: 'Arial', size: 9, color: { argb: C.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(2).height = 20;

    row = 4;

    // ══════ SECTION 1: KPIs de Uso ══════
    sectionTitle('📊  INDICADORES CLAVE DE USO');

    ws.getRow(row).height = 32;
    kpiCard('B', 'PERSONAL REGISTRADO', total, C.blue);
    kpiCard('E', 'TOTAL DE USOS', totalUsos, C.sky);
    row++;

    ws.getRow(row).height = 28;
    kpiCard('B', 'Promedio de usos', promedio.toFixed(1), C.emerald);
    kpiCard('E', 'Mediana de usos', mediana.toFixed(1), C.emerald);
    row++;

    ws.getRow(row).height = 28;
    kpiCard('B', 'Máximo de usos', maximo, C.amber);
    kpiCard('E', 'Personal bajo uso', bajoUsoData.length, bajoUsoData.length > 0 ? C.rose : C.emerald, pct(bajoUsoData.length, total));
    row++;

    ws.getRow(row).height = 28;
    kpiCard('B', 'Solo usó torniquete', soloTorniqueteCount, soloTorniqueteCount > 0 ? C.rose : C.emerald, pct(soloTorniqueteCount, total));
    kpiCard('E', 'Sin días de inactividad', matchedData.filter(m => m.diasInactividad === null).length, C.sky);
    row++;
    row++;

    // ══════ SECTION 2: Distribution by Ranges ══════
    sectionTitle('📈  DISTRIBUCIÓN POR RANGO DE USO');

    tableHeader([
        { col: 'B', label: 'RANGO' },
        { col: 'C', label: 'PERSONAS' },
        { col: 'D', label: '% DEL TOTAL' },
        { col: 'E', label: 'USOS EN RANGO' },
        { col: 'F', label: '% DE USOS' },
    ], C.cyan);

    ranges.forEach(range => {
        const personas = matchedData.filter(m => range.filter(m.conteo));
        const usosEnRango = personas.reduce((sum, m) => sum + m.conteo, 0);
        tableRow([
            { col: 'B', value: range.label },
            { col: 'C', value: personas.length },
            { col: 'D', value: pct(personas.length, total) },
            { col: 'E', value: usosEnRango },
            { col: 'F', value: pct(usosEnRango, totalUsos) },
        ], C.cyan);
    });
    row++;

    // ══════ SECTION 3: Distribution by Dependencies ══════
    sectionTitle('�  DISTRIBUCIÓN POR DEPENDENCIAS');

    tableHeader([
        { col: 'B', label: 'DEPENDENCIA' },
        { col: 'C', label: 'PERSONAS' },
        { col: 'D', label: 'TOTAL USOS' },
        { col: 'E', label: 'PROMEDIO USOS' },
        { col: 'F', label: '% DEL TOTAL' },
    ], C.violet);

    depEntries.forEach(([dep, stats], i) => {
        const avgUsos = stats.count > 0 ? (stats.totalUsos / stats.count).toFixed(1) : '0';
        tableRow([
            { col: 'B', value: dep },
            { col: 'C', value: stats.count },
            { col: 'D', value: stats.totalUsos },
            { col: 'E', value: avgUsos },
            { col: 'F', value: pct(stats.totalUsos, totalUsos) },
        ], i % 2 === 0 ? C.violet : C.slate);
    });
    row++;

    // ══════ SECTION 4: By Building ══════
    if (buildEntries.length > 0) {
        sectionTitle('🏗️  DISTRIBUCIÓN POR EDIFICIO');

        tableHeader([
            { col: 'B', label: 'EDIFICIO' },
            { col: 'C', label: 'PERSONAS' },
            { col: 'D', label: 'USOS TOTALES' },
            { col: 'E', label: 'PROMEDIO' },
            { col: 'F', label: '% DE USOS' },
        ], C.sky);

        buildEntries.forEach(([bld, stats]) => {
            tableRow([
                { col: 'B', value: bld },
                { col: 'C', value: stats.count },
                { col: 'D', value: stats.totalUsos },
                { col: 'E', value: (stats.totalUsos / stats.count).toFixed(1) },
                { col: 'F', value: pct(stats.totalUsos, totalUsos) },
            ], C.sky);
        });
    }

    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
    ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1 };
}

export async function exportKoneUsageToExcel(matchResult: KoneUsageMatchResult, usageThreshold: number = 10) {
    const matchedData = matchResult.matched;
    const [ExcelJSModule, { saveAs: saveAsFunction }] = await Promise.all([
        import('exceljs'),
        import('file-saver')
    ]);
    const workbook = new (ExcelJSModule.default || ExcelJSModule).Workbook();

    // Define shared constants and helpers
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const total = matchedData.length;
    const totalUsos = matchedData.reduce((sum, m) => sum + m.conteo, 0);

    const thin = (argb: string): ExcelJSTypes.Border => ({ style: 'thin', color: { argb } });
    const setBorder = (cell: ExcelJSTypes.Cell, color = 'FFCBD5E1') => {
        cell.border = { top: thin(color), bottom: thin(color), left: thin(color), right: thin(color) };
    };

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
        rose: { head: 'FFFEE2E2', sub: 'FF991B1B', fill: 'FFFFF1F2' },
        koneUsage: { head: 'FFCFFAFE', sub: 'FF155E75', fill: 'FFECFEFF' },
    };

    const headerLabels = [
        'APELLIDOS', 'NOMBRES', 'NO. EMPLEADO',
        'EDIFICIO', 'DEPENDENCIA', 'EQUIPO', 'PUESTO', 'PISO BASE',
        'FOLIO KONE', 'USOS REGISTRADOS', 'DÍAS INACTIVIDAD'
    ];

    // ══════════════════════════════════════════════════════════════
    // SHEET 1: Executive Summary — Usage Metrics (All)
    // ══════════════════════════════════════════════════════════════
    await addKoneSummarySheet(workbook, matchedData, 'Resumen — Uso KONE', 'REPORTE DE USO DE TARJETAS KONE — NEXA', usageThreshold);

    const bajoUsoData = matchedData.filter(m => m.conteo < usageThreshold);

    // ══════════════════════════════════════════════════════════════
    // SHEET 2: Executive Summary — Low Usage Metrics
    // ══════════════════════════════════════════════════════════════
    if (bajoUsoData.length > 0) {
        await addKoneSummarySheet(workbook, bajoUsoData, 'Resumen — Bajo Uso', `PERSONAL CON BAJO USO DE TARJETA (< ${usageThreshold})`, usageThreshold);
    }

    // ══════════════════════════════════════════════════════════════
    // SHEET 3: Personnel Directory with Usage Count
    // ══════════════════════════════════════════════════════════════
    const dataSheet = workbook.addWorksheet('Directorio con Conteo');
    dataSheet.columns = [
        { key: 'last_name', width: 25 }, { key: 'first_name', width: 25 }, { key: 'employee_no', width: 15 },
        { key: 'building', width: 22 }, { key: 'dependency', width: 28 }, { key: 'area', width: 22 },
        { key: 'position', width: 28 }, { key: 'floor', width: 12 },
        { key: 'folioKone', width: 18 }, { key: 'conteoUsoKone', width: 18 }, { key: 'diasInactividad', width: 18 }
    ];

    const setupDirectorySheet = async (ws: ExcelJSTypes.Worksheet, title: string, meta: string) => {
        ws.mergeCells('A1:K1');
        const dtTitle = ws.getCell('A1');
        dtTitle.value = `       ${title}`;
        dtTitle.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
        dtTitle.alignment = { vertical: 'middle', horizontal: 'left' };
        ws.getRow(1).height = 40;

        try {
            const response = await fetch('/favicon.svg');
            if (response.ok) {
                const blob = await response.blob();
                const buffer = await blob.arrayBuffer();
                const imageId = workbook.addImage({ buffer, extension: 'svg' as any });
                ws.addImage(imageId, { tl: { col: 0.15, row: 0.2 }, ext: { width: 32, height: 32 } });
            }
        } catch { /* logo optional */ }

        ws.mergeCells('A2:K2');
        const dtMeta = ws.getCell('A2');
        dtMeta.value = meta;
        dtMeta.font = { name: 'Arial', size: 9, color: { argb: COLORS.meta } };
        dtMeta.alignment = { vertical: 'middle', horizontal: 'left' };
        ws.getRow(2).height = 20;

        const groups = [
            { label: 'DATOS PERSONALES', range: 'A3:C3', colors: COLORS.personal },
            { label: 'UBICACIÓN Y PUESTO', range: 'D3:H3', colors: COLORS.location },
            { label: 'USO KONE', range: 'I3:K3', colors: COLORS.koneUsage }
        ];

        groups.forEach(group => {
            ws.mergeCells(group.range);
            const cell = ws.getCell(group.range.split(':')[0]);
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

        const subHeaderRow = ws.getRow(4);
        subHeaderRow.height = 30;
        headerLabels.forEach((label, i) => {
            const cell = subHeaderRow.getCell(i + 1);
            cell.value = label;
            const colLetter = String.fromCharCode(65 + i);
            const group = groups.find(g => {
                const [start, end] = g.range.replace(/[0-9]/g, '').split(':');
                return colLetter >= (start || 'A') && colLetter <= (end || start || 'A');
            }) || groups[0];

            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.sub } };
            cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 8 };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            const isGroupEnd = [3, 8, 11].includes(i + 1);
            cell.border = {
                bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
                right: { style: isGroupEnd ? 'medium' : 'thin', color: { argb: isGroupEnd ? COLORS.separator : 'FFFFFFFF' } }
            };
        });

        return groups;
    };

    const populateRows = (ws: ExcelJSTypes.Worksheet, data: KoneUsageMatchedEntry[], groups: any[]) => {
        data.forEach(entry => {
            const person = entry.person;
            const folioP2000 = person.cards?.filter(c => c.type.toUpperCase() === 'P2000').map(c => c.folio).join(', ') || '-';
            const folioKone = person.cards?.filter(c => c.type.toUpperCase() === 'KONE').map(c => c.folio).join(', ') || '-';

            const rowData = {
                last_name: person.last_name || '-',
                first_name: person.first_name || '-',
                employee_no: person.employee_no || '-',
                building: person.building || '-',
                dependency: person.dependency || '-',
                area: person.area || '-',
                position: person.position || '-',
                floor: person.floor || '-',
                folioKone: entry.folio,
                conteoUsoKone: entry.conteo,
                diasInactividad: entry.diasInactividad !== null ? entry.diasInactividad : 'Sin registro'
            };

            const dataRow = ws.addRow(rowData);
            dataRow.height = 24;
            const isInactive = person.status === 'Baja' || person.status === 'Inactivo/a';

            dataRow.eachCell((cell, colNumber) => {
                const colLetter = String.fromCharCode(64 + colNumber);
                const group = groups.find(g => {
                    const parts = g.range.replace(/[0-9]/g, '').split(':');
                    return colLetter >= parts[0] && colLetter <= (parts[1] || parts[0]);
                }) || groups[0];

                cell.font = { name: 'Arial', size: 9, color: { argb: isInactive ? 'FF64748B' : 'FF111827' }, italic: isInactive };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                const isGroupEnd = [3, 8, 11].includes(colNumber);
                setBorder(cell, isGroupEnd ? COLORS.separator : 'FFCBD5E1');

                if (isInactive) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.fill } };
                }

                // Highlight conteo column specifically
                if (colNumber === 10 && !isInactive) {
                    const conteoVal = entry.conteo;
                    if (conteoVal > 100) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                        cell.font = { ...cell.font, bold: true, color: { argb: 'FF065F46' } };
                    } else if (conteoVal > 50) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
                        cell.font = { ...cell.font, bold: true, color: { argb: 'FF075985' } };
                    } else if (conteoVal === 0) {
                        cell.value = 'Sin registro';
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                        cell.font = { ...cell.font, color: { argb: 'FFB91C1C' }, bold: true };
                    } else if (conteoVal < usageThreshold) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
                        cell.font = { ...cell.font, bold: true, color: { argb: 'FF991B1B' } };
                    }
                }

                // Highlight dias de inactividad column in red
                if (colNumber === 11) {
                    if (entry.diasInactividad === null) {
                        cell.value = 'Sin registro';
                        cell.font = { ...cell.font, color: { argb: 'FFDC2626' }, bold: true };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                    } else {
                        // Mantener el valor numérico (incluyendo 0)
                        cell.font = { ...cell.font, color: { argb: 'FFDC2626' }, bold: true };
                    }
                }

                // Handle other empty values (but not dias de inactividad column)
                if (colNumber !== 11 && (cell.value === '-' || cell.value === 'N/A' || !cell.value)) {
                    cell.value = '[SIN DATO]';
                    cell.font = { ...cell.font, color: { argb: 'FFB91C1C' }, italic: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                }
            });

            // Remove Status coloring column since it's removed from export
        });
    };

    const mainGroups = await setupDirectorySheet(dataSheet, 'DIRECTORIO DE PERSONAL CON CONTEO DE USO KONE — NEXA', `Reporte generado: ${dateStr}  |  Registros: ${total}  |  Total usos: ${totalUsos}`);
    populateRows(dataSheet, matchedData, mainGroups);
    dataSheet.autoFilter = 'A4:K4';
    dataSheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 4 }];

    // ══════════════════════════════════════════════════════════════
    // SHEET 4: Low Usage Directory
    // ══════════════════════════════════════════════════════════════
    if (bajoUsoData.length > 0) {
        const lowUsageSheet = workbook.addWorksheet('Personal Bajo Uso');
        lowUsageSheet.columns = dataSheet.columns;
        const luGroups = await setupDirectorySheet(lowUsageSheet, `PERSONAL CON BAJO USO (< ${usageThreshold}) — NEXA`, `Filtrado por: Conteo < ${usageThreshold}  |  Registros: ${bajoUsoData.length}`);
        populateRows(lowUsageSheet, bajoUsoData, luGroups);
        lowUsageSheet.autoFilter = 'A4:K4';
        lowUsageSheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 4 }];
    }

    // ══════════════════════════════════════════════════════════════
    // SHEET 5: Unmatched Folios
    // ══════════════════════════════════════════════════════════════
    if (matchResult.unmatched && matchResult.unmatched.length > 0) {
        const unmatchedSheet = workbook.addWorksheet('No Relacionados');
        unmatchedSheet.columns = [
            { key: 'folio', width: 25 },
            { key: 'conteo', width: 20 },
            { key: 'diasInactividad', width: 20 }
        ];

        unmatchedSheet.mergeCells('A1:C1');
        const unfTitle = unmatchedSheet.getCell('A1');
        unfTitle.value = `       FOLIOS NO ENCONTRADOS — NEXA`;
        unfTitle.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
        unfTitle.alignment = { vertical: 'middle', horizontal: 'left' };
        unmatchedSheet.getRow(1).height = 40;

        try {
            const response = await fetch('/favicon.svg');
            if (response.ok) {
                const blob = await response.blob();
                const buffer = await blob.arrayBuffer();
                const imageId = workbook.addImage({ buffer, extension: 'svg' as any });
                unmatchedSheet.addImage(imageId, { tl: { col: 0.15, row: 0.2 }, ext: { width: 32, height: 32 } });
            }
        } catch { /* logo optional */ }

        unmatchedSheet.mergeCells('A2:C2');
        const unfMeta = unmatchedSheet.getCell('A2');
        unfMeta.value = `Reporte generado: ${dateStr}  |  Folios no encontrados: ${matchResult.unmatched.length}`;
        unfMeta.font = { name: 'Arial', size: 9, color: { argb: COLORS.meta } };
        unfMeta.alignment = { vertical: 'middle', horizontal: 'left' };
        unmatchedSheet.getRow(2).height = 20;

        const subHeaderRow = unmatchedSheet.getRow(3);
        subHeaderRow.height = 30;
        const unfLabels = ['FOLIO', 'USOS REGISTRADOS', 'DÍAS INACTIVIDAD'];
        unfLabels.forEach((label, i) => {
            const cell = subHeaderRow.getCell(i + 1);
            cell.value = label;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.amber.head } };
            cell.font = { name: 'Arial', bold: true, color: { argb: COLORS.amber.sub }, size: 9 };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
                right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
            };
        });

        matchResult.unmatched.forEach(entry => {
            const dataRow = unmatchedSheet.addRow({
                folio: entry.folio,
                conteo: entry.conteo,
                diasInactividad: entry.diasInactividad !== null ? entry.diasInactividad : '-'
            });
            dataRow.height = 24;

            dataRow.eachCell((cell) => {
                cell.font = { name: 'Arial', size: 9, color: { argb: 'FF111827' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.amber.fill } };
                cell.border = { top: thin('FFCBD5E1'), bottom: thin('FFCBD5E1'), left: thin('FFCBD5E1'), right: thin('FFCBD5E1') };
            });
        });

        unmatchedSheet.autoFilter = 'A3:C3';
        unmatchedSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
    }

    // ── Save ──
    const finalFileName = `Conteo_Uso_KONE_${new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAsFunction(new Blob([buffer]), finalFileName);
}
