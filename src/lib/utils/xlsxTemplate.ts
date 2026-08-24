import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { CatalogItem } from '../types';
import { activeMediaTypes, ALTAS_BASE, altasMediaCols, modifMediaCols, reposMediaCols, type MediaInfo } from './mediaContract';
import { settingsState } from '../stores';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────

interface Building extends CatalogItem {
    floors?: string[];
}

interface TemplateCatalogs {
    buildings: Building[];
    dependencies: CatalogItem[];
    specialAccesses: CatalogItem[];
    schedules: CatalogItem[];
    /** Tipos de medio activos (del catálogo) para armar columnas/dropdowns. */
    mediaTypes?: CatalogItem[];
}

// ─────────────────────────────────────────
// Paleta de colores
// ─────────────────────────────────────────
const C = {
    titleText: 'FF1E293B',
    metaText: 'FF64748B',
    mandatoryFill: 'FFFEE2E2',
    mandatoryText: 'FF991B1B',
    recommendedFill: 'FFEFF6FF',
    recommendedText: 'FF1D4ED8',
    optionalFill: 'FFF8FAFC',
    optionalText: 'FF475569',
    groupBlue: { head: 'FF1E40AF', fill: 'FFDBEAFE' },
    groupSlate: { head: 'FF334155', fill: 'FFF1F5F9' },
    groupAmber: { head: 'FF92400E', fill: 'FFFEF3C7' },
    groupSky: { head: 'FF075985', fill: 'FFE0F2FE' },
    groupEmerald: { head: 'FF065F46', fill: 'FFD1FAE5' },
    groupRose: { head: 'FF9D174D', fill: 'FFFCE7F3' },
    groupViolet: { head: 'FF5B21B6', fill: 'FFEDE9FE' },
    groupOrange: { head: 'FF9A3412', fill: 'FFFED7AA' },
    white: 'FFFFFFFF',
    border: 'FFCBD5E1',
};

// ─────────────────────────────────────────
// Orden de pisos
// ─────────────────────────────────────────
function sortFloors(floors: string[]): string[] {
    const ORDER: Record<string, number> = {
        'Sótano': -2,
        'Sotano': -2,
        'Planta Baja': -1,
        'PB': -1,
    };
    return [...floors].sort((a, b) => {
        const oa = ORDER[a] ?? parseInt(a);
        const ob = ORDER[b] ?? parseInt(b);
        if (!isNaN(oa) && !isNaN(ob)) return oa - ob;
        if (!isNaN(oa)) return oa < 0 ? -1 : 1;
        if (!isNaN(ob)) return ob < 0 ? 1 : -1;
        return a.localeCompare(b);
    });
}

// ─────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────

/** Convierte un índice de columna 0-based a su letra (A, B, ..., Z, AA, ...). */
function colLetter(idx: number): string {
    let n = idx + 1;
    let s = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

function styleCell(
    cell: ExcelJS.Cell,
    opts: {
        bold?: boolean;
        size?: number;
        fontColor?: string;
        fillColor?: string;
        align?: ExcelJS.Alignment['horizontal'];
        valign?: ExcelJS.Alignment['vertical'];
        wrap?: boolean;
        italic?: boolean;
        borders?: boolean;
    } = {}
) {
    cell.font = {
        name: 'Arial', size: opts.size ?? 9,
        bold: opts.bold ?? false, italic: opts.italic ?? false,
        color: { argb: opts.fontColor ?? C.titleText },
    };
    if (opts.fillColor) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fillColor } };
    }
    cell.alignment = {
        vertical: opts.valign ?? 'middle',
        horizontal: opts.align ?? 'left',
        wrapText: opts.wrap ?? false,
    };
    if (opts.borders) {
        cell.border = {
            top: { style: 'thin', color: { argb: C.border } },
            left: { style: 'thin', color: { argb: C.border } },
            bottom: { style: 'thin', color: { argb: C.border } },
            right: { style: 'thin', color: { argb: C.border } },
        };
    }
}

function addSheetTitle(ws: ExcelJS.Worksheet, title: string, totalCols: number) {
    const last = colLetter(totalCols - 1);
    ws.mergeCells(`A1:${last}1`);
    const cell = ws.getCell('A1');
    cell.value = title;
    styleCell(cell, { bold: true, size: 15, fontColor: C.titleText, fillColor: 'FFF1F5F9', align: 'center' });
    ws.getRow(1).height = 38;
}

type GroupConfig = { label: string; cols: number; color: { head: string; fill: string } };

function addGroupHeaders(ws: ExcelJS.Worksheet, row: number, groups: GroupConfig[]) {
    let col = 1;
    for (const g of groups) {
        const start = colLetter(col - 1);
        const end = colLetter(col + g.cols - 2);
        const range = g.cols > 1 ? `${start}${row}:${end}${row}` : `${start}${row}`;
        if (g.cols > 1) ws.mergeCells(range);
        const cell = ws.getCell(`${start}${row}`);
        cell.value = g.label;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: g.color.fill } };
        cell.font = { name: 'Arial', bold: true, size: 8, color: { argb: g.color.head } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin', color: { argb: C.border } }, bottom: { style: 'thin', color: { argb: C.border } },
            left: { style: 'thin', color: { argb: C.border } }, right: { style: 'medium', color: { argb: C.border } },
        };
        col += g.cols;
    }
    ws.getRow(row).height = 24;
}

