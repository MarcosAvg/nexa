import { addLogoToSheet, autoRowHeight } from './xlsxShared';

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

        row.eachCell((cell, colNumber) => {
            const colLetter = String.fromCharCode(64 + colNumber);
            const group = groups.find(g => {
                const parts = g.range.replace(/[0-9]/g, '').split(':');
                return colLetter >= parts[0] && colLetter <= (parts[1] || parts[0]);
            }) || groups[0];

            cell.font = { name: 'Arial', size: 9 };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
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
        // Auto height: calculate row height based on wrapped text content
        autoRowHeight(worksheet, row.number, 22);
    });

    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
    const finalFileName = `Tarjetas_Nexa_${new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAsFunction(new Blob([buffer]), finalFileName);
}
