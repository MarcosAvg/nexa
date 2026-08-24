<script lang="ts">
    import { toast } from "svelte-sonner";
    import { moduleState } from "../../stores";
    import { catalogState } from "../../stores";
    import { MODULE_DEFINITIONS, moduleDef, type ModuleDef } from "../../modules/definitions";
    import Button from "../Button.svelte";
    import Card from "../Card.svelte";
    import Badge from "../Badge.svelte";
    import { BarChart3, ClipboardX, Power, RotateCcw } from "lucide-svelte";
    import { onMount } from "svelte";

    let mediaTypes = $derived(catalogState.mediaTypes);

    /** Módulos compilados en este build. */
    let compiledIds = $state<string[]>([]);
    /** Config por módulo (editable en caliente). */
    let configs = $state<Record<string, any>>({});

    $effect(() => {
        compiledIds = moduleState.moduleIds;
        configs = moduleState.state;
    });

    async function toggle(id: string, enabled: boolean) {
        try {
            await moduleState.setConfig(id, { enabled });
            configs = moduleState.state;
        } catch (e: any) {
            toast.error(e?.message || "No se pudo actualizar el módulo");
        }
    }

    async function saveField(id: string, key: string, value: any) {
        try {
            await moduleState.setConfig(id, { [key]: value });
            configs = moduleState.state;
            toast.success("Configuración guardada");
        } catch (e: any) {
            toast.error(e?.message || "No se pudo guardar");
        }
    }

    async function resetModules() {
        try {
            await moduleState.reset();
            configs = moduleState.state;
            toast.success("Módulos restablecidos");
        } catch (e: any) {
            toast.error(e?.message || "No se pudo restablecer");
        }
    }

    function fieldsFor(def: ModuleDef, id: string) {
        return def.fields.map((f) => {
            const cfg = configs[id] ?? {};
            const value = cfg[f.key] ?? f.default;
            return { ...f, value };
        });
    }
</script>

<div>
    <div class="flex justify-between items-center mb-8">
        <div>
            <h3 class="text-xl font-black text-slate-900 tracking-tight">Módulos</h3>
            <p class="text-sm font-medium text-slate-500 mt-0.5">Activa y configura los flujos de la plataforma por medio de acceso</p>
        </div>
        <Button variant="secondary" size="sm" onclick={resetModules}>
            <RotateCcw size={16} strokeWidth={2} class="mr-1.5" /> Restablecer
        </Button>
    </div>

    <div class="space-y-4">
        {#each MODULE_DEFINITIONS as def}
            {@const id = def.id}
            {@const cfg = configs[id] ?? {}}
            {@const enabled = cfg.enabled !== false && moduleState.isEnabled(id)}
            <Card class="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex items-start gap-3">
                        <div class="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                            {#if def.id === "conteo_uso"}
                                <BarChart3 size={20} class="text-slate-600" />
                            {:else if def.id === "registro_sin_tarjeta"}
                                <ClipboardX size={20} class="text-slate-600" />
                            {:else}
                                <Power size={20} class="text-slate-600" />
                            {/if}
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h4 class="text-sm font-extrabold text-slate-900">{def.title}</h4>
                                <Badge variant={enabled ? "emerald" : "slate"}>
                                    {enabled ? "Activo" : "Inactivo"}
                                </Badge>
                            </div>
                            <p class="text-xs font-medium text-slate-500 mt-1 leading-relaxed">{def.description}</p>
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
                                {def.kind === "route" ? "Vista" : "Integración"} · {def.path || "—"}
                            </p>
                        </div>
                    </div>
                    <label class="flex items-center gap-2 cursor-pointer shrink-0">
                        <input
                            type="checkbox"
                            class="w-5 h-5 accent-emerald-600"
                            checked={enabled}
                            onchange={(e) => toggle(id, (e.currentTarget as HTMLInputElement).checked)}
                        />
                        <span class="text-sm font-bold text-slate-700">Activo</span>
                    </label>
                </div>

                {#if enabled}
                    <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                        {#each fieldsFor(def, id) as field}
                            <div>
                                <p class="block text-xs font-bold text-slate-600 mb-1">{field.label}</p>
                                {#if field.type === "media-select"}                                    <select
                                        class="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                                        value={field.value || ""}
                                        onchange={(e) => saveField(id, field.key, (e.currentTarget as HTMLSelectElement).value)}
                                    >
                                        <option value="">Selecciona un medio</option>
                                        {#each mediaTypes as m}
                                            <option value={m.key}>{m.name}</option>
                                        {/each}
                                    </select>
                                {:else if field.type === "number"}
                                    <input
                                        type="number"
                                        min="0"
                                        class="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                                        value={field.value ?? field.default ?? 0}
                                        onchange={(e) => saveField(id, field.key, Number((e.currentTarget as HTMLInputElement).value))}
                                    />
                                {:else if field.type === "boolean"}
                                    <input
                                        type="checkbox"
                                        class="w-5 h-5 accent-emerald-600"
                                        checked={field.value === true || field.value === "true"}
                                        onchange={(e) => saveField(id, field.key, (e.currentTarget as HTMLInputElement).checked)}
                                    />
                                {:else}
                                    <input
                                        type="text"
                                        class="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                                        value={field.value ?? ""}
                                        onchange={(e) => saveField(id, field.key, (e.currentTarget as HTMLInputElement).value)}
                                    />
                                {/if}
                                {#if field.help}
                                    <p class="text-[10px] text-slate-400 mt-1">{field.help}</p>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </Card>
        {:else}
            <div class="p-10 text-center">
                <Power size={32} class="mx-auto text-slate-300 mb-2" />
                <p class="text-sm font-semibold text-slate-500">No hay módulos definidos.</p>
            </div>
        {/each}
    </div>
</div>
