/**
 * moduleDefinitions.ts
 *
 * Catálogo maestro de módulos de la plataforma. Los módulos se habilitan por
 * instalación (config) y se COMPILAN por contrato (`VITE_MODULES` → generated.ts).
 *
 * Cada módulo declara:
 *  - id: clave única
 *  - title / description / icon
 *  - kind: 'route' (vista con ruta) | 'context' (botón/acción dentro de otra vista)
 *  - path: ruta si kind === 'route'
 *  - fields: campos de configuración persistidos en app_settings.modules
 */

export type ModuleField = {
    key: string;
    label: string;
    type: "media-select" | "number" | "boolean" | "text";
    default?: string | number | boolean;
    help?: string;
};

export type ModuleDef = {
    id: string;
    title: string;
    description: string;
    kind: "route" | "context";
    path?: string;
    icon: string;
    fields: ModuleField[];
};

export const MODULE_DEFINITIONS: ModuleDef[] = [
    {
        id: "conteo_uso",
        title: "Conteo de uso de tarjetas",
        description:
            "Importa un archivo con folios y conteo de uso para cruzar con el directorio de personal. Requiere un medio con folio.",
        kind: "context",
        icon: "bar-chart",
        fields: [
            { key: "mediaKey", label: "Medio", type: "media-select" },
            { key: "usageThreshold", label: "Umbral de bajo uso", type: "number", default: 10 },
        ],
    },
    {
        id: "registro_sin_tarjeta",
        title: "Registro sin tarjeta",
        description:
            "Registro de personas que llegan sin tarjeta de acceso, con estado de responsiva del medio.",
        kind: "route",
        path: "/registro-sin-tarjeta",
        icon: "clipboard-x",
        fields: [{ key: "mediaKey", label: "Medio", type: "media-select" }],
    },
];

/** Devuelve la definición de un módulo por id. */
export function moduleDef(id: string): ModuleDef | undefined {
    return MODULE_DEFINITIONS.find((m) => m.id === id);
}
