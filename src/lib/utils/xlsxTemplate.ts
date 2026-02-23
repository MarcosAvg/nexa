import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { CatalogItem } from '../types';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

interface Building extends CatalogItem {
    floors?: string[];
}

interface TemplateCatalogs {
    buildings: Building[];
    dependencies: CatalogItem[];
    specialAccesses: CatalogItem[];
    schedules: CatalogItem[];
}

// ─────────────────────────────────────────
// Color Palette
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
// Floor sort order
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
// Helpers
// ─────────────────────────────────────────

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
    const last = String.fromCharCode(64 + totalCols);
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
        const start = String.fromCharCode(64 + col);
        const end = String.fromCharCode(64 + col + g.cols - 1);
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
    const colStr = typeof col === 'number' ? String.fromCharCode(64 + col) : col;
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
// Sheet: CATÁLOGOS — computed refs + writer
// ─────────────────────────────────────────

function prepareCatalogData(catalogs: TemplateCatalogs) {
    const depsNames = catalogs.dependencies.map(d => d.name);
    const buildingNames = catalogs.buildings.map(b => b.name);
    const accessNames = catalogs.specialAccesses.map(a => a.name);
    const scheduleNames = catalogs.schedules.map(s => s.name);
    const allFloors = new Set<string>();
    catalogs.buildings.forEach(b => (b.floors || []).forEach(f => allFloors.add(f)));
    const floorList = sortFloors(Array.from(allFloors));

    const refs = {
        depsRef: () => `CATALOGOS!$A$1:$A$${depsNames.length}`,
        buildingsRef: () => `CATALOGOS!$B$1:$B$${buildingNames.length}`,
        floorsRef: () => `CATALOGOS!$C$1:$C$${floorList.length}`,
        accessRef: () => `CATALOGOS!$D$1:$D$${accessNames.length}`,
        schedulesRef: () => `CATALOGOS!$E$1:$E$${scheduleNames.length}`,
        tipoPersonalRef: () => `CATALOGOS!$F$1:$F$6`,
        tipoTarjetaRef: () => `CATALOGOS!$G$1:$G$3`,
        accionPisosRef: () => `CATALOGOS!$H$1:$H$3`,
        tipoBajaRef: () => `CATALOGOS!$I$1:$I$2`,
        motivoReposRef: () => `CATALOGOS!$J$1:$J$4`,
        urgenciaRef: () => `CATALOGOS!$K$2:$K$4`,
    };
    return { refs, lists: { depsNames, buildingNames, accessNames, scheduleNames, floorList } };
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
    write(7, ['P2000', 'KONE', 'Ambas']);
    write(8, ['Reemplazar', 'Sumar', 'Quitar']);
    write(9, ['Definitiva', 'Temporal']);
    write(10, ['Extravío', 'Daño', 'Robo', 'Otro']);
    write(11, ['Alta (Alta/Media/Baja)', 'Alta', 'Media', 'Baja']);
}

// Alias type so sheets still reference the same shape
type CatalogRefs = ReturnType<typeof prepareCatalogData>['refs'];

// ─────────────────────────────────────────
// Sheet: INSTRUCCIONES
// ─────────────────────────────────────────

function buildInstructionsSheet(wb: ExcelJS.Workbook) {
    const ws = wb.addWorksheet('📋 INSTRUCCIONES');
    ws.views = [{ showGridLines: false }];
    ws.columns = [
        { width: 4 }, { width: 32 }, { width: 90 }
    ];

    // Title
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
        // Dynamic height: ~18px per line + 10px padding
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
    addRow('Correo de envío', 'Control.Accesos@nuevoleon.gob.mx', 'note');
    addRow('Asunto del correo', 'Formato sugerido: [TIPO DE MOVIMIENTO] – [DEPENDENCIA]\nEjemplo: ALTA – SECRETARÍA DEL TRABAJO\nEjemplo: BAJA – SECRETARÍA DE ADMINISTRACIÓN\nEjemplo: ALTA/REPOSICIÓN – SECRETARÍA DE ADMINISTRACIÓN', 'note');
    addRow('Tiempo de respuesta', 'Las solicitudes se procesan en un plazo de 1 a 3 días hábiles.');
    addRow('Dudas o aclaraciones', 'Comuníquese al área de Control de Accesos - [Ext: 32199] antes de enviar la solicitud\nsi tiene dudas sobre qué tipo de hoja usar.');
    space();
}

// ─────────────────────────────────────────
// Sheet: ALTAS
// ─────────────────────────────────────────

function buildAltasSheet(wb: ExcelJS.Workbook, refs: CatalogRefs) {
    const ws = wb.addWorksheet('✅ ALTAS');
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: true }];

    ws.columns = [
        { key: 'apellidos', width: 22 },
        { key: 'nombres', width: 22 },
        { key: 'tipo_personal', width: 22 },
        { key: 'no_empleado', width: 14 },
        { key: 'dependencia', width: 26 },
        { key: 'edificio', width: 22 },
        { key: 'piso_base', width: 13 },
        { key: 'area', width: 22 },
        { key: 'puesto', width: 22 },
        { key: 'p2000_req', width: 16 },
        { key: 'pisos_p2000', width: 28 },
        { key: 'kone_req', width: 16 },
        { key: 'pisos_kone', width: 28 },
        { key: 'acceso1', width: 22 },
        { key: 'acceso2', width: 22 },
        { key: 'acceso3', width: 22 },
        { key: 'horario', width: 22 },
        { key: 'entrada', width: 13 },
        { key: 'salida', width: 13 },
        { key: 'correo', width: 30 },
    ];

    addSheetTitle(ws, 'SOLICITUD DE ALTA', 20);

    // Row 2: explanation banner
    ws.mergeCells('A2:T2');
    const banner = ws.getCell('A2');
    banner.value = 'Use esta hoja para dar de alta a personas nuevas en el sistema de accesos (Trabajadores, Honorarios, Servicio Social, etc.). Llene todos los campos marcados con *.';
    styleCell(banner, { size: 9, fontColor: 'FF065F46', fillColor: 'FFD1FAE5', align: 'center', wrap: true });
    ws.getRow(2).height = 24;

    addGroupHeaders(ws, 3, [
        { label: 'IDENTIFICACIÓN', cols: 4, color: C.groupBlue },
        { label: 'UBICACIÓN', cols: 3, color: C.groupSlate },
        { label: 'PUESTO', cols: 2, color: C.groupSlate },
        { label: 'TARJETA P2000 (Puertas)', cols: 2, color: C.groupAmber },
        { label: 'TARJETA KONE (Elevadores)', cols: 2, color: C.groupSky },
        { label: 'ACCESOS ESPECIALES', cols: 3, color: C.groupViolet },
        { label: 'JORNADA LABORAL', cols: 3, color: C.groupEmerald },
        { label: 'CONTACTO', cols: 1, color: C.groupRose },
    ]);

    addColumnHeaders(ws, 4, [
        { label: 'Apellidos', mandatory: true },
        { label: 'Nombres', mandatory: true },
        { label: 'Tipo de Personal', mandatory: true },
        { label: 'No. Empleado (solo trabajadores)' },
        { label: 'Dependencia', mandatory: true },
        { label: 'Edificio', mandatory: true },
        { label: 'Piso Base', mandatory: true },
        { label: 'Área / Equipo', mandatory: true },
        { label: 'Puesto', mandatory: true },
        { label: '¿Requiere Tarjeta P2000?', mandatory: true },
        { label: 'Pisos P2000 (separados por coma)' },
        { label: '¿Requiere Tarjeta KONE?', mandatory: true },
        { label: 'Pisos KONE (separados por coma)' },
        { label: 'Acceso Especial 1' },
        { label: 'Acceso Especial 2' },
        { label: 'Acceso Especial 3' },
        { label: 'Horario', mandatory: true },
        { label: 'Hora Entrada', mandatory: true },
        { label: 'Hora Salida', mandatory: true },
        { label: 'Correo Electrónico' },
    ]);

    const ROWS = 200;
    paintDataRows(ws, 5, 5 + ROWS, 20, [1, 2, 3, 5, 6, 7, 8, 9, 10, 12, 17, 18, 19]);

    addDropdown(ws, 'C', 5, 5 + ROWS, refs.tipoPersonalRef());
    addDropdown(ws, 'E', 5, 5 + ROWS, refs.depsRef());
    addDropdown(ws, 'F', 5, 5 + ROWS, refs.buildingsRef());
    addDropdown(ws, 'G', 5, 5 + ROWS, refs.floorsRef());
    addYesNoDropdown(ws, 'J', 5, 5 + ROWS);
    addYesNoDropdown(ws, 'L', 5, 5 + ROWS);
    addDropdown(ws, 'N', 5, 5 + ROWS, refs.accessRef());
    addDropdown(ws, 'O', 5, 5 + ROWS, refs.accessRef());
    addDropdown(ws, 'P', 5, 5 + ROWS, refs.accessRef());
    addDropdown(ws, 'Q', 5, 5 + ROWS, refs.schedulesRef());

    ws.autoFilter = 'A4:T4';
}

// ─────────────────────────────────────────
// Sheet: MODIFICACIONES
// ─────────────────────────────────────────

function buildModificacionesSheet(wb: ExcelJS.Workbook, refs: CatalogRefs) {
    const ws = wb.addWorksheet('✏️ MODIFICACIONES');
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: true }];

    // A: Apellidos* B: Nombres* C: NoEmpleado
    // D: NuevoApellido E: NuevoNombre F: NuevaDep G: NuevoEdificio H: NuevoPiso I: NuevaArea J: NuevoPuesto
    // K: AccionP2000 L: PisosP2000
    // M: AccionKONE N: PisosKONE
    // O: AccionAccEsp P: AccEsp1 Q: AccEsp2 R: AccEsp3
    // S: Horario T: Entrada U: Salida
    // V: Observaciones
    ws.columns = [
        { key: 'apellidos', width: 22 }, // A mandatory
        { key: 'nombres', width: 22 }, // B mandatory
        { key: 'no_empleado', width: 14 }, // C
        { key: 'nuevo_apellido', width: 22 }, // D
        { key: 'nuevo_nombre', width: 22 }, // E
        { key: 'nueva_dep', width: 26 }, // F
        { key: 'nuevo_edificio', width: 22 }, // G
        { key: 'nuevo_piso', width: 13 }, // H
        { key: 'nueva_area', width: 22 }, // I
        { key: 'nuevo_puesto', width: 22 }, // J
        { key: 'accion_p2000', width: 16 }, // K
        { key: 'pisos_p2000', width: 28 }, // L
        { key: 'accion_kone', width: 16 }, // M
        { key: 'pisos_kone', width: 28 }, // N
        { key: 'accion_acc', width: 16 }, // O
        { key: 'acceso1', width: 22 }, // P
        { key: 'acceso2', width: 22 }, // Q
        { key: 'acceso3', width: 22 }, // R
        { key: 'horario', width: 22 }, // S
        { key: 'entrada', width: 13 }, // T
        { key: 'salida', width: 13 }, // U
        { key: 'observacion', width: 30 }, // V
    ];

    addSheetTitle(ws, 'SOLICITUD DE MODIFICACIÓN', 22);

    // Row 2: Legend note
    ws.mergeCells('A2:V2');
    const note = ws.getCell('A2');
    note.value = '⚠️  IMPORTANTE: Solo llene los campos que desea MODIFICAR. Los campos vacíos NO serán alterados en el sistema. Si un valor es igual al actual, puede dejarlo en blanco.';
    styleCell(note, { bold: true, size: 9, fontColor: 'FF92400E', fillColor: 'FFFFFBEB', align: 'center', wrap: true });
    ws.getRow(2).height = 24;

    addGroupHeaders(ws, 3, [
        { label: 'IDENTIFICACIÓN *', cols: 3, color: C.groupBlue },
        { label: 'CAMBIOS PERSONALES (dejar vacío si no cambia)', cols: 7, color: C.groupSlate },
        { label: 'CAMBIOS P2000', cols: 2, color: C.groupAmber },
        { label: 'CAMBIOS KONE', cols: 2, color: C.groupSky },
        { label: 'ACCESOS ESPECIALES (dejar en blanco si no cambia)', cols: 4, color: C.groupViolet },
        { label: 'JORNADA LABORAL', cols: 3, color: C.groupEmerald },
        { label: 'NOTAS', cols: 1, color: C.groupSlate },
    ]);

    addColumnHeaders(ws, 4, [
        { label: 'Apellidos (como aparece en sistema)', mandatory: true },
        { label: 'Nombres (como aparece en sistema)', mandatory: true },
        { label: 'No. Empleado' },
        { label: 'Nuevo Apellido' },
        { label: 'Nuevo Nombre' },
        { label: 'Nueva Dependencia' },
        { label: 'Nuevo Edificio' },
        { label: 'Nuevo Piso Base' },
        { label: 'Nueva Área' },
        { label: 'Nuevo Puesto' },
        { label: 'Acción P2000' },
        { label: 'Pisos P2000 (coma)' },
        { label: 'Acción KONE' },
        { label: 'Pisos KONE (coma)' },
        { label: 'Acción Acc. Esp.' },
        { label: 'Acceso Esp. 1' },
        { label: 'Acceso Esp. 2' },
        { label: 'Acceso Esp. 3' },
        { label: 'Horario' },
        { label: 'Hora Entrada' },
        { label: 'Hora Salida' },
        { label: 'Observaciones' },
    ]);

    const ROWS = 200;
    paintDataRows(ws, 5, 5 + ROWS, 22, [1, 2]);

    addDropdown(ws, 'F', 5, 5 + ROWS, refs.depsRef());
    addDropdown(ws, 'G', 5, 5 + ROWS, refs.buildingsRef());
    addDropdown(ws, 'H', 5, 5 + ROWS, refs.floorsRef());
    addDropdown(ws, 'K', 5, 5 + ROWS, refs.accionPisosRef());
    addDropdown(ws, 'M', 5, 5 + ROWS, refs.accionPisosRef());
    addDropdown(ws, 'O', 5, 5 + ROWS, refs.accionPisosRef());
    addDropdown(ws, 'P', 5, 5 + ROWS, refs.accessRef());
    addDropdown(ws, 'Q', 5, 5 + ROWS, refs.accessRef());
    addDropdown(ws, 'R', 5, 5 + ROWS, refs.accessRef());
    addDropdown(ws, 'S', 5, 5 + ROWS, refs.schedulesRef());

    ws.autoFilter = 'A4:V4';
}

// ─────────────────────────────────────────
// Sheet: BAJA DE PERSONA
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

    // Row 2: explanation banner
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
// Sheet: REPOSICIÓN DE TARJETA
// ─────────────────────────────────────────

function buildReposicionSheet(wb: ExcelJS.Workbook, refs: CatalogRefs) {
    const ws = wb.addWorksheet('🔄 REPOSICIÓN DE TARJETA');
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: true }];

    ws.columns = [
        { key: 'apellidos', width: 22 },
        { key: 'nombres', width: 22 },
        { key: 'no_empleado', width: 14 },
        { key: 'dependencia', width: 26 },
        { key: 'reponer_p2000', width: 18 },
        { key: 'folio_p2000', width: 16 },
        { key: 'reponer_kone', width: 18 },
        { key: 'folio_kone', width: 16 },
        { key: 'motivo', width: 20 },
        { key: 'observaciones', width: 40 },
    ];

    addSheetTitle(ws, 'SOLICITUD DE REPOSICIÓN DE TARJETA', 10);

    // Row 2: explanation banner
    ws.mergeCells('A2:J2');
    const banner = ws.getCell('A2');
    banner.value = 'Use esta hoja para solicitar la reposición de una tarjeta P2000 (Puertas), KONE (Elevadores) o ambas. Puede solicitar una o las dos al mismo tiempo en una sola fila. Indique "Sí" en la(s) tarjeta(s) que requiere reponer.';
    styleCell(banner, { size: 9, fontColor: 'FF92400E', fillColor: 'FFFEF3C7', align: 'center', wrap: true });
    ws.getRow(2).height = 24;

    addGroupHeaders(ws, 3, [
        { label: 'IDENTIFICACIÓN', cols: 4, color: C.groupBlue },
        { label: 'TARJETA P2000 (Puertas)', cols: 2, color: C.groupAmber },
        { label: 'TARJETA KONE (Elevadores)', cols: 2, color: C.groupSky },
        { label: 'MOTIVO Y NOTAS', cols: 2, color: C.groupSlate },
    ]);
    addColumnHeaders(ws, 4, [
        { label: 'Apellidos', mandatory: true },
        { label: 'Nombres', mandatory: true },
        { label: 'No. Empleado' },
        { label: 'Dependencia', mandatory: true },
        { label: '¿Reponer P2000?', mandatory: true },
        { label: 'Folio P2000 Anterior (si lo conoce)' },
        { label: '¿Reponer KONE?', mandatory: true },
        { label: 'Folio KONE Anterior (si lo conoce)' },
        { label: 'Motivo', mandatory: true },
        { label: 'Observaciones' },
    ]);

    const ROWS = 100;
    paintDataRows(ws, 5, 5 + ROWS, 10, [1, 2, 4, 5, 7, 9]);

    addDropdown(ws, 'D', 5, 5 + ROWS, refs.depsRef());
    addYesNoDropdown(ws, 'E', 5, 5 + ROWS);
    addYesNoDropdown(ws, 'G', 5, 5 + ROWS);
    addDropdown(ws, 'I', 5, 5 + ROWS, refs.motivoReposRef());

    ws.autoFilter = 'A4:J4';
}

