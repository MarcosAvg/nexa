/**
 * gestures.ts — acciones Svelte para interacción táctil.
 *
 * - `longPress`: dispara un callback al mantener pulsado (táctil), con
 *   cancelación si el dedo se mueve. Se usa para entrar en modo selección.
 * - `swipe`: detecta un deslizamiento horizontal y expone la distancia; útil
 *   para revelar acciones en tarjetas sin chocar con el scroll vertical.
 */

export interface LongPressOptions {
    onLongPress: () => void;
    /** Duración mínima en ms. @default 450 */
    duration?: number;
    /** Tolerancia de movimiento en px antes de cancelar. @default 10 */
    moveTolerance?: number;
}

export function longPress(node: HTMLElement, options: LongPressOptions) {
    let opts = options;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let startX = 0;
    let startY = 0;
    let active = false;
    let fired = false;

    const clear = () => {
        active = false;
        if (timer) clearTimeout(timer);
        timer = null;
    };

    const onPointerDown = (e: PointerEvent) => {
        // Solo punteros táctiles (dedo/stylus); el mouse conserva el click normal.
        if (e.pointerType === 'mouse') return;
        active = true;
        fired = false;
        startX = e.clientX;
        startY = e.clientY;
        timer = setTimeout(() => {
            if (!active) return;
            fired = true;
            navigator.vibrate?.(15);
            opts.onLongPress();
        }, opts.duration ?? 450);
    };

    const onPointerMove = (e: PointerEvent) => {
        if (!active) return;
        const tol = opts.moveTolerance ?? 10;
        if (Math.abs(e.clientX - startX) > tol || Math.abs(e.clientY - startY) > tol) {
            clear();
        }
    };

    const onPointerUp = () => clear();

    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointermove', onPointerMove);
    node.addEventListener('pointerup', onPointerUp);
    node.addEventListener('pointercancel', onPointerUp);
    node.addEventListener('pointerleave', onPointerUp);

    return {
        update(next: LongPressOptions) {
            opts = next;
        },
        destroy() {
            clear();
            node.removeEventListener('pointerdown', onPointerDown);
            node.removeEventListener('pointermove', onPointerMove);
            node.removeEventListener('pointerup', onPointerUp);
            node.removeEventListener('pointercancel', onPointerUp);
            node.removeEventListener('pointerleave', onPointerUp);
        },
    };
}

export interface SwipeOptions {
    /** Callback con la distancia horizontal (positiva = derecha). */
    onSwipe?: (deltaX: number, deltaY: number) => void;
    /** Umbral para considerar un swipe. @default 60 */
    threshold?: number;
    /** Callback al superar el umbral (izquierda). */
    onSwipeLeft?: () => void;
    /** Callback al superar el umbral (derecha). */
    onSwipeRight?: () => void;
}

export function swipe(node: HTMLElement, options: SwipeOptions = {}) {
    let opts = options;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let horizontal = false;

    const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        tracking = true;
        horizontal = false;
    };

    const onTouchMove = (e: TouchEvent) => {
        if (!tracking) return;
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        // Determina intención horizontal una sola vez (no secuestrar scroll vertical).
        if (!horizontal) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
            if (!horizontal) {
                tracking = false;
                return;
            }
        }
        opts.onSwipe?.(dx, dy);
    };

    const onTouchEnd = (e: TouchEvent) => {
        if (!tracking) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - startX;
        const threshold = opts.threshold ?? 60;
        if (horizontal && dx <= -threshold) opts.onSwipeLeft?.();
        else if (horizontal && dx >= threshold) opts.onSwipeRight?.();
        tracking = false;
        horizontal = false;
    };

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchmove', onTouchMove, { passive: true });
    node.addEventListener('touchend', onTouchEnd);
    node.addEventListener('touchcancel', onTouchEnd);

    return {
        update(next: SwipeOptions) {
            opts = next;
        },
        destroy() {
            node.removeEventListener('touchstart', onTouchStart);
            node.removeEventListener('touchmove', onTouchMove);
            node.removeEventListener('touchend', onTouchEnd);
            node.removeEventListener('touchcancel', onTouchEnd);
        },
    };
}
