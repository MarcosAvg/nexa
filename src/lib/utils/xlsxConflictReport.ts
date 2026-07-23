/**
 * xlsxConflictReport.ts
 *
 * Genera un reporte Excel con el análisis de conflictos de la importación
 * de tickets desde plantilla. Incluye:
 *
 *   - Hoja "Resumen" con KPIs y estadísticas generales
 *   - Hoja "ALTAS - Análisis" con detalle por fila y conflicto
 *   - Hoja "MODIFICACIONES - Análisis" con detalle campo por campo
 *   - Hoja "Otros Tipos" con las filas de baja, reposición y reporte
 *
 * El reporte está diseñado para ser enviado al solicitante para que
 * revise los conflictos y haga los cambios necesarios.
 */

import {
    createExcelWorkbook,
    addTitleAndMetaRow,
    addKpiCard,
    calcPct,
    addSectionTitle,
    addTableHeader,
    addTableRow,
    autoRowHeight,
    saveWorkbook,
} from './xlsxShared';
import type { ImportParseResult } from './xlsxImporter';
import type { AltaConflictAnalysis, ModificacionConflictAnalysis } from './matchAnalysis';

// ─────────────────────────────────────────
// Paleta local (formato { bg, fg } que esperan addKpiCard, addTableHeader, addTableRow)
// ─────────────────────────────────────────

const C = {
    title: 'FF1E293B',
    meta: 'FF64748B',
    separator: 'FF94A3B8',
    white: 'FFFFFFFF',
    black: 'FF111827',
    sectionHead: 'FF0F172A',
    sky: { bg: 'FFE0F2FE', fg: 'FF075985' },
    blue: { bg: 'FFDBEAFE', fg: 'FF1E40AF' },
    emerald: { bg: 'FFD1FAE5', fg: 'FF065F46' },
    amber: { bg: 'FFFEF3C7', fg: 'FF92400E' },
    rose: { bg: 'FFFEE2E2', fg: 'FF991B1B' },
    slate: { bg: 'FFF1F5F9', fg: 'FF334155' },
    indigo: { bg: 'FFE0E7FF', fg: 'FF3730A3' },
    violet: { bg: 'FFEDE9FE', fg: 'FF5B21B6' },
    // Variantes con fill para celdas de datos (formato { fill, fg })
    roseFill: { fill: 'FFFFF1F2', fg: 'FF991B1B' },
    emeraldFill: { fill: 'FFF0FDF4', fg: 'FF065F46' },
    amberFill: { fill: 'FFFEFCE8', fg: 'FF92400E' },
    slateFill: { fill: 'FFF8FAFC', fg: 'FF334155' },
    // Grupos de colores para super-encabezados (formato { head, sub, fill })
    modGroup: { head: 'FFE0E7FF', sub: 'FF3730A3', fill: 'FFEEF2FF' },
    actualGroup: { head: 'FFDBEAFE', sub: 'FF1E40AF', fill: 'FFEFF6FF' },
    nuevoGroup: { head: 'FFD1FAE5', sub: 'FF065F46', fill: 'FFF0FDF4' },
    pisosGroup: { head: 'FFFEF3C7', sub: 'FF92400E', fill: 'FFFEFCE8' },
    otrosGroup: { head: 'FFF1F5F9', sub: 'FF334155', fill: 'FFF8FAFC' },
    bajaGroup: { head: 'FFFEE2E2', sub: 'FF991B1B', fill: 'FFFFF1F2' },
    repoGroup: { head: 'FFFEF3C7', sub: 'FF92400E', fill: 'FFFEFCE8' },
    fallaGroup: { head: 'FFEDE9FE', sub: 'FF5B21B6', fill: 'FFFAF5FF' },
    // Grupos para ALTAS
    altasGroup: { head: 'FFE0E7FF', sub: 'FF3730A3', fill: 'FFEEF2FF' },
    p2000Group: { head: 'FFDBEAFE', sub: 'FF1E40AF', fill: 'FFEFF6FF' },
    koneGroup: { head: 'FFD1FAE5', sub: 'FF065F46', fill: 'FFF0FDF4' },
};

// ─────────────────────────────────────────
// Tipos de entrada para el reporte
// ─────────────────────────────────────────

export interface ConflictReportInput {
    parseResult: ImportParseResult;
    altaAnalyses: Map<string, AltaConflictAnalysis>;
    modAnalyses: Map<string, ModificacionConflictAnalysis>;
    matchResults: Map<string, PersonSimplified[]>;
    selectedRows: Set<string>;
    totalSelected: number;
}

interface PersonSimplified {
    last_name: string;
    first_name: string;
    dependency: string;
    building: string;
}

// ─────────────────────────────────────────
// Exportación principal
// ─────────────────────────────────────────

