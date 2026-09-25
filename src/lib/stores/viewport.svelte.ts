/**
 * ViewportState — expone el inset del teclado virtual (visualViewport) y lo
 * publica como variable CSS `--keyboard-inset` para que footers/barras se
 * ajusten sin quedar tapados por el teclado en móvil.
 */
class ViewportState {
    keyboardInset = $state(0);

    init() {
        if (typeof window === 'undefined' || !window.visualViewport) return;
        const vv = window.visualViewport;
        const update = () => {
            const inset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
            this.keyboardInset = inset;
            document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`);
            document.body.classList.toggle('keyboard-open', inset > 80);
        };
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        update();
    }
}

export const viewport = new ViewportState();