function addColumnHeaders(ws: ExcelJS.Worksheet, row: number, headers: { label: string; mandatory?: boolean; recommended?: boolean }[]) {
    headers.forEach((h, i) => {
        const cell = ws.getCell(row, i + 1);
        cell.value = h.mandatory ? `${h.label} *` : h.label;
        const fill = h.mandatory ? C.mandatoryFill : h.recommended ? C.recommendedFill : C.optionalFill;
        const fontColor = h.mandatory ? C.mandatoryText : h.recommended ? C.recommendedText : C.optionalText;
        styleCell(cell, { bold: true, size: 8, fontColor, fillColor: fill, align: 'center', wrap: true, borders: true });
    });
    ws.getRow(row).height = 32;
}

function addDropdown(ws: ExcelJS.Worksheet, col: string | number, from: number, to: number, formulae: string) {
    const colStr = typeof col === 'number' ? colLetter(col - 1) : col;
    for (let r = from; r <= to; r++) {
        ws.getCell(`${colStr}${r}`).dataValidation = {
            type: 'list', allowBlank: true, formulae: [formulae],
            showErrorMessage: true, errorTitle: 'Valor inválido',
            error: 'Selecciona una opción de la lista desplegable.',
        };
    }
}

function addYesNoDropdown(ws: ExcelJS.Worksheet, col: string | number, from: number, to: number) {
    addDropdown(ws, col, from, to, '"Sí,No"');
}

function paintDataRows(ws: ExcelJS.Worksheet, fromRow: number, toRow: number, totalCols: number, mandatoryCols: number[], recommendedCols: number[] = []) {
    for (let r = fromRow; r <= toRow; r++) {
        for (let c = 1; c <= totalCols; c++) {
            const cell = ws.getCell(r, c);
            const fill = mandatoryCols.includes(c) ? C.mandatoryFill : recommendedCols.includes(c) ? C.recommendedFill : C.optionalFill;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
            cell.font = { name: 'Arial', size: 9, color: { argb: C.titleText } };
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.border = {
                bottom: { style: 'thin', color: { argb: C.border } },
                right: { style: 'thin', color: { argb: C.border } },
            };
        }
    }
}

// ─────────────────────────────────────────
// Hoja: CATÁLOGOS — referencias calculadas + writer
// ─────────────────────────────────────────

function prepareCatalogData(catalogs: TemplateCatalogs) {
    const depsNames = catalogs.dependencies.map(d => d.name);
    const buildingNames = catalogs.buildings.map(b => b.name);
    const accessNames = catalogs.specialAccesses.map(a => a.name);
    const scheduleNames = catalogs.schedules.map(s => s.name);
    const allFloors = new Set<string>();
    catalogs.buildings.forEach(b => (b.floors || []).forEach(f => allFloors.add(f)));
    const floorList = sortFloors(Array.from(allFloors));

    // Tipos de tarjeta derivados del catálogo de medios (activos); "Ambas" al final.
    // Se usa el nombre visible (P2000/KONE/AccessPRO) para no romper el contrato
    // de la hoja Reporte de Falla; la key queda como identificador interno.
    const mediaNames = (catalogs.mediaTypes || [])
        .filter((m) => m.active !== false)
        .map((m) => m.name || m.key);
    const cardTypeList = [...mediaNames, 'Ambas'];

    const refs = {
        depsRef: () => `CATALOGOS!$A$1:$A$${depsNames.length}`,
        buildingsRef: () => `CATALOGOS!$B$1:$B$${buildingNames.length}`,
        floorsRef: () => `CATALOGOS!$C$1:$C$${floorList.length}`,
        accessRef: () => `CATALOGOS!$D$1:$D$${accessNames.length}`,
        schedulesRef: () => `CATALOGOS!$E$1:$E$${scheduleNames.length}`,
        tipoPersonalRef: () => `CATALOGOS!$F$1:$F$6`,
        tipoTarjetaRef: () => `CATALOGOS!$G$1:$G$${cardTypeList.length}`,
        accionPisosRef: () => `CATALOGOS!$H$1:$H$3`,
        tipoBajaRef: () => `CATALOGOS!$I$1:$I$2`,
        motivoReposRef: () => `CATALOGOS!$J$1:$J$4`,
        urgenciaRef: () => `CATALOGOS!$K$2:$K$4`,
    };
    return { refs, lists: { depsNames, buildingNames, accessNames, scheduleNames, floorList, cardTypeList } };
}

function writeCatalogSheet(wb: ExcelJS.Workbook, lists: ReturnType<typeof prepareCatalogData>['lists']) {
    const ws = wb.addWorksheet('CATALOGOS');
    ws.state = 'hidden';
    const write = (col: number, items: string[]) =>
        items.forEach((item, i) => { ws.getCell(i + 1, col).value = item; });
    write(1, lists.depsNames);
    write(2, lists.buildingNames);
    write(3, lists.floorList);
    write(4, lists.accessNames);
    write(5, lists.scheduleNames);
    write(6, ['Trabajador de planta', 'Honorarios Profesionales', 'Servicio Social', 'Otro']);
    write(7, lists.cardTypeList);
    write(8, ['Reemplazar', 'Sumar', 'Quitar']);
    write(9, ['Definitiva', 'Temporal']);
    write(10, ['Extravío', 'Daño', 'Robo', 'Otro']);
    write(11, ['Alta (Alta/Media/Baja)', 'Alta', 'Media', 'Baja']);
}