export async function exportConflictReportToExcel(input: ConflictReportInput): Promise<void> {
    const { workbook } = await createExcelWorkbook();

    const totalRows = input.parseResult.sheets.reduce((s, sh) => s + sh.rows.length, 0);
    const totalMatched = [...input.matchResults.values()].filter((v) => v.length > 0).length;
    const totalNoMatch = [...input.matchResults.values()].filter((v) => v.length === 0).length;
    const totalConflicts = [...input.altaAnalyses.values()].filter((a) => a.hasConflicts).length;
    const resolutionsMap = buildResolutionsSummary(input);

    // ════════════════════════════════════════════════
    // HOJA 1: RESUMEN
    // ════════════════════════════════════════════════
    const wsResumen = workbook.addWorksheet('Resumen');
    wsResumen.columns = [
        { width: 4 },   // A
        { width: 32 },  // B
        { width: 18 },  // C
        { width: 16 },  // D
        { width: 16 },  // E
        { width: 18 },  // F
    ];
    const LAST_R = 'F';

    await addTitleAndMetaRow({
        worksheet: wsResumen,
        workbook,
        title: 'REPORTE DE ANÁLISIS DE IMPORTACIÓN',
        lastCol: LAST_R,
        metaLines: [`Archivo procesado: ${totalRows} filas totales`],
    });

    let row = 4;

    // ── KPIs ──
    row = addSectionTitle(wsResumen, row, '📊  INDICADORES CLAVE', LAST_R, { sectionHead: C.sectionHead, separator: C.separator });
    addKpiCard(wsResumen, row, 'B', 'FILAS TOTALES', totalRows, C.sky);
    addKpiCard(wsResumen, row, 'E', 'SELECCIONADOS', input.totalSelected, C.blue);
    row++;

    addKpiCard(wsResumen, row, 'B', 'CON COINCIDENCIA', totalMatched, C.emerald, calcPct(totalMatched, input.totalSelected));
    addKpiCard(wsResumen, row, 'E', 'SIN COINCIDENCIA', totalNoMatch, C.amber, calcPct(totalNoMatch, input.totalSelected));
    row++;

    addKpiCard(wsResumen, row, 'B', 'CONFLICTOS DETECTADOS', totalConflicts, totalConflicts > 0 ? C.rose : C.emerald, calcPct(totalConflicts, totalMatched));
    addKpiCard(wsResumen, row, 'E', 'RESOLUCIONES PENDIENTES', resolutionsMap.pending, resolutionsMap.pending > 0 ? C.amber : C.emerald);
    row++;
    row++;

    // ── Resumen por tipo de hoja ──
    row = addSectionTitle(wsResumen, row, '📋  DESGLOSE POR TIPO DE TICKET', LAST_R, { sectionHead: C.sectionHead, separator: C.separator });
    addTableHeader(wsResumen, row, [
        { col: 'B', label: 'TIPO' },
        { col: 'C', label: 'FILAS' },
        { col: 'D', label: 'CONFLICTOS' },
        { col: 'E', label: 'SELECCIONADOS' },
    ], C.indigo, C.white);
    row++;

    const sheetSummary = buildSheetSummary(input);
    sheetSummary.forEach((s, i) => {
        addTableRow(wsResumen, row, [
            { col: 'B', value: s.label },
            { col: 'C', value: s.total },
            { col: 'D', value: s.conflicts },
            { col: 'E', value: s.selected },
        ], i % 2 === 0 ? C.indigo : C.slate, C.sectionHead, C.white);
        row++;
    });

    // ════════════════════════════════════════════════
    // HOJA 2: ALTAS — CONFLICTOS POR PERSONA
    // ════════════════════════════════════════════════
    // Diseño: super-encabezados agrupados + sub-encabezados
    // Grupos: # | PERSONA | P2000 | KONE | CONFLICTOS
    const wsAltas = workbook.addWorksheet('ALTAS - Conflictos');
    wsAltas.columns = [
        { width: 5 },   // A: #
        { width: 24 },  // B: Persona
        { width: 22 },  // C: Dependencia
        { width: 22 },  // D: Edificio
        { width: 14 },  // E: P2000 Solicitó
        { width: 18 },  // F: P2000 Tiene
        { width: 14 },  // G: P2000 Conflicto
        { width: 14 },  // H: KONE Solicitó
        { width: 18 },  // I: KONE Tiene
        { width: 14 },  // J: KONE Conflicto
        { width: 24 },  // K: Conflictos detectados
    ];
    const LAST_A = 'K';
    const ALTA_GROUPS = [
        { label: '#', range: 'A4:A4', colors: C.altasGroup, endCol: 1 },
        { label: 'PERSONA', range: 'B4:D4', colors: C.altasGroup, endCol: 4 },
        { label: 'P2000', range: 'E4:G4', colors: C.p2000Group, endCol: 7 },
        { label: 'KONE', range: 'H4:J4', colors: C.koneGroup, endCol: 10 },
        { label: 'CONFLICTOS', range: 'K4:K4', colors: C.altasGroup, endCol: 11 },
    ];
    const ALTA_GROUP_END_COLS = new Set(ALTA_GROUPS.map((g) => g.endCol));

    await addTitleAndMetaRow({
        worksheet: wsAltas,
        workbook,
        title: 'ALTAS — CONFLICTOS POR PERSONA',
        lastCol: LAST_A,
        metaLines: ['Cada fila representa una persona. Se muestran las tarjetas solicitadas vs. las que ya tiene.'],
    });

    // Row 4: Super-headers
    ALTA_GROUPS.forEach((group) => {
        wsAltas.mergeCells(group.range);
        const cell = wsAltas.getCell(group.range.split(':')[0]);
        cell.value = group.label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.head } };
        cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: group.colors.sub } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'medium', color: { argb: C.separator } },
        };
    });
    wsAltas.getRow(4).height = 24;

    // Row 5: Sub-headers
    const altaSubHeaders = [
        { label: 'NO.', group: ALTA_GROUPS[0], col: 1 },
        { label: 'PERSONA', group: ALTA_GROUPS[1], col: 2 },
        { label: 'DEPENDENCIA', group: ALTA_GROUPS[1], col: 3 },
        { label: 'EDIFICIO', group: ALTA_GROUPS[1], col: 4 },
        { label: 'SOLICITÓ', group: ALTA_GROUPS[2], col: 5 },
        { label: 'TIENE', group: ALTA_GROUPS[2], col: 6 },
        { label: 'CONFLICTO', group: ALTA_GROUPS[2], col: 7 },
        { label: 'SOLICITÓ', group: ALTA_GROUPS[3], col: 8 },
        { label: 'TIENE', group: ALTA_GROUPS[3], col: 9 },
        { label: 'CONFLICTO', group: ALTA_GROUPS[3], col: 10 },
        { label: 'DETALLE', group: ALTA_GROUPS[4], col: 11 },
    ];

    const subRowAltas = wsAltas.getRow(5);
    subRowAltas.height = 32;
    altaSubHeaders.forEach(({ label, group, col }) => {
        const cell = subRowAltas.getCell(col);
        cell.value = label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.sub } };
        cell.font = { name: 'Arial', bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            bottom: { style: 'medium', color: { argb: group.colors.sub } },
            right: {
                style: ALTA_GROUP_END_COLS.has(col) ? 'medium' : 'thin',
                color: { argb: ALTA_GROUP_END_COLS.has(col) ? C.separator : 'FFFFFFFF' },
            },
        };
    });

    wsAltas.autoFilter = `A5:${LAST_A}5`;

    let altaRowIdx = 6;
    let altaCounter = 0;

    for (const sheet of input.parseResult.sheets) {
        if (sheet.key !== 'altas') continue;
        for (const rowData of sheet.rows) {
            if (!rowData.isValid) continue;
            const rk = `${sheet.key}-${rowData.rowNumber}`;
            if (!input.selectedRows.has(rk)) continue;

            const analysis = input.altaAnalyses.get(rk);
            const person = getFirstMatch(input, rk);

            altaCounter++;
            const r = wsAltas.getRow(altaRowIdx);

            // Datos básicos de la persona
            r.getCell(1).value = altaCounter;
            r.getCell(2).value = person ? `${person.last_name}, ${person.first_name}` : (rowData.fields.apellidos + ', ' + rowData.fields.nombres);
            r.getCell(3).value = person?.dependency || rowData.fields.dependencia || '';
            r.getCell(4).value = person?.building || rowData.fields.edificio || '';

            if (analysis) {
                // P2000
                const p2000 = analysis.conflicts.find(c => c.cardType === 'P2000');
                r.getCell(5).value = p2000?.requested ? 'Sí' : 'No';
                r.getCell(6).value = p2000?.existingFolio || (p2000?.hasCard ? 'Sí' : '—');
                r.getCell(7).value = p2000?.conflict ? '⚠ Conflicto' : '✓ OK';

                // KONE
                const kone = analysis.conflicts.find(c => c.cardType === 'KONE');
                r.getCell(8).value = kone?.requested ? 'Sí' : 'No';
                r.getCell(9).value = kone?.existingFolio || (kone?.hasCard ? 'Sí' : '—');
                r.getCell(10).value = kone?.conflict ? '⚠ Conflicto' : '✓ OK';

                // Resumen de conflictos
                const conflictList = analysis.conflicts
                    .filter(c => c.conflict)
                    .map(c => `${c.cardType}: ya tiene activa (${c.existingFolio})`);
                r.getCell(11).value = conflictList.length > 0 ? conflictList.join('; ') : 'Sin conflictos';
            } else {
                // Sin análisis (persona no encontrada en BD)
                r.getCell(5).value = '—';
                r.getCell(6).value = '—';
                r.getCell(7).value = '⚠';
                r.getCell(8).value = '—';
                r.getCell(9).value = '—';
                r.getCell(10).value = '⚠';
                r.getCell(11).value = 'Persona nueva — sin conflictos';
            }

            // Styling: cada celda toma el fill de su GRUPO (como en xlsxExport)
            // + badges especiales para columnas de conflicto/match
            for (let c = 1; c <= 11; c++) {
                const cell = r.getCell(c);
                const subEntry = altaSubHeaders.find((s) => s.col === c);
                const grp = subEntry?.group ?? ALTA_GROUPS[0];
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: grp.colors.fill },
                };
                cell.font = { name: 'Arial', size: 9, color: { argb: C.black } };
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: [1, 5, 6, 7, 8, 9, 10].includes(c) ? 'center' : 'left',
                    wrapText: true,
                };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: {
                        style: ALTA_GROUP_END_COLS.has(c) ? 'medium' : 'thin',
                        color: { argb: ALTA_GROUP_END_COLS.has(c) ? C.separator : 'FFCBD5E1' },
                    },
                };
            }

            // Badges para celdas de conflicto
            const altaConflictStatus = analysis?.hasConflicts
                ? 'conflict' : (!analysis ? 'new-person' : 'ok');
            if (altaConflictStatus === 'conflict') {
                // P2000 conflicto badge
                if (analysis!.conflicts.find(c => c.cardType === 'P2000' && c.conflict)) {
                    r.getCell(7).font = { name: 'Arial', size: 9, bold: true, color: { argb: C.roseFill.fg } };
                    r.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.roseFill.fill } };
                }
                // KONE conflicto badge
                if (analysis!.conflicts.find(c => c.cardType === 'KONE' && c.conflict)) {
                    r.getCell(10).font = { name: 'Arial', size: 9, bold: true, color: { argb: C.roseFill.fg } };
                    r.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.roseFill.fill } };
                }
                r.getCell(11).font = { name: 'Arial', size: 9, bold: true, color: { argb: C.roseFill.fg } };
                r.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.roseFill.fill } };
            }
            if (altaConflictStatus === 'new-person') {
                r.getCell(7).value = '—';
                r.getCell(7).font = { name: 'Arial', size: 9, color: { argb: C.emeraldFill.fg } };
                r.getCell(10).value = '—';
                r.getCell(10).font = { name: 'Arial', size: 9, color: { argb: C.emeraldFill.fg } };
                r.getCell(11).value = 'Persona nueva — sin conflictos';
                r.getCell(11).font = { name: 'Arial', size: 9, bold: true, color: { argb: C.emeraldFill.fg } };
                r.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.emeraldFill.fill } };
            }

            autoRowHeight(wsAltas, altaRowIdx, 22);
            altaRowIdx++;
        }
    }

    // ════════════════════════════════════════════════
    // HOJA 3: MODIFICACIONES — CAMBIOS POR PERSONA
    // ════════════════════════════════════════════════
    // Diseño: super-encabezados agrupados + sub-encabezados (como en xlsxExport)
    // Grupos: # | PERSONA | DATOS ACTUALES | DATOS NUEVOS | PISOS | CAMBIOS
    const wsMod = workbook.addWorksheet('MODIFICACIONES - Cambios');
    wsMod.columns = [
        { width: 5 },   // A: #
        { width: 24 },  // B: Persona
        { width: 22 },  // C: Dependencia
        { width: 20 },  // D: Edificio
        { width: 18 },  // E: Apellidos (Actual)
        { width: 18 },  // F: Nombres (Actual)
        { width: 18 },  // G: Área (Actual)
        { width: 20 },  // H: Puesto (Actual)
        { width: 14 },  // I: Horario (Actual)
        { width: 18 },  // J: Apellidos (Nuevo)
        { width: 18 },  // K: Nombres (Nuevo)
        { width: 18 },  // L: Área (Nuevo)
        { width: 20 },  // M: Puesto (Nuevo)
        { width: 14 },  // N: Horario (Nuevo)
        { width: 18 },  // O: P2000 (+/-/=)
        { width: 18 },  // P: KONE (+/-/=)
        { width: 18 },  // Q: Accesos (+/-/=)
        { width: 10 },  // R: Cambios
    ];
    const LAST_M = 'R';
    const MOD_GROUPS = [
        { label: '#', range: 'A4:A4', colors: C.modGroup, endCol: 1 },
        { label: 'PERSONA', range: 'B4:D4', colors: C.modGroup, endCol: 4 },
        { label: 'DATOS ACTUALES', range: 'E4:I4', colors: C.actualGroup, endCol: 9 },
        { label: 'DATOS NUEVOS', range: 'J4:N4', colors: C.nuevoGroup, endCol: 14 },
        { label: 'PISOS', range: 'O4:Q4', colors: C.pisosGroup, endCol: 17 },
        { label: 'CAMBIOS', range: 'R4:R4', colors: C.modGroup, endCol: 18 },
    ];
    const MOD_GROUP_END_COLS = new Set(MOD_GROUPS.map((g) => g.endCol));

    await addTitleAndMetaRow({
        worksheet: wsMod,
        workbook,
        title: 'MODIFICACIONES — CAMBIOS POR PERSONA',
        lastCol: LAST_M,
        metaLines: ['Cada fila representa una persona. Los campos se comparan entre datos actuales del sistema y los nuevos propuestos.'],
    });

    // Row 4: Super-headers
    MOD_GROUPS.forEach((group) => {
        wsMod.mergeCells(group.range);
        const cell = wsMod.getCell(group.range.split(':')[0]);
        cell.value = group.label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.head } };
        cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: group.colors.sub } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'medium', color: { argb: C.separator } },
        };
    });
    wsMod.getRow(4).height = 24;

    // Row 5: Sub-headers
    const modSubHeaders = [
        { label: 'NO.', group: MOD_GROUPS[0], col: 1 },
        { label: 'PERSONA', group: MOD_GROUPS[1], col: 2 },
        { label: 'DEPENDENCIA', group: MOD_GROUPS[1], col: 3 },
        { label: 'EDIFICIO', group: MOD_GROUPS[1], col: 4 },
        { label: 'APELLIDOS', group: MOD_GROUPS[2], col: 5 },
        { label: 'NOMBRES', group: MOD_GROUPS[2], col: 6 },
        { label: 'ÁREA', group: MOD_GROUPS[2], col: 7 },
        { label: 'PUESTO', group: MOD_GROUPS[2], col: 8 },
        { label: 'HORARIO', group: MOD_GROUPS[2], col: 9 },
        { label: 'APELLIDOS', group: MOD_GROUPS[3], col: 10 },
        { label: 'NOMBRES', group: MOD_GROUPS[3], col: 11 },
        { label: 'ÁREA', group: MOD_GROUPS[3], col: 12 },
        { label: 'PUESTO', group: MOD_GROUPS[3], col: 13 },
        { label: 'HORARIO', group: MOD_GROUPS[3], col: 14 },
        { label: 'P2000', group: MOD_GROUPS[4], col: 15 },
        { label: 'KONE', group: MOD_GROUPS[4], col: 16 },
        { label: 'ACC. ESP.', group: MOD_GROUPS[4], col: 17 },
        { label: 'TOTAL', group: MOD_GROUPS[5], col: 18 },
    ];

    const subRow = wsMod.getRow(5);
    subRow.height = 32;
    modSubHeaders.forEach(({ label, group, col }) => {
        const cell = subRow.getCell(col);
        cell.value = label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.sub } };
        cell.font = { name: 'Arial', bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            bottom: { style: 'medium', color: { argb: group.colors.sub } },
            right: {
                style: MOD_GROUP_END_COLS.has(col) ? 'medium' : 'thin',
                color: { argb: MOD_GROUP_END_COLS.has(col) ? C.separator : 'FFFFFFFF' },
            },
        };
    });

    wsMod.autoFilter = `A5:${LAST_M}5`;

    // Helper to find a change by field or label
    const FIELD_COL_MAP: Record<string, { actualCol: number; nuevoCol: number }> = {
        nuevo_apellido: { actualCol: 5, nuevoCol: 10 },
        nuevo_nombre: { actualCol: 6, nuevoCol: 11 },
        nueva_area: { actualCol: 7, nuevoCol: 12 },
        nuevo_puesto: { actualCol: 8, nuevoCol: 13 },
        hora_entrada: { actualCol: 9, nuevoCol: 14 },
        hora_salida: { actualCol: 9, nuevoCol: 14 }, // same horario column
    };

    let modRowIdx = 6;
    let modCounter = 0;

    for (const sheet of input.parseResult.sheets) {
        if (sheet.key !== 'modificaciones') continue;
        for (const rowData of sheet.rows) {
            if (!rowData.isValid) continue;
            const rk = `${sheet.key}-${rowData.rowNumber}`;
            if (!input.selectedRows.has(rk)) continue;

            const analysis = input.modAnalyses.get(rk);
            const person = getFirstMatch(input, rk);

            modCounter++;
            const r = wsMod.getRow(modRowIdx);

            // Basic info
            r.getCell(1).value = modCounter;
            r.getCell(2).value = person ? `${person.last_name}, ${person.first_name}` : `${rowData.fields.apellidos}, ${rowData.fields.nombres}`;
            r.getCell(3).value = person?.dependency || rowData.fields.dependencia || '';
            r.getCell(4).value = person?.building || rowData.fields.edificio || '';

            let changedCount = 0;

            if (analysis && person) {
                // Fill actual values from person data
                r.getCell(5).value = person.last_name || '—';
                r.getCell(6).value = person.first_name || '—';
                r.getCell(7).value = person.area || '—';
                r.getCell(8).value = person.position || '—';
                r.getCell(9).value = person.schedule
                    ? `${person.schedule.entry || '—'} - ${person.schedule.exit || '—'}`
                    : '—';

                // Fill new values from template fields
                r.getCell(10).value = rowData.fields.nuevo_apellido?.trim() || '—';
                r.getCell(11).value = rowData.fields.nuevo_nombre?.trim() || '—';
                r.getCell(12).value = rowData.fields.nueva_area?.trim() || '—';
                r.getCell(13).value = rowData.fields.nuevo_puesto?.trim() || '—';
                // Horario nuevo: from hora_entrada/hora_salida
                const newEntry = rowData.fields.hora_entrada?.trim();
                const newExit = rowData.fields.hora_salida?.trim();
                r.getCell(14).value = newEntry && newExit ? `${newEntry} - ${newExit}` : (newEntry || newExit || '—');

                // Floor changes
                const fc = analysis.floorChanges;
                if (fc?.p2000) {
                    const parts: string[] = [];
                    if (fc.p2000.added.length) parts.push(`+${fc.p2000.added.join(',')}`);
                    if (fc.p2000.removed.length) parts.push(`-${fc.p2000.removed.join(',')}`);
                    if (fc.p2000.kept.length) parts.push(`=${fc.p2000.kept.join(',')}`);
                    r.getCell(15).value = parts.join(' ') || 'Sin cambios';
                } else {
                    r.getCell(15).value = '—';
                }

                if (fc?.kone) {
                    const parts: string[] = [];
                    if (fc.kone.added.length) parts.push(`+${fc.kone.added.join(',')}`);
                    if (fc.kone.removed.length) parts.push(`-${fc.kone.removed.join(',')}`);
                    if (fc.kone.kept.length) parts.push(`=${fc.kone.kept.join(',')}`);
                    r.getCell(16).value = parts.join(' ') || 'Sin cambios';
                } else {
                    r.getCell(16).value = '—';
                }

                if (fc?.accesses) {
                    const parts: string[] = [];
                    if (fc.accesses.added.length) parts.push(`+${fc.accesses.added.join(',')}`);
                    if (fc.accesses.removed.length) parts.push(`-${fc.accesses.removed.join(',')}`);
                    if (fc.accesses.kept.length) parts.push(`=${fc.accesses.kept.join(',')}`);
                    r.getCell(17).value = parts.join(' ') || 'Sin cambios';
                } else {
                    r.getCell(17).value = '—';
                }

                changedCount = analysis.changes.filter((c) => c.changed).length;
                if (fc) {
                    if (fc.p2000?.added.length || fc.p2000?.removed.length) changedCount++;
                    if (fc.kone?.added.length || fc.kone?.removed.length) changedCount++;
                    if (fc.accesses?.added.length || fc.accesses?.removed.length) changedCount++;
                }
                r.getCell(18).value = changedCount;
            } else if (!person) {
                // Person not found — fill with dashes and warning
                for (let c = 5; c <= 17; c++) r.getCell(c).value = '—';
                r.getCell(18).value = '⚠';
            } else {
                // No analysis (likely no changes at all)
                for (let c = 5; c <= 17; c++) r.getCell(c).value = '—';
                r.getCell(18).value = '0';
            }

            // Styling: cada celda toma el fill de su GRUPO (como en xlsxExport)
            // + badges para cambios detectados o persona no encontrada
            for (let c = 1; c <= 18; c++) {
                const cell = r.getCell(c);
                const subEntry = modSubHeaders.find((s) => s.col === c);
                const grp = subEntry?.group ?? MOD_GROUPS[0];
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: grp.colors.fill },
                };
                cell.font = { name: 'Arial', size: 9, color: { argb: C.black } };
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: [1, 15, 16, 17, 18].includes(c) ? 'center' : 'left',
                    wrapText: true,
                };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: {
                        style: MOD_GROUP_END_COLS.has(c) ? 'medium' : 'thin',
                        color: { argb: MOD_GROUP_END_COLS.has(c) ? C.separator : 'FFCBD5E1' },
                    },
                };
            }

            // Badges para cambios detectados
            if (changedCount > 0) {
                r.getCell(18).font = { name: 'Arial', size: 9, bold: true, color: { argb: C.roseFill.fg } };
                r.getCell(18).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.roseFill.fill } };

                if (analysis) {
                    analysis.changes.forEach((ch) => {
                        if (ch.changed) {
                            const cols = FIELD_COL_MAP[ch.field];
                            if (cols) {
                                // Actual: tachado + ámbar
                                r.getCell(cols.actualCol).font = {
                                    name: 'Arial', size: 9, color: { argb: C.amberFill.fg },
                                    strike: true,
                                };
                                r.getCell(cols.actualCol).fill = {
                                    type: 'pattern', pattern: 'solid', fgColor: { argb: C.amberFill.fill },
                                };
                                // Nuevo: negrita + rosa
                                r.getCell(cols.nuevoCol).font = {
                                    name: 'Arial', size: 9, bold: true, color: { argb: C.roseFill.fg },
                                };
                                r.getCell(cols.nuevoCol).fill = {
                                    type: 'pattern', pattern: 'solid', fgColor: { argb: C.roseFill.fill },
                                };
                            }
                        }
                    });
                }
            }
            if (!person) {
                r.getCell(18).font = { name: 'Arial', size: 9, bold: true, color: { argb: C.roseFill.fg } };
                r.getCell(18).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.roseFill.fill } };
            }

            autoRowHeight(wsMod, modRowIdx, 22);
            modRowIdx++;
        }
    }

    // ════════════════════════════════════════════════
    // HOJA 4: BAJA DE PERSONA
    // ════════════════════════════════════════════════
    const wsBaja = workbook.addWorksheet('Baja de Persona');
    wsBaja.columns = [
        { width: 5 },   // A: #
        { width: 24 },  // B: Persona
        { width: 22 },  // C: Dependencia
        { width: 22 },  // D: Edificio
        { width: 16 },  // E: Tipo Baja
        { width: 28 },  // F: Motivo
        { width: 24 },  // G: Observaciones
        { width: 14 },  // H: Match
    ];
    const LAST_BA = 'H';
    const BAJA_GROUPS = [
        { label: '#', range: 'A4:A4', colors: C.otrosGroup, endCol: 1 },
        { label: 'PERSONA', range: 'B4:D4', colors: C.otrosGroup, endCol: 4 },
        { label: 'BAJA', range: 'E4:G4', colors: C.bajaGroup, endCol: 7 },
        { label: 'ESTADO', range: 'H4:H4', colors: C.otrosGroup, endCol: 8 },
    ];
    const BAJA_GROUP_END_COLS = new Set(BAJA_GROUPS.map((g) => g.endCol));

    await addTitleAndMetaRow({
        worksheet: wsBaja,
        workbook,
        title: 'BAJA DE PERSONA',
        lastCol: LAST_BA,
        metaLines: ['Solicitudes de baja de personal.'],
    });

    BAJA_GROUPS.forEach((group) => {
        wsBaja.mergeCells(group.range);
        const cell = wsBaja.getCell(group.range.split(':')[0]);
        cell.value = group.label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.head } };
        cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: group.colors.sub } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'medium', color: { argb: C.separator } },
        };
    });
    wsBaja.getRow(4).height = 24;

    const bajaSubHeaders = [
        { label: 'NO.', group: BAJA_GROUPS[0], col: 1 },
        { label: 'PERSONA', group: BAJA_GROUPS[1], col: 2 },
        { label: 'DEPENDENCIA', group: BAJA_GROUPS[1], col: 3 },
        { label: 'EDIFICIO', group: BAJA_GROUPS[1], col: 4 },
        { label: 'TIPO BAJA', group: BAJA_GROUPS[2], col: 5 },
        { label: 'MOTIVO', group: BAJA_GROUPS[2], col: 6 },
        { label: 'OBSERVACIONES', group: BAJA_GROUPS[2], col: 7 },
        { label: 'MATCH', group: BAJA_GROUPS[3], col: 8 },
    ];
    const srBaja = wsBaja.getRow(5);
    srBaja.height = 32;
    bajaSubHeaders.forEach(({ label, group, col }) => {
        const cell = srBaja.getCell(col);
        cell.value = label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.sub } };
        cell.font = { name: 'Arial', bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            bottom: { style: 'medium', color: { argb: group.colors.sub } },
            right: {
                style: BAJA_GROUP_END_COLS.has(col) ? 'medium' : 'thin',
                color: { argb: BAJA_GROUP_END_COLS.has(col) ? C.separator : 'FFFFFFFF' },
            },
        };
    });
    wsBaja.autoFilter = `A5:${LAST_BA}5`;

    let bajaRowIdx = 6, bajaCt = 0;
    for (const sheet of input.parseResult.sheets) {
        if (sheet.key !== 'baja_persona') continue;
        for (const rd of sheet.rows) {
            if (!rd.isValid) continue;
            const rk = `${sheet.key}-${rd.rowNumber}`;
            if (!input.selectedRows.has(rk)) continue;
            bajaCt++; const person = getFirstMatch(input, rk); const r = wsBaja.getRow(bajaRowIdx);
            r.getCell(1).value = bajaCt;
            r.getCell(2).value = person ? `${person.last_name}, ${person.first_name}` : `${rd.fields.apellidos}, ${rd.fields.nombres}`;
            r.getCell(3).value = person?.dependency || rd.fields.dependencia || '';
            r.getCell(4).value = person?.building || '';
            r.getCell(5).value = rd.fields.tipo_baja || '—';
            r.getCell(6).value = rd.fields.motivo || '—';
            r.getCell(7).value = rd.fields.observaciones || '—';
            r.getCell(8).value = person ? '✓ Encontrado' : '✖ No encontrado';

            for (let c = 1; c <= 8; c++) {
                const cell = r.getCell(c);
                const se = bajaSubHeaders.find(s => s.col === c);
                const g = se?.group ?? BAJA_GROUPS[0];
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: g.colors.fill } };
                cell.font = { name: 'Arial', size: 9, color: { argb: C.black } };
                cell.alignment = { vertical: 'middle', horizontal: [1, 8].includes(c) ? 'center' : 'left', wrapText: true };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: {
                        style: BAJA_GROUP_END_COLS.has(c) ? 'medium' : 'thin',
                        color: { argb: BAJA_GROUP_END_COLS.has(c) ? C.separator : 'FFCBD5E1' },
                    },
                };
            }
            if (!person) {
                r.getCell(8).font = { name: 'Arial', size: 9, bold: true, color: { argb: C.roseFill.fg } };
                r.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.roseFill.fill } };
            } else {
                r.getCell(8).font = { name: 'Arial', size: 9, bold: true, color: { argb: C.emeraldFill.fg } };
                r.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.emeraldFill.fill } };
            }
            autoRowHeight(wsBaja, bajaRowIdx, 22); bajaRowIdx++;
        }
    }

    // ════════════════════════════════════════════════
    // HOJA 5: REPOSICIÓN DE TARJETA
    // ════════════════════════════════════════════════
    const wsRepo = workbook.addWorksheet('Reposición de Tarjeta');
    wsRepo.columns = [
        { width: 5 },   // A: #
        { width: 24 },  // B: Persona
        { width: 22 },  // C: Dependencia
        { width: 22 },  // D: Edificio
        { width: 14 },  // E: Repone P2000
        { width: 18 },  // F: Folio P2000
        { width: 14 },  // G: Repone KONE
        { width: 18 },  // H: Folio KONE
        { width: 22 },  // I: Motivo
        { width: 22 },  // J: Observaciones
        { width: 14 },  // K: Match
    ];
    const LAST_RE = 'K';
    const REPO_GROUPS = [
        { label: '#', range: 'A4:A4', colors: C.otrosGroup, endCol: 1 },
        { label: 'PERSONA', range: 'B4:D4', colors: C.otrosGroup, endCol: 4 },
        { label: 'P2000', range: 'E4:F4', colors: C.p2000Group, endCol: 6 },
        { label: 'KONE', range: 'G4:H4', colors: C.koneGroup, endCol: 8 },
        { label: 'REPOSICIÓN', range: 'I4:J4', colors: C.repoGroup, endCol: 10 },
        { label: 'ESTADO', range: 'K4:K4', colors: C.otrosGroup, endCol: 11 },
    ];
    const REPO_GROUP_END_COLS = new Set(REPO_GROUPS.map((g) => g.endCol));

    await addTitleAndMetaRow({
        worksheet: wsRepo,
        workbook,
        title: 'REPOSICIÓN DE TARJETA',
        lastCol: LAST_RE,
        metaLines: ['Solicitudes de reposición de tarjetas P2000 y KONE.'],
    });

    REPO_GROUPS.forEach((group) => {
        wsRepo.mergeCells(group.range);
        const cell = wsRepo.getCell(group.range.split(':')[0]);
        cell.value = group.label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.head } };
        cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: group.colors.sub } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'medium', color: { argb: C.separator } },
        };
    });
    wsRepo.getRow(4).height = 24;

    const repoSubHeaders = [
        { label: 'NO.', group: REPO_GROUPS[0], col: 1 },
        { label: 'PERSONA', group: REPO_GROUPS[1], col: 2 },
        { label: 'DEPENDENCIA', group: REPO_GROUPS[1], col: 3 },
        { label: 'EDIFICIO', group: REPO_GROUPS[1], col: 4 },
        { label: '¿REPONE?', group: REPO_GROUPS[2], col: 5 },
        { label: 'FOLIO', group: REPO_GROUPS[2], col: 6 },
        { label: '¿REPONE?', group: REPO_GROUPS[3], col: 7 },
        { label: 'FOLIO', group: REPO_GROUPS[3], col: 8 },
        { label: 'MOTIVO', group: REPO_GROUPS[4], col: 9 },
        { label: 'OBSERVACIONES', group: REPO_GROUPS[4], col: 10 },
        { label: 'MATCH', group: REPO_GROUPS[5], col: 11 },
    ];
    const srRepo = wsRepo.getRow(5);
    srRepo.height = 32;
    repoSubHeaders.forEach(({ label, group, col }) => {
        const cell = srRepo.getCell(col);
        cell.value = label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.sub } };
        cell.font = { name: 'Arial', bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            bottom: { style: 'medium', color: { argb: group.colors.sub } },
            right: {
                style: REPO_GROUP_END_COLS.has(col) ? 'medium' : 'thin',
                color: { argb: REPO_GROUP_END_COLS.has(col) ? C.separator : 'FFFFFFFF' },
            },
        };
    });
    wsRepo.autoFilter = `A5:${LAST_RE}5`;

    let repoRowIdx = 6, repoCt = 0;
    for (const sheet of input.parseResult.sheets) {
        if (sheet.key !== 'reposicion') continue;
        for (const rd of sheet.rows) {
            if (!rd.isValid) continue;
            const rk = `${sheet.key}-${rd.rowNumber}`;
            if (!input.selectedRows.has(rk)) continue;
            repoCt++; const person = getFirstMatch(input, rk); const r = wsRepo.getRow(repoRowIdx);
            r.getCell(1).value = repoCt;
            r.getCell(2).value = person ? `${person.last_name}, ${person.first_name}` : `${rd.fields.apellidos}, ${rd.fields.nombres}`;
            r.getCell(3).value = person?.dependency || rd.fields.dependencia || '';
            r.getCell(4).value = person?.building || '';
            r.getCell(5).value = rd.fields.reponer_p2000 || '—';
            r.getCell(6).value = rd.fields.folio_p2000 || '—';
            r.getCell(7).value = rd.fields.reponer_kone || '—';
            r.getCell(8).value = rd.fields.folio_kone || '—';
            r.getCell(9).value = rd.fields.motivo || '—';
            r.getCell(10).value = rd.fields.observaciones || '—';
            r.getCell(11).value = person ? '✓ Encontrado' : '✖ No encontrado';

            for (let c = 1; c <= 11; c++) {
                const cell = r.getCell(c);
                const se = repoSubHeaders.find(s => s.col === c);
                const g = se?.group ?? REPO_GROUPS[0];
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: g.colors.fill } };
                cell.font = { name: 'Arial', size: 9, color: { argb: C.black } };
                cell.alignment = { vertical: 'middle', horizontal: [1, 5, 6, 7, 8, 11].includes(c) ? 'center' : 'left', wrapText: true };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: {
                        style: REPO_GROUP_END_COLS.has(c) ? 'medium' : 'thin',
                        color: { argb: REPO_GROUP_END_COLS.has(c) ? C.separator : 'FFCBD5E1' },
                    },
                };
            }
            if (!person) {
                r.getCell(11).font = { name: 'Arial', size: 9, bold: true, color: { argb: C.roseFill.fg } };
                r.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.roseFill.fill } };
            } else {
                r.getCell(11).font = { name: 'Arial', size: 9, bold: true, color: { argb: C.emeraldFill.fg } };
                r.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.emeraldFill.fill } };
            }
            autoRowHeight(wsRepo, repoRowIdx, 22); repoRowIdx++;
        }
    }

    // ════════════════════════════════════════════════
    // HOJA 6: REPORTE DE FALLA
    // ════════════════════════════════════════════════
    const wsFalla = workbook.addWorksheet('Reporte de Falla');
    wsFalla.columns = [
        { width: 5 },   // A: #
        { width: 24 },  // B: Persona
        { width: 22 },  // C: Dependencia
        { width: 22 },  // D: Edificio
        { width: 14 },  // E: Tipo Tarjeta
        { width: 16 },  // F: Folio
        { width: 28 },  // G: Descripción
        { width: 16 },  // H: Desde Cuándo
        { width: 14 },  // I: Urgencia
        { width: 22 },  // J: Observaciones
        { width: 14 },  // K: Match
    ];
    const LAST_F = 'K';
    const FALLA_GROUPS = [
        { label: '#', range: 'A4:A4', colors: C.otrosGroup, endCol: 1 },
        { label: 'PERSONA', range: 'B4:D4', colors: C.otrosGroup, endCol: 4 },
        { label: 'TARJETA', range: 'E4:F4', colors: C.fallaGroup, endCol: 6 },
        { label: 'PROBLEMA', range: 'G4:H4', colors: C.repoGroup, endCol: 8 },
        { label: 'DETALLE', range: 'I4:J4', colors: C.bajaGroup, endCol: 10 },
        { label: 'ESTADO', range: 'K4:K4', colors: C.otrosGroup, endCol: 11 },
    ];
    const FALLA_GROUP_END_COLS = new Set(FALLA_GROUPS.map((g) => g.endCol));

    await addTitleAndMetaRow({
        worksheet: wsFalla,
        workbook,
        title: 'REPORTE DE FALLA',
        lastCol: LAST_F,
        metaLines: ['Reportes de falla de tarjetas de acceso.'],
    });

    FALLA_GROUPS.forEach((group) => {
        wsFalla.mergeCells(group.range);
        const cell = wsFalla.getCell(group.range.split(':')[0]);
        cell.value = group.label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.head } };
        cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: group.colors.sub } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'medium', color: { argb: C.separator } },
        };
    });
    wsFalla.getRow(4).height = 24;

    const fallaSubHeaders = [
        { label: 'NO.', group: FALLA_GROUPS[0], col: 1 },
        { label: 'PERSONA', group: FALLA_GROUPS[1], col: 2 },
        { label: 'DEPENDENCIA', group: FALLA_GROUPS[1], col: 3 },
        { label: 'EDIFICIO', group: FALLA_GROUPS[1], col: 4 },
        { label: 'TIPO TARJ.', group: FALLA_GROUPS[2], col: 5 },
        { label: 'FOLIO', group: FALLA_GROUPS[2], col: 6 },
        { label: 'DESCRIPCIÓN', group: FALLA_GROUPS[3], col: 7 },
        { label: 'DESDE CUÁNDO', group: FALLA_GROUPS[3], col: 8 },
        { label: 'URGENCIA', group: FALLA_GROUPS[4], col: 9 },
        { label: 'OBSERVACIONES', group: FALLA_GROUPS[4], col: 10 },
        { label: 'MATCH', group: FALLA_GROUPS[5], col: 11 },
    ];
    const srFalla = wsFalla.getRow(5);
    srFalla.height = 32;
    fallaSubHeaders.forEach(({ label, group, col }) => {
        const cell = srFalla.getCell(col);
        cell.value = label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.sub } };
        cell.font = { name: 'Arial', bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            bottom: { style: 'medium', color: { argb: group.colors.sub } },
            right: {
                style: FALLA_GROUP_END_COLS.has(col) ? 'medium' : 'thin',
                color: { argb: FALLA_GROUP_END_COLS.has(col) ? C.separator : 'FFFFFFFF' },
            },
        };
    });
    wsFalla.autoFilter = `A5:${LAST_F}5`;

    let fallaRowIdx = 6, fallaCt = 0;
    for (const sheet of input.parseResult.sheets) {
        if (sheet.key !== 'reporte_falla') continue;
        for (const rd of sheet.rows) {
            if (!rd.isValid) continue;
            const rk = `${sheet.key}-${rd.rowNumber}`;
            if (!input.selectedRows.has(rk)) continue;
            fallaCt++; const person = getFirstMatch(input, rk); const r = wsFalla.getRow(fallaRowIdx);
            r.getCell(1).value = fallaCt;
            r.getCell(2).value = person ? `${person.last_name}, ${person.first_name}` : `${rd.fields.apellidos}, ${rd.fields.nombres}`;
            r.getCell(3).value = person?.dependency || rd.fields.dependencia || '';
            r.getCell(4).value = rd.fields.ubicacion || person?.building || '';
            r.getCell(5).value = rd.fields.tipo_tarjeta || '—';
            r.getCell(6).value = rd.fields.folio || '—';
            r.getCell(7).value = (rd.fields.descripcion || '').substring(0, 80);
            r.getCell(8).value = rd.fields.desde_cuando || '—';
            r.getCell(9).value = rd.fields.urgencia || '—';
            r.getCell(10).value = rd.fields.observaciones || '—';
            r.getCell(11).value = person ? '✓ Encontrado' : '✖ No encontrado';

            for (let c = 1; c <= 11; c++) {
                const cell = r.getCell(c);
                const se = fallaSubHeaders.find(s => s.col === c);
                const g = se?.group ?? FALLA_GROUPS[0];
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: g.colors.fill } };
                cell.font = { name: 'Arial', size: 9, color: { argb: C.black } };
                cell.alignment = { vertical: 'middle', horizontal: [1, 5, 6, 9, 11].includes(c) ? 'center' : 'left', wrapText: true };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: {
                        style: FALLA_GROUP_END_COLS.has(c) ? 'medium' : 'thin',
                        color: { argb: FALLA_GROUP_END_COLS.has(c) ? C.separator : 'FFCBD5E1' },
                    },
                };
            }
            if (!person) {
                r.getCell(11).font = { name: 'Arial', size: 9, bold: true, color: { argb: C.roseFill.fg } };
                r.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.roseFill.fill } };
            } else {
                r.getCell(11).font = { name: 'Arial', size: 9, bold: true, color: { argb: C.emeraldFill.fg } };
                r.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.emeraldFill.fill } };
            }
            autoRowHeight(wsFalla, fallaRowIdx, 22); fallaRowIdx++;
        }
    }

    // ── Freeze panes for all sheets ──
    wsResumen.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
    wsAltas.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }];
    wsMod.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }];
    wsBaja.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }];
    wsRepo.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }];
    wsFalla.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }];

    // ── Save ──
    const filename = `Reporte_Importacion_${new Date().toISOString().split('T')[0]}.xlsx`;
    await saveWorkbook(workbook, filename);
}

