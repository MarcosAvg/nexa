import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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

export async function exportPersonnelToExcel(data: ExportPersonnelData[], options?: ExportOptions) {
    const workbook = new ExcelJS.Workbook();

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

            const isInactive = person.status === 'Baja' || person.status === 'Inactivo/a';

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
    saveAs(new Blob([buffer]), finalFileName);
}

export async function exportCardsToExcel(data: any[], options?: ExportOptions) {
    const workbook = new ExcelJS.Workbook();
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
            responsivaText: card.responsiva_status === 'signed' ? 'Firmada' : (card.person_id ? 'PENDIENTE' : 'N/A')
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
    saveAs(new Blob([buffer]), finalFileName);
}

export async function exportHistoryToExcel(data: any[], options?: ExportOptions) {
    const workbook = new ExcelJS.Workbook();
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
        CREATE: "Registro de Personal", UPDATE: "Actualización de Datos", DELETE: "Eliminación Permanente",
        BLOCK: "Bloqueo de Acceso", ACTIVATE: "Activación de Acceso", DEACTIVATE: "Desactivación de Personal",
        ASSIGN_CARD: "Asignación de Tarjeta", UNASSIGN_CARD: "Desvinculación de Tarjeta", UPSERT: "Guardado/Actualización",
        UPDATE_STATUS: "Cambio de Estado", UNASSIGN: "Desvinculación", UPDATE_PROGRAMMING: "Programación de Acceso",
        UPDATE_RESPONSIVA: "Estatus de Responsiva", REPLACE_CARD: "Reposición de Tarjeta", TICKET: "Ticket de Sistema",
        CREATE_TICKET: "Creación de Ticket", SIGN_RESPONSIVA: "Firma de Responsiva", DELETE_RESPONSIVA: "Eliminación de Responsiva",
        COMPLETE_TICKET: "Ticket Completado", APPLY_MODIFICATION: "Modificación Aprobada", REJECT_MODIFICATION: "Modificación Rechazada",
        REPLACE_OLD: "Baja por Reposición", DELETE_TICKET_CASCADE: "Eliminación en Cascada"
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
    saveAs(new Blob([buffer]), finalFileName);
}
