/**
 * PullRefreshState — registro global del refresco de la vista activa para
 * habilitar "pull to refresh" en móvil. Cada vista registra su refresco.
 */
class PullRefreshState {
    handler: (() => Promise<void>) | null = null;
    isRefreshing = $state(false);

    /** Registra el refresco de la vista. Devuelve la función de limpieza. */
    register(fn: () => Promise<void>) {
        this.handler = fn;
        return () => {
            if (this.handler === fn) this.handler = null;
        };
    }

    async trigger() {
        if (!this.handler || this.isRefreshing) return;
        this.isRefreshing = true;
        try {
            await this.handler();
        } finally {
            this.isRefreshing = false;
        }
    }
}

export const pullRefresh = new PullRefreshState();
