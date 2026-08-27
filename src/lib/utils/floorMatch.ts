/**
 * floorMatch.ts
 *
 * Utilidades para normalizar y resolver pisos escritos en la plantilla contra
 * los labels canónicos de la tabla `floors`. Se usa tanto en la capa de
 * guardado (buildPermissionPlan / savePersonAccess) como en la validación al
 * alta, para tolerar diferencias de formato ("piso 3", "3°", " Piso 3 ", etc.).
 */

/** Normaliza un label de piso para comparaciones (trim + espacios + acentos + case). */
export function normalizeFloorLabel(label: string): string {
    return String(label ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");
}

/** Extrae el número principal de un texto de piso, si lo hay ("piso 3" → "3"). */
function extractNumeric(raw: string): string | null {
    const normalized = normalizeFloorLabel(raw)
        .replace(/(piso|nivel|planta|pb|sotano|sótano)/g, " ");
    const match = normalized.match(/\d+/);
    return match ? match[0] : null;
}

/**
 * Resuelve un piso textual contra la lista de labels canónicos de un edificio.
 * Devuelve el label canónico coincidente o null si no hay coincidencia.
 *
 * Estrategias, en orden:
 *   1. Coincidencia exacta normalizada (trim + acentos + case).
 *   2. Coincidencia numérica ("piso 3" ↔ "3", "3°" ↔ "3").
 *   3. Coincidencia por etiqueta especial (ej. "pb" ↔ "Planta Baja",
 *      "sotano" ↔ "Sótano").
 */
export function resolveFloorLabel(raw: string, canonicalLabels: string[]): string | null {
    if (!raw || !canonicalLabels?.length) return null;

    const wanted = normalizeFloorLabel(raw);
    if (!wanted) return null;

    // 1. Exacta normalizada.
    const exact = canonicalLabels.find((l) => normalizeFloorLabel(l) === wanted);
    if (exact) return exact;

    // 2. Numérica ("piso 3" ↔ "3", "3°" ↔ "3", "nivel 4" ↔ "4").
    const wantedNum = extractNumeric(wanted);
    if (wantedNum) {
        const byNum = canonicalLabels.find(
            (l) => normalizeFloorLabel(l) === wantedNum,
        );
        if (byNum) return byNum;
    }

    // 3. Etiquetas especiales normalizadas (Planta Baja, Sótano, etc.).
    const aliasish = normalizeFloorLabel(wanted)
        .replace(/(piso|nivel|planta)\s*/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
    const specialAliases: Record<string, string> = {
        "pb": "planta baja",
        "planta": "planta baja",
        "planta b": "planta baja",
        "planta baja": "planta baja",
        "sotano": "sótano",
        "sot": "sótano",
        "subsuelo": "sótano",
        "soterrano": "sótano",
    };
    const aliasTarget = specialAliases[aliasish];
    const specialMatch = aliasTarget
        ? canonicalLabels.find((l) => normalizeFloorLabel(l) === aliasTarget)
        : undefined;
    if (specialMatch) return specialMatch;

    return null;
}

/**
 * Dado un listado de pisos textuales y los labels canónicos del edificio,
 * devuelve los pisos resueltos a labels canónicos y los no reconocidos.
 */
export function resolveFloorList(
    rawFloors: string[],
    canonicalLabels: string[],
): { resolved: string[]; unresolved: string[] } {
    const resolved: string[] = [];
    const unresolved: string[] = [];
    const seen = new Set<string>();
    for (const raw of rawFloors || []) {
        const label = resolveFloorLabel(raw, canonicalLabels);
        if (label) {
            if (!seen.has(label)) {
                seen.add(label);
                resolved.push(label);
            }
        } else {
            unresolved.push(raw);
        }
    }
    return { resolved, unresolved };
}

/** Indica si un conjunto de pisos textuales puede resolverse por completo en un edificio. */
export function allFloorsResolve(rawFloors: string[], canonicalLabels: string[]): boolean {
    return resolveFloorList(rawFloors, canonicalLabels).unresolved.length === 0;
}

/**
 * Construye un resolvedor de pisos por edificio a partir del arreglo crudo de
 * la tabla `floors` (idi, label, building_id). Devuelve un mapa
 * building_id → función que resuelve un label textual a su id (o null).
 */
export function buildFloorResolver(
    floors: { id: number; label: string; building_id: number }[],
): (buildingId: number, floorLabel: string) => number | null {
    const byBuilding = new Map<number, { byLabel: Map<string, number>; labels: string[] }>();
    for (const f of floors || []) {
        let entry = byBuilding.get(f.building_id);
        if (!entry) {
            entry = { byLabel: new Map(), labels: [] };
            byBuilding.set(f.building_id, entry);
        }
        const key = normalizeFloorLabel(f.label);
        if (!entry.byLabel.has(key)) {
            entry.byLabel.set(key, f.id);
            entry.labels.push(f.label);
        }
    }

    return (buildingId: number, floorLabel: string): number | null => {
        const entry = byBuilding.get(buildingId);
        if (!entry) return null;
        // Primero intento por label normalizado directo (rápido y exacto).
        const direct = entry.byLabel.get(normalizeFloorLabel(floorLabel));
        if (direct !== undefined) return direct;
        // Luego por estrategias de tolerancia (numérica / especial).
        const resolved = resolveFloorLabel(floorLabel, entry.labels);
        if (!resolved) return null;
        return entry.byLabel.get(normalizeFloorLabel(resolved)) ?? null;
    };
}
