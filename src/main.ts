import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

// ─── Red de seguridad contra chunks rotos ────────────────────────────────
// Tras un deploy, si el Service Worker quedó desincronizado (JS viejo con
// precache nuevo), los imports dinámicos de las vistas pueden fallar y la
// vista se queda cargando. Vite emite `vite:preloadError`; recargamos una vez
// (con guarda para no entrar en bucle) para recuperar la versión consistente.
const RELOAD_GUARD_KEY = 'nexa_preload_reload';

if (typeof window !== 'undefined') {
    window.addEventListener('vite:preloadError', (event) => {
        (event as Event).preventDefault?.();
        console.warn('[preloadError] Falló la carga de un chunk; recargando…');
        if (sessionStorage.getItem(RELOAD_GUARD_KEY) === '1') return;
        sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
        window.location.reload();
    });

    // Tras una carga correcta, liberar la guarda para futuros deploys.
    window.addEventListener('load', () => {
        setTimeout(() => sessionStorage.removeItem(RELOAD_GUARD_KEY), 10_000);
    });
}

const app = mount(App, {
    target: document.getElementById('app')!,
});

export default app;
