const browser = typeof window !== 'undefined';

/**
 * MediaQueryState — Suscripción reactiva a una media query.
 *
 * Evita duplicar breakpoints de Tailwind en lógica JS con `window.innerWidth`,
 * que no reacciona a rotación/resize. El estado se mantiene sincronizado vía
 * `matchMedia` y se puede usar en plantillas y `$derived`.
 */
class MediaQueryState {
    matches = $state(false);
    private mql: MediaQueryList | null = null;
    private onChange = (e: MediaQueryListEvent) => {
        this.matches = e.matches;
    };

    constructor(query: string) {
        if (!browser) return;
        this.mql = window.matchMedia(query);
        this.matches = this.mql.matches;
        this.mql.addEventListener('change', this.onChange);
    }

    destroy() {
        this.mql?.removeEventListener('change', this.onChange);
        this.mql = null;
    }
}

export const mediaState = {
    /** < 640px (breakpoint `sm` de Tailwind). */
    isMobile: new MediaQueryState('(max-width: 639px)'),
    /** < 481px (teléfonos estrechos, usado para modos de UI compactos). */
    isPhone: new MediaQueryState('(max-width: 480px)'),
    /** >= 1024px (breakpoint `lg` de Tailwind). */
    isDesktop: new MediaQueryState('(min-width: 1024px)'),
};
