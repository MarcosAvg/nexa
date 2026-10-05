import { addLogoToSheet, autoRowHeight } from './xlsxShared';
import { settingsState } from '../stores';

/** Fila de enlace ya resuelta (nombres legibles) para exportar. */
export type EnlacesExportRow = {
    employeeNo?: string | null;
    name?: string | null;
    dependency?: string | null;
    building?: string | null;
    floor?: string | null;
    email?: string | null;
    extension?: string | null;
};

export type EnlacesExportFilters = {
    search?: string;
    dependency?: string[];
    building?: string[];
    floor?: string[];
};

/** Valor legible para exportar: "Sin dato" si viene vacío o "N/A". */
function cellValue(v: string | null | undefined): string {
    const s = v == null ? '' : String(v).trim();
    if (s === '' || s.toUpperCase() === 'N/A') return 'Sin dato';
    return s;
}

/**
 * Exporta el directorio de Enlaces Administrativos (según los filtros
 * aplicados en la vista) a un archivo Excel.
 */
export async function exportEnlacesToExcel(
    data: EnlacesExportRow[],
    options?: { filters?: EnlacesExportFilters },
) {
    const [ExcelJSModule, { saveAs: saveAsFunction }] = await Promise.all([
        import('exceljs'),
        import('file-saver'),
    ]);
    const workbook = new (ExcelJSModule.default || ExcelJSModule).Workbook();
    const worksheet = workbook.addWorksheet('Enlaces');

    const COLORS = {
        title: 'FF1E293B',
        meta: 'FF64748B',
        separator: 'FF94A3B8',
        persona: { head: 'FFDBEAFE', sub: 'FF1E40AF', fill: 'FFEFF6FF' },
        ubicacion: { head: 'FFFEF3C7', sub: 'FF92400E', fill: 'FFFEFCE8' },
        contacto: { head: 'FFEDE9FE', sub: 'FF5B21B6', fill: 'FFFAF5FF' },
    };

    // Descripción de filtros aplicados.
    const filterParts: string[] = [];
    if (options?.filters?.search?.trim()) filterParts.push(`Búsqueda: "${options.filters.search.trim()}"`);
    if (options?.filters?.dependency?.length)
        filterParts.push(`Dependencia: ${options.filters.dependency.join(', ')}`);
    if (options?.filters?.building?.length)
        filterParts.push(`Edificio: ${options.filters.building.join(', ')}`);
    if (options?.filters?.floor?.length) filterParts.push(`Piso: ${options.filters.floor.join(', ')}`);
    const filterDescription = filterParts.length ? `      -  Filtros: ${filterParts.join('  |  ')}` : '';

    worksheet.columns = [
        { key: 'employeeNo', width: 16 },
        { key: 'name', width: 34 },
        { key: 'dependency', width: 38 },
        { key: 'building', width: 24 },
        { key: 'floor', width: 14 },
        { key: 'email', width: 34 },
        { key: 'extension', width: 14 },
    ];

    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `       DIRECTORIO DE ENLACES ADMINISTRATIVOS - ${settingsState.orgName.toUpperCase()}${filterDescription}`;
    titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: COLORS.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 40;

    await addLogoToSheet(workbook, worksheet);

    worksheet.mergeCells('A2:G2');
    const metaCell = worksheet.getCell('A2');
    const dateStr = new Date().toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
    metaCell.value = `Reporte generado: ${dateStr}  |  Registros: ${data.length}`;
    metaCell.font = { name: 'Arial', size: 9, color: { argb: COLORS.meta } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(2).height = 20;

    const groups = [
        { label: 'PERSONA', range: 'A3:B3', colors: COLORS.persona },
        { label: 'UBICACIÓN', range: 'C3:E3', colors: COLORS.ubicacion },
        { label: 'CONTACTO', range: 'F3:G3', colors: COLORS.contacto },
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

    const headerRow = worksheet.getRow(4);
    headerRow.height = 30;
    const headerLabels = [
        'Nº EMPLEADO',
        'NOMBRE COMPLETO',
        'DEPENDENCIA',
        'EDIFICIO',
        'PISO BASE',
        'CORREO',
        'EXTENSIÓN',
    ];
    headerLabels.forEach((label, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = label;
        const col = String.fromCharCode(65 + i);
        const group =
            groups.find((g) => {
                const [start, end] = g.range.replace(/[0-9]/g, '').split(':');
                return col >= start && col <= (end || start);
            }) || groups[0];
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.sub } };
        cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 8 };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
            right: { style: 'medium', color: { argb: COLORS.separator } },
        };
    });

    worksheet.autoFilter = 'A4:G4';

    data.forEach((row) => {
        const excelRow = worksheet.addRow({
            employeeNo: cellValue(row.employeeNo),
            name: cellValue(row.name),
            dependency: cellValue(row.dependency),
            building: cellValue(row.building),
            floor: cellValue(row.floor),
            email: cellValue(row.email),
            extension: cellValue(row.extension),
        });

        excelRow.eachCell((cell, colNumber) => {
            const col = String.fromCharCode(64 + colNumber);
            const group =
                groups.find((g) => {
                    const [start, end] = g.range.replace(/[0-9]/g, '').split(':');
                    return col >= start && col <= (end || start);
                }) || groups[0];

            cell.font = { name: 'Arial', size: 9 };
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.colors.fill } };
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'medium', color: { argb: COLORS.separator } },
            };

            if (cell.value === 'Sin dato') {
                cell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFB45309' } };
            }
        });

        excelRow.getCell('employeeNo').alignment = { horizontal: 'center', vertical: 'middle' };
        excelRow.getCell('extension').alignment = { horizontal: 'center', vertical: 'middle' };
        autoRowHeight(worksheet, excelRow.number, 22);
    });

    worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 4 }];

    const finalFileName = `Enlaces_${settingsState.orgName.replace(/\s+/g, '_')}_${
        new Date().toISOString().split('T')[0]
    }.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAsFunction(new Blob([buffer]), finalFileName);
}
