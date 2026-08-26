/**
 * legal.ts — Textos legales base para la firma de responsiva.
 *
 * Son plantillas genéricas: los datos de la organización (nombre, edificio,
 * costo de reposición, etc.) se reemplazan en tiempo de generación desde
 * `app_settings` mediante los placeholders `{organizacion}`, `{monto}`, etc.
 * Configura esos valores por instalación en "Configuración de Responsiva".
 */
export const RESPONSIVA_LEGAL_TEXTS = {
    KONE: [
        'Por medio de la presente, yo {nombre}, con número de empleado {numEmpleado}, adscrito(a) a la Dependencia y/o Unidad Administrativa {dependencia}, hago constar que recibí en calidad de préstamo un acceso electrónico identificado con el folio {folio}, para el ingreso a las instalaciones de {organizacion}.',
        'Me comprometo a hacer uso responsable de dicho acceso, así como a conservarlo en buen estado durante el tiempo que lo tenga bajo mi resguardo. Asimismo, me doy por enterado(a) de que, en caso de extravío, robo o daño del mismo, deberé cubrir el costo de reposición correspondiente, el cual asciende a la cantidad de {monto}, pago que se realizará de acuerdo con el procedimiento establecido por la organización.',
        'De igual manera, me comprometo hacer la devolución del acceso, en las mismas condiciones en las que me fue entregado en el momento que me sea requerido o al finalizar mi relación laboral con esta Dependencia.',
    ],
    P2000: [
        'Por medio de la presente, yo {nombre}, con número de empleado {numEmpleado}, adscrito(a) a la Dependencia y/o Unidad Administrativa {dependencia}, hago constar que recibí en calidad de préstamo un acceso electrónico identificado con el folio {folio}, para el ingreso a las instalaciones de {organizacion}.',
        'Me comprometo a hacer uso responsable de dicho acceso, así como a conservarlo en buen estado durante el tiempo que lo tenga bajo mi resguardo.',
        'De igual manera, me comprometo hacer la devolución del acceso, en las mismas condiciones en las que me fue entregado en el momento que me sea requerido o al finalizar mi relación laboral con esta Dependencia.',
    ],
    AccessPRO: [
        'Por medio de la presente, yo {nombre}, con número de empleado {numEmpleado}, adscrito(a) a la Dependencia y/o Unidad Administrativa {dependencia}, hago constar que recibí en calidad de préstamo un acceso electrónico identificado con el folio {folio}, para el ingreso a las instalaciones de {organizacion}.',
        'Me comprometo a hacer uso responsable de dicho acceso, así como a conservarlo en buen estado durante el tiempo que lo tenga bajo mi resguardo.',
        'De igual manera, me comprometo hacer la devolución del acceso, en las mismas condiciones en las que me fue entregado en el momento que me sea requerido o al finalizar mi relación laboral con esta Dependencia.',
    ],
}; // Para compatibilidad hacia atrás durante la migración
export const RESPONSIVA_LEGAL_TEXT = RESPONSIVA_LEGAL_TEXTS.KONE;
