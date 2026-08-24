import { catalogState } from "../stores";

/**
 * mediaTypeAppearance.ts
 *
 * Apariencia por tipo de medio de acceso. El color se resuelve así:
 *   1. Primero, el color personalizado del medio en el catálogo (`access_media_types.color`),
 *      si es un identificador válido de la paleta.
 *   2. Si el medio no tiene color configurado, se usa un color determinista por la
 *      posición estable del tipo dentro del catálogo activo (orden alfabético).
 *
 * La paleta es NOMBRADA y finita para que Tailwind JIT siga compilando las clases
 * literales. Cada variante expone sus clases (dot, bar, stock) y su variante de Badge.
 */

type PaletteId = "amber" | "sky" | "emerald" | "violet" | "rose" | "indigo";

/** Variantes soportadas por el componente Badge. */
export type MediaTypeVariant = "slate" | "amber" | "emerald" | "blue" | "rose" | "violet";

type PaletteEntry = {
    id: PaletteId;
    dot: string;
    rgb: [number, number, number];
    badge: MediaTypeVariant;
    bar: { text: string; badge: string; bar: string };
    stock: { wrap: string; label: string; value: string };
};

const PALETTE: PaletteEntry[] = [
    { id: "amber", dot: "bg-amber-400", rgb: [245, 158, 11], badge: "amber", bar: { text: "text-amber-700", badge: "text-amber-600 bg-amber-50", bar: "bg-amber-500" }, stock: { wrap: "bg-amber-50/60", label: "text-amber-400", value: "text-amber-700" } },
    { id: "sky", dot: "bg-sky-400", rgb: [14, 165, 233], badge: "blue", bar: { text: "text-sky-700", badge: "text-sky-600 bg-sky-50", bar: "bg-sky-500" }, stock: { wrap: "bg-blue-50/60", label: "text-blue-400", value: "text-blue-700" } },
    { id: "emerald", dot: "bg-emerald-400", rgb: [16, 185, 129], badge: "emerald", bar: { text: "text-emerald-700", badge: "text-emerald-600 bg-emerald-50", bar: "bg-emerald-500" }, stock: { wrap: "bg-emerald-50/60", label: "text-emerald-500", value: "text-emerald-700" } },
    { id: "violet", dot: "bg-violet-400", rgb: [139, 92, 246], badge: "violet", bar: { text: "text-violet-700", badge: "text-violet-600 bg-violet-50", bar: "bg-violet-500" }, stock: { wrap: "bg-violet-50/60", label: "text-violet-400", value: "text-violet-700" } },
    { id: "rose", dot: "bg-rose-400", rgb: [244, 63, 94], badge: "rose", bar: { text: "text-rose-700", badge: "text-rose-600 bg-rose-50", bar: "bg-rose-500" }, stock: { wrap: "bg-rose-50/60", label: "text-rose-400", value: "text-rose-700" } },
    { id: "indigo", dot: "bg-indigo-400", rgb: [99, 102, 241], badge: "violet", bar: { text: "text-indigo-700", badge: "text-indigo-600 bg-indigo-50", bar: "bg-indigo-500" }, stock: { wrap: "bg-indigo-50/60", label: "text-indigo-400", value: "text-indigo-700" } },
];

const PALETTE_BY_ID: Record<PaletteId, PaletteEntry> = Object.fromEntries(
    PALETTE.map((p) => [p.id, p]),
) as Record<PaletteId, PaletteEntry>;

const VALID_IDS = new Set<string>(PALETTE.map((p) => p.id));

/** Fallback determinista: posición estable del tipo dentro del catálogo activo (alfabético). */
function indexOf(name: string): number {
    const names = [...catalogState.activeMediaTypeNames()].sort((a, b) =>
        a.localeCompare(b),
    );
    const i = names.indexOf(name);
    return i >= 0 ? i : names.length; // tipos desconocidos van al final
}

/** Colores configurables (para el selector del catálogo). Cada uno con un swatch de clase dot. */
export const MEDIA_COLOR_OPTIONS: { id: PaletteId; label: string; dot: string; badge: MediaTypeVariant }[] =
    PALETTE.map((p) => ({ id: p.id, label: p.id.charAt(0).toUpperCase() + p.id.slice(1), dot: p.dot, badge: p.badge }));

/** Resuelve la entrada de paleta para un tipo de medio. */
function paletteFor(name: string): PaletteEntry {
    const medias = catalogState.mediaTypes;
    const media = medias.find((m) => m.name === name) ?? medias.find((m) => (m as any).key === name);
    const color = media ? (media as any).color : undefined;
    if (typeof color === "string" && VALID_IDS.has(color)) {
        return PALETTE_BY_ID[color as PaletteId];
    }
    return PALETTE[indexOf(name) % PALETTE.length];
}

/** Variante de Badge para el tipo de medio. */
export function mediaTypeVariant(name: string): MediaTypeVariant {
    return paletteFor(name).badge;
}

export function mediaTypeDotClass(name: string): string {
    return paletteFor(name).dot;
}

export function mediaTypeRgb(name: string): [number, number, number] {
    return paletteFor(name).rgb;
}

/** Clases para barras de progreso de cobertura (Tailwind literales). */
export function mediaTypeBarClasses(name: string): {
    text: string;
    badge: string;
    bar: string;
} {
    return paletteFor(name).bar;
}

/** Clases para tarjetas de stock (Tailwind literales). */
export function mediaTypeStockClasses(name: string): {
    wrap: string;
    label: string;
    value: string;
} {
    return paletteFor(name).stock;
}
