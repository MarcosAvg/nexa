/**
 * overlayHistory.ts
 *
 * Integra los overlays (modales, side panels, command palette, hojas) con el
 * historial del navegador para que el botón "atrás" (Android/touch) cierre el
 * overlay superior en lugar de navegar o salir de la PWA.
 *
 * El router es hash-based, así que se empuja la MISMA URL con `pushState`; al
 * recibir `popstate` se cierra el overlay superior sin cambiar de ruta.
 */

type Entry = { id: symbol; close: () => void };

const stack: Entry[] = [];
let listening = false;
let ignoreNextPop = false;

function onPopState() {
    if (ignoreNextPop) {
        ignoreNextPop = false;
        return;
    }
    const entry = stack.pop();
    entry?.close();
}

function ensureListener() {
    if (listening || typeof window === 'undefined') return;
    listening = true;
    window.addEventListener('popstate', onPopState);
}

export const overlayHistory = {
    /** Registra un overlay abierto y empuja un estado de historial. */
    push(id: symbol, close: () => void) {
        if (typeof window === 'undefined') return;
        ensureListener();
        stack.push({ id, close });
        try {
            history.pushState({ __nexaOverlay: true }, '', location.href);
        } catch {
            // Algunos contextos (file://) pueden bloquear pushState.
        }
    },

    /**
     * Consume el estado del overlay al cerrarse por UI (Escape/backdrop/botón).
     * Si el overlay ya fue cerrado por `popstate`, no hace nada.
     */
    close(id: symbol) {
        if (typeof window === 'undefined') return;
        const i = stack.findIndex((e) => e.id === id);
        if (i === -1) return;
        stack.splice(i, 1);
        // Consumir la entrada de historial que empujamos, sin re-cerrar.
        ignoreNextPop = true;
        try {
            history.back();
        } catch {
            ignoreNextPop = false;
        }
    },

    /** ¿Hay overlays registrados? (para tests / depuración) */
    size(): number {
        return stack.length;
    },
};
