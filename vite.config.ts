import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'fs';

/**
 * Build-time del bundle actual, leído del `public/build-info.json` generado en
 * `prebuild`/`predev`. Se inyecta como `__BUILD_TIME__` para que la app compare
 * contra el archivo del servidor sin depender de la caché HTTP.
 */
function readLocalBuildTime(): string {
    try {
        const raw = readFileSync(new URL('./public/build-info.json', import.meta.url), 'utf-8');
        return (JSON.parse(raw).buildTime as string) ?? '';
    } catch {
        return '';
    }
}

// https://vite.dev/config/
export default defineConfig({
    define: {
        __BUILD_TIME__: JSON.stringify(readLocalBuildTime()),
    },
    build: {
        // Separa vendors grandes en chunks propios para mejorar el cacheo.
        rollupOptions: {
            output: {
                manualChunks(id: string) {
                    if (!id.includes('node_modules')) return;
                    if (id.includes('@supabase')) return 'vendor-supabase';
                    if (id.includes('exceljs')) return 'vendor-exceljs';
                    if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('dompurify'))
                        return 'vendor-pdf';
                    if (id.includes('jszip')) return 'vendor-zip';
                    if (id.includes('chart.js')) return 'vendor-chart';
                    if (id.includes('lucide-svelte')) return 'vendor-icons';
                    if (id.includes('svelte')) return 'vendor-svelte';
                },
            },
        },
    },
    plugins: [
        svelte(),
        tailwindcss(),
        VitePWA({
            // Modo manual: el SW nuevo queda en espera hasta que el usuario pulsa
            // "Recargar ahora". Evita que un SW nuevo limpie el precache viejo
            // mientras la página aún ejecuta el JS anterior (chunks rotos).
            registerType: 'prompt',
            workbox: {
                maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
                cleanupOutdatedCaches: true,
                navigateFallback: 'index.html',
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
                // No se precargan los chunks de exportación pesados (ExcelJS/PDF/ZIP/Chart):
                // se cachean on-demand con runtimeCaching al primer uso, lo que reduce el
                // tiempo de instalación/actualización de la PWA.
                globIgnores: [
                    '**/{vendor-exceljs,vendor-pdf,vendor-zip,vendor-chart,xlsxExport,xlsxTemplate,xlsxConflictReport,xlsxImporter,xlsxUsage,pdfGenerator}-*.js',
                    '**/{exceljs.min,jspdf.es.min,html2canvas.esm,jszip.min}-*.js',
                ],
                runtimeCaching: [
                    {
                        urlPattern:
                            /\/assets\/(vendor-exceljs|vendor-pdf|vendor-zip|vendor-chart|xlsxExport|xlsxTemplate|xlsxConflictReport|xlsxImporter|xlsxUsage|pdfGenerator|exceljs\.min|jspdf\.es\.min|html2canvas\.esm|jszip\.min)-.*\.js$/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'nexa-heavy-chunks',
                            expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
                        },
                    },
                ],
                // No se cachean respuestas de la API de Supabase: son datos autenticados
                // y el Cache Storage de Workbox no varía por cabeceras, lo que provocaría
                // fuga de datos entre usuarios en un dispositivo compartido.
            },
            includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'maskable-icon-512x512.png'],
            // Habilitar SW en modo dev para que el prompt de instalación funcione en localhost
            devOptions: {
                enabled: true,
            },
            manifest: {
                id: '/',
                name: 'Nexa',
                short_name: 'Nexa',
                description: 'Sistema Profesional de Control de Accesos y Personal',
                lang: 'es',
                dir: 'ltr',
                start_url: '/',
                scope: '/',
                theme_color: '#f8fafc',
                background_color: '#f8fafc',
                display: 'standalone',
                display_override: ['window-controls-overlay'],
                orientation: 'any',
                categories: ['business', 'productivity'],
                screenshots: [
                    {
                        src: 'screenshots/login-wide.png',
                        sizes: '2560x1440',
                        type: 'image/png',
                        form_factor: 'wide',
                        label: 'Inicio de sesión en escritorio',
                    },
                    {
                        src: 'screenshots/login-narrow.png',
                        sizes: '780x1688',
                        type: 'image/png',
                        label: 'Inicio de sesión en móvil',
                    },
                ],
                icons: [
                    {
                        src: 'favicon.svg',
                        sizes: 'any',
                        type: 'image/svg+xml',
                        purpose: 'any',
                    },
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: 'maskable-icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
                shortcuts: [
                    {
                        name: 'Pendientes',
                        short_name: 'Pendientes',
                        url: '/tickets',
                        icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
                    },
                    {
                        name: 'Personal',
                        short_name: 'Personal',
                        url: '/personal',
                        icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
                    },
                    {
                        name: 'Tarjetas',
                        short_name: 'Tarjetas',
                        url: '/cards',
                        icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
                    },
                ],
            },
        }),
    ],
});
