import { catalogState } from "../stores";

/**
 * mediaTypeAppearance.ts
 *
 * Apariencia determinista por tipo de medio de acceso: el color se asigna por
 * la posición estable del tipo dentro del catálogo activo (orden alfabético),
 * de modo que cada tipo tenga siempre el mismo color en toda la app.
 */

const VARIANTS = ["amber", "blue", "emerald", "violet", "rose"] as const;
export type MediaTypeVariant = (typeof VARIANTS)[number];

const DOT_CLASSES = [
    "bg-amber-400",
    "bg-sky-400",
    "bg-emerald-400",
    "bg-violet-400",
    "bg-rose-400",
    "bg-indigo-400",
];

const RGB_COLORS: [number, number, number][] = [
    [245, 158, 11], // amber
    [14, 165, 233], // sky
    [16, 185, 129], // emerald
    [139, 92, 246], // violet
    [244, 63, 94],  // rose
    [99, 102, 241], // indigo
];

/** Índice estable del tipo dentro del catálogo activo (alfabético). */
function indexOf(name: string): number {
    const names = [...catalogState.activeMediaTypeNames()].sort((a, b) =>
        a.localeCompare(b),
    );
    const i = names.indexOf(name);
    return i >= 0 ? i : names.length; // tipos desconocidos van al final
}

export function mediaTypeVariant(name: string): MediaTypeVariant {
    return VARIANTS[indexOf(name) % VARIANTS.length];
}

export function mediaTypeDotClass(name: string): string {
    return DOT_CLASSES[indexOf(name) % DOT_CLASSES.length];
}

export function mediaTypeRgb(name: string): [number, number, number] {
    return RGB_COLORS[indexOf(name) % RGB_COLORS.length];
}

/** Clases para barras de progreso de cobertura (Tailwind literales). */
const BAR_CLASSES = [
    { text: "text-amber-700", badge: "text-amber-600 bg-amber-50", bar: "bg-amber-500" },
    { text: "text-sky-700", badge: "text-sky-600 bg-sky-50", bar: "bg-sky-500" },
    { text: "text-emerald-700", badge: "text-emerald-600 bg-emerald-50", bar: "bg-emerald-500" },
    { text: "text-violet-700", badge: "text-violet-600 bg-violet-50", bar: "bg-violet-500" },
    { text: "text-rose-700", badge: "text-rose-600 bg-rose-50", bar: "bg-rose-500" },
];

/** Clases para tarjetas de stock (Tailwind literales). */
const STOCK_CLASSES = [
    { wrap: "bg-blue-50/60", label: "text-blue-400", value: "text-blue-700" },
    { wrap: "bg-amber-50/60", label: "text-amber-400", value: "text-amber-700" },
    { wrap: "bg-emerald-50/60", label: "text-emerald-500", value: "text-emerald-700" },
    { wrap: "bg-violet-50/60", label: "text-violet-400", value: "text-violet-700" },
    { wrap: "bg-rose-50/60", label: "text-rose-400", value: "text-rose-700" },
];

export function mediaTypeBarClasses(name: string): {
    text: string;
    badge: string;
    bar: string;
} {
    return BAR_CLASSES[indexOf(name) % BAR_CLASSES.length];
}

export function mediaTypeStockClasses(name: string): {
    wrap: string;
    label: string;
    value: string;
} {
    return STOCK_CLASSES[indexOf(name) % STOCK_CLASSES.length];
}