import type * as ExcelJSTypes from 'exceljs';
import { addLogoToSheet } from './xlsxShared';
import { batchPaginate } from './batchPaginate';

// ─── Types ─────────────────────────────────────────────────────────────

export type CardlessRegistryExportRow = {
    person_id?: string | null;
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
    pendingKoneResponsiva?: boolean;
    koneResponsivaSignedAt?: string | null;
};

export type CardlessRegistryExportFilters = {
    startDate?: string;
    endDate?: string;
    reason?: string;
    dependency?: string;
    search?: string;
};

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
    isLinked: boolean;
    pendingKoneResponsiva?: boolean;
    koneSignedAt?: string | null;
};

// ─── Helpers ───────────────────────────────────────────────────────────

function cardlessPersonKey(reg: CardlessRegistryExportRow): string {
    const emp = (reg.employee_no || '').trim().toLowerCase();
    if (emp) return `emp:${emp}`;
    const name = (
        reg.personName ||
        [reg.first_name, reg.last_name].filter(Boolean).join(' ') ||
        'sin nombre'
    ).trim().toLowerCase().replace(/\s+/g, ' ');
    return `name:${name}`;
}

function cardlessPersonLabel(reg: CardlessRegistryExportRow): { name: string; firstName: string; lastName: string; employeeNo: string } {
    const firstName = reg.first_name || (reg.personName ? reg.personName.split(' ').slice(0, -1).join(' ') : '') || '';
    const lastName = reg.last_name || (reg.personName ? reg.personName.split(' ').slice(-1).join(' ') : '') || '';
    const name = reg.personName || [firstName, lastName].filter(Boolean).join(' ') || 'Sin nombre';
    return { name, firstName, lastName, employeeNo: reg.employee_no || '' };
}

async function fetchKoneResponsivaSignDates(): Promise<Map<string, string>> {
    const { supabase } = await import('../supabase');
    const signMap = new Map<string, string>();

    try {
        const allRows = await batchPaginate(
            (from, to) => supabase
                .from('signed_responsivas')
                .select('person_id, created_at')
                .eq('card_type', 'KONE')
                .order('created_at', { ascending: false })
                .range(from, to),
            1000
        );

        for (const row of allRows) {
            if (!row.person_id) continue;
            const existing = signMap.get(row.person_id);
            if (!existing || row.created_at > existing) {
                signMap.set(row.person_id, row.created_at);
            }
        }
    } catch {
        // Non-critical — export continues without sign dates
    }

    return signMap;
}

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
        if (reg.pendingKoneResponsiva !== undefined) agg.pendingKoneResponsiva = reg.pendingKoneResponsiva;
        if (reg.koneResponsivaSignedAt) {
            if (!agg.koneSignedAt || reg.koneResponsivaSignedAt > agg.koneSignedAt) {
                agg.koneSignedAt = reg.koneResponsivaSignedAt;
            }
        }
    });

    const people = [...personMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(a.name, 'es'));
    return { people, reasonMap, depMap, buildingMap, operatorMap };
}

// ─── Evidence Sheet ────────────────────────────────────────────────────

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
        { width: 4 }, { width: 28 }, { width: 14 }, { width: 14 },
        { width: 26 }, { width: 16 }, { width: 16 }, { width: 14 },
        { width: 42 }, { width: 20 }, { width: 20 },
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
        new Date(ms).toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

    ws.mergeCells('A1:K1');
    const titleCell = ws.getCell('A1');
    titleCell.value = '       EVIDENCIA — REGISTRO SIN TARJETA';
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: C.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(1).height = 40;

    await addLogoToSheet(workbook, ws);

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
    footer.value = 'Nota: Esta hoja resume la evidencia del periodo exportado. El detalle de reincidencia por persona está en "Reincidencia" y el detalle completo en "Detalle".';
    footer.font = { name: 'Arial', size: 8, italic: true, color: { argb: C.meta } };

    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];
}

