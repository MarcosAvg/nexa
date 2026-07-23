import type * as ExcelJSTypes from 'exceljs';
import { addLogoToSheet, autoRowHeight } from './xlsxShared';

export const RESPONSIVA_PICKUP_DAYS = 7;
/** Días a partir de los cuales se muestra advertencia "Por vencer" (ámbar) en la UI. */
export const RESPONSIVA_WARN_DAYS = 5;

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
        if (needsBaja) return "Plazo vencido";
        return `Alta — Restan ${formatDaysRemaining(daysRemaining)} para recoger`;
    }
    if (needsBaja) return "Plazo vencido";
    return `Restan ${formatDaysRemaining(daysRemaining)} para recoger`;
}

export function computeResponsivaManagement(
    movementType: string,
    referenceDate: string,
    ticketCreatedAt: string,
    pickupDays: number = RESPONSIVA_PICKUP_DAYS
) {
    const isReposicion = movementType === "Reposición";
    const elapsedRef = isReposicion ? referenceDate : ticketCreatedAt;
    const daysElapsed = daysSince(elapsedRef);
    const daysRemaining = Math.max(0, pickupDays - daysSince(ticketCreatedAt));
    const needsBaja = !isReposicion && daysSince(ticketCreatedAt) > pickupDays;

    return {
        daysElapsed,
        controlLabel: needsBaja ? "Baja de registro" : "-",
        deadlineLabel: formatPickupTrackingLabel(movementType, daysRemaining, daysElapsed, needsBaja),
        needsBaja,
        isReposicion,
        isAlta: movementType === "Alta de Personal",
    };
}

export async function exportResponsivasToExcel(tickets: any[], dependencyName?: string, returnBuffer?: false): Promise<void>;
export async function exportResponsivasToExcel(tickets: any[], dependencyName: string | undefined, returnBuffer: true): Promise<{ buffer: ArrayBuffer; filename: string }>;
export async function exportResponsivasToExcel(tickets: any[], dependencyName?: string, returnBuffer?: boolean): Promise<void | { buffer: ArrayBuffer; filename: string }> {
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

    let filterDescription = '';
    if (dependencyName && dependencyName !== 'Todas') {
        filterDescription = `      -  Dependencia: ${dependencyName}`;
    }

    worksheet.mergeCells(`A1:${LAST_COL}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `       PERSONAL PENDIENTE DE RECOGER ACCESOS${filterDescription}`;
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 40;

    await addLogoToSheet(workbook, worksheet);

    worksheet.mergeCells(`A2:${LAST_COL}2`);
    const metaCell = worksheet.getCell('A2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaCell.value = `Reporte generado: ${dateStr}  |  Personas: ${uniquePersons}  |  Tarjetas pendientes: ${rows.length}  |  Requieren baja de registro: ${bajaCount}`;
    metaCell.font = { name: 'Arial', size: 9, color: { argb: COLORS.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(2).height = 20;

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
        // Auto height: calculate row height based on wrapped text content
        autoRowHeight(worksheet, row.number, 22);
    });

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

    worksheet.autoFilter = `A4:${LAST_COL}4`;
    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
    worksheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };

    const fileNameParts = ['Responsivas_Pendientes'];
    if (dependencyName && dependencyName !== 'Todas') {
        fileNameParts.push(dependencyName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').replace(/ /g, '_'));
    }
    const finalFileName = `${fileNameParts.join('_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    if (returnBuffer) {
        return { buffer: buffer as ArrayBuffer, filename: finalFileName };
    }
    saveAsFunction(new Blob([buffer]), finalFileName);
}
