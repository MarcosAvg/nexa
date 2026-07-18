import type * as ExcelJSTypes from 'exceljs';
import { addLogoToSheet } from './xlsxShared';

export async function exportCardsToExcel(data: any[], options?: { filters?: { status?: string; dependency?: string; search?: string } }) {
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

    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `       INVENTARIO DE TARJETAS Y ACCESOS - NEXA${filterDescription}`;
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 40;

    await addLogoToSheet(workbook, worksheet);

    worksheet.mergeCells('A2:F2');
    const metaCell = worksheet.getCell('A2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaCell.value = `Reporte generado: ${dateStr}  |  Registros: ${data.length}`;
    metaCell.font = { name: 'Arial', size: 9, color: { argb: COLORS.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(2).height = 20;

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

            if (cell.value === 'PENDIENTE' || cell.value === 'N/A' || !cell.value || cell.value === '[SIN DATO]' || cell.value === 'Sin asignar') {
                const label = cell.value === 'Sin asignar' ? 'SIN ASIGNAR' : (cell.value === 'PENDIENTE' ? '[PENDIENTE]' : (cell.value === 'N/A' ? 'N/A' : '[SIN DATO]'));
                cell.value = label;
                cell.font = { ...cell.font, color: { argb: 'FFB91C1C' }, italic: true, bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            } else if (cell.value === 'Programada' || cell.value === 'Firmada') {
                const isProg = cell.value === 'Programada';
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isProg ? COLORS.violet.head : COLORS.emerald.head } };
                cell.font = { ...cell.font, color: { argb: isProg ? COLORS.violet.sub : COLORS.emerald.sub }, bold: true };
            } else if (colNumber === 4) {
                let statusColors = COLORS.slate;
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
        amber: { bg: 'FFFEF3C7', fg: 'FF92400E' },
        rose: { bg: 'FFFEE2E2', fg: 'FF991B1B' },
        slate: { bg: 'FFF1F5F9', fg: 'FF334155' },
        blue: { bg: 'FFDBEAFE', fg: 'FF1E40AF' },
        sky: { bg: 'FFE0F2FE', fg: 'FF075985' },
        emerald: { bg: 'FFD1FAE5', fg: 'FF065F46' },
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

    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `       ANÁLISIS DE FOLIOS FALTANTES — ${type}`;
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: C.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 40;

    await addLogoToSheet(workbook, worksheet);

    worksheet.mergeCells('A2:E2');
    const metaCell = worksheet.getCell('A2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    metaCell.value = `Reporte generado: ${dateStr}  |  Rango: ${start} al ${end}  |  Total incidencias: ${missingData.length}`;
    metaCell.font = { name: 'Arial', size: 9, color: { argb: C.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(2).height = 20;

    const countReposicion = missingData.filter(d => d.observation === 'Extravío / Reposición').length;
    const countNoDevuelta = missingData.filter(d => d.observation.startsWith('Tarjeta no devuelta')).length;
    const countSinRegistro = missingData.filter(d => d.observation === 'No registrada').length;
    const countEliminada = missingData.filter(d => d.observation === 'Eliminada permanentemente').length;
    const countOther = missingData.length - countReposicion - countNoDevuelta - countSinRegistro - countEliminada;

    let row = 4;

    worksheet.mergeCells(`A${row}:E${row}`);
    const secTitle = worksheet.getCell(`A${row}`);
    secTitle.value = '📊  RESUMEN POR CATEGORÍA';
    secTitle.font = { name: 'Arial', bold: true, size: 12, color: { argb: C.sectionHead } };
    secTitle.alignment = { vertical: 'middle' };
    worksheet.getRow(row).height = 28;
    row++;

    const kpis = [
        { label: 'Extravío / Rep.', count: countReposicion, colors: C.amber },
        { label: 'No Devuelta', count: countNoDevuelta, colors: C.rose },
        { label: 'Eliminada Perm.', count: countEliminada, colors: C.sky },
        { label: 'No Registrada', count: countSinRegistro, colors: C.slate },
    ];

    if (countOther > 0) {
        kpis.push({ label: 'Otros', count: countOther, colors: C.emerald });
    }

    kpis.forEach((kpi, i) => {
        const col = String.fromCharCode(65 + i);
        const lCell = worksheet.getCell(`${col}${row}`);
        lCell.value = kpi.label;
        lCell.font = { name: 'Arial', bold: true, size: 9, color: { argb: kpi.colors.fg } };
        lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.colors.bg } };
        lCell.alignment = { vertical: 'middle', horizontal: 'center' };
        setBorder(lCell);
    });
    worksheet.getRow(row).height = 22;
    row++;

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
    row++; row++;

    worksheet.mergeCells(`A${row}:E${row}`);
    const dataTitle = worksheet.getCell(`A${row}`);
    dataTitle.value = '📋  DETALLE DE INCIDENCIAS';
    dataTitle.font = { name: 'Arial', bold: true, size: 12, color: { argb: C.sectionHead } };
    dataTitle.alignment = { vertical: 'middle' };
    worksheet.getRow(row).height = 28;
    row++;

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

    missingData.forEach(item => {
        const dataRow = worksheet.addRow({
            folio: item.folio,
            status: item.status,
            observation: item.observation,
            date: item.date,
            personName: item.personName
        });
        dataRow.height = 22;

        let rowColors = C.slate;
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

            if (colNumber === 3) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColors.bg } };
                cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: rowColors.fg } };
            }
        });
    });

    worksheet.autoFilter = `A${dataHeaderRow}:E${dataHeaderRow}`;
    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: dataHeaderRow }];

    const finalFileName = `Analisis_Folios_${type}_${start}_a_${end}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAsFunction(new Blob([buffer]), finalFileName);
}
