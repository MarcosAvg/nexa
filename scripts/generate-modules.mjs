#!/usr/bin/env node
/**
 * generate-modules.mjs
 *
 * Genera `src/lib/modules/generated.ts` con SOLO los módulos contratados
 * (variable de entorno `VITE_MODULES`, coma-separada). Si no está definida,
 * se compilan todos. Así el build solo incluye el código de los módulos que el
 * cliente contrató (los no listados nunca se importan, por lo que no entran al
 * bundle vía tree-shaking).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outFile = resolve(root, "src/lib/modules/generated.ts");

// ── Módulos con ruta (vista) ──────────────────────────────────────────────
const ROUTE_MODULES = {
    registro_sin_tarjeta: {
        path: "/registro-sin-tarjeta",
        view: "../views/RegistroSinTarjetaView.svelte",
    },
};

// ── Módulos "context" (componente embebido, p. ej. modal) ─────────────────
const CONTEXT_MODULES = {
    conteo_uso: "../components/modals/UsoTarjetasImportModal.svelte",
};

const ALL_IDS = ["conteo_uso", "registro_sin_tarjeta"];

/** Símbolo JS estable por módulo. */
const sym = (id) => `__mod_${id.replace(/[^a-z0-9]/gi, "_")}`;

// ── Leer módulos contratados (env o .env) ────────────────────────────────
let raw = (process.env.VITE_MODULES || "").trim();
if (!raw) {
    try {
        const env = readFileSync(resolve(root, ".env"), "utf8");
        const m = env.match(/^VITE_MODULES=(.*)$/m);
        raw = m ? m[1].trim() : "";
    } catch {
        // sin .env
    }
}
const contracted = raw
    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : ALL_IDS;

const lines = [
    "// ⚠️ Archivo GENERADO por scripts/generate-modules.mjs — NO editar a mano.",
    `// Módulos contratados (VITE_MODULES): ${contracted.join(", ") || "todos"}`,
    "",
];

// Imports estáticos SOLO de los módulos contratados (clave para el tree-shaking)
for (const id of contracted) {
    const r = ROUTE_MODULES[id];
    if (r) lines.push(`import ${sym(id)} from ${JSON.stringify(r.view)};`);
}
lines.push("");

lines.push("export const BUILT_MODULES: string[] = [" + contracted.map((id) => JSON.stringify(id)).join(", ") + "];");
lines.push("");

lines.push("export const moduleRoutes: Record<string, any> = {");
for (const id of contracted) {
    const r = ROUTE_MODULES[id];
    if (r) lines.push(`  ${JSON.stringify(r.path)}: ${sym(id)},`);
}
lines.push("};");
lines.push("");

// Componentes "context" → lazy import (solo si está contratado)
lines.push("export const moduleComponents: Record<string, () => any> = {");
for (const id of contracted) {
    const c = CONTEXT_MODULES[id];
    if (c) lines.push(`  ${JSON.stringify(id)}: () => import(${JSON.stringify(c)}),`);
}
lines.push("};");
lines.push("");

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, lines.join("\n"), "utf8");
console.log(`✅ generated.ts → módulos contratados: ${contracted.join(", ")}`);