// Tipo alias para que las hojas sigan referenciando la misma forma
type CatalogRefs = ReturnType<typeof prepareCatalogData>['refs'];

// ─────────────────────────────────────────
// Hoja: INSTRUCCIONES
// ─────────────────────────────────────────

function buildInstructionsSheet(wb: ExcelJS.Workbook) {
    const ws = wb.addWorksheet('📋 INSTRUCCIONES');
    ws.views = [{ showGridLines: false }];
    ws.columns = [
        { width: 4 }, { width: 32 }, { width: 90 }
    ];

    // Título
    ws.mergeCells('A1:C1');
    const title = ws.getCell('A1');
    title.value = 'Plantilla de Solicitudes de Acceso';
    styleCell(title, { bold: true, size: 18, fontColor: C.white, fillColor: C.groupBlue.head, align: 'center' });
    ws.getRow(1).height = 48;

    ws.mergeCells('A2:C2');
    const subtitle = ws.getCell('A2');
    subtitle.value = 'Lea las instrucciones completas antes de llenar cualquier hoja';
    styleCell(subtitle, { size: 16, fontColor: C.metaText, fillColor: 'FFF8FAFC', align: 'center', italic: true, bold: true });
    ws.getRow(2).height = 24;

    let r = 4;

    const sectionTitle = (text: string) => {
        ws.mergeCells(`B${r}:C${r}`);
        const c = ws.getCell(`B${r}`);
        c.value = text;
        styleCell(c, { bold: true, size: 11, fontColor: C.white, fillColor: 'FF0F172A' });
        ws.getRow(r).height = 28;
        r++;
    };

    const addRow = (label: string, description: string, type?: 'mandatory' | 'recommended' | 'optional' | 'note') => {
        ws.getCell(`B${r}`).value = label;
        const fill = type === 'mandatory' ? C.mandatoryFill : type === 'recommended' ? C.recommendedFill : type === 'note' ? 'FFFFFBEB' : C.optionalFill;
        const fontColor = type === 'mandatory' ? C.mandatoryText : type === 'recommended' ? C.recommendedText : type === 'note' ? 'FF92400E' : C.optionalText;
        styleCell(ws.getCell(`B${r}`), { bold: type === 'mandatory', size: 9, fontColor, fillColor: fill, borders: true, valign: 'top' });
        ws.getCell(`C${r}`).value = description;
        styleCell(ws.getCell(`C${r}`), { size: 9, fontColor, fillColor: fill, borders: true, wrap: true, valign: 'top' });
        // Altura dinámica: ~18px por línea + 10px padding
        const lines = description.split('\n').length + Math.ceil(description.replace(/\n/g, '').length / 105);
        ws.getRow(r).height = Math.max(10, lines * 10);
        r++;
    };

    const space = (h = 10) => { ws.getRow(r).height = h; r++; };

    // ─ LEGEND ─
    sectionTitle('🎨  LEYENDA DE COLORES');
    addRow('CAMPO OBLIGATORIO *', 'Debe llenarse siempre.\nLa solicitud será rechazada si falta este dato.', 'mandatory');
    addRow('CAMPO RECOMENDADO', 'Importante para procesar la solicitud correctamente.\nAyuda a evitar retrasos o aclaraciones adicionales.', 'recommended');
    addRow('CAMPO OPCIONAL', 'Complételo solo si aplica al caso.\nPuede dejarse en blanco sin afectar la solicitud.');
    space();

    // ─ SHEETS ─
    sectionTitle('📑  DESCRIPCIÓN DE CADA HOJA');
    addRow('✅ ALTAS', 'Para dar de alta a personas nuevas en el sistema.\nIncluye trabajadores de planta, honorarios, servicio social, etc.');
    addRow('✏️ MODIFICACIONES', 'Para corregir o actualizar datos de personas ya registradas.\nImportante: Solo llene los campos que desea cambiar. Los campos vacíos NO se modificarán.');
    addRow('🚫 BAJA DE PERSONA', 'Para dar de baja a una persona del sistema de accesos.\nEsta acción desactiva todos sus accesos. Para dar de baja solo una tarjeta, use la hoja de REPOSICIÓN.');
    addRow('🔄 REPOSICIÓN DE TARJETA', 'Para solicitar la reposición de una tarjeta P2000 (Puertas), KONE (Elevadores), o ambas al mismo tiempo.\nPuede indicar Sí en una o en ambas en una misma fila.');
    addRow('🔧 REPORTE DE FALLA', 'Para reportar cuando una tarjeta no funciona correctamente (no abre la puerta, lector no la lee, elevador no responde).\nEl área de accesos verificará antes de determinar si se requiere reposición.');
    space();

    // ─ RULES ─
    sectionTitle('⚠️  REGLAS Y ACLARACIONES IMPORTANTES');
    addRow('Listas desplegables', 'Los campos con lista desplegable (▼) NO aceptan valores escritos a mano.\nUse siempre las opciones predefinidas.', 'mandatory');
    addRow('Número de Empleado', 'Solo el PERSONAL DE PLANTA (Trabajador) debe incluir número de empleado.\nPersonal externo, honorarios, servicio social, etc., deben dejar este campo vacío\ne indicar su categoría en el campo "Tipo de Personal".', 'recommended');
    addRow('Apellidos y Nombres', 'Use siempre DOS campos separados: Apellidos y Nombres.\nEsto evita confusiones al buscar personas en el sistema.', 'note');
    addRow('Asignación de Pisos', 'Los pisos se anotan separados por coma.\nLos únicos pisos escritos con letra son: "Planta Baja" y "Sótano".\nLos demás se anotan con número. Ejemplo: Sótano, Planta Baja, 1, 5', 'note');
    addRow('Aclaración de pisos asignados', 'Una persona puede tener acceso al ELEVADOR para llegar a un piso, pero esto NO implica tener acceso a las PUERTAS de ese piso.\nSon sistemas independientes (P2000 (Puertas) y KONE (Elevadores)). Registre cada uno según corresponda.', 'note');
    addRow('Accesos Especiales', 'Solo para accesos fuera de lo ordinario (ej: Filtro 1, Filtro 2, Estacionamiento).\nSi no aplica, dejar en blanco.', 'recommended');
    addRow('Modificaciones — Campos vacíos', 'En la hoja de MODIFICACIONES, dejar una celda en blanco significa "sin cambio".\nSi los datos son iguales a los actuales, no es necesario llenarlos.', 'mandatory');
    addRow('Acción sobre Pisos (Modificaciones)', '"Reemplazar" → sustituye todos los pisos asignados por los nuevos indicados.\n"Sumar" → agrega los pisos indicados a los que ya tiene asignados.\n"Quitar" → elimina únicamente los pisos indicados, sin afectar los demás.', 'mandatory');
    addRow('Múltiples registros', 'Puede incluir varias solicitudes en cada hoja, una por fila.\nNo modifique ni elimine las filas de encabezado.', 'recommended');
    space();

    // ─ CONTACT ─
    sectionTitle('📬  ENVÍO DE LA SOLICITUD');
    addRow('Correo de envío', settingsState.orgSupportEmail || 'Control.Accesos@nuevoleon.gob.mx', 'note');
    addRow('Asunto del correo', 'Formato sugerido: [TIPO DE MOVIMIENTO] – [DEPENDENCIA]\nEjemplo: ALTA – SECRETARÍA DEL TRABAJO\nEjemplo: BAJA – SECRETARÍA DE ADMINISTRACIÓN\nEjemplo: ALTA/REPOSICIÓN – SECRETARÍA DE ADMINISTRACIÓN', 'note');
    addRow('Tiempo de respuesta', 'Las solicitudes se procesan en un plazo de 1 a 3 días hábiles.');
    addRow('Dudas o aclaraciones', `Comuníquese al área de Control de Accesos - [Ext: ${settingsState.orgSupportExtension || '0000'}] antes de enviar la solicitud\nsi tiene dudas sobre qué tipo de hoja usar.`);
    space();
}

