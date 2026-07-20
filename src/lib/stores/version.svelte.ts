/**
 * VersionState — Detecta si hay una nueva versión disponible
 * comparando el build-time local con el servidor periódicamente,
 * y muestra un indicador de estado "Al día" o "Actualización disponible".
 */
export class VersionState {
    localBuildTime = $state<string>("");
    isUpdateAvailable = $state(false);
    /** true cuando la primera verificación ya se completó. */
    hasChecked = $state(false);
    lastCheckTime = $state<number>(0);
    /** Build-time de la última versión disponible que el usuario descartó. */
    dismissedBuildTime = $state<string | null>(null);
    /** Build-time formateado para mostrar al usuario. */
    formattedBuildTime = $derived.by(() => {
        if (!this.localBuildTime) return null;
        try {
            const d = new Date(this.localBuildTime);
            return d.toLocaleString("es-MX", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return this.localBuildTime.slice(0, 10);
        }
    });

    /** Último serverBuildTime detectado (para saber si es una versión nueva al descartar). */
    #latestServerBuildTime: string | null = null;

    private checkInterval: ReturnType<typeof setInterval> | null = null;
    private initialized = false;

    async init() {
        if (this.initialized) return;
        this.initialized = true;

        // Cargar build-time actual
        try {
            const res = await fetch("/build-info.json");
            const data = await res.json();
            this.localBuildTime = data.buildTime ?? "";
        } catch {
            // Si no existe el archivo (dev), ignorar
            this.localBuildTime = "";
        }

        // Verificar cada 2 minutos si hay versión nueva
        await this.checkForUpdate();
        this.checkInterval = setInterval(() => this.checkForUpdate(), 120_000);
    }

    async checkForUpdate() {
        if (!this.localBuildTime) {
            this.hasChecked = true;
            return;
        }

        try {
            const res = await fetch(`/build-info.json?t=${Date.now()}`);
            const data = await res.json();
            const serverBuildTime = data.buildTime ?? "";

            if (serverBuildTime && serverBuildTime !== this.localBuildTime) {
                this.isUpdateAvailable = true;
                this.#latestServerBuildTime = serverBuildTime;

                // Si el usuario había descartado una versión anterior y ahora hay
                // una versión distinta, reseteamos el descarte para que el modal
                // se muestre automáticamente de nuevo.
                if (
                    this.dismissedBuildTime &&
                    this.dismissedBuildTime !== serverBuildTime
                ) {
                    this.dismissedBuildTime = null;
                }
            }
            this.lastCheckTime = Date.now();
            this.hasChecked = true;
        } catch {
            this.hasChecked = true;
        }
    }

    /**
     * El usuario descartó la actualización actual — guardamos qué build
     * era para no volver a mostrar el modal automáticamente hasta que
     * llegue una versión distinta.
     */
    dismissUpdate() {
        // Si no hay serverBuildTime aún (no se ha completado la primera verificación),
        // simplemente ignoramos el descarte.
        if (this.#latestServerBuildTime) {
            this.dismissedBuildTime = this.#latestServerBuildTime;
        }
    }

    /**
     * Recarga la aplicación forzando la actualización desde el servidor.
     * Usa navegación con cache-busting (query param único) en lugar de
     * location.reload() para evitar que el navegador sirva la página desde
     * bfcache (back-forward cache) o que el Service Worker entregue recursos
     * cacheados de la versión anterior.
     */
    refreshPage() {
        const url = new URL(window.location.href);
        url.searchParams.set(
            '_cb',
            `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        );
        // replace en vez de href para no contaminar el historial del navegador
        window.location.replace(url.toString());
    }

    destroy() {
        if (this.checkInterval) clearInterval(this.checkInterval);
        this.initialized = false;
    }
}

export const versionState = new VersionState();
