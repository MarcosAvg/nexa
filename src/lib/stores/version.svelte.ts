/**
 * VersionState — Detecta si hay una nueva versión disponible
 * comparando el build-time local con el servidor periódicamente.
 */
export class VersionState {
    localBuildTime = $state<string>("");
    isUpdateAvailable = $state(false);
    lastCheckTime = $state<number>(0);

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
        if (!this.localBuildTime) return;

        try {
            const res = await fetch(`/build-info.json?t=${Date.now()}`);
            const data = await res.json();
            const serverBuildTime = data.buildTime ?? "";

            if (serverBuildTime && serverBuildTime !== this.localBuildTime) {
                this.isUpdateAvailable = true;
            }
            this.lastCheckTime = Date.now();
        } catch {
            // Error de red, ignorar
        }
    }

    refreshPage() {
        window.location.reload();
    }

    destroy() {
        if (this.checkInterval) clearInterval(this.checkInterval);
        this.initialized = false;
    }
}

export const versionState = new VersionState();