// ─────────────────────────────────────────
// Hoja: ALTAS
// ─────────────────────────────────────────

function buildAltasSheet(wb: ExcelJS.Workbook, refs: CatalogRefs, mediaTypes: MediaInfo[]) {
    const ws = wb.addWorksheet('✅ ALTAS');
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: true }];

    const base = ALTAS_BASE;
    const mediaCols = mediaTypes.flatMap((m) => altasMediaCols(m));
    const accesoCols = ['acceso1', 'acceso2', 'acceso3'];
    const jornadaCols = ['horario', 'hora_entrada', 'hora_salida'];

    const widthOf = (key: string) => {
        const BASE_WIDTH: Record<string, number> = {
            apellidos: 22, nombres: 22, tipo_personal: 22, no_empleado: 14,
            dependencia: 26, edificio: 22, piso_base: 13, area: 22, puesto: 22,
            acceso1: 22, acceso2: 22, acceso3: 22, horario: 22,
            hora_entrada: 13, hora_salida: 13, correo: 30,
        };
        if (BASE_WIDTH[key]) return BASE_WIDTH[key];
        if (key.startsWith('pisos_')) return 28;
        if (key.startsWith('accion_')) return 16;
        return 20;
    };

    const allColumns = [
        ...base.map((b) => ({ key: b.key, width: widthOf(b.key) })),
        ...mediaCols.map((c) => ({ key: c.key, width: widthOf(c.key) })),
        ...accesoCols.map((k) => ({ key: k, width: widthOf(k) })),
        ...jornadaCols.map((k) => ({ key: k, width: widthOf(k) })),
        { key: 'correo', width: 30 },
    ];
    ws.columns = allColumns;
    const totalCols = allColumns.length;

    addSheetTitle(ws, 'SOLICITUD DE ALTA', totalCols);

    ws.mergeCells(`A2:${colLetter(totalCols - 1)}2`);
    const banner = ws.getCell('A2');
    banner.value = 'Use esta hoja para dar de alta a personas nuevas en el sistema de accesos (Trabajadores, Honorarios, Servicio Social, etc.). Llene todos los campos marcados con *.';
    styleCell(banner, { size: 9, fontColor: 'FF065F46', fillColor: 'FFD1FAE5', align: 'center', wrap: true });
    ws.getRow(2).height = 24;

    // Grupos de encabezado (fila 3)
    const mediaStartIdx = base.length;
    const mediaGroups = mediaTypes.map((m, i) => ({
        label: `TARJETA ${m.name}`,
        cols: altasMediaCols(m).length,
        color: i % 2 === 0 ? C.groupAmber : C.groupSky,
    }));
    const accesoStartIdx = mediaStartIdx + mediaCols.length;
    const groupConfigs: GroupConfig[] = [
        { label: 'IDENTIFICACIÓN', cols: 4, color: C.groupBlue },
        { label: 'UBICACIÓN', cols: 3, color: C.groupSlate },
        { label: 'PUESTO', cols: 2, color: C.groupSlate },
        ...mediaGroups,
        { label: 'ACCESOS ESPECIALES', cols: accesoCols.length, color: C.groupViolet },
        { label: 'JORNADA LABORAL', cols: jornadaCols.length, color: C.groupEmerald },
        { label: 'CONTACTO', cols: 1, color: C.groupRose },
    ];
    addGroupHeaders(ws, 3, groupConfigs);

    // Encabezados de columnas (fila 4)
    const headers = [
        ...base.map((b) => ({ label: b.label, mandatory: b.required })),
        ...mediaCols.map((c) => ({ label: c.label, mandatory: c.required })),
        ...accesoCols.map((k, i) => ({ label: `Acceso Especial ${i + 1}` })),
        ...jornadaCols.map((k, i) => ({ label: ['Horario', 'Hora Entrada', 'Hora Salida'][i], mandatory: i === 0 })),
        { label: 'Correo Electrónico' },
    ];
    addColumnHeaders(ws, 4, headers);

    const ROWS = 200;
    const requiredIdxs = [1, 2, 3, 5, 6, 7, 8, 9];
    let nextReq = 10;
    for (const m of mediaTypes) {
        for (const c of altasMediaCols(m)) {
            if (c.required) requiredIdxs.push(nextReq);
            nextReq++;
        }
    }
    // accesos son opcionales; jornada horario obligatorio
    const jornadaStartIdx = accesoStartIdx + accesoCols.length;
    requiredIdxs.push(jornadaStartIdx + 1, jornadaStartIdx + 2, jornadaStartIdx + 3);
    paintDataRows(ws, 5, 5 + ROWS, totalCols, [...new Set(requiredIdxs)]);

    // Dropdowns
    addDropdown(ws, 'C', 5, 5 + ROWS, refs.tipoPersonalRef());
    addDropdown(ws, 'E', 5, 5 + ROWS, refs.depsRef());
    addDropdown(ws, 'F', 5, 5 + ROWS, refs.buildingsRef());
    addDropdown(ws, 'G', 5, 5 + ROWS, refs.floorsRef());
    mediaTypes.forEach((m, i) => {
        const reqIdx = mediaStartIdx + i * altasMediaCols(m).length;
        addYesNoDropdown(ws, colLetter(reqIdx), 5, 5 + ROWS);
    });
    accesoCols.forEach((k, i) => addDropdown(ws, colLetter(accesoStartIdx + i), 5, 5 + ROWS, refs.accessRef()));
    addDropdown(ws, colLetter(jornadaStartIdx), 5, 5 + ROWS, refs.schedulesRef());

    ws.autoFilter = `A4:${colLetter(totalCols - 1)}4`;
}