// ─── Reincidence Sheet ────────────────────────────────────────────────

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
        new Date(ms).toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

    ws.columns = [
        { key: 'num', width: 6 },
        { key: 'linked', width: 13 },
        { key: 'last_name', width: 24 },
        { key: 'first_name', width: 22 },
        { key: 'employee_no', width: 14 },
        { key: 'dependency', width: 28 },
        { key: 'building', width: 20 },
        { key: 'count', width: 14 },
        { key: 'distinctReasons', width: 12 },
        { key: 'reasonBreakdown', width: 42 },
        { key: 'firstDate', width: 20 },
        { key: 'lastDate', width: 20 },
        { key: 'operators', width: 28 },
        { key: 'pending_kone', width: 22 },
        { key: 'signed_at', width: 22 },
    ];

    ws.mergeCells('A1:O1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `       REINCIDENCIA POR PERSONA — REGISTRO SIN TARJETA${filterDescription}`;
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(1).height = 40;

    await addLogoToSheet(workbook, ws);

    ws.mergeCells('A2:O2');
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

    ws.mergeCells('A3:O3');
    const legendCell = ws.getCell('A3');
    legendCell.value = '  Vínculo: ✔ Registrado = persona en sistema  |  ✗ No Registrado = ingresado sin vínculo    Severidad: Normal  |  Reincidente ≥2 (ámbar)  |  Frecuente ≥3 (rojo)';
    legendCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: COLORS.meta } };
    legendCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.slate.head } };
    legendCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(3).height = 18;

    const groups = [
        { label: '#', range: 'A4:A4', colors: COLORS.slate, endCols: [1] },
        { label: 'VÍNCULO', range: 'B4:B4', colors: COLORS.emerald, endCols: [2] },
        { label: 'DATOS DEL PERSONAL', range: 'C4:G4', colors: COLORS.personal, endCols: [7] },
        { label: 'REINCIDENCIA', range: 'H4:J4', colors: COLORS.rose, endCols: [10] },
        { label: 'HISTORIAL', range: 'K4:L4', colors: COLORS.sky, endCols: [12] },
        { label: 'OPERADORES', range: 'M4:M4', colors: COLORS.violet, endCols: [13] },
        { label: 'TARJETA KONE', range: 'N4:O4', colors: COLORS.emerald, endCols: [15] },
    ];

    groups.forEach((group) => {
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
            right: { style: 'medium', color: { argb: COLORS.separator } },
        };
    });
    ws.getRow(4).height = 24;

    const subHeaders = [
        { label: 'NO.', group: groups[0], col: 1 },
        { label: 'VÍNCULO', group: groups[1], col: 2 },
        { label: 'APELLIDOS', group: groups[2], col: 3 },
        { label: 'NOMBRES', group: groups[2], col: 4 },
        { label: '# EMPLEADO', group: groups[2], col: 5 },
        { label: 'DEPENDENCIA', group: groups[2], col: 6 },
        { label: 'EDIFICIO', group: groups[2], col: 7 },
        { label: 'TOTAL REGISTROS', group: groups[3], col: 8 },
        { label: 'MOTIVOS', group: groups[3], col: 9 },
        { label: 'DESGLOSE', group: groups[3], col: 10 },
        { label: 'PRIMER REGISTRO', group: groups[4], col: 11 },
        { label: 'ÚLTIMO REGISTRO', group: groups[4], col: 12 },
        { label: 'OPERADORES', group: groups[5], col: 13 },
        { label: 'TARJETA KONE', group: groups[6], col: 14 },
        { label: 'FECHA ENTREGA', group: groups[6], col: 15 },
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

    ws.autoFilter = 'A5:O5';

    people.forEach((person, idx) => {
        const reasonBreakdown = Object.entries(person.reasons)
            .sort((a, b) => b[1] - a[1])
            .map(([r, c]) => `${r} (${c})`)
            .join('; ');
        const minDate = person.dates.length ? Math.min(...person.dates) : NaN;
        const maxDate = person.dates.length ? Math.max(...person.dates) : NaN;

        const severity = person.count >= 3 ? COLORS.rose : person.count >= 2 ? COLORS.amber : COLORS.slate;

        const koneLabel = !person.isLinked
            ? 'N/A'
            : person.pendingKoneResponsiva ? 'PENDIENTE DE RECOGER' : 'ENTREGADA';

        const signedAtLabel = !person.isLinked
            ? ''
            : person.koneSignedAt
                ? new Date(person.koneSignedAt).toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '';

        const rowData = {
            num: idx + 1,
            linked: person.isLinked ? '✔ Registrado' : '✗ No Registrado',
            last_name: person.lastName || '—',
            first_name: person.firstName || '—',
            employee_no: person.employeeNo || '—',
            dependency: person.dependency,
            building: person.building,
            count: person.count,
            distinctReasons: Object.keys(person.reasons).length,
            reasonBreakdown,
            firstDate: Number.isNaN(minDate) ? '—' : formatDate(minDate),
            lastDate: Number.isNaN(maxDate) ? '—' : formatDate(maxDate),
            operators: [...person.operators].join(', ') || '—',
            pending_kone: koneLabel,
            signed_at: signedAtLabel,
        };

        const dataRow = ws.addRow(rowData);
        dataRow.height = person.count >= 2 ? 28 : 22;

        dataRow.eachCell((cell, colNumber) => {
            const subHeader = subHeaders.find((s) => s.col === colNumber);
            const group = subHeader?.group ?? groups[0];

            cell.font = { name: 'Arial', size: 9, color: { argb: 'FF111827' } };
            cell.alignment = {
                vertical: 'middle',
                horizontal: [1, 2, 5, 8, 9, 14, 15].includes(colNumber) ? 'center' : 'left',
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

            if (colNumber === 8) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: severity.head } };
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: severity.sub } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }

            if (colNumber === 3 && person.count >= 2) {
                cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF111827' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: severity.head } };
            }

            if (colNumber === 10) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.violet.fill } };
                cell.font = { name: 'Arial', size: 8, color: { argb: COLORS.violet.sub } };
            }

            if (colNumber === 14) {
                if (!person.isLinked) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.slate.head } };
                    cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: COLORS.slate.sub } };
                } else if (person.pendingKoneResponsiva) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.rose.head } };
                    cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: COLORS.rose.sub } };
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.emerald.head } };
                    cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: COLORS.emerald.sub } };
                }
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }

            if (colNumber === 15) {
                if (!person.isLinked) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.slate.head } };
                    cell.font = { name: 'Arial', size: 8, italic: true, color: { argb: COLORS.slate.sub } };
                    cell.value = 'N/A';
                } else if (person.koneSignedAt) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.emerald.head } };
                    cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: COLORS.emerald.sub } };
                } else if (!person.pendingKoneResponsiva) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.sky.head } };
                    cell.font = { name: 'Arial', size: 8, italic: true, color: { argb: COLORS.sky.sub } };
                    cell.value = 'Entrega previa al sistema';
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.rose.head } };
                    cell.font = { name: 'Arial', size: 8, italic: true, color: { argb: COLORS.rose.sub } };
                    cell.value = 'Pendiente';
                }
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
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

