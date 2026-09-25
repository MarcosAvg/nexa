import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
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
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Pendientes',
            short_name: 'Pendientes',
            url: '/tickets',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Personal',
            short_name: 'Personal',
            url: '/personal',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Tarjetas',
            short_name: 'Tarjetas',
            url: '/cards',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }]
          }
        ]
      }
    })
  ],
})