// ─────────────────────────────────────────
// Hoja: MODIFICACIONES
// ─────────────────────────────────────────

function buildModificacionesSheet(wb: ExcelJS.Workbook, refs: CatalogRefs, mediaTypes: MediaInfo[]) {
    const ws = wb.addWorksheet('✏️ MODIFICACIONES');
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: true }];

    const widthOf = (key: string) => {
        if (key.startsWith('pisos_')) return 28;
        if (key.startsWith('accion_')) return 16;
        return 22;
    };

    // Solo medios CON pisos generan bloques en MODIFICACIONES.
    const floorMedias = mediaTypes.filter((m) => m.has_floors);
    const mediaCols = floorMedias.flatMap((m) => modifMediaCols(m));
    const base = [
        { key: 'apellidos', label: 'Apellidos (como aparece en sistema)', mandatory: true },
        { key: 'nombres', label: 'Nombres (como aparece en sistema)', mandatory: true },
        { key: 'no_empleado', label: 'No. Empleado' },
        { key: 'nuevo_apellido', label: 'Nuevo Apellido' },
        { key: 'nuevo_nombre', label: 'Nuevo Nombre' },
        { key: 'nueva_dep', label: 'Nueva Dependencia' },
        { key: 'nuevo_edificio', label: 'Nuevo Edificio' },
        { key: 'nuevo_piso', label: 'Nuevo Piso Base' },
        { key: 'nueva_area', label: 'Nueva Área' },
        { key: 'nuevo_puesto', label: 'Nuevo Puesto' },
    ];

    const allColumns = [
        ...base.map((b) => ({ key: b.key, width: widthOf(b.key) })),
        ...mediaCols.map((c) => ({ key: c.key, width: widthOf(c.key) })),
        { key: 'accion_acc', width: 16 },
        { key: 'acceso1', width: 22 },
        { key: 'acceso2', width: 22 },
        { key: 'acceso3', width: 22 },
        { key: 'horario', width: 22 },
        { key: 'entrada', width: 13 },
        { key: 'salida', width: 13 },
        { key: 'observacion', width: 30 },
    ];
    ws.columns = allColumns;
    const totalCols = allColumns.length;

    addSheetTitle(ws, 'SOLICITUD DE MODIFICACIÓN', totalCols);

    ws.mergeCells(`A2:${colLetter(totalCols - 1)}2`);
    const note = ws.getCell('A2');
    note.value = '⚠️  IMPORTANTE: Solo llene los campos que desea MODIFICAR. Los campos vacíos NO serán alterados en el sistema. Si un valor es igual al actual, puede dejarlo en blanco.';
    styleCell(note, { bold: true, size: 9, fontColor: 'FF92400E', fillColor: 'FFFFFBEB', align: 'center', wrap: true });
    ws.getRow(2).height = 24;

    const mediaStartIdx = base.length;
    const mediaGroups = floorMedias.map((m) => ({
        label: `CAMBIOS ${m.name}`,
        cols: modifMediaCols(m).length,
        color: C.groupAmber,
    }));
    const accesosStartIdx = mediaStartIdx + mediaCols.length;
    const groupConfigs: GroupConfig[] = [
        { label: 'IDENTIFICACIÓN *', cols: 3, color: C.groupBlue },
        { label: 'CAMBIOS PERSONALES (dejar vacío si no cambia)', cols: 7, color: C.groupSlate },
        ...mediaGroups,
        { label: 'ACCESOS ESPECIALES (dejar en blanco si no cambia)', cols: 4, color: C.groupViolet },
        { label: 'JORNADA LABORAL', cols: 3, color: C.groupEmerald },
        { label: 'NOTAS', cols: 1, color: C.groupSlate },
    ];
    addGroupHeaders(ws, 3, groupConfigs);

    const headers = [
        ...base.map((b) => ({ label: b.label, mandatory: b.mandatory })),
        ...mediaCols.map((c) => ({ label: c.label })),
        { label: 'Acción Acc. Esp.' },
        { label: 'Acceso Esp. 1' },
        { label: 'Acceso Esp. 2' },
        { label: 'Acceso Esp. 3' },
        { label: 'Horario' },
        { label: 'Hora Entrada' },
        { label: 'Hora Salida' },
        { label: 'Observaciones' },
    ];
    addColumnHeaders(ws, 4, headers);

    const ROWS = 200;
    paintDataRows(ws, 5, 5 + ROWS, totalCols, [1, 2]);

    addDropdown(ws, 'F', 5, 5 + ROWS, refs.depsRef());
    addDropdown(ws, 'G', 5, 5 + ROWS, refs.buildingsRef());
    addDropdown(ws, 'H', 5, 5 + ROWS, refs.floorsRef());
    floorMedias.forEach((m, i) => {
        const accionIdx = mediaStartIdx + i * modifMediaCols(m).length;
        addDropdown(ws, colLetter(accionIdx), 5, 5 + ROWS, refs.accionPisosRef());
    });
    addDropdown(ws, colLetter(accesosStartIdx), 5, 5 + ROWS, refs.accionPisosRef());
    addDropdown(ws, colLetter(accesosStartIdx + 1), 5, 5 + ROWS, refs.accessRef());
    addDropdown(ws, colLetter(accesosStartIdx + 2), 5, 5 + ROWS, refs.accessRef());
    addDropdown(ws, colLetter(accesosStartIdx + 3), 5, 5 + ROWS, refs.accessRef());
    addDropdown(ws, colLetter(accesosStartIdx + 4), 5, 5 + ROWS, refs.schedulesRef());

    ws.autoFilter = `A4:${colLetter(totalCols - 1)}4`;
}

