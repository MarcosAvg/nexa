// ─────────────────────────────────────────────────────────────
// scripts/generate-build-info.js
// Genera public/build-info.json con el timestamp del build
// para que la app pueda detectar si hay una versión nueva.
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const info = {
    buildTime: new Date().toISOString(),
};

// En dev: escribe en public/ para que Vite lo sirva
writeFileSync(
    resolve(__dirname, '../public/build-info.json'),
    JSON.stringify(info, null, 2) + '\n',
    'utf-8',
);

// En build: escribe también en dist/ porque `vite build` ya copió public/ cuando postbuild corre
// En predev: dist/ no existe, así que ignoramos silenciosamente el error
const outDir = process.env.VITE_OUT_DIR || 'dist';
try {
    writeFileSync(
        resolve(__dirname, `../${outDir}/build-info.json`),
        JSON.stringify(info, null, 2) + '\n',
        'utf-8',
    );
} catch {
    // Si dist/ no existe (predev), lo ignoramos — dev sirve desde public/
}

console.log(`✅ build-info.json generated — ${info.buildTime}`);
