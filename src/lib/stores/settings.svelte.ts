import { supabase } from "../supabase";

/**
 * SettingsState — Configuración persistente del sistema en `app_settings`.
 * Los valores se cargan de la BD al iniciar y los setters persisten ahí,
 * de modo que la configuración es compartida por todos los usuarios.
 */
export class SettingsState {
    responsivaPickupDays = $state(7);
    responsivaWarnDays = $state(5);
    /** Número de medios "core" (con pisos) requeridos para estado Activo. */
    coreTypesRequired = $state(2);

    #loaded = false;

    /** Carga los settings desde la BD (idempotente). */
    async loadFromServer() {
        if (this.#loaded) return;
        try {
            const { data, error } = await supabase
                .from("app_settings")
                .select("key, value");
            if (error) throw error;
            for (const row of data || []) {
                this.#apply(row.key, row.value);
            }
            this.#loaded = true;
        } catch {
            // No crítico: se mantienen los valores por defecto
        }
    }

    #apply(key: string, value: unknown) {
        if (typeof value !== "number") return;
        if (key === "responsivaPickupDays") this.responsivaPickupDays = value;
        else if (key === "responsivaWarnDays") this.responsivaWarnDays = value;
        else if (key === "coreTypesRequired") this.coreTypesRequired = Math.max(1, value);
    }

    async #persist(key: string, value: number) {
        const { error } = await supabase
            .from("app_settings")
            .upsert({ key, value }, { onConflict: "key" });
        if (error) throw error;
    }

    /** Actualizar el umbral de días para baja de registro (plazo recogida). */
    async setResponsivaPickupDays(days: number) {
        const clamped = Math.max(1, Math.min(90, Math.round(days)));
        if (clamped !== this.responsivaPickupDays) {
            this.responsivaPickupDays = clamped;
            await this.#persist("responsivaPickupDays", clamped);
        }
    }

    /** Actualizar el umbral de días para advertencia "Por vencer". */
    async setResponsivaWarnDays(days: number) {
        const clamped = Math.max(1, Math.min(this.responsivaPickupDays - 1, 90, Math.round(days)));
        if (clamped !== this.responsivaWarnDays) {
            this.responsivaWarnDays = clamped;
            await this.#persist("responsivaWarnDays", clamped);
        }
    }

    /** Restablecer valores por defecto y persistir. */
    async resetToDefaults() {
        this.responsivaPickupDays = 7;
        this.responsivaWarnDays = 5;
        this.coreTypesRequired = 2;
        try {
            await Promise.all([
                this.#persist("responsivaPickupDays", 7),
                this.#persist("responsivaWarnDays", 5),
                this.#persist("coreTypesRequired", 2),
            ]);
        } catch {
            // No crítico
        }
    }

    /** Actualizar el umbral de tipos "core" para estado Activo/a. */
    async setCoreTypesRequired(n: number) {
        const clamped = Math.max(1, Math.min(10, Math.round(n)));
        if (clamped !== this.coreTypesRequired) {
            this.coreTypesRequired = clamped;
            await this.#persist("coreTypesRequired", clamped);
        }
    }
}

export const settingsState = new SettingsState();