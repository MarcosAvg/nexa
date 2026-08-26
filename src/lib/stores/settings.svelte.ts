import { supabase } from "../supabase";

/**
 * SettingsState — Configuración persistente del sistema en `app_settings`.
 * Los valores se cargan de la BD al iniciar y los setters persisten ahí,
 * de modo que la configuración es compartida por todos los usuarios.
 */
export class SettingsState {
    // ─── Umbrales de responsiva ──────────────────────────────
    responsivaPickupDays = $state(7);
    responsivaWarnDays = $state(5);
    /** Número de medios "core" (con pisos) requeridos para estado Activo. */
    coreTypesRequired = $state(2);

    // ─── Identidad / datos de la organización ────────────────
    // Valores por defecto genéricos; se configuran por instalación en `app_settings`.
    /** Nombre mostrado del sistema (branding en exports). */
    orgName = $state("Nexa");
    /** Correo de contacto/soporte (hoja INSTRUCCIONES de la plantilla). */
    orgSupportEmail = $state("soporte@example.com");
    /** Extensión del área de soporte. */
    orgSupportExtension = $state("000");
    /** Monto de reposición formateado (texto legal). */
    replacementCost = $state("");

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
        if (key === "responsivaPickupDays" && typeof value === "number") this.responsivaPickupDays = value;
        else if (key === "responsivaWarnDays" && typeof value === "number") this.responsivaWarnDays = value;
        else if (key === "coreTypesRequired" && typeof value === "number") this.coreTypesRequired = Math.max(1, value);
        else if (key === "orgName" && typeof value === "string") this.orgName = value;
        else if (key === "orgSupportEmail" && typeof value === "string") this.orgSupportEmail = value;
        else if (key === "orgSupportExtension" && typeof value === "string") this.orgSupportExtension = value;
        else if (key === "replacementCost" && typeof value === "string") this.replacementCost = value;
    }

    /** Persiste cualquier valor (número o string) como JSON. */
    async #persistValue(key: string, value: string | number) {
        const { error } = await supabase
            .from("app_settings")
            .upsert({ key, value }, { onConflict: "key" });
        if (error) throw error;
    }

    async #persist(key: string, value: number) {
        await this.#persistValue(key, value);
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

    async setCoreTypesRequired(n: number) {
        const clamped = Math.max(1, Math.min(10, Math.round(n)));
        if (clamped !== this.coreTypesRequired) {
            this.coreTypesRequired = clamped;
            await this.#persist("coreTypesRequired", clamped);
        }
    }

    // ─── Organización ─────────────────────────────────────────

    /** Persiste los datos de organización en bloque. */
    async setOrganization(cfg: {
        orgName: string;
        orgSupportEmail: string;
        orgSupportExtension: string;
        replacementCost: string;
    }) {
        this.orgName = cfg.orgName.trim() || this.orgName;
        this.orgSupportEmail = cfg.orgSupportEmail.trim();
        this.orgSupportExtension = cfg.orgSupportExtension.trim();
        this.replacementCost = cfg.replacementCost.trim();
        await Promise.all([
            this.#persistValue("orgName", this.orgName),
            this.#persistValue("orgSupportEmail", this.orgSupportEmail),
            this.#persistValue("orgSupportExtension", this.orgSupportExtension),
            this.#persistValue("replacementCost", this.replacementCost),
        ]);
    }

    /** Restablecer valores por defecto y persistir. */
    async resetToDefaults() {
        this.responsivaPickupDays = 7;
        this.responsivaWarnDays = 5;
        this.coreTypesRequired = 2;
        this.orgName = "Nexa";
        this.orgSupportEmail = "soporte@example.com";
        this.orgSupportExtension = "000";
        this.replacementCost = "";
        try {
            await Promise.all([
                this.#persist("responsivaPickupDays", 7),
                this.#persist("responsivaWarnDays", 5),
                this.#persist("coreTypesRequired", 2),
                this.#persistValue("orgName", this.orgName),
                this.#persistValue("orgSupportEmail", this.orgSupportEmail),
                this.#persistValue("orgSupportExtension", this.orgSupportExtension),
                this.#persistValue("replacementCost", this.replacementCost),
            ]);
        } catch {
            // No crítico
        }
    }
}

export const settingsState = new SettingsState();
