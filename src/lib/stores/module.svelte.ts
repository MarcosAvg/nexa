import { supabase } from "../supabase";
import { BUILT_MODULES } from "../modules/generated";

/**
 * ModuleState — Estado de módulos de la plataforma (conteo de uso, registro sin
 * tarjeta, …). Combinado con la compilación por contrato (`BUILT_MODULES`):
 *
 *  - `BUILT_MODULES` (generado en prebuild desde `VITE_MODULES`) = qué módulos
 *    llegaron al bundle.
 *  - `state` (persistido en `app_settings.modules`) = qué módulos están
 *    ACTIVOS y configurables por instalación (mediaKey, umbral, etc.).
 */

export type ModuleConfig = {
    enabled?: boolean;
    mediaKey?: string;
    usageThreshold?: number;
};

export type ModuleId = (typeof BUILT_MODULES)[number];

const DEFAULTS: Record<string, ModuleConfig> = {
    conteo_uso: { mediaKey: "kone", usageThreshold: 10 },
    registro_sin_tarjeta: { mediaKey: "kone" },
};

export class ModuleState {
    state = $state<Record<string, ModuleConfig>>({});
    #loaded = false;

    /** Módulos compilados en este build. */
    get moduleIds(): string[] {
        return BUILT_MODULES;
    }

    /** ¿El módulo existe (compilado) y está activo para esta instalación? */
    isEnabled(id: string): boolean {
        if (!BUILT_MODULES.includes(id as ModuleId)) return false;
        const cfg = this.state[id];
        return cfg?.enabled !== false;
    }

    /** Config efectiva de un módulo (defaults fusionados). */
    config(id: string): ModuleConfig {
        return { ...(DEFAULTS[id] ?? {}), ...(this.state[id] ?? {}) };
    }

    async loadFromServer() {
        if (this.#loaded) return;
        try {
            const { data, error } = await supabase
                .from("app_settings")
                .select("value")
                .eq("key", "modules")
                .maybeSingle();
            if (error) throw error;
            const parsed = data?.value as Record<string, ModuleConfig> | null;
            this.state = parsed || {};
            this.#loaded = true;
        } catch {
            this.#loaded = true;
        }
    }

    /** Persiste y actualiza la config de un módulo. */
    async setConfig(id: string, patch: ModuleConfig) {
        const next = { ...(this.state[id] ?? DEFAULTS[id] ?? {}), ...patch };
        this.state = { ...this.state, [id]: next };
        const { error } = await supabase
            .from("app_settings")
            .upsert({ key: "modules", value: this.state }, { onConflict: "key" });
        if (error) throw error;
    }

    async reset() {
        this.state = {};
        const { error } = await supabase
            .from("app_settings")
            .upsert({ key: "modules", value: this.state }, { onConflict: "key" });
        if (error) throw error;
    }
}

export const moduleState = new ModuleState();