// ═════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════

const SHEET_LABELS: Record<string, string> = {
    altas: 'Alta',
    modificaciones: 'Modificación',
    baja_persona: 'Baja',
    reposicion: 'Reposición',
    reporte_falla: 'Reporte Falla',
};

function getFirstMatch(input: ConflictReportInput, rowKey: string): PersonSimplified | null {
    const matches = input.matchResults.get(rowKey);
    if (matches && matches.length > 0) return matches[0];
    return null;
}

function buildSheetSummary(input: ConflictReportInput): { label: string; total: number; conflicts: number; selected: number }[] {
    const result: { label: string; total: number; conflicts: number; selected: number }[] = [];

    for (const sheet of input.parseResult.sheets) {
        const total = sheet.rows.filter((r) => r.isValid).length;
        let conflicts = 0;
        let selected = 0;

        for (const row of sheet.rows) {
            if (!row.isValid) continue;
            const rk = `${sheet.key}-${row.rowNumber}`;
            if (!input.selectedRows.has(rk)) continue;
            selected++;

            if (sheet.key === 'altas') {
                const analysis = input.altaAnalyses.get(rk);
                if (analysis?.hasConflicts) conflicts++;
            } else if (sheet.key === 'modificaciones') {
                const analysis = input.modAnalyses.get(rk);
                if (analysis?.hasChanges) conflicts++;
            }
        }

        result.push({
            label: SHEET_LABELS[sheet.key] || sheet.key,
            total,
            conflicts,
            selected,
        });
    }

    return result;
}

function buildResolutionsSummary(input: ConflictReportInput): { pending: number; resolved: number } {
    let pending = 0;
    let resolved = 0;

    for (const analysis of input.altaAnalyses.values()) {
        for (const conflict of analysis.conflicts) {
            if (!conflict.conflict) continue;
            if (conflict.resolution === 'proceed') resolved++;
            else pending++;
        }
    }

    // Modificaciones: "apply" or null = pending until imported, "reject" = resolved
    for (const analysis of input.modAnalyses.values()) {
        if (analysis.resolution === null) pending++;
        else resolved++;
    }

    return { pending, resolved };
}
