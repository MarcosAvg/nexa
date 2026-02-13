import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface ExportPersonnelData {
    first_name: string;
    last_name: string;
    employeeNo: string;
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
    email?: string;
    cards?: { type: string; folio: string }[];
}

export interface ExportOptions {
    filters?: {
        status?: string;
        dependency?: string;
        search?: string;
    }
}

export async function exportPersonnelToExcel(data: ExportPersonnelData[], options?: ExportOptions) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Directorio');

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

    // Construct Dynamic Title and Filename
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
            filterDescription = `  |  Filtros: ${activeFilters.join(' - ')}`;
        }
    }

    worksheet.columns = [
        { key: 'last_name', width: 25 },
        { key: 'first_name', width: 25 },
        { key: 'employeeNo', width: 15 },
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
    titleCell.value = `         DIRECTORIO MAESTRO DE PERSONAL - NEXA${filterDescription}`;
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
    metaCell.value = `Reporte generado: ${dateStr}  |  Registros: ${data.length}`;
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
    data.forEach((person, index) => {
        const folioP2000 = person.cards?.filter(c => c.type.toUpperCase() === 'P2000').map(c => c.folio).join(', ') || '-';
        const folioKone = person.cards?.filter(c => c.type.toUpperCase() === 'KONE').map(c => c.folio).join(', ') || '-';

        const rowData = {
            last_name: person.last_name || '-',
            first_name: person.first_name || '-',
            employeeNo: person.employeeNo || '-',
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
    };

    let filterDescription = '';
    if (options?.filters?.search) {
        filterDescription = `  |  Búsqueda: "${options.filters.search}"`;
    }
    if (options?.filters?.status && options.filters.status !== 'Todas') {
        filterDescription += `  |  Estado: ${options.filters.status}`;
    }

    worksheet.columns = [
        { key: 'type', width: 12 },
        { key: 'folio', width: 20 },
        { key: 'personName', width: 30 },
        { key: 'statusLabel', width: 15 },
        { key: 'responsivaText', width: 22 },
        { key: 'programmingText', width: 22 },
    ];

    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `         INVENTARIO DE TARJETAS Y ACCESOS - NEXA${filterDescription}`;
    titleCell.font = { name: 'Arial', bold: true, size: 14, color: { argb: COLORS.title } };
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

    // Sub-Headers (No Row 2 gap)
    const headerRow = worksheet.getRow(2);
    headerRow.height = 25;
    const headerLabels = ['TIPO', 'FOLIO / NO. TARJETA', 'ASIGNADA A', 'ESTADO', 'RESPONSIVA', 'PROGRAMACIÓN'];

    headerLabels.forEach((label, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.title } };
        cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
            right: { style: (i === 1 || i === 3) ? 'medium' : 'thin', color: { argb: 'FFFFFFFF' } }
        };
    });

    worksheet.autoFilter = 'A2:F2';

    data.forEach((card) => {
        const rowData = {
            type: card.type,
            folio: card.folio,
            personName: card.personName || 'Sin asignar',
            statusLabel: card.status === 'active' ? 'Activa' : (card.status === 'blocked' ? 'Bloqueada' : 'Disponible'),
            responsivaText: card.responsiva_status === 'signed' ? 'Firmada' : (card.personId ? 'PENDIENTE' : 'N/A'),
            programmingText: card.programming_status === 'done' ? 'Programada' : (card.personId ? 'PENDIENTE' : 'N/A')
        };

        const row = worksheet.addRow(rowData);
        row.height = 22;

        row.eachCell((cell, colNumber) => {
            cell.font = { name: 'Arial', size: 9 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: (colNumber === 2 || colNumber === 4) ? 'medium' : 'thin', color: { argb: 'FFCBD5E1' } }
            };

            // Empty highlights
            if (cell.value === 'PENDIENTE') {
                cell.value = '[SIN DATO]';
                cell.font = { ...cell.font, color: { argb: 'FFB91C1C' }, italic: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            }
        });

        // Status Colors
        const statusCell = row.getCell('statusLabel');
        if (card.status === 'active') {
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
            statusCell.font = { color: { argb: 'FF166534' }, bold: true, name: 'Arial', size: 9 };
        } else if (card.status === 'blocked') {
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            statusCell.font = { color: { argb: 'FF991B1B' }, bold: true, name: 'Arial', size: 9 };
        }

        // Type Colors
        const typeCell = row.getCell('type');
        typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: card.type === 'KONE' ? COLORS.sky.head : COLORS.amber.head } };
        typeCell.font = { color: { argb: card.type === 'KONE' ? COLORS.sky.sub : COLORS.amber.sub }, bold: true, name: 'Arial', size: 9 };
    });

    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];
    const finalFileName = `Tarjetas_Nexa_${new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), finalFileName);
}

export async function exportHistoryToExcel(data: any[], options?: ExportOptions) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Historial');

    const COLORS = {
        title: 'FF1E293B',
        personal: { head: 'FFDBEAFE', sub: 'FF1E40AF' },
        amber: { head: 'FFFEF3C7', sub: 'FF92400E' },
        sky: { head: 'FFE0F2FE', sub: 'FF075985' },
        emerald: { head: 'FFD1FAE5', sub: 'FF065F46' },
        rose: { head: 'FFFEE2E2', sub: 'FF991B1B' },
        violet: { head: 'FFEDE9FE', sub: 'FF5B21B6' }
    };

    const actionNames: Record<string, string> = {
        CREATE: "Registro de Personal", UPDATE: "Actualización de Datos", DELETE: "Eliminación Permanente",
        BLOCK: "Bloqueo de Acceso", ACTIVATE: "Activación de Acceso", DEACTIVATE: "Desactivación de Personal",
        ASSIGN_CARD: "Asignación de Tarjeta", UNASSIGN_CARD: "Desvinculación de Tarjeta", UPSERT: "Guardado/Actualización",
        UPDATE_STATUS: "Cambio de Estado", UNASSIGN: "Desvinculación", UPDATE_PROGRAMMING: "Programación de Acceso",
        UPDATE_RESPONSIVA: "Estatus de Responsiva", REPLACE_CARD: "Reposición de Tarjeta", TICKET: "Ticket de Sistema",
        CREATE_TICKET: "Creación de Ticket", SIGN_RESPONSIVA: "Firma de Responsiva", DELETE_RESPONSIVA: "Eliminación de Responsiva",
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
            .replace(/\bavailable\b/gi, "disponible");
    }

    worksheet.columns = [
        { key: 'date', width: 22 },
        { key: 'entity', width: 45 }, // Slightly wider for full names
        { key: 'actionLabel', width: 25 },
        { key: 'description', width: 55 },
    ];

    worksheet.mergeCells('A1:D1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `         HISTORIAL DE AUDITORÍA Y ACCIONES - NEXA`;
    titleCell.font = { name: 'Arial', bold: true, size: 14, color: { argb: COLORS.title } };
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

    const headerRow = worksheet.getRow(2);
    headerRow.height = 25;
    const headerLabels = ['FECHA / HORA', 'ENTIDAD AFECTADA', 'ACCIÓN', 'DESCRIPCIÓN'];
    headerLabels.forEach((label, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.title } };
        cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    worksheet.autoFilter = 'A2:D2';

    data.forEach((log) => {
        const message = log.details?.message || (typeof log.details === 'string' ? log.details : JSON.stringify(log.details));
        let cleanMessage = message.replace(/\sID:?\s?[a-f0-9-]{8,}/gi, '').replace(/\s(de|ID)\s?[a-f0-9-]{8,}/gi, '');
        cleanMessage = translateText(cleanMessage);

        // Resolve entity string (since we are receiving data that might already have resolved entity in some cases, 
        // but the view sends the raw or almost raw data. We'll handle it here if view gives us it or we derive.)
        // Looking at HistoryView, it uses resolveEntity(log.entity_type, log.entity_id)
        // We'll assume the caller might have already resolved it or we'll just use what's there.
        // Actually, let's assume the view sends row.resolvedEntity derived field.

        const rowData = {
            date: new Date(log.timestamp).toLocaleString('es-MX'),
            entity: log.resolvedName || `${log.entity_type}: ${log.entity_id}`,
            actionLabel: actionNames[log.action] || log.action,
            description: cleanMessage
        };

        const row = worksheet.addRow(rowData);
        row.height = 24;

        // Apply Row Background Color based on Action (Subtle)
        let rowFillColor = 'FFFFFFFF'; // Default white
        const action = log.action;
        if (['CREATE', 'ACTIVATE'].includes(action)) rowFillColor = COLORS.emerald.head;
        else if (['DELETE', 'BLOCK', 'DEACTIVATE', 'UNASSIGN', 'UNASSIGN_CARD', 'DELETE_RESPONSIVA'].includes(action)) rowFillColor = COLORS.rose.head;
        else if (['UPDATE', 'UPDATE_STATUS', 'UPSERT'].includes(action)) rowFillColor = COLORS.personal.head;
        else if (['ASSIGN_CARD', 'UPDATE_PROGRAMMING', 'UPDATE_RESPONSIVA', 'REPLACE_CARD', 'SIGN_RESPONSIVA'].includes(action)) rowFillColor = COLORS.violet.head;
        else if (['TICKET', 'CREATE_TICKET'].includes(action)) rowFillColor = COLORS.sky.head;

        row.eachCell((cell) => {
            cell.font = { name: 'Arial', size: 9 };
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
            // Apply fill if not white
            if (rowFillColor !== 'FFFFFFFF') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillColor } };
            }
        });

        row.getCell('date').alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell('actionLabel').alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell('actionLabel').font = { ...row.getCell('actionLabel').font, bold: true };
    });

    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];
    const finalFileName = `Historial_Nexa_${new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), finalFileName);
}