// ─────────────────────────────────────────
// Hoja: BAJA DE PERSONA
// ─────────────────────────────────────────

function buildBajaPersonaSheet(wb: ExcelJS.Workbook, refs: CatalogRefs) {
    const ws = wb.addWorksheet('🚫 BAJA DE PERSONA');
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: true }];

    ws.columns = [
        { key: 'apellidos', width: 22 },
        { key: 'nombres', width: 22 },
        { key: 'no_empleado', width: 14 },
        { key: 'dependencia', width: 26 },
        { key: 'tipo_baja', width: 18 },
        { key: 'motivo', width: 45 },
        { key: 'observaciones', width: 40 },
    ];

    addSheetTitle(ws, 'SOLICITUD DE BAJA DE PERSONA', 7);

    // Fila 2: banner explicativo
    ws.mergeCells('A2:G2');
    const banner = ws.getCell('A2');
    banner.value = 'Use esta hoja para solicitar la baja total de una persona del sistema de accesos. Esta acción desactivará todos sus accesos (P2000 y KONE). Para dar de baja solo una tarjeta use la hoja de REPOSICIÓN.';
    styleCell(banner, { size: 9, fontColor: 'FF9D174D', fillColor: 'FFFCE7F3', align: 'center', wrap: true });
    ws.getRow(2).height = 24;

    addGroupHeaders(ws, 3, [
        { label: 'IDENTIFICACIÓN', cols: 4, color: C.groupBlue },
        { label: 'DATOS DE BAJA', cols: 2, color: C.groupRose },
        { label: 'NOTAS', cols: 1, color: C.groupSlate },
    ]);
    addColumnHeaders(ws, 4, [
        { label: 'Apellidos', mandatory: true },
        { label: 'Nombres', mandatory: true },
        { label: 'No. Empleado' },
        { label: 'Dependencia', mandatory: true },
        { label: 'Tipo de Baja', mandatory: true },
        { label: 'Motivo de la Baja', mandatory: true },
        { label: 'Observaciones' },
    ]);

    const ROWS = 100;
    paintDataRows(ws, 5, 5 + ROWS, 7, [1, 2, 4, 5, 6]);

    addDropdown(ws, 'D', 5, 5 + ROWS, refs.depsRef());
    addDropdown(ws, 'E', 5, 5 + ROWS, refs.tipoBajaRef());

    ws.autoFilter = 'A4:G4';
}