// ─────────────────────────────────────────
// Sheet: REPORTE DE FALLA
// ─────────────────────────────────────────

function buildReporteFallaSheet(wb: ExcelJS.Workbook, refs: CatalogRefs) {
    const ws = wb.addWorksheet('🔧 REPORTE DE FALLA');
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: true }];

    // A: Apellidos*, B: Nombres*, C: No. Empleado, D: Dependencia*
    // E: Tipo de Tarjeta*, F: Folio (si lo conoce)
    // G: Edificio / Lugar de la falla*, H: Descripción del problema*, I: ¿Desde cuándo?
    // J: Urgencia*, K: Observaciones
    ws.columns = [
        { key: 'apellidos', width: 22 }, // A mandatory
        { key: 'nombres', width: 22 }, // B mandatory
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

    // Note banner
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
    addDropdown(ws, 'E', 5, 5 + ROWS, '"Tarjeta P2000,Tarjeta KONE,Ambas tarjetas"');
    addDropdown(ws, 'G', 5, 5 + ROWS, refs.buildingsRef());
    addDropdown(ws, 'J', 5, 5 + ROWS, refs.urgenciaRef());

    ws.autoFilter = 'A4:K4';
}

// ─────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────

export async function generateRequestTemplate(catalogs: TemplateCatalogs) {
    const wb = new ExcelJS.Workbook();
    wb.created = new Date();

    // Prepare refs from catalog data (no workbook write yet)
    const { refs, lists } = prepareCatalogData(catalogs);

    // Build all visible sheets first
    buildInstructionsSheet(wb);
    buildAltasSheet(wb, refs);
    buildModificacionesSheet(wb, refs);
    buildBajaPersonaSheet(wb, refs);
    buildReposicionSheet(wb, refs);
    buildReporteFallaSheet(wb, refs);

    // Add catalog sheet LAST so it appears at the end (and stays hidden)
    writeCatalogSheet(wb, lists);

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'Plantilla_Solicitudes_Acceso.xlsx');
}
