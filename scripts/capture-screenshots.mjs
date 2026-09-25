#!/usr/bin/env node
/**
 * capture-screenshots.mjs
 *
 * Captura screenshots reales de la app (pantalla de login, pública) para el
 * manifest de la PWA, en formato `wide` y `narrow`.
 *
 * Uso:
 *   npm run build && npm run preview &   # o cualquier server
 *   BASE_URL=http://localhost:4173 node scripts/capture-screenshots.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, 'public/screenshots');
const baseURL = process.env.BASE_URL || 'http://localhost:4173';

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
try {
    const shots = [
        { name: 'login-wide.png', width: 1280, height: 720, label: 'Login (escritorio)' },
        { name: 'login-narrow.png', width: 390, height: 844, label: 'Login (móvil)' },
    ];

    for (const shot of shots) {
        const page = await browser.newPage({
            viewport: { width: shot.width, height: shot.height },
            deviceScaleFactor: 2,
        });
        await page.goto(baseURL, { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);
        await page.screenshot({ path: resolve(outDir, shot.name) });
        console.log(`✅ ${shot.label} → public/screenshots/${shot.name}`);
        await page.close();
    }
} finally {
    await browser.close();
}