// ─────────────────────────────────────────
// Hoja: REPOSICIÓN DE TARJETA
// ─────────────────────────────────────────

function buildReposicionSheet(wb: ExcelJS.Workbook, refs: CatalogRefs, mediaTypes: MediaInfo[]) {
    const ws = wb.addWorksheet('🔄 REPOSICIÓN DE TARJETA');
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: true }];

    const widthOf = (key: string) => {
        if (key.startsWith('folio_')) return 20;
        if (key.startsWith('reponer_')) return 18;
        return 22;
    };

    const base = [
        { key: 'apellidos', label: 'Apellidos', mandatory: true },
        { key: 'nombres', label: 'Nombres', mandatory: true },
        { key: 'no_empleado', label: 'No. Empleado' },
        { key: 'dependencia', label: 'Dependencia', mandatory: true },
    ];
    const mediaCols = mediaTypes.flatMap((m) => reposMediaCols(m));

    const allColumns = [
        ...base.map((b) => ({ key: b.key, width: widthOf(b.key) })),
        ...mediaCols.map((c) => ({ key: c.key, width: widthOf(c.key) })),
        { key: 'motivo', width: 20 },
        { key: 'observaciones', width: 40 },
    ];
    ws.columns = allColumns;
    const totalCols = allColumns.length;

    addSheetTitle(ws, 'SOLICITUD DE REPOSICIÓN DE TARJETA', totalCols);

    ws.mergeCells(`A2:${colLetter(totalCols - 1)}2`);
    const banner = ws.getCell('A2');
    banner.value = 'Use esta hoja para solicitar la reposición de una tarjeta del sistema de accesos. Puede solicitar una o varias al mismo tiempo en una sola fila. Indique "Sí" en la(s) tarjeta(s) que requiere reponer.';
    styleCell(banner, { size: 9, fontColor: 'FF92400E', fillColor: 'FFFEF3C7', align: 'center', wrap: true });
    ws.getRow(2).height = 24;

    const mediaStartIdx = base.length;
    const groupConfigs: GroupConfig[] = [
        { label: 'IDENTIFICACIÓN', cols: 4, color: C.groupBlue },
        ...mediaTypes.map((m, i) => ({
            label: `TARJETA ${m.name}`,
            cols: reposMediaCols(m).length,
            color: i % 2 === 0 ? C.groupAmber : C.groupSky,
        })),
        { label: 'MOTIVO Y NOTAS', cols: 2, color: C.groupSlate },
    ];
    addGroupHeaders(ws, 3, groupConfigs);

    const headers = [
        ...base.map((b) => ({ label: b.label, mandatory: b.mandatory })),
        ...mediaCols.map((c) => ({ label: c.label, mandatory: c.required })),
        { label: 'Motivo', mandatory: true },
        { label: 'Observaciones' },
    ];
    addColumnHeaders(ws, 4, headers);

    const ROWS = 100;
    const mandatoryIdxs = [1, 2, 4];
    let next = 5;
    for (const m of mediaTypes) {
        for (const c of reposMediaCols(m)) {
            if (c.required) mandatoryIdxs.push(next);
            next++;
        }
    }
    mandatoryIdxs.push(next); // motivo
    paintDataRows(ws, 5, 5 + ROWS, totalCols, [...new Set(mandatoryIdxs)]);

    addDropdown(ws, 'D', 5, 5 + ROWS, refs.depsRef());
    mediaTypes.forEach((m, i) => {
        const reqIdx = mediaStartIdx + i * reposMediaCols(m).length;
        addYesNoDropdown(ws, colLetter(reqIdx), 5, 5 + ROWS);
    });
    addDropdown(ws, colLetter(totalCols - 2), 5, 5 + ROWS, refs.motivoReposRef());

    ws.autoFilter = `A4:${colLetter(totalCols - 1)}4`;
}

// ─────────────────────────────────────────
// Hoja: REPORTE DE FALLA
// ─────────────────────────────────────────

