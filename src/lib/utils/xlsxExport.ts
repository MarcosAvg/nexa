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

const RESPONSIVA_PICKUP_DAYS = 7;

function daysSince(dateStr: string, reference: Date = new Date()): number {
    if (!dateStr) return 0;
    const start = new Date(dateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(reference);
    end.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatDaysRemaining(remaining: number): string {
    return `${remaining} día${remaining !== 1 ? "s" : ""}`;
}

function formatPickupTrackingLabel(
    movementType: string,
    daysRemaining: number,
    daysElapsed: number,
    needsBaja: boolean
): string {
    if (movementType === "Reposición") {
        return `Reposición — ${formatDaysRemaining(daysElapsed)} sin recoger`;
    }

    if (movementType === "Alta de Personal") {
        if (needsBaja) {
            return "Plazo vencido";
        }
        return `Alta — Restan ${formatDaysRemaining(daysRemaining)} para recoger`;
    }

    if (needsBaja) {
        return "Plazo vencido";
    }
    return `Restan ${formatDaysRemaining(daysRemaining)} para recoger`;
}

function computeResponsivaManagement(
    movementType: string,
    referenceDate: string,
    ticketCreatedAt: string
) {
    const isReposicion = movementType === "Reposición";
    const elapsedRef = isReposicion ? referenceDate : ticketCreatedAt;
    const daysElapsed = daysSince(elapsedRef);
    const daysRemaining = Math.max(0, RESPONSIVA_PICKUP_DAYS - daysSince(ticketCreatedAt));
    const needsBaja = !isReposicion && daysSince(ticketCreatedAt) > RESPONSIVA_PICKUP_DAYS;

    return {
        daysElapsed,
        controlLabel: needsBaja ? "Baja de registro" : "-",
        deadlineLabel: formatPickupTrackingLabel(movementType, daysRemaining, daysElapsed, needsBaja),
        needsBaja,
        isReposicion,
        isAlta: movementType === "Alta de Personal",
    };
}

export async function exportResponsivasToExcel(tickets: any[], dependencyName?: string) {
    const [ExcelJSModule, { saveAs: saveAsFunction }] = await Promise.all([
        import('exceljs'),
        import('file-saver')
    ]);
    const workbook = new (ExcelJSModule.default || ExcelJSModule).Workbook();
    const worksheet = workbook.addWorksheet('Responsivas Pendientes');

    const COLORS = {
        title: 'FF1E293B',
        meta: 'FF64748B',
        separator: 'FF94A3B8',
        indigo: { head: 'FFE0E7FF', sub: 'FF3730A3', fill: 'FFEEF2FF' },
        personal: { head: 'FFDBEAFE', sub: 'FF1E40AF', fill: 'FFEFF6FF' },
        amber: { head: 'FFFEF3C7', sub: 'FF92400E', fill: 'FFFEFCE8' },
        sky: { head: 'FFE0F2FE', sub: 'FF075985', fill: 'FFF0F9FF' },
        emerald: { head: 'FFD1FAE5', sub: 'FF065F46', fill: 'FFF0FDF4' },
        rose: { head: 'FFFEE2E2', sub: 'FF991B1B', fill: 'FFFFF1F2' },
        slate: { head: 'FFF1F5F9', sub: 'FF334155', fill: 'FFF8FAFC' },
        violet: { head: 'FFEDE9FE', sub: 'FF5B21B6', fill: 'FFFAF5FF' },
    };

    const LAST_COL = 'K';

    // ── Build one row per pending card/ticket ──
    const rows = tickets
        .filter((t) => t.person_id)
        .map((t) => {
            const p = t.personnel || {};
            const card = t.cards;
            const movementType = t.movementType || "Sin clasificar";
            const referenceDate = t.assignmentDate || t.created_at;
            const mgmt = computeResponsivaManagement(movementType, referenceDate, t.created_at);

            return {
                name: `${p.last_name || ''}, ${p.first_name || ''}`.trim().replace(/^,\s*/, ''),
                employee_no: p.employee_no || '-',
                dependency: p.dependencies?.name || '-',
                movementType,
                cardType: card?.type || t.payload?.tipo_tarjeta || '-',
                folio: card?.folio || t.title?.replace('Firma: ', '') || '-',
                pendingSince: t.created_at,
                ...mgmt,
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name) || a.folio.localeCompare(b.folio));

    const uniquePersons = new Set(rows.map((r) => r.name)).size;
    const bajaCount = rows.filter((r) => r.needsBaja).length;

    // ── Column widths ──
    worksheet.columns = [
        { key: 'num', width: 6 },
        { key: 'name', width: 32 },
        { key: 'employee_no', width: 14 },
        { key: 'dependency', width: 28 },
        { key: 'movementType', width: 18 },
        { key: 'cardType', width: 12 },
        { key: 'folio', width: 18 },
        { key: 'pendingSince', width: 16 },
        { key: 'daysElapsed', width: 14 },
        { key: 'controlLabel', width: 22 },
        { key: 'deadlineLabel', width: 34 },
    ];

    // ── Filter description ──
    let filterDescription = '';
    if (dependencyName && dependencyName !== 'Todas') {
        filterDescription = `      -  Dependencia: ${dependencyName}`;
    }

    // ── Row 1: Title ──
    worksheet.mergeCells(`A1:${LAST_COL}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `       PERSONAL PENDIENTE DE RECOGER ACCESOS${filterDescription}`;
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 40;

    try {
        const response = await fetch('/favicon.svg');
        if (response.ok) {
            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();
            const imageId = workbook.addImage({ buffer, extension: 'svg' as any });
            worksheet.addImage(imageId, { tl: { col: 0.15, row: 0.2 }, ext: { width: 32, height: 32 } });
        }
    } catch { /* logo optional */ }

    // ── Row 2: Meta ──
    worksheet.mergeCells(`A2:${LAST_COL}2`);
    const metaCell = worksheet.getCell('A2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaCell.value = `Reporte generado: ${dateStr}  |  Personas: ${uniquePersons}  |  Tarjetas pendientes: ${rows.length}  |  Requieren baja de registro: ${bajaCount}`;
    metaCell.font = { name: 'Arial', size: 9, color: { argb: COLORS.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(2).height = 20;

    // ── Row 3: Super-Headers ──
    const groups = [
        { label: '#', range: 'A3:A3', colors: COLORS.slate },
        { label: 'DATOS DEL PERSONAL', range: 'B3:D3', colors: COLORS.personal },
        { label: 'MOVIMIENTO', range: 'E3:E3', colors: COLORS.violet },
        { label: 'TARJETA', range: 'F3:G3', colors: COLORS.indigo },
        { label: 'SEGUIMIENTO', range: 'H3:K3', colors: COLORS.amber },
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

    // ── Row 4: Sub-Headers ──
    const headerRow = worksheet.getRow(4);
    headerRow.height = 36;
    const headerLabels = [
        'NO.', 'NOMBRE COMPLETO', 'NO. EMPLEADO', 'DEPENDENCIA',
        'TIPO', 'TARJETA', 'FOLIO', 'PENDIENTE DESDE',
        'DÍAS', 'CONTROL DE GESTIÓN', 'SEGUIMIENTO DE ENTREGA',
    ];

    const colGroupMap = [0, 1, 1, 1, 2, 3, 3, 4, 4, 4, 4];

    headerLabels.forEach((label, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = label;
        const group = groups[colGroupMap[i]];
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.sub } };
        cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 8 };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

        const isGroupEnd = [1, 4, 5, 7, 11].includes(i + 1);
        cell.border = {
            bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
            right: { style: isGroupEnd ? 'medium' : 'thin', color: { argb: isGroupEnd ? COLORS.separator : 'FFFFFFFF' } }
        };
    });

    // ── Data Rows ──
    rows.forEach((entry, idx) => {
        const pendingLabel = entry.pendingSince
            ? new Date(entry.pendingSince).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
            : '-';

        const rowData = {
            num: idx + 1,
            name: entry.name,
            employee_no: entry.employee_no,
            dependency: entry.dependency,
            movementType: entry.movementType,
            cardType: entry.cardType,
            folio: entry.folio,
            pendingSince: pendingLabel,
            daysElapsed: entry.daysElapsed,
            controlLabel: entry.controlLabel,
            deadlineLabel: entry.deadlineLabel,
        };

        const row = worksheet.addRow(rowData);
        row.height = 26;

        row.eachCell((cell, colNumber) => {
            const group = groups[colGroupMap[colNumber - 1]];
            cell.font = { name: 'Arial', size: 9, color: { argb: 'FF111827' } };
            cell.alignment = {
                vertical: 'middle',
                horizontal: colNumber <= 1 || colNumber === 9 ? 'center' : 'left',
                wrapText: true,
            };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.fill } };

            const isGroupEnd = [1, 4, 5, 7, 11].includes(colNumber);
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: isGroupEnd ? 'medium' : 'thin', color: { argb: isGroupEnd ? COLORS.separator : 'FFCBD5E1' } }
            };

            if (colNumber === 5) {
                if (entry.isAlta) {
                    cell.font = { ...cell.font, bold: true, color: { argb: COLORS.emerald.sub } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.emerald.head } };
                } else if (entry.isReposicion) {
                    cell.font = { ...cell.font, bold: true, color: { argb: COLORS.sky.sub } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.sky.head } };
                }
            }

            if (colNumber === 10 && entry.needsBaja) {
                cell.font = { ...cell.font, bold: true, color: { argb: COLORS.rose.sub } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.rose.head } };
            }

            if (colNumber === 9 && entry.daysElapsed > RESPONSIVA_PICKUP_DAYS && !entry.isReposicion) {
                cell.font = { ...cell.font, bold: true, color: { argb: COLORS.amber.sub } };
            }

            if (colNumber === 11) {
                if (entry.needsBaja) {
                    cell.font = { ...cell.font, bold: true, color: { argb: COLORS.rose.sub } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.rose.head } };
                } else if (entry.isReposicion) {
                    cell.font = { ...cell.font, color: { argb: COLORS.sky.sub } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.sky.fill } };
                } else if (entry.isAlta) {
                    cell.font = { ...cell.font, color: { argb: COLORS.emerald.sub } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.emerald.fill } };
                }
            }
        });
    });

    // ── Summary row ──
    const summaryRowNum = worksheet.rowCount + 1;
    const summaryRow = worksheet.getRow(summaryRowNum);
    summaryRow.height = 28;

    const summaryValues: (string | number)[] = [
        '', 'TOTAL', '', `${uniquePersons} personas`,
        '', '', `${rows.length} tarjetas`, '',
        '', `${bajaCount} requieren baja`, '',
    ];

    summaryValues.forEach((value, i) => {
        const cell = summaryRow.getCell(i + 1);
        cell.value = value;
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLORS.title } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.slate.head } };
        cell.alignment = { vertical: 'middle', horizontal: i <= 0 ? 'center' : 'left' };
        cell.border = {
            top: { style: 'medium', color: { argb: COLORS.separator } },
            bottom: { style: 'medium', color: { argb: COLORS.separator } },
        };
    });

    // ── Freeze + filter ──
    worksheet.autoFilter = `A4:${LAST_COL}4`;
    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
    worksheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };

    // ── Save ──
    const fileNameParts = ['Responsivas_Pendientes'];
    if (dependencyName && dependencyName !== 'Todas') {
        fileNameParts.push(dependencyName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').replace(/ /g, '_'));
    }
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

        const fallbackName = (message || '').match(/(?:Actualización de|Registro de|para tarjeta \w+ folio|con folio)\s+([^,.(]+)/i)?.[1]?.trim();
        const displayName = log.entity_name || log.resolvedName || fallbackName || `${log.entity_type} (${(log.entity_id || '').slice(0, 8)}...)`;
        const entityLabel = log.entity_type === "PERSONNEL" || log.entity_type === "PERSON" ? "PERSONAL" : log.entity_type === "CARD" ? "TARJETA" : log.entity_type;

        const rowData = {
            date: new Date(log.timestamp).toLocaleString('es-MX'),
            entity: displayName,
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

export type CardlessRegistryExportRow = {
    person_id?: string | null;   // null = registro manual sin vínculo a personal
    first_name?: string | null;
    last_name?: string | null;
    employee_no?: string | null;
    dependencyName?: string | null;
    buildingName?: string | null;
    floor?: string | null;
    reason: string;
    comments?: string | null;
    recorded_at: string;
    recordedByName?: string | null;
    personName?: string | null;
};

export type CardlessRegistryExportFilters = {
    startDate?: string;
    endDate?: string;
    reason?: string;
    dependency?: string;
    search?: string;
};

function cardlessPersonKey(reg: CardlessRegistryExportRow): string {
    const emp = (reg.employee_no || '').trim().toLowerCase();
    if (emp) return `emp:${emp}`;
    const name = (
        reg.personName ||
        [reg.first_name, reg.last_name].filter(Boolean).join(' ') ||
        'sin nombre'
    )
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
    return `name:${name}`;
}

function cardlessPersonLabel(reg: CardlessRegistryExportRow): { name: string; firstName: string; lastName: string; employeeNo: string } {
    const firstName = reg.first_name || (reg.personName ? reg.personName.split(' ').slice(0, -1).join(' ') : '') || '';
    const lastName = reg.last_name || (reg.personName ? reg.personName.split(' ').slice(-1).join(' ') : '') || '';
    const name = reg.personName || [firstName, lastName].filter(Boolean).join(' ') || 'Sin nombre';
    return { name, firstName, lastName, employeeNo: reg.employee_no || '' };
}

// ─── Shared aggregation type & helper ──────────────────────────────────
type CardlessPersonAgg = {
    key: string;
    name: string;
    firstName: string;
    lastName: string;
    employeeNo: string;
    dependency: string;
    building: string;
    count: number;
    reasons: Record<string, number>;
    dates: number[];
    operators: Set<string>;
    isLinked: boolean;  // true if at least one record has person_id
};

function aggregateCardlessData(data: CardlessRegistryExportRow[]) {
    const personMap = new Map<string, CardlessPersonAgg>();
    const reasonMap: Record<string, number> = {};
    const depMap: Record<string, { registros: number; personas: Set<string> }> = {};
    const buildingMap: Record<string, { registros: number; personas: Set<string> }> = {};
    const operatorMap: Record<string, number> = {};

    data.forEach((reg) => {
        const key = cardlessPersonKey(reg);
        const label = cardlessPersonLabel(reg);
        const ts = new Date(reg.recorded_at).getTime();
        const dep = reg.dependencyName || 'Sin dependencia';
        const bldg = reg.buildingName || 'Sin edificio';
        const op = reg.recordedByName || 'Sin operador';

        reasonMap[reg.reason] = (reasonMap[reg.reason] || 0) + 1;
        operatorMap[op] = (operatorMap[op] || 0) + 1;

        if (!depMap[dep]) depMap[dep] = { registros: 0, personas: new Set() };
        depMap[dep].registros++;
        depMap[dep].personas.add(key);

        if (!buildingMap[bldg]) buildingMap[bldg] = { registros: 0, personas: new Set() };
        buildingMap[bldg].registros++;
        buildingMap[bldg].personas.add(key);

        let agg = personMap.get(key);
        if (!agg) {
            agg = { key, name: label.name, firstName: label.firstName, lastName: label.lastName,
                employeeNo: label.employeeNo, dependency: dep, building: bldg,
                count: 0, reasons: {}, dates: [], operators: new Set(), isLinked: false };
            personMap.set(key, agg);
        }
        agg.count++;
        agg.reasons[reg.reason] = (agg.reasons[reg.reason] || 0) + 1;
        if (!Number.isNaN(ts)) agg.dates.push(ts);
        if (reg.recordedByName) agg.operators.add(reg.recordedByName);
        if (!agg.employeeNo && label.employeeNo) agg.employeeNo = label.employeeNo;
        if (!agg.firstName && label.firstName) agg.firstName = label.firstName;
        if (!agg.lastName && label.lastName) agg.lastName = label.lastName;
        if (agg.dependency === 'Sin dependencia' && reg.dependencyName) agg.dependency = reg.dependencyName;
        if (agg.building === 'Sin edificio' && reg.buildingName) agg.building = reg.buildingName;
        if (reg.person_id) agg.isLinked = true;
    });

    const people = [...personMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'));
    return { people, reasonMap, depMap, buildingMap, operatorMap };
}

async function addCardlessEvidenceSheet(
    workbook: ExcelJSTypes.Workbook,
    data: CardlessRegistryExportRow[],
    filterDescription: string
) {
    const ws = workbook.addWorksheet('Evidencia');

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
    };

    ws.columns = [
        { width: 4 },
        { width: 28 },
        { width: 14 },
        { width: 14 },
        { width: 26 },
        { width: 16 },
        { width: 16 },
        { width: 14 },
        { width: 42 },
        { width: 20 },
        { width: 20 },
    ];

    let row = 1;
    const thin = (argb: string): ExcelJSTypes.Border => ({ style: 'thin', color: { argb } });
    const setBorder = (cell: ExcelJSTypes.Cell, color = 'FFCBD5E1') => {
        cell.border = { top: thin(color), bottom: thin(color), left: thin(color), right: thin(color) };
    };

    const sectionTitle = (text: string) => {
        ws.mergeCells(`B${row}:K${row}`);
        const cell = ws.getCell(`B${row}`);
        cell.value = text;
        cell.font = { name: 'Arial', bold: true, size: 12, color: { argb: C.sectionHead } };
        cell.alignment = { vertical: 'middle' };
        ws.getRow(row).height = 28;
        row++;
        ws.mergeCells(`B${row}:K${row}`);
        ws.getCell(`B${row}`).border = { top: { style: 'medium', color: { argb: C.separator } } };
        ws.getRow(row).height = 6;
        row++;
    };

    const kpi = (col: string, label: string, value: number | string, colors: { bg: string; fg: string }) => {
        const lCell = ws.getCell(`${col}${row}`);
        lCell.value = label;
        lCell.font = { name: 'Arial', bold: true, size: 9, color: { argb: colors.fg } };
        lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
        lCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        setBorder(lCell);

        const valCol = String.fromCharCode(col.charCodeAt(0) + 1);
        const vCell = ws.getCell(`${valCol}${row}`);
        vCell.value = value;
        vCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: colors.fg } };
        vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
        vCell.alignment = { vertical: 'middle', horizontal: 'center' };
        setBorder(vCell);
    };

    const pct = (n: number, total: number) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%');

    // ── Aggregate (shared helper) ──
    const { people, reasonMap, depMap, buildingMap, operatorMap } = aggregateCardlessData(data);
    const total = data.length;
    const uniquePeople = people.length;
    const reincidentes = people.filter((p) => p.count >= 2).length;
    const frecuentes = people.filter((p) => p.count >= 3).length;
    const avg = uniquePeople > 0 ? total / uniquePeople : 0;
    const reasonEntries = Object.entries(reasonMap).sort((a, b) => b[1] - a[1]);
    const topReason = reasonEntries[0];
    const depEntries = Object.entries(depMap).sort((a, b) => b[1].registros - a[1].registros);
    const buildingEntries = Object.entries(buildingMap).sort((a, b) => b[1].registros - a[1].registros);
    const operatorEntries = Object.entries(operatorMap).sort((a, b) => b[1] - a[1]);

    const formatDate = (ms: number) =>
        new Date(ms).toLocaleString('es-MX', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });

    // ── Title ──
    ws.mergeCells('A1:K1');
    const titleCell = ws.getCell('A1');
    titleCell.value = '       EVIDENCIA — REGISTRO SIN TARJETA';
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

    row = 2;
    ws.mergeCells('A2:K2');
    const metaCell = ws.getCell('A2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaCell.value = `Reporte generado: ${dateStr}  |  Total registros: ${total}  |  Personas únicas: ${uniquePeople}${filterDescription}`;
    metaCell.font = { name: 'Arial', size: 9, color: { argb: C.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(2).height = 20;
    row = 4;

    // ── KPIs ──
    sectionTitle('1. INDICADORES DE EVIDENCIA');
    kpi('B', 'Total registros', total, C.blue);
    kpi('D', 'Personas únicas', uniquePeople, C.emerald);
    kpi('F', 'Promedio / persona', avg.toFixed(2), C.sky);
    kpi('H', 'Reincidentes (≥2)', reincidentes, C.amber);
    row++;
    kpi('B', 'Frecuentes (≥3)', frecuentes, C.rose);
    kpi('D', 'Motivos distintos', reasonEntries.length, C.violet);
    kpi('F', 'Motivo principal', topReason ? topReason[1] : 0, C.amber);
    kpi('H', 'Operadores', operatorEntries.length, C.slate);
    ws.getRow(row).height = 32;
    if (topReason) {
        row++;
        ws.mergeCells(`B${row}:K${row}`);
        const note = ws.getCell(`B${row}`);
        note.value = `Motivo principal: "${topReason[0]}" (${topReason[1]} registros, ${pct(topReason[1], total)} del total)`;
        note.font = { name: 'Arial', size: 9, italic: true, color: { argb: C.meta } };
    }
    row += 2;

    // ── Reasons ──
    sectionTitle('2. DESGLOSE POR MOTIVO');
    ['MOTIVO', 'REGISTROS', '% DEL TOTAL'].forEach((label, i) => {
        const cell = ws.getCell(row, i + 2);
        cell.value = label;
        cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: C.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.rose.fg } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        setBorder(cell, C.rose.fg);
    });
    ws.getRow(row).height = 24;
    row++;

    reasonEntries.forEach(([reason, count]) => {
        const values = [reason, count, pct(count, total)];
        values.forEach((value, i) => {
            const cell = ws.getCell(row, i + 2);
            cell.value = value;
            cell.font = { name: 'Arial', size: 9, bold: i === 0, color: { argb: C.sectionHead } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i === 0 ? C.rose.bg : C.white } };
            cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0 };
            setBorder(cell);
        });
        ws.getRow(row).height = 22;
        row++;
    });
    if (reasonEntries.length === 0) {
        ws.getCell(`B${row}`).value = 'Sin datos';
        row++;
    }
    row += 2;

    // ── Dependency / Building ──
    sectionTitle('3. DISTRIBUCIÓN POR DEPENDENCIA Y EDIFICIO');

    ['DEPENDENCIA', 'REGISTROS', 'PERSONAS', '% REG.'].forEach((label, i) => {
        const cell = ws.getCell(row, i + 2);
        cell.value = label;
        cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: C.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.emerald.fg } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        setBorder(cell, C.emerald.fg);
    });
    ['EDIFICIO', 'REGISTROS', 'PERSONAS', '% REG.'].forEach((label, i) => {
        const cell = ws.getCell(row, i + 7);
        cell.value = label;
        cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: C.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.amber.fg } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        setBorder(cell, C.amber.fg);
    });
    ws.getRow(row).height = 24;
    row++;

    const maxDistRows = Math.max(depEntries.length, buildingEntries.length, 1);
    for (let i = 0; i < maxDistRows; i++) {
        const dep = depEntries[i];
        const bldg = buildingEntries[i];

        if (dep) {
            const values = [dep[0], dep[1].registros, dep[1].personas.size, pct(dep[1].registros, total)];
            values.forEach((value, colIdx) => {
                const cell = ws.getCell(row, colIdx + 2);
                cell.value = value;
                cell.font = { name: 'Arial', size: 9, bold: colIdx === 0, color: { argb: C.sectionHead } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colIdx === 0 ? C.emerald.bg : C.white } };
                cell.alignment = { vertical: 'middle', horizontal: colIdx === 0 ? 'left' : 'center', indent: colIdx === 0 ? 1 : 0 };
                setBorder(cell);
            });
        }

        if (bldg) {
            const values = [bldg[0], bldg[1].registros, bldg[1].personas.size, pct(bldg[1].registros, total)];
            values.forEach((value, colIdx) => {
                const cell = ws.getCell(row, colIdx + 7);
                cell.value = value;
                cell.font = { name: 'Arial', size: 9, bold: colIdx === 0, color: { argb: C.sectionHead } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colIdx === 0 ? C.amber.bg : C.white } };
                cell.alignment = { vertical: 'middle', horizontal: colIdx === 0 ? 'left' : 'center', indent: colIdx === 0 ? 1 : 0 };
                setBorder(cell);
            });
        }

        ws.getRow(row).height = 22;
        row++;
    }
    row += 2;

    // ── Operators ──
    sectionTitle('4. REGISTROS POR OPERADOR');
    ['OPERADOR', 'REGISTROS', '% DEL TOTAL'].forEach((label, i) => {
        const cell = ws.getCell(row, i + 2);
        cell.value = label;
        cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: C.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.slate.fg } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        setBorder(cell, C.slate.fg);
    });
    ws.getRow(row).height = 24;
    row++;

    operatorEntries.forEach(([op, count]) => {
        const values = [op, count, pct(count, total)];
        values.forEach((value, i) => {
            const cell = ws.getCell(row, i + 2);
            cell.value = value;
            cell.font = { name: 'Arial', size: 9, bold: i === 0, color: { argb: C.sectionHead } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i === 0 ? C.slate.bg : C.white } };
            cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0 };
            setBorder(cell);
        });
        ws.getRow(row).height = 22;
        row++;
    });

    row += 2;
    ws.mergeCells(`B${row}:K${row}`);
    const footer = ws.getCell(`B${row}`);
    footer.value =
        'Nota: Esta hoja resume la evidencia del periodo exportado. El detalle de reincidencia por persona está en "Reincidencia" y el detalle completo en "Detalle".';
    footer.font = { name: 'Arial', size: 8, italic: true, color: { argb: C.meta } };

    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];
}

// ─── Reincidence Sheet ─────────────────────────────────────────────────
async function addCardlessReincidenceSheet(
    workbook: ExcelJSTypes.Workbook,
    data: CardlessRegistryExportRow[],
    filterDescription: string
) {
    const ws = workbook.addWorksheet('Reincidencia');

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
        slate: { head: 'FFF1F5F9', sub: 'FF334155', fill: 'FFF8FAFC' },
    };

    const { people } = aggregateCardlessData(data);
    const total = data.length;
    const uniquePeople = people.length;
    const reincidentes = people.filter((p) => p.count >= 2).length;
    const frecuentes = people.filter((p) => p.count >= 3).length;
    const linkedPeople = people.filter((p) => p.isLinked).length;
    const manualPeople = uniquePeople - linkedPeople;

    const formatDate = (ms: number) =>
        new Date(ms).toLocaleString('es-MX', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });

    ws.columns = [
        { key: 'num',             width: 6  },  // A  #
        { key: 'linked',          width: 13 },  // B  Vínculo
        { key: 'last_name',       width: 24 },  // C  Apellidos
        { key: 'first_name',      width: 22 },  // D  Nombres
        { key: 'employee_no',     width: 14 },  // E  # Empleado
        { key: 'dependency',      width: 28 },  // F  Dependencia
        { key: 'building',        width: 20 },  // G  Edificio
        { key: 'count',           width: 14 },  // H  Total registros
        { key: 'distinctReasons', width: 12 },  // I  Motivos distintos
        { key: 'reasonBreakdown', width: 42 },  // J  Desglose
        { key: 'firstDate',       width: 20 },  // K  Primer registro
        { key: 'lastDate',        width: 20 },  // L  Último registro
        { key: 'operators',       width: 28 },  // M  Operadores
    ];

    // ── Row 1: Title ──
    ws.mergeCells('A1:M1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `       REINCIDENCIA POR PERSONA — REGISTRO SIN TARJETA${filterDescription}`;
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
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

    // ── Row 2: Meta ──
    ws.mergeCells('A2:M2');
    const metaCell = ws.getCell('A2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaCell.value = [
        `Reporte generado: ${dateStr}`,
        `Total registros: ${total}`,
        `Personas únicas: ${uniquePeople}`,
        `Reincidentes (≥2): ${reincidentes}`,
        `Frecuentes (≥3): ${frecuentes}`,
        `Vinculados: ${linkedPeople}`,
        `Manuales: ${manualPeople}`,
    ].join('  |  ');
    metaCell.font = { name: 'Arial', size: 9, color: { argb: COLORS.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(2).height = 20;

    // ── Row 3: Legend note ──
    ws.mergeCells('A3:M3');
    const legendCell = ws.getCell('A3');
    legendCell.value = '  Vínculo: ✔ Registrado = persona en sistema  |  ✗ No Registrado = ingresado sin vínculo    Severidad: Normal  |  Reincidente ≥2 (ámbar)  |  Frecuente ≥3 (rojo)';
    legendCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: COLORS.meta } };
    legendCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.slate.head } };
    legendCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(3).height = 18;

    // ── Row 4: Super-headers ──
    // cols: A=#, B=Vínculo, C-G=Personal, H-J=Reincidencia, K-L=Historial, M=Operadores
    const groups = [
        { label: '#',                  range: 'A4:A4', colors: COLORS.slate,    endCols: [1]  },
        { label: 'VÍNCULO',            range: 'B4:B4', colors: COLORS.emerald,  endCols: [2]  },
        { label: 'DATOS DEL PERSONAL', range: 'C4:G4', colors: COLORS.personal, endCols: [7]  },
        { label: 'REINCIDENCIA',       range: 'H4:J4', colors: COLORS.rose,     endCols: [10] },
        { label: 'HISTORIAL',          range: 'K4:L4', colors: COLORS.sky,      endCols: [12] },
        { label: 'OPERADORES',         range: 'M4:M4', colors: COLORS.violet,   endCols: [13] },
    ];

    groups.forEach((group) => {
        ws.mergeCells(group.range);
        const cell = ws.getCell(group.range.split(':')[0]);
        cell.value = group.label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.head } };
        cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: group.colors.sub } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top:    { style: 'thin',   color: { argb: 'FFCBD5E1' } },
            left:   { style: 'thin',   color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin',   color: { argb: 'FFCBD5E1' } },
            right:  { style: 'medium', color: { argb: COLORS.separator } },
        };
    });
    ws.getRow(4).height = 24;

    // ── Row 5: Sub-headers ──
    const subHeaders = [
        { label: 'NO.',              group: groups[0], col: 1  },
        { label: 'VÍNCULO',          group: groups[1], col: 2  },
        { label: 'APELLIDOS',        group: groups[2], col: 3  },
        { label: 'NOMBRES',          group: groups[2], col: 4  },
        { label: '# EMPLEADO',       group: groups[2], col: 5  },
        { label: 'DEPENDENCIA',      group: groups[2], col: 6  },
        { label: 'EDIFICIO',         group: groups[2], col: 7  },
        { label: 'TOTAL REGISTROS',  group: groups[3], col: 8  },
        { label: 'MOTIVOS',          group: groups[3], col: 9  },
        { label: 'DESGLOSE',         group: groups[3], col: 10 },
        { label: 'PRIMER REGISTRO',  group: groups[4], col: 11 },
        { label: 'ÚLTIMO REGISTRO',  group: groups[4], col: 12 },
        { label: 'OPERADORES',       group: groups[5], col: 13 },
    ];
    const groupEndCols = new Set(groups.flatMap((g) => g.endCols));

    const subHeaderRow = ws.getRow(5);
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

    ws.autoFilter = 'A5:M5';

    // ── Data rows ──
    people.forEach((person, idx) => {
        const reasonBreakdown = Object.entries(person.reasons)
            .sort((a, b) => b[1] - a[1])
            .map(([r, c]) => `${r} (${c})`)
            .join('; ');
        const minDate = person.dates.length ? Math.min(...person.dates) : NaN;
        const maxDate = person.dates.length ? Math.max(...person.dates) : NaN;

        // Severity: ≥3 = rose, ≥2 = amber, else slate
        const severity =
            person.count >= 3 ? COLORS.rose :
            person.count >= 2 ? COLORS.amber :
            COLORS.slate;

        const rowData = {
            num:             idx + 1,
            linked:          person.isLinked ? '✔ Registrado' : '✗ No Registrado',
            last_name:       person.lastName || '—',
            first_name:      person.firstName || '—',
            employee_no:     person.employeeNo || '—',
            dependency:      person.dependency,
            building:        person.building,
            count:           person.count,
            distinctReasons: Object.keys(person.reasons).length,
            reasonBreakdown,
            firstDate:       Number.isNaN(minDate) ? '—' : formatDate(minDate),
            lastDate:        Number.isNaN(maxDate) ? '—' : formatDate(maxDate),
            operators:       [...person.operators].join(', ') || '—',
        };

        const dataRow = ws.addRow(rowData);
        dataRow.height = person.count >= 2 ? 28 : 22;

        dataRow.eachCell((cell, colNumber) => {
            const subHeader = subHeaders.find((s) => s.col === colNumber);
            const group = subHeader?.group ?? groups[0];

            // Base style
            cell.font = { name: 'Arial', size: 9, color: { argb: 'FF111827' } };
            cell.alignment = {
                vertical: 'middle',
                // center: #(1), vínculo(2), emp_no(5), count(8), distinct(9)
                horizontal: [1, 2, 5, 8, 9].includes(colNumber) ? 'center' : 'left',
                indent: [3, 4, 6, 7, 10, 13].includes(colNumber) ? 1 : 0,
                wrapText: colNumber === 10 || colNumber === 13,
            };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.fill } };
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: {
                    style: groupEndCols.has(colNumber) ? 'medium' : 'thin',
                    color: { argb: groupEndCols.has(colNumber) ? COLORS.separator : 'FFCBD5E1' },
                },
            };

            // Vínculo badge (col 2)
            if (colNumber === 2) {
                if (person.isLinked) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.emerald.head } };
                    cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: COLORS.emerald.sub } };
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.amber.head } };
                    cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: COLORS.amber.sub } };
                }
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }

            // Count column — severity badge (col 8)
            if (colNumber === 8) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: severity.head } };
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: severity.sub } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }

            // Last name — bold + severity tint when reincident (col 3)
            if (colNumber === 3 && person.count >= 2) {
                cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF111827' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: severity.head } };
            }

            // Reason breakdown — subtle violet tint (col 10)
            if (colNumber === 10) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.violet.fill } };
                cell.font = { name: 'Arial', size: 8, color: { argb: COLORS.violet.sub } };
            }
        });
    });

    if (people.length === 0) {
        const emptyRow = ws.addRow({ name: 'Sin datos' });
        emptyRow.height = 22;
    }

    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }];
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
}

export async function exportCardlessRegistryToExcel(
    data: CardlessRegistryExportRow[],
    filters?: CardlessRegistryExportFilters
) {
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
        amber: { head: 'FFFEF3C7', sub: 'FF92400E', fill: 'FFFEFCE8' },
        sky: { head: 'FFE0F2FE', sub: 'FF075985', fill: 'FFF0F9FF' },
        emerald: { head: 'FFD1FAE5', sub: 'FF065F46', fill: 'FFF0FDF4' },
        rose: { head: 'FFFEE2E2', sub: 'FF991B1B', fill: 'FFFFF1F2' },
        violet: { head: 'FFEDE9FE', sub: 'FF5B21B6', fill: 'FFFAF5FF' },
        slate: { head: 'FFF1F5F9', sub: 'FF334155', fill: 'FFF8FAFC' }
    };

    const filterParts: string[] = [];
    if (filters?.startDate) filterParts.push(`Desde: ${filters.startDate}`);
    if (filters?.endDate) filterParts.push(`Hasta: ${filters.endDate}`);
    if (filters?.reason) filterParts.push(`Motivo: ${filters.reason}`);
    if (filters?.dependency) filterParts.push(`Dependencia: ${filters.dependency}`);
    if (filters?.search) filterParts.push(`Búsqueda: "${filters.search}"`);
    const filterDescription = filterParts.length ? `  |  ${filterParts.join('  |  ')}` : '';

    // Sheet 1: Evidence / summary
    await addCardlessEvidenceSheet(workbook, data, filterDescription);

    // Sheet 2: Reincidence by person
    await addCardlessReincidenceSheet(workbook, data, filterDescription);

    // Sheet 3: Detail
    const worksheet = workbook.addWorksheet('Detalle');

    worksheet.columns = [
        { key: 'linked',       width: 14 },  // A  Vínculo
        { key: 'first_name',   width: 18 },  // B
        { key: 'last_name',    width: 20 },  // C
        { key: 'employee_no',  width: 14 },  // D
        { key: 'dependency',   width: 28 },  // E
        { key: 'building',     width: 20 },  // F
        { key: 'floor',        width: 12 },  // G
        { key: 'reason',       width: 32 },  // H
        { key: 'comments',     width: 30 },  // I
        { key: 'recorded_at',  width: 20 },  // J
        { key: 'recorded_by',  width: 22 },  // K
    ];

    worksheet.mergeCells('A1:K1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = '       DETALLE — REGISTRO SIN TARJETA - NEXA';
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 40;

    try {
        const response = await fetch('/favicon.svg');
        if (response.ok) {
            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();
            const imageId = workbook.addImage({ buffer, extension: 'svg' as any });
            worksheet.addImage(imageId, {
                tl: { col: 0.15, row: 0.2 },
                ext: { width: 32, height: 32 }
            });
        }
    } catch {
        console.warn('Logo load failed');
    }

    worksheet.mergeCells('A2:K2');
    const metaCell = worksheet.getCell('A2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaCell.value = `Reporte generado: ${dateStr}  |  Registros: ${data.length}${filterDescription}`;
    metaCell.font = { name: 'Arial', size: 9, color: { argb: COLORS.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(2).height = 20;

    const groups = [
        { label: 'VÍNCULO',              range: 'A3:A3', colors: COLORS.emerald, endCol: 1  },
        { label: 'PERSONA',              range: 'B3:D3', colors: COLORS.personal, endCol: 4 },
        { label: 'ORGANIZACIÓN',         range: 'E3:E3', colors: COLORS.emerald,  endCol: 5 },
        { label: 'UBICACIÓN',            range: 'F3:G3', colors: COLORS.amber,    endCol: 7 },
        { label: 'MOTIVO DEL REGISTRO',  range: 'H3:I3', colors: COLORS.rose,     endCol: 9 },
        { label: 'CONTROL',              range: 'J3:K3', colors: COLORS.slate,    endCol: 11 },
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
            right: { style: 'medium', color: { argb: COLORS.separator } }
        };
    });

    const headerRow = worksheet.getRow(4);
    headerRow.height = 30;
    const headerLabels = [
        'VÍNCULO',
        'NOMBRES',
        'APELLIDOS',
        '# EMPLEADO',
        'DEPENDENCIA',
        'EDIFICIO',
        'PISO BASE',
        'MOTIVO',
        'COMENTARIOS',
        'FECHA / HORA',
        'REGISTRADO POR',
    ];

    const groupEnds = new Set(groups.map((g) => g.endCol));

    headerLabels.forEach((label, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = label;
        const group = groups.find((g) => {
            const col = String.fromCharCode(65 + i);
            const [start, end] = g.range.replace(/[0-9]/g, '').split(':');
            return col >= (start || 'A') && col <= (end || start || 'A');
        }) || groups[0];

        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.sub } };
        cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 8 };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
            right: {
                style: groupEnds.has(i + 1) ? 'medium' : 'thin',
                color: { argb: groupEnds.has(i + 1) ? COLORS.separator : 'FFFFFFFF' }
            }
        };
    });

    worksheet.autoFilter = 'A4:K4';

    data.forEach((reg) => {
        const { firstName, lastName } = cardlessPersonLabel(reg);
        const isLinked = !!reg.person_id;

        const excelRow = worksheet.addRow({
            linked:       isLinked ? '✔ Registrado' : '✗ No Registrado',
            first_name:   firstName,
            last_name:    lastName,
            employee_no:  reg.employee_no || '',
            dependency:   reg.dependencyName || '',
            building:     reg.buildingName || '',
            floor:        reg.floor || '',
            reason:       reg.reason,
            comments:     reg.comments || '',
            recorded_at:  new Date(reg.recorded_at).toLocaleString('es-MX'),
            recorded_by:  reg.recordedByName || '',
        });
        excelRow.height = 24;

        excelRow.eachCell((cell, colNumber) => {
            const colLetter = String.fromCharCode(64 + colNumber);
            const group = groups.find((g) => {
                const parts = g.range.replace(/[0-9]/g, '').split(':');
                return colLetter >= parts[0] && colLetter <= (parts[1] || parts[0]);
            }) || groups[0];

            cell.font = { name: 'Arial', size: 9 };
            cell.alignment = {
                vertical: 'middle',
                // col 1=linked, 4=emp_no, 7=floor, 10=date → center
                horizontal: [1, 4, 7, 10].includes(colNumber) ? 'center' : 'left',
                indent: [1, 4, 7, 10].includes(colNumber) ? 0 : 1,
                wrapText: colNumber === 8 || colNumber === 9
            };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.fill } };
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: {
                    style: groupEnds.has(colNumber) ? 'medium' : 'thin',
                    color: { argb: groupEnds.has(colNumber) ? COLORS.separator : 'FFCBD5E1' }
                }
            };

            // Linked/Manual badge (col 1)
            if (colNumber === 1) {
                if (isLinked) {
                    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.emerald.head } };
                    cell.font  = { name: 'Arial', size: 8, bold: true, color: { argb: COLORS.emerald.sub } };
                } else {
                    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.amber.head } };
                    cell.font  = { name: 'Arial', size: 8, bold: true, color: { argb: COLORS.amber.sub } };
                }
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }

            if (!cell.value || cell.value === '') {
                cell.value = '—';
                cell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF94A3B8' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }

            // Reason badge (col 8)
            if (colNumber === 8 && reg.reason) {
                cell.value = reg.reason;
                let badge = COLORS.slate;
                if (reg.reason.includes('Olvidada') || reg.reason === 'No la porta') badge = COLORS.amber;
                else if (reg.reason === 'Extraviada' || reg.reason === 'Robada') badge = COLORS.rose;
                else if (
                    reg.reason === 'No se le ha entregado' ||
                    reg.reason.includes('proceso') ||
                    reg.reason.includes('ingreso') ||
                    reg.reason.includes('Reposición')
                ) {
                    badge = COLORS.sky;
                }
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: badge.head } };
                cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: badge.sub } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            }
        });
    });

    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
    const finalFileName = `Registro_Sin_Tarjeta_Nexa_${new Date().toISOString().split('T')[0]}.xlsx`;
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

    const noUtilizadas = matchedData.filter(m => m.conteo === 0);
    const bajoUsoData = matchedData.filter(m => m.conteo > 0 && m.conteo < usageThreshold);

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
    kpiCard('B', 'Tarjetas No Utilizadas', noUtilizadas.length, noUtilizadas.length > 0 ? C.rose : C.emerald, pct(noUtilizadas.length, total));
    kpiCard('E', 'Personal bajo uso', bajoUsoData.length, bajoUsoData.length > 0 ? C.amber : C.emerald, pct(bajoUsoData.length, total));
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

    // ══════ SECTION 5: Usage by Personnel Status ══════
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
        sectionTitle('👤  USO POR ESTADO DEL PERSONAL');

        tableHeader([
            { col: 'B', label: 'ESTADO' },
            { col: 'C', label: 'PERSONAS' },
            { col: 'D', label: 'TOTAL USOS' },
            { col: 'E', label: 'PROMEDIO' },
            { col: 'F', label: 'NO UTILIZADAS' },
        ], C.amber);

        statusEntries.forEach(([status, stats]) => {
            const avg = stats.count > 0 ? (stats.totalUsos / stats.count).toFixed(1) : '0';
            tableRow([
                { col: 'B', value: status },
                { col: 'C', value: stats.count },
                { col: 'D', value: stats.totalUsos },
                { col: 'E', value: avg },
                { col: 'F', value: stats.noUtilizadas },
            ], C.amber);
        });
        row++;
    }

    // ══════ SECTION 6: Distribution by Days Without Use ══════
    const inactivityRanges = [
        { label: '0 – 7 días', filter: (d: number | null) => d !== null && d >= 0 && d <= 7 },
        { label: '8 – 30 días', filter: (d: number | null) => d !== null && d >= 8 && d <= 30 },
        { label: '31 – 60 días', filter: (d: number | null) => d !== null && d >= 31 && d <= 60 },
        { label: '61 – 90 días', filter: (d: number | null) => d !== null && d >= 61 && d <= 90 },
        { label: '90+ días', filter: (d: number | null) => d !== null && d > 90 },
        { label: 'Sin registro de uso', filter: (d: number | null) => d === null },
    ];

    sectionTitle('🕐  DISTRIBUCIÓN POR DÍAS SIN USO');

    tableHeader([
        { col: 'B', label: 'RANGO INACTIVIDAD' },
        { col: 'C', label: 'PERSONAS' },
        { col: 'D', label: '% DEL TOTAL' },
    ], C.rose);

    inactivityRanges.forEach(range => {
        const personas = matchedData.filter(m => range.filter(m.diasInactividad));
        tableRow([
            { col: 'B', value: range.label },
            { col: 'C', value: personas.length },
            { col: 'D', value: pct(personas.length, total) },
        ], C.rose);
    });

    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
    ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1 };
}

export async function exportKoneUsageToExcel(matchResult: KoneUsageMatchResult, usageThreshold: number = 10, dependencyFilter?: string) {
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
        'FOLIO KONE', 'USOS REGISTRADOS', 'DÍAS SIN USO'
    ];

    // ══════════════════════════════════════════════════════════════
    // SHEET 0: Guide — How to read this report
    // ══════════════════════════════════════════════════════════════
    const guideSheet = workbook.addWorksheet('Guía');
    guideSheet.columns = [
        { width: 4 },   // A spacer
        { width: 28 },  // B term/label
        { width: 65 },  // C description
    ];

    const C_GUIDE = {
        title: 'FF1E293B',
        meta: 'FF64748B',
        separator: 'FF94A3B8',
        white: 'FFFFFFFF',
        sectionHead: 'FF0F172A',
        blue: { bg: 'FFDBEAFE', fg: 'FF1E40AF' },
        sky: { bg: 'FFE0F2FE', fg: 'FF075985' },
        emerald: { bg: 'FFD1FAE5', fg: 'FF065F46' },
        amber: { bg: 'FFFEF3C7', fg: 'FF92400E' },
        rose: { bg: 'FFFEE2E2', fg: 'FF991B1B' },
        slate: { bg: 'FFF1F5F9', fg: 'FF334155' },
        violet: { bg: 'FFEDE9FE', fg: 'FF5B21B6' },
    };

    let gr = 1;

    // Title
    guideSheet.mergeCells('A1:C1');
    const guideTitle = guideSheet.getCell('A1');
    guideTitle.value = '       GUÍA DE INTERPRETACIÓN — REPORTE DE USO KONE';
    guideTitle.font = { name: 'Arial', bold: true, size: 16, color: { argb: C_GUIDE.title } };
    guideTitle.alignment = { vertical: 'middle', horizontal: 'left' };
    guideSheet.getRow(1).height = 40;

    try {
        const response = await fetch('/favicon.svg');
        if (response.ok) {
            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();
            const imageId = workbook.addImage({ buffer, extension: 'svg' as any });
            guideSheet.addImage(imageId, { tl: { col: 0.15, row: 0.2 }, ext: { width: 32, height: 32 } });
        }
    } catch { /* logo optional */ }

    guideSheet.mergeCells('A2:C2');
    const guideMeta = guideSheet.getCell('A2');
    guideMeta.value = `Este documento explica el contenido de cada hoja y cada indicador del reporte.`;
    guideMeta.font = { name: 'Arial', size: 9, color: { argb: C_GUIDE.meta } };
    guideMeta.alignment = { vertical: 'middle', horizontal: 'left' };
    guideSheet.getRow(2).height = 20;

    gr = 4;

    const guideSectionTitle = (text: string) => {
        guideSheet.mergeCells(`B${gr}:C${gr}`);
        const cell = guideSheet.getCell(`B${gr}`);
        cell.value = text;
        cell.font = { name: 'Arial', bold: true, size: 12, color: { argb: C_GUIDE.sectionHead } };
        cell.alignment = { vertical: 'middle' };
        guideSheet.getRow(gr).height = 28;
        gr++;
        guideSheet.mergeCells(`B${gr}:C${gr}`);
        guideSheet.getCell(`B${gr}`).border = { top: { style: 'medium', color: { argb: C_GUIDE.separator } } };
        guideSheet.getRow(gr).height = 6;
        gr++;
    };

    const guideTableHeader = (col1: string, col2: string, colors: { bg: string; fg: string }) => {
        const c1 = guideSheet.getCell(`B${gr}`);
        c1.value = col1;
        c1.font = { name: 'Arial', bold: true, size: 9, color: { argb: C_GUIDE.white } };
        c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.fg } };
        c1.alignment = { vertical: 'middle', horizontal: 'center' };
        c1.border = { top: thin(colors.fg), bottom: thin(colors.fg), left: thin(colors.fg), right: thin(colors.fg) };

        const c2 = guideSheet.getCell(`C${gr}`);
        c2.value = col2;
        c2.font = { name: 'Arial', bold: true, size: 9, color: { argb: C_GUIDE.white } };
        c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.fg } };
        c2.alignment = { vertical: 'middle', horizontal: 'center' };
        c2.border = { top: thin(colors.fg), bottom: thin(colors.fg), left: thin(colors.fg), right: thin(colors.fg) };
        guideSheet.getRow(gr).height = 24;
        gr++;
    };

    const guideRow = (term: string, desc: string, colors: { bg: string; fg: string }) => {
        const c1 = guideSheet.getCell(`B${gr}`);
        c1.value = term;
        c1.font = { name: 'Arial', bold: true, size: 9, color: { argb: colors.fg } };
        c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
        c1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
        c1.border = { top: thin('FFCBD5E1'), bottom: thin('FFCBD5E1'), left: thin('FFCBD5E1'), right: thin('FFCBD5E1') };

        const c2 = guideSheet.getCell(`C${gr}`);
        c2.value = desc;
        c2.font = { name: 'Arial', size: 9, color: { argb: C_GUIDE.sectionHead } };
        c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_GUIDE.white } };
        c2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
        c2.border = { top: thin('FFCBD5E1'), bottom: thin('FFCBD5E1'), left: thin('FFCBD5E1'), right: thin('FFCBD5E1') };
        guideSheet.getRow(gr).height = 36;
        gr++;
    };

    const guideNote = (text: string) => {
        guideSheet.mergeCells(`B${gr}:C${gr}`);
        const cell = guideSheet.getCell(`B${gr}`);
        cell.value = text;
        cell.font = { name: 'Arial', size: 9, italic: true, color: { argb: C_GUIDE.meta } };
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
        guideSheet.getRow(gr).height = 34;
        gr++;
    };

    // ── KPIs ──
    guideSectionTitle('📊  INDICADORES CLAVE DE USO (KPIs)');
    guideTableHeader('INDICADOR', 'DESCRIPCIÓN', C_GUIDE.blue);
    guideRow('Personal Registrado', 'Cantidad total de personas cuyas tarjetas KONE fueron identificadas y cruzadas con el directorio de personal.', C_GUIDE.blue);
    guideRow('Total de Usos', 'Suma total de todos los usos registrados de tarjetas KONE en el periodo analizado (incluye torniquetes y elevadores).', C_GUIDE.sky);
    guideRow('Promedio de usos', 'Número promedio de usos por persona. Puede verse inflado por usuarios con uso muy alto.', C_GUIDE.emerald);
    guideRow('Mediana de usos', 'Valor central de usos. Representa el uso típico y es más representativo que el promedio cuando hay valores extremos.', C_GUIDE.emerald);
    guideRow('Tarjetas No Utilizadas', 'Cantidad de tarjetas con 0 usos en el periodo. Están asignadas pero no fueron utilizadas. Se muestra el porcentaje respecto al total.', C_GUIDE.rose);
    guideRow('Personal bajo uso', 'Personas que sí utilizaron su tarjeta pero por debajo del umbral definido (excluyendo las de 0 usos). Indica uso esporádico.', C_GUIDE.amber);
    gr++;

    // ── Sections ──
    guideSectionTitle('📈  SECCIONES DEL RESUMEN EJECUTIVO');
    guideTableHeader('SECCIÓN', 'DESCRIPCIÓN', C_GUIDE.violet);
    guideRow('Distribución por Rango de Uso', 'Clasifica al personal según la cantidad de usos registrados en rangos: 0, 1–10, 11–50, 51–100, 101+. Muestra personas, porcentaje y usos acumulados por rango.', C_GUIDE.violet);
    guideRow('Distribución por Dependencias', 'Desglosa los datos por dependencia/organización. Incluye personas, usos totales, promedio y porcentaje de contribución.', C_GUIDE.violet);
    guideRow('Distribución por Edificio', 'Misma estructura que por dependencias pero agrupada por el edificio asignado.', C_GUIDE.violet);
    guideRow('Uso por Estado del Personal', 'Cruza el estado de la persona (Activo, Parcial, Bloqueado, Baja) con métricas de uso. Permite ver cuántas tarjetas sin uso pertenecen a personal activo vs. baja.', C_GUIDE.amber);
    guideRow('Distribución por Días Sin Uso', 'Clasifica según días desde el último uso: 0–7, 8–30, 31–60, 61–90, 90+, Sin registro. Identifica tarjetas que dejaron de usarse.', C_GUIDE.rose);
    gr++;

    // ── Sheets ──
    guideSectionTitle('📋  HOJAS DEL ARCHIVO');
    guideTableHeader('HOJA', 'CONTENIDO', C_GUIDE.sky);
    guideRow('Resumen — Uso KONE', 'Resumen ejecutivo con todos los indicadores clave, tablas de distribución por rango de uso, dependencia, edificio, estado del personal y días sin uso.', C_GUIDE.sky);
    guideRow('Tarjetas No Utilizadas', 'Listado de personal con tarjetas KONE de 0 usos. Incluye el estado de la persona (coloreado) para priorizar acciones.', C_GUIDE.rose);
    guideRow('Directorio con Conteo', 'Listado completo de todo el personal con su folio KONE, usos registrados y días sin uso. Celdas coloreadas según nivel de uso.', C_GUIDE.blue);
    guideRow('Personal Bajo Uso', 'Subconjunto del directorio filtrado a personas con usos por debajo del umbral configurado (excluyendo tarjetas con 0 usos).', C_GUIDE.amber);
    gr++;

    // ── Notes ──
    guideSectionTitle('📌  NOTAS GENERALES');
    guideNote('• Los datos corresponden al periodo cubierto por el archivo de reporte KONE importado.');
    guideNote('• "Días sin uso" = fecha límite seleccionada − fecha del último registro de uso en el reporte KONE.');
    guideNote('• Se excluyen automáticamente tarjetas creadas/modificadas después de la fecha de cortesía, para no penalizar tarjetas recién creadas.');
    guideNote('• Si un folio aparece más de una vez en el reporte KONE, sus conteos se suman automáticamente.');

    // ── Colors ──
    gr++;
    guideSectionTitle('🎨  CÓDIGO DE COLORES PARA USOS REGISTRADOS');
    guideTableHeader('COLOR', 'SIGNIFICADO', C_GUIDE.emerald);
    guideRow('🟢 Verde', 'Más de 100 usos — uso alto.', C_GUIDE.emerald);
    guideRow('🔵 Azul', 'Entre 51 y 100 usos — uso moderado.', C_GUIDE.sky);
    guideRow('🟡 Rojo claro', 'Por debajo del umbral de bajo uso.', C_GUIDE.amber);
    guideRow('🔴 Rojo fuerte', '0 usos — tarjeta no utilizada.', C_GUIDE.rose);
    gr++;
    guideSectionTitle('🎨  CÓDIGO DE COLORES PARA DÍAS SIN USO');
    guideTableHeader('COLOR', 'SIGNIFICADO', C_GUIDE.rose);
    guideRow('🟢 Verde suave', 'De 0 a 3 días sin uso — uso muy activo y reciente.', C_GUIDE.emerald);
    guideRow('🟡 Amarillo suave', 'De 4 a 7 días sin uso — uso regular reciente.', C_GUIDE.amber);
    guideRow('🟠 Naranja suave', 'De 8 a 10 días sin uso — inactividad leve / alerta.', C_GUIDE.sky);
    guideRow('🔴 Rojo suave', '11 o más días sin uso (o Sin registro de uso) — inactividad prolongada.', C_GUIDE.rose);

    guideSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
    guideSheet.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1 };

    // ══════════════════════════════════════════════════════════════
    // SHEET 1: Executive Summary — Usage Metrics (All)
    // ══════════════════════════════════════════════════════════════
    const dynamicTitle = dependencyFilter
        ? `REPORTE DE USO DE TARJETAS KONE — ${dependencyFilter.toUpperCase()}`
        : 'REPORTE DE USO DE TARJETAS KONE — NEXA';
    await addKoneSummarySheet(workbook, matchedData, 'Resumen — Uso KONE', dynamicTitle, usageThreshold);

    const bajoUsoData = matchedData.filter(m => m.conteo > 0 && m.conteo < usageThreshold);
    const noUtilizadasData = matchedData.filter(m => m.conteo === 0);


    // ══════════════════════════════════════════════════════════════
    // SHEET 2: Personnel Directory with Usage Count
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
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                        cell.font = { ...cell.font, color: { argb: 'FFB91C1C' }, bold: true };
                    } else if (conteoVal < usageThreshold) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
                        cell.font = { ...cell.font, bold: true, color: { argb: 'FF991B1B' } };
                    }
                }

                // Semáforo dinámico de días de inactividad
                if (colNumber === 11) {
                    const dias = entry.diasInactividad;
                    if (dias === null) {
                        cell.value = 'Sin registro';
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Rojo suave
                        cell.font = { ...cell.font, color: { argb: 'FFB91C1C' }, bold: true };
                    } else if (dias >= 11) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Rojo suave
                        cell.font = { ...cell.font, color: { argb: 'FFB91C1C' }, bold: true };
                    } else if (dias >= 8 && dias <= 10) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } }; // Naranja suave
                        cell.font = { ...cell.font, color: { argb: 'FFC2410C' }, bold: true };
                    } else if (dias >= 4 && dias <= 7) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } }; // Amarillo suave
                        cell.font = { ...cell.font, color: { argb: 'FF854D0E' }, bold: true };
                    } else {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Verde suave
                        cell.font = { ...cell.font, color: { argb: 'FF065F46' }, bold: true };
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
    // SHEET 3: Tarjetas No Utilizadas Directory
    // ══════════════════════════════════════════════════════════════
    if (noUtilizadasData.length > 0) {
        const noUseSheet = workbook.addWorksheet('Tarjetas No Utilizadas');
        noUseSheet.columns = [
            { key: 'last_name', width: 25 }, { key: 'first_name', width: 25 }, { key: 'employee_no', width: 15 },
            { key: 'building', width: 22 }, { key: 'dependency', width: 28 }, { key: 'area', width: 22 },
            { key: 'position', width: 28 }, { key: 'floor', width: 12 },
            { key: 'folioKone', width: 18 }, { key: 'status', width: 16 }, { key: 'diasInactividad', width: 18 }
        ];

        noUseSheet.mergeCells('A1:K1');
        const nuTitle = noUseSheet.getCell('A1');
        nuTitle.value = `       TARJETAS KONE NO UTILIZADAS — NEXA`;
        nuTitle.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
        nuTitle.alignment = { vertical: 'middle', horizontal: 'left' };
        noUseSheet.getRow(1).height = 40;

        try {
            const response = await fetch('/favicon.svg');
            if (response.ok) {
                const blob = await response.blob();
                const buffer = await blob.arrayBuffer();
                const imageId = workbook.addImage({ buffer, extension: 'svg' as any });
                noUseSheet.addImage(imageId, { tl: { col: 0.15, row: 0.2 }, ext: { width: 32, height: 32 } });
            }
        } catch { /* logo optional */ }

        noUseSheet.mergeCells('A2:K2');
        const nuMeta = noUseSheet.getCell('A2');
        nuMeta.value = `Reporte generado: ${dateStr}  |  Tarjetas sin uso: ${noUtilizadasData.length} de ${total} (${((noUtilizadasData.length / total) * 100).toFixed(1)}%)`;
        nuMeta.font = { name: 'Arial', size: 9, color: { argb: COLORS.meta } };
        nuMeta.alignment = { vertical: 'middle', horizontal: 'left' };
        noUseSheet.getRow(2).height = 20;

        // Super-headers
        const nuGroups = [
            { label: 'DATOS PERSONALES', range: 'A3:C3', colors: COLORS.personal },
            { label: 'UBICACIÓN Y PUESTO', range: 'D3:H3', colors: COLORS.location },
            { label: 'TARJETA KONE', range: 'I3:K3', colors: COLORS.rose },
        ];
        nuGroups.forEach(group => {
            noUseSheet.mergeCells(group.range);
            const cell = noUseSheet.getCell(group.range.split(':')[0]);
            cell.value = group.label;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.head } };
            cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: group.colors.sub } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: thin('FFCBD5E1'), left: thin('FFCBD5E1'),
                bottom: thin('FFCBD5E1'), right: { style: 'medium', color: { argb: COLORS.separator } }
            };
        });

        const nuSubRow = noUseSheet.getRow(4);
        nuSubRow.height = 30;
        const nuLabels = ['APELLIDOS', 'NOMBRES', 'NO. EMPLEADO', 'EDIFICIO', 'DEPENDENCIA', 'EQUIPO', 'PUESTO', 'PISO BASE', 'FOLIO KONE', 'ESTADO', 'DÍAS SIN USO'];
        nuLabels.forEach((label, i) => {
            const cell = nuSubRow.getCell(i + 1);
            cell.value = label;
            const colLetter = String.fromCharCode(65 + i);
            const group = nuGroups.find(g => {
                const [start, end] = g.range.replace(/[0-9]/g, '').split(':');
                return colLetter >= (start || 'A') && colLetter <= (end || start || 'A');
            }) || nuGroups[0];
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.sub } };
            cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 8 };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            const isGroupEnd = [3, 8, 11].includes(i + 1);
            cell.border = {
                bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
                right: { style: isGroupEnd ? 'medium' : 'thin', color: { argb: isGroupEnd ? COLORS.separator : 'FFFFFFFF' } }
            };
        });

        noUtilizadasData.forEach(entry => {
            const person = entry.person;
            const dataRow = noUseSheet.addRow({
                last_name: person.last_name || '-',
                first_name: person.first_name || '-',
                employee_no: person.employee_no || '-',
                building: person.building || '-',
                dependency: person.dependency || '-',
                area: person.area || '-',
                position: person.position || '-',
                floor: person.floor || '-',
                folioKone: entry.folio,
                status: person.status || '-',
                diasInactividad: entry.diasInactividad !== null ? entry.diasInactividad : 'Sin registro'
            });
            dataRow.height = 24;

            const isInactive = person.status === 'Baja' || person.status === 'Bloqueado/a';
            dataRow.eachCell((cell, colNumber) => {
                const colLetter = String.fromCharCode(64 + colNumber);
                const group = nuGroups.find(g => {
                    const parts = g.range.replace(/[0-9]/g, '').split(':');
                    return colLetter >= parts[0] && colLetter <= (parts[1] || parts[0]);
                }) || nuGroups[0];

                cell.font = { name: 'Arial', size: 9, color: { argb: isInactive ? 'FF64748B' : 'FF111827' }, italic: isInactive };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                const isGroupEnd = [3, 8, 11].includes(colNumber);
                setBorder(cell, isGroupEnd ? COLORS.separator : 'FFCBD5E1');

                if (isInactive) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.fill } };
                }

                // Status column coloring
                if (colNumber === 10) {
                    if (person.status === 'Activo/a') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
                        cell.font = { color: { argb: 'FF166534' }, bold: true, name: 'Arial', size: 9 };
                    } else if (person.status === 'Parcial') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                        cell.font = { color: { argb: 'FF92400E' }, bold: true, name: 'Arial', size: 9 };
                    } else if (person.status === 'Bloqueado/a') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                        cell.font = { color: { argb: 'FF991B1B' }, bold: true, name: 'Arial', size: 9 };
                    } else if (person.status === 'Baja' || person.status === 'Sin Acceso') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                        cell.font = { color: { argb: 'FF475569' }, italic: true, name: 'Arial', size: 9 };
                    }
                }

                // Semáforo dinámico de días de inactividad
                if (colNumber === 11) {
                    const dias = entry.diasInactividad;
                    if (dias === null) {
                        cell.value = 'Sin registro';
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Rojo suave
                        cell.font = { ...cell.font, color: { argb: 'FFB91C1C' }, bold: true };
                    } else if (dias >= 11) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Rojo suave
                        cell.font = { ...cell.font, color: { argb: 'FFB91C1C' }, bold: true };
                    } else if (dias >= 8 && dias <= 10) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } }; // Naranja suave
                        cell.font = { ...cell.font, color: { argb: 'FFC2410C' }, bold: true };
                    } else if (dias >= 4 && dias <= 7) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } }; // Amarillo suave
                        cell.font = { ...cell.font, color: { argb: 'FF854D0E' }, bold: true };
                    } else {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Verde suave
                        cell.font = { ...cell.font, color: { argb: 'FF065F46' }, bold: true };
                    }
                }

                if (colNumber !== 10 && colNumber !== 11 && (cell.value === '-' || cell.value === 'N/A' || !cell.value)) {
                    cell.value = '[SIN DATO]';
                    cell.font = { ...cell.font, color: { argb: 'FFB91C1C' }, italic: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                }
            });
        });

        noUseSheet.autoFilter = 'A4:K4';
        noUseSheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 4 }];
    }
    // ══════════════════════════════════════════════════════════════
    // SHEET 4: Low Usage Directory
    // ══════════════════════════════════════════════════════════════
    if (bajoUsoData.length > 0) {
        const lowUsageSheet = workbook.addWorksheet('Personal Bajo Uso');
        lowUsageSheet.columns = dataSheet.columns;
        const luGroups = await setupDirectorySheet(lowUsageSheet, `PERSONAL CON BAJO USO (< ${usageThreshold}) — NEXA`, `Filtrado por: 0 < Conteo < ${usageThreshold}  |  Registros: ${bajoUsoData.length}`);
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
        const unfLabels = ['FOLIO', 'USOS REGISTRADOS', 'DÍAS SIN USO'];
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
        unmatchedSheet.state = 'hidden';
    }

    // ── Save ──
    const depSuffix = dependencyFilter ? `_${dependencyFilter.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').replace(/\s+/g, '_')}` : '';
    const finalFileName = `Conteo_Uso_KONE${depSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAsFunction(new Blob([buffer]), finalFileName);
}

export async function exportMissingCardsToExcel(
    missingData: { folio: string, status: string, observation: string, date: string, personName: string }[],
    type: string, start: number, end: number
) {
    const [ExcelJSModule, { saveAs: saveAsFunction }] = await Promise.all([
        import('exceljs'),
        import('file-saver')
    ]);
    const workbook = new (ExcelJSModule.default || ExcelJSModule).Workbook();
    const worksheet = workbook.addWorksheet('Análisis de Folios');

    const C = {
        title: 'FF1E293B',
        meta: 'FF64748B',
        white: 'FFFFFFFF',
        sectionHead: 'FF0F172A',
        // Category colors
        amber: { bg: 'FFFEF3C7', fg: 'FF92400E' },    // Reposición
        rose: { bg: 'FFFEE2E2', fg: 'FF991B1B' },      // Tarjeta no devuelta
        slate: { bg: 'FFF1F5F9', fg: 'FF334155' },      // Sin registro
        blue: { bg: 'FFDBEAFE', fg: 'FF1E40AF' },       // KONE header
        sky: { bg: 'FFE0F2FE', fg: 'FF075985' },        // KPI
        emerald: { bg: 'FFD1FAE5', fg: 'FF065F46' },    // KPI
    };

    const thin = (argb: string): ExcelJSTypes.Border => ({ style: 'thin', color: { argb } });
    const setBorder = (cell: ExcelJSTypes.Cell, color = 'FFCBD5E1') => {
        cell.border = { top: thin(color), bottom: thin(color), left: thin(color), right: thin(color) };
    };

    worksheet.columns = [
        { key: 'folio', width: 16 },
        { key: 'status', width: 20 },
        { key: 'observation', width: 30 },
        { key: 'date', width: 22 },
        { key: 'personName', width: 35 },
    ];

    const headerColor = type === 'KONE' ? C.blue : C.amber;

    // ══════ ROW 1: Title ══════
    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `       ANÁLISIS DE FOLIOS FALTANTES — ${type}`;
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: C.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 40;

    try {
        const response = await fetch('/favicon.svg');
        if (response.ok) {
            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();
            const imageId = workbook.addImage({ buffer, extension: 'svg' as any });
            worksheet.addImage(imageId, { tl: { col: 0.15, row: 0.2 }, ext: { width: 32, height: 32 } });
        }
    } catch { /* logo optional */ }

    // ══════ ROW 2: Meta ══════
    worksheet.mergeCells('A2:E2');
    const metaCell = worksheet.getCell('A2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaCell.value = `Reporte generado: ${dateStr}  |  Rango: ${start} al ${end}  |  Total incidencias: ${missingData.length}`;
    metaCell.font = { name: 'Arial', size: 9, color: { argb: C.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(2).height = 20;

    // ══════ ROW 4-6: Summary KPIs ══════
    const countReposicion = missingData.filter(d => d.observation === 'Extravío / Reposición').length;
    const countNoDevuelta = missingData.filter(d => d.observation.startsWith('Tarjeta no devuelta')).length;
    const countSinRegistro = missingData.filter(d => d.observation === 'No registrada').length;
    const countEliminada = missingData.filter(d => d.observation === 'Eliminada permanentemente').length;
    const countOther = missingData.length - countReposicion - countNoDevuelta - countSinRegistro - countEliminada;

    let row = 4;

    // Section Title
    worksheet.mergeCells(`A${row}:E${row}`);
    const secTitle = worksheet.getCell(`A${row}`);
    secTitle.value = '📊  RESUMEN POR CATEGORÍA';
    secTitle.font = { name: 'Arial', bold: true, size: 12, color: { argb: C.sectionHead } };
    secTitle.alignment = { vertical: 'middle' };
    worksheet.getRow(row).height = 28;
    row++;

    // KPI cards in a row
    const kpis = [
        { label: 'Extravío / Rep.', count: countReposicion, colors: C.amber },
        { label: 'No Devuelta', count: countNoDevuelta, colors: C.rose },
        { label: 'Eliminada Perm.', count: countEliminada, colors: C.sky },
        { label: 'No Registrada', count: countSinRegistro, colors: C.slate },
    ];

    if (countOther > 0) {
        kpis.push({ label: 'Otros', count: countOther, colors: C.emerald });
    }

    // KPI Labels Row
    kpis.forEach((kpi, i) => {
        const col = String.fromCharCode(65 + i); // A, B, C, D
        const lCell = worksheet.getCell(`${col}${row}`);
        lCell.value = kpi.label;
        lCell.font = { name: 'Arial', bold: true, size: 9, color: { argb: kpi.colors.fg } };
        lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.colors.bg } };
        lCell.alignment = { vertical: 'middle', horizontal: 'center' };
        setBorder(lCell);
    });
    worksheet.getRow(row).height = 22;
    row++;

    // KPI Values Row
    kpis.forEach((kpi, i) => {
        const col = String.fromCharCode(65 + i);
        const vCell = worksheet.getCell(`${col}${row}`);
        vCell.value = kpi.count;
        vCell.font = { name: 'Arial', bold: true, size: 18, color: { argb: kpi.colors.fg } };
        vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.colors.bg } };
        vCell.alignment = { vertical: 'middle', horizontal: 'center' };
        setBorder(vCell);
    });
    worksheet.getRow(row).height = 36;
    row++;

    // Total
    const totalCell = worksheet.getCell(`A${row}`);
    totalCell.value = 'TOTAL INCIDENCIAS';
    totalCell.font = { name: 'Arial', bold: true, size: 9, color: { argb: C.sectionHead } };
    totalCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    setBorder(totalCell);
    const totalValCell = worksheet.getCell(`B${row}`);
    totalValCell.value = missingData.length;
    totalValCell.font = { name: 'Arial', bold: true, size: 14, color: { argb: C.sectionHead } };
    totalValCell.alignment = { vertical: 'middle', horizontal: 'center' };
    setBorder(totalValCell);
    worksheet.getRow(row).height = 28;
    row++;
    row++; // spacer

    // ══════ DATA TABLE ══════
    worksheet.mergeCells(`A${row}:E${row}`);
    const dataTitle = worksheet.getCell(`A${row}`);
    dataTitle.value = '📋  DETALLE DE INCIDENCIAS';
    dataTitle.font = { name: 'Arial', bold: true, size: 12, color: { argb: C.sectionHead } };
    dataTitle.alignment = { vertical: 'middle' };
    worksheet.getRow(row).height = 28;
    row++;

    // Header Row
    const dataHeaderRow = row;
    const labels = ['FOLIO', 'ESTADO', 'OBSERVACIÓN', 'FECHA', 'ÚLTIMA PERSONA'];
    labels.forEach((label, i) => {
        const cell = worksheet.getRow(row).getCell(i + 1);
        cell.value = label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor.fg } };
        cell.font = { name: 'Arial', bold: true, color: { argb: C.white }, size: 9 };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            bottom: { style: 'medium', color: { argb: C.white } },
            right: { style: 'thin', color: { argb: C.white } }
        };
    });
    worksheet.getRow(row).height = 26;
    row++;

    // Data Rows with color coding
    missingData.forEach(item => {
        const dataRow = worksheet.addRow({
            folio: item.folio,
            status: item.status,
            observation: item.observation,
            date: item.date,
            personName: item.personName
        });
        dataRow.height = 22;

        // Determine row color based on observation
        let rowColors = C.slate; // default: No registrada
        if (item.observation === 'Extravío / Reposición') {
            rowColors = C.amber;
        } else if (item.observation.startsWith('Tarjeta no devuelta')) {
            rowColors = C.rose;
        } else if (item.observation === 'Eliminada permanentemente') {
            rowColors = C.sky;
        }

        dataRow.eachCell((cell, colNumber) => {
            cell.font = { name: 'Arial', size: 9, color: { argb: '111827' } };
            cell.alignment = {
                vertical: 'middle',
                horizontal: colNumber === 5 ? 'left' : 'center',
                indent: colNumber === 5 ? 1 : 0
            };
            cell.border = {
                bottom: thin('FFCBD5E1'),
                right: thin('FFCBD5E1'),
                left: thin('FFCBD5E1'),
                top: thin('FFCBD5E1')
            };

            // Color the observation column with the category color
            if (colNumber === 3) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColors.bg } };
                cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: rowColors.fg } };
            }
        });
    });

    // Auto-filter on the data header
    worksheet.autoFilter = `A${dataHeaderRow}:E${dataHeaderRow}`;

    // Freeze rows above the data
    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: dataHeaderRow }];

    const finalFileName = `Analisis_Folios_${type}_${start}_a_${end}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAsFunction(new Blob([buffer]), finalFileName);
}