// ─── Main Export Function ─────────────────────────────────────────────

export async function exportCardlessRegistryToExcel(
    data: CardlessRegistryExportRow[],
    filters?: CardlessRegistryExportFilters,
    returnBuffer?: false
): Promise<void>;
export async function exportCardlessRegistryToExcel(
    data: CardlessRegistryExportRow[],
    filters: CardlessRegistryExportFilters | undefined,
    returnBuffer: true
): Promise<{ buffer: ArrayBuffer; filename: string }>;
export async function exportCardlessRegistryToExcel(
    data: CardlessRegistryExportRow[],
    filters?: CardlessRegistryExportFilters,
    returnBuffer?: boolean
): Promise<void | { buffer: ArrayBuffer; filename: string }> {
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

    const signDateMap = await fetchKoneResponsivaSignDates();
    const enrichedData: CardlessRegistryExportRow[] = data.map(row => ({
        ...row,
        koneResponsivaSignedAt: row.person_id ? (signDateMap.get(row.person_id) ?? null) : null,
    }));

    await addCardlessEvidenceSheet(workbook, enrichedData, filterDescription);
    await addCardlessReincidenceSheet(workbook, enrichedData, filterDescription);

    // Sheet 3: Detail
    const worksheet = workbook.addWorksheet('Detalle');

    worksheet.columns = [
        { key: 'linked', width: 14 },
        { key: 'first_name', width: 18 },
        { key: 'last_name', width: 20 },
        { key: 'employee_no', width: 14 },
        { key: 'dependency', width: 28 },
        { key: 'building', width: 20 },
        { key: 'floor', width: 12 },
        { key: 'reason', width: 32 },
        { key: 'comments', width: 30 },
        { key: 'recorded_at', width: 20 },
        { key: 'recorded_by', width: 22 },
        { key: 'pending_kone', width: 22 },
        { key: 'signed_at', width: 22 },
    ];

    worksheet.mergeCells('A1:M1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = '       DETALLE — REGISTRO SIN TARJETA - NEXA';
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 40;

    await addLogoToSheet(workbook, worksheet);

    worksheet.mergeCells('A2:M2');
    const metaCell = worksheet.getCell('A2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaCell.value = `Reporte generado: ${dateStr}  |  Registros: ${enrichedData.length}${filterDescription}`;
    metaCell.font = { name: 'Arial', size: 9, color: { argb: COLORS.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(2).height = 20;

    const groups = [
        { label: 'VÍNCULO', range: 'A3:A3', colors: COLORS.emerald, endCol: 1 },
        { label: 'PERSONA', range: 'B3:D3', colors: COLORS.personal, endCol: 4 },
        { label: 'ORGANIZACIÓN', range: 'E3:E3', colors: COLORS.emerald, endCol: 5 },
        { label: 'UBICACIÓN', range: 'F3:G3', colors: COLORS.amber, endCol: 7 },
        { label: 'MOTIVO DEL REGISTRO', range: 'H3:I3', colors: COLORS.rose, endCol: 9 },
        { label: 'CONTROL', range: 'J3:M3', colors: COLORS.slate, endCol: 13 },
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
        'VÍNCULO', 'NOMBRES', 'APELLIDOS', '# EMPLEADO',
        'DEPENDENCIA', 'EDIFICIO', 'PISO BASE', 'MOTIVO',
        'COMENTARIOS', 'FECHA / HORA', 'REGISTRADO POR', 'TARJETA KONE', 'FECHA ENTREGA',
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

    worksheet.autoFilter = 'A4:M4';

    enrichedData.forEach((reg) => {
        const { firstName, lastName } = cardlessPersonLabel(reg);
        const isLinked = !!reg.person_id;
        const signedAt = reg.koneResponsivaSignedAt
            ? new Date(reg.koneResponsivaSignedAt).toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
            : null;

        const excelRow = worksheet.addRow({
            linked: isLinked ? '✔ Registrado' : '✗ No Registrado',
            first_name: firstName,
            last_name: lastName,
            employee_no: reg.employee_no || '',
            dependency: reg.dependencyName || '',
            building: reg.buildingName || '',
            floor: reg.floor || '',
            reason: reg.reason,
            comments: reg.comments || '',
            recorded_at: new Date(reg.recorded_at).toLocaleString('es-MX'),
            recorded_by: reg.recordedByName || '',
            pending_kone: !isLinked ? 'N/A' : (reg.pendingKoneResponsiva ? 'PENDIENTE DE RECOGER' : 'ENTREGADA'),
            signed_at: !isLinked ? '' : (signedAt || ''),
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
                horizontal: [1, 4, 7, 10, 12, 13].includes(colNumber) ? 'center' : 'left',
                indent: [1, 4, 7, 10, 12, 13].includes(colNumber) ? 0 : 1,
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

            if (colNumber === 1) {
                if (isLinked) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.emerald.head } };
                    cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: COLORS.emerald.sub } };
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.amber.head } };
                    cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: COLORS.amber.sub } };
                }
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }

            if (!cell.value || cell.value === '') {
                cell.value = '—';
                cell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF94A3B8' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }

            if (colNumber === 8 && reg.reason) {
                cell.value = reg.reason;
                let badge = COLORS.slate;
                if (reg.reason.includes('Olvidada') || reg.reason === 'No la porta') badge = COLORS.amber;
                else if (reg.reason === 'Extraviada' || reg.reason === 'Robada') badge = COLORS.rose;
                else if (reg.reason === 'No se le ha entregado' || reg.reason.includes('proceso') || reg.reason.includes('ingreso') || reg.reason.includes('Reposición')) {
                    badge = COLORS.sky;
                }
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: badge.head } };
                cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: badge.sub } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            }

            if (colNumber === 12) {
                if (!isLinked) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.slate.head } };
                    cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: COLORS.slate.sub } };
                } else if (reg.pendingKoneResponsiva) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.rose.head } };
                    cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: COLORS.rose.sub } };
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.emerald.head } };
                    cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: COLORS.emerald.sub } };
                }
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }

            if (colNumber === 13) {
                if (!isLinked) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.slate.head } };
                    cell.font = { name: 'Arial', size: 8, italic: true, color: { argb: COLORS.slate.sub } };
                    cell.value = 'N/A';
                } else if (reg.koneResponsivaSignedAt) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.emerald.head } };
                    cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: COLORS.emerald.sub } };
                } else if (!reg.pendingKoneResponsiva) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.sky.head } };
                    cell.font = { name: 'Arial', size: 8, italic: true, color: { argb: COLORS.sky.sub } };
                    cell.value = 'Entrega previa al sistema';
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.rose.head } };
                    cell.font = { name: 'Arial', size: 8, italic: true, color: { argb: COLORS.rose.sub } };
                    cell.value = 'Pendiente';
                }
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }
        });
    });

    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

    let fileNameParts = ['Registro_Sin_Tarjeta_Nexa'];
    if (filters?.dependency) {
        fileNameParts.push(filters.dependency.replace(/\s+/g, '_'));
    }
    fileNameParts.push(new Date().toISOString().split('T')[0]);
    const finalFileName = `${fileNameParts.join('_')}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    if (returnBuffer) {
        return { buffer: buffer as ArrayBuffer, filename: finalFileName };
    }
    saveAsFunction(new Blob([buffer]), finalFileName);
}
