// ─── Scroll lock con conteo de referencias ──────────────────────────────
// Varios overlays (Modal, SidePanel, CommandPalette) pueden abrirse a la vez.
// Un simple `overflow: hidden`/restore se rompe al cerrar el primero, por eso
// se lleva un contador y solo se restaura cuando no queda ningún overlay.

let lockCount = 0;
let previousOverflow = '';
let previousPaddingRight = '';

export const scrollLock = {
    lock(): void {
        if (typeof document === 'undefined') return;
        if (lockCount === 0) {
            const body = document.body;
            previousOverflow = body.style.overflow;
            previousPaddingRight = body.style.paddingRight;
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
            body.style.overflow = 'hidden';
            if (scrollbarWidth > 0) {
                body.style.paddingRight = `${scrollbarWidth}px`;
            }
        }
        lockCount++;
    },

    unlock(): void {
        if (typeof document === 'undefined' || lockCount === 0) return;
        lockCount--;
        if (lockCount === 0) {
            document.body.style.overflow = previousOverflow;
            document.body.style.paddingRight = previousPaddingRight;
        }
    },
};
