/**
 * SettingsState — Configuración persistente del sistema.
 * Los valores se almacenan en localStorage y se cargan al iniciar.
 */
export class SettingsState {
    #STORAGE_KEY = "nexa_settings";

    responsivaPickupDays = $state(7);
    responsivaWarnDays = $state(5);

    constructor() {
        this.#load();
    }

    /** Cargar configuración desde localStorage. */
    #load() {
        try {
            const raw = localStorage.getItem(this.#STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                if (typeof data.responsivaPickupDays === "number") {
                    this.responsivaPickupDays = data.responsivaPickupDays;
                }
                if (typeof data.responsivaWarnDays === "number") {
                    this.responsivaWarnDays = data.responsivaWarnDays;
                }
            }
        } catch {
            // Ignorar errores de parseo
        }
    }

    /** Persistir configuración actual en localStorage. */
    #save() {
        try {
            localStorage.setItem(
                this.#STORAGE_KEY,
                JSON.stringify({
                    responsivaPickupDays: this.responsivaPickupDays,
                    responsivaWarnDays: this.responsivaWarnDays,
                }),
            );
        } catch {
            // localStorage puede fallar (ej. modo privado)
        }
    }

    /** Actualizar el umbral de días para baja de registro (plazo recogida). */
    setResponsivaPickupDays(days: number) {
        const clamped = Math.max(1, Math.min(90, Math.round(days)));
        if (clamped !== this.responsivaPickupDays) {
            this.responsivaPickupDays = clamped;
            this.#save();
        }
    }

    /** Actualizar el umbral de días para advertencia "Por vencer". */
    setResponsivaWarnDays(days: number) {
        const clamped = Math.max(1, Math.min(this.responsivaPickupDays - 1, 90, Math.round(days)));
        if (clamped !== this.responsivaWarnDays) {
            this.responsivaWarnDays = clamped;
            this.#save();
        }
    }

    /** Restablecer valores por defecto. */
    resetToDefaults() {
        this.responsivaPickupDays = 7;
        this.responsivaWarnDays = 5;
        this.#save();
    }
}

export const settingsState = new SettingsState();