function buildReporteFallaSheet(wb: ExcelJS.Workbook, refs: CatalogRefs) {
    const ws = wb.addWorksheet('🔧 REPORTE DE FALLA');
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: true }];

    // A: Apellidos*, B: Nombres*, C: No. Empleado, D: Dependencia*
    // E: Tipo de Tarjeta*, F: Folio (si lo conoce)
    // G: Edificio / Lugar de la falla*, H: Descripción del problema*, I: ¿Desde cuándo?
    // J: Urgencia*, K: Observaciones
    ws.columns = [
        { key: 'apellidos', width: 22 }, // A obligatorio
        { key: 'nombres', width: 22 }, // B obligatorio
        { key: 'no_empleado', width: 14 }, // C
        { key: 'dependencia', width: 26 }, // D mandatory
        { key: 'tipo_tarjeta', width: 20 }, // E mandatory
        { key: 'folio', width: 16 }, // F optional
        { key: 'ubicacion', width: 28 }, // G mandatory
        { key: 'descripcion', width: 55 }, // H mandatory
        { key: 'desde_cuando', width: 18 }, // I optional
        { key: 'urgencia', width: 14 }, // J mandatory
        { key: 'observaciones', width: 40 }, // K
    ];

    addSheetTitle(ws, 'REPORTE DE FALLA DE TARJETA DE ACCESO', 11);

    // Banner de nota
    ws.mergeCells('A2:K2');
    const note = ws.getCell('A2');
    note.value = 'Use esta hoja para reportar cuando su tarjeta de acceso no funciona correctamente (no abre la puerta, el elevador no responde, lector no lee la tarjeta, etc.). El área de Control de Accesos verificará el estado de la tarjeta y determinará si se requiere reposición u otro procedimiento.';
    styleCell(note, { size: 9, fontColor: 'FF075985', fillColor: 'FFE0F2FE', align: 'center', wrap: true });
    ws.getRow(2).height = 32;

    addGroupHeaders(ws, 3, [
        { label: 'DATOS DEL TITULAR', cols: 4, color: C.groupBlue },
        { label: 'TARJETA CON FALLA', cols: 2, color: C.groupAmber },
        { label: 'DESCRIPCIÓN DEL PROBLEMA', cols: 3, color: C.groupRose },
        { label: 'PRIORIDAD', cols: 1, color: C.groupOrange },
        { label: 'NOTAS', cols: 1, color: C.groupSlate },
    ]);

    addColumnHeaders(ws, 4, [
        { label: 'Apellidos', mandatory: true },
        { label: 'Nombres', mandatory: true },
        { label: 'No. Empleado' },
        { label: 'Dependencia', mandatory: true },
        { label: 'Tipo de Tarjeta con Falla', mandatory: true },
        { label: 'Folio de Tarjeta (si lo conoce)' },
        { label: 'Edificio / Lugar donde falla', mandatory: true },
        { label: 'Descripción del Problema', mandatory: true },
        { label: '¿Desde cuándo ocurre?' },
        { label: 'Urgencia', mandatory: true },
        { label: 'Observaciones adicionales' },
    ]);

    const ROWS = 100;
    paintDataRows(ws, 5, 5 + ROWS, 11, [1, 2, 4, 5, 7, 8, 10]);

    addDropdown(ws, 'D', 5, 5 + ROWS, refs.depsRef());
    addDropdown(ws, 'E', 5, 5 + ROWS, refs.tipoTarjetaRef());
    addDropdown(ws, 'G', 5, 5 + ROWS, refs.buildingsRef());
    addDropdown(ws, 'J', 5, 5 + ROWS, refs.urgenciaRef());

    ws.autoFilter = 'A4:K4';
}

// ─────────────────────────────────────────
// Punto de entrada principal
// ─────────────────────────────────────────

export async function generateMediaTemplate(catalogs: TemplateCatalogs) {
    const wb = new ExcelJS.Workbook();
    wb.created = new Date();

    const mediaTypes = activeMediaTypes(catalogs.mediaTypes || []);

    // Preparar referencias desde datos de catálogo (sin escribir workbook aún)
    const { refs, lists } = prepareCatalogData(catalogs);

    // Construir todas las hojas visibles primero
    buildInstructionsSheet(wb);
    buildAltasSheet(wb, refs, mediaTypes);
    buildModificacionesSheet(wb, refs, mediaTypes);
    buildBajaPersonaSheet(wb, refs);
    buildReposicionSheet(wb, refs, mediaTypes);
    buildReporteFallaSheet(wb, refs);

    // Añadir hoja de catálogo al FINAL para que aparezca al final (y permanezca oculta)
    writeCatalogSheet(wb, lists);

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'Plantilla_Solicitudes_Acceso.xlsx');
}

export async function generateUsageTemplate(mediaLabel: string = "Uso de tarjetas") {
    const wb = new ExcelJS.Workbook();
    wb.created = new Date();

    const ws = wb.addWorksheet(`Uso ${mediaLabel}`);

    ws.columns = [
        { key: 'folio', width: 20 },
        { key: 'conteo', width: 15 },
        { key: 'ultima_mod', width: 25 },
        { key: 'ultimo_reg', width: 25 },
    ];

    addSheetTitle(ws, `PLANTILLA DE CONTEO DE USO — ${mediaLabel.toUpperCase()}`, 4);

    ws.mergeCells('A2:D2');
    const banner = ws.getCell('A2');
    banner.value = 'Instrucciones: Ingrese el folio de la tarjeta y la cantidad de usos (conteo). Las columnas de fecha son opcionales pero altamente recomendadas para filtrar tarjetas inactivas correctamente.';
    styleCell(banner, { size: 9, fontColor: C.metaText, fillColor: C.groupSky.fill, align: 'center', wrap: true });
    ws.getRow(2).height = 36;

    addColumnHeaders(ws, 3, [
        { label: 'Folio', mandatory: true },
        { label: 'Conteo', mandatory: true },
        { label: 'Última modificación', recommended: true },
        { label: 'Último registro', recommended: true },
    ]);

    const ROWS = 100;
    paintDataRows(ws, 4, 4 + ROWS, 4, [1, 2], [3, 4]);

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Plantilla_Conteo_Uso_${mediaLabel.replace(/\s+/g, '_')}.xlsx`);
}
