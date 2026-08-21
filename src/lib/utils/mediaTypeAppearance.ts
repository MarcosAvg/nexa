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