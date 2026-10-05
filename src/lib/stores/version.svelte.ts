/**
 * VersionState — Detecta si hay una nueva versión disponible
 * comparando el build-time embebido en el bundle con el del servidor
 * periódicamente, y muestra un indicador de estado "Al día" o
 * "Actualización disponible".
 *
 * El proceso de actualización es manual: el Service Worker se registra en
 * modo `prompt`, de modo que la versión nueva queda en espera hasta que el
 * usuario pulsa "Recargar ahora". Así nunca se limpia el precache viejo
 * mientras la página sigue ejecutando el JS anterior (que rompería los
 * chunks cargados por `import()` dinámico).
 */
const DISMISS_KEY = 'nexa_dismissed_build_time';

export class VersionState {
    localBuildTime = $state<string>('');
    isUpdateAvailable = $state(false);
    /** true cuando la primera verificación ya se completó. */
    hasChecked = $state(false);
    lastCheckTime = $state<number>(0);
    /** Build-time de la última versión disponible que el usuario descartó. */
    dismissedBuildTime = $state<string | null>(null);
    /** true mientras se descarga/aplica una actualización (para el spinner). */
    isRefreshing = $state(false);
    /** Fase visible del proceso de actualización. */
    refreshPhase = $state<'idle' | 'checking' | 'installing' | 'activating'>('idle');
    /** Build-time formateado para mostrar al usuario. */
    formattedBuildTime = $derived.by(() => {
        if (!this.localBuildTime) return null;
        try {
            const d = new Date(this.localBuildTime);
            return d.toLocaleString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return this.localBuildTime.slice(0, 10);
        }
    });

    /** Último serverBuildTime detectado (para saber si es una versión nueva al descartar). */
    #latestServerBuildTime: string | null = null;

    private checkInterval: ReturnType<typeof setInterval> | null = null;
    private initialized = false;
    /** Evita programar más de una recarga desde esta página. */
    private _reloadScheduled = false;

    async init() {
        if (this.initialized) return;
        this.initialized = true;

        // Build-time del bundle en ejecución (inyectado por Vite en build).
        // Siempre coincide con el JS que corre, evitando falsos positivos.
        try {
            this.localBuildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';
        } catch {
            this.localBuildTime = '';
        }
        // Fallback: si no se pudo inyectar, leerlo del servidor sin caché.
        if (!this.localBuildTime) {
            this.localBuildTime = await this.fetchServerBuildTime();
        }

        // Descartado persistido entre recargas (hasta que llegue otra versión).
        try {
            const saved = sessionStorage.getItem(DISMISS_KEY);
            if (saved) this.dismissedBuildTime = saved;
        } catch {
            // sessionStorage puede fallar (modo privado); ignorar.
        }

        this.setupControllerChange();

        await this.checkForUpdate();
        this.checkInterval = setInterval(() => this.checkForUpdate(), 120_000);
    }

    /**
     * Red de seguridad: si un SW nuevo toma el control sin que hayamos
     * recargado, recargamos para no quedar con JS viejo + precache nuevo.
     */
    private setupControllerChange() {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
        const hadController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            // En la primera instalación (sin controlador previo) no recargar.
            if (!hadController) return;
            this.reloadOnce();
        });
    }

    /** Lee el build-time publicado por el servidor, sin caché. */
    private async fetchServerBuildTime(): Promise<string> {
        try {
            const res = await fetch(`/build-info.json?t=${Date.now()}`, { cache: 'no-store' });
            const data = await res.json();
            return data.buildTime ?? '';
        } catch {
            return '';
        }
    }

    async checkForUpdate() {
        // Reintentar cargar el build local si no lo tenemos (p. ej. falló al inicio).
        if (!this.localBuildTime) {
            this.localBuildTime = await this.fetchServerBuildTime();
            if (!this.localBuildTime) {
                this.hasChecked = true;
                return;
            }
        }

        const serverBuildTime = await this.fetchServerBuildTime();
        if (serverBuildTime && serverBuildTime !== this.localBuildTime) {
            this.isUpdateAvailable = true;
            this.#latestServerBuildTime = serverBuildTime;

            // Si el usuario había descartado una versión anterior y ahora hay
            // una versión distinta, reseteamos el descarte para que el modal
            // se muestre automáticamente de nuevo.
            if (this.dismissedBuildTime && this.dismissedBuildTime !== serverBuildTime) {
                this.dismissedBuildTime = null;
                try {
                    sessionStorage.removeItem(DISMISS_KEY);
                } catch {
                    // ignorar
                }
            }
        } else {
            // El servidor coincide con lo que corremos: ya estamos al día.
            this.isUpdateAvailable = false;
        }
        this.lastCheckTime = Date.now();
        this.hasChecked = true;
    }

    /**
     * El usuario descartó la actualización actual — guardamos qué build
     * era para no volver a mostrar el modal automáticamente hasta que
     * llegue una versión distinta.
     */
    dismissUpdate() {
        if (this.#latestServerBuildTime) {
            this.dismissedBuildTime = this.#latestServerBuildTime;
            try {
                sessionStorage.setItem(DISMISS_KEY, this.#latestServerBuildTime);
            } catch {
                // ignorar
            }
        }
    }

    /** Recarga una sola vez, con cache-busting para evitar bfcache. */
    private reloadOnce() {
        if (this._reloadScheduled) return;
        this._reloadScheduled = true;
        const url = new URL(window.location.href);
        url.searchParams.set('_cb', `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
        window.location.replace(url.toString());
    }

    /** Espera a que un SW pase a `installed`/`activated` (con timeout). */
    private waitForState(sw: ServiceWorker, states: string[], timeoutMs: number): Promise<void> {
        if (states.includes(sw.state)) return Promise.resolve();
        return new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                sw.removeEventListener('statechange', onStateChange);
                resolve();
            }, timeoutMs);
            const onStateChange = () => {
                if (states.includes(sw.state)) {
                    clearTimeout(timeout);
                    sw.removeEventListener('statechange', onStateChange);
                    resolve();
                }
            };
            sw.addEventListener('statechange', onStateChange);
        });
    }

    /**
     * Espera a que exista un worker nuevo (instalándose o en espera) tras
     * `registration.update()`. Evita la carrera de leer `installing`/`waiting`
     * antes de que el navegador los cree (causa de tener que pulsar 2 veces).
     */
    private waitForNewWorker(
        registration: ServiceWorkerRegistration,
        timeoutMs: number,
    ): Promise<ServiceWorker | null> {
        const existing = registration.installing || registration.waiting;
        if (existing) return Promise.resolve(existing);

        return new Promise((resolve) => {
            let done = false;
            const started = Date.now();

            const onFound = () => {
                const sw = registration.installing || registration.waiting;
                if (sw) finish(sw);
            };

            const interval = setInterval(() => {
                const sw = registration.installing || registration.waiting;
                if (sw) {
                    finish(sw);
                    return;
                }
                if (Date.now() - started >= timeoutMs) finish(null);
            }, 200);

            const finish = (sw: ServiceWorker | null) => {
                if (done) return;
                done = true;
                registration.removeEventListener('updatefound', onFound);
                clearInterval(interval);
                resolve(sw);
            };

            registration.addEventListener('updatefound', onFound);
        });
    }

    /**
     * Fuerza la actualización del Service Worker y recarga.
     *
     * En modo `prompt`, el SW nuevo queda en `waiting`. Se le envía
     * `SKIP_WAITING`, se espera a que active y recién entonces se recarga,
     * garantizando que el precache nuevo sirva el próximo `index.html` y los
     * chunks sean consistentes.
     */
    async refreshPage() {
        if (this._reloadScheduled) return;

        this.isRefreshing = true;
        this.refreshPhase = 'checking';

        try {
            const registration = await navigator.serviceWorker?.getRegistration();
            if (registration) {
                await registration.update();

                // Esperar a que aparezca el worker nuevo (evita recargar en vano).
                const newWorker = await this.waitForNewWorker(registration, 10_000);

                if (newWorker) {
                    // Si aún se está instalando, esperar a que termine.
                    this.refreshPhase = 'installing';
                    await this.waitForState(newWorker, ['installed', 'activated'], 10_000);

                    // El SW nuevo en espera: pedirle que se active y esperar.
                    this.refreshPhase = 'activating';
                    const waiting =
                        registration.waiting ?? (newWorker.state === 'installed' ? newWorker : null);
                    if (waiting) {
                        waiting.postMessage({ type: 'SKIP_WAITING' });
                        await this.waitForState(waiting, ['activated'], 8_000);
                    }
                }
            }
        } catch {
            // Si falla la comunicación con el SW, recargar de todas formas.
        }

        this.reloadOnce();
        // Si la navegación tardara, no dejar el botón bloqueado indefinidamente.
        this.isRefreshing = false;
        this.refreshPhase = 'idle';
    }

    destroy() {
        if (this.checkInterval) clearInterval(this.checkInterval);
        this.initialized = false;
    }
}

export const versionState = new VersionState();
