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
            }
            this.lastCheckTime = Date.now();
            this.hasChecked = true;
        } catch {
            this.hasChecked = true;
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
