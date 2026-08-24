<script lang="ts">
    import { SectionHeader, Card, BuildingCatalog, DependencyCatalog, AccessCatalog, MediaTypeCatalog, ScheduleCatalog, UserManagementSection, ExportDropdown, PlantillasCatalog, ModulesCatalog, Button, SectionPill } from "../components";
    import { Building2, Briefcase, Key, Calendar, Users, FileDown, Settings2, RotateCcw, AlertTriangle, FileSignature, CreditCard, FileText, Puzzle } from "lucide-svelte";
    import { userState, catalogState, settingsState, moduleState } from "../stores";
    import { networkStore } from "../stores/network.svelte";
    import { generateMediaTemplate, generateUsageTemplate, handleError, capitalize } from "../utils";
    import { toast } from "svelte-sonner";
    import GeneralSettingsView from "./GeneralSettingsView.svelte";

    let activeTab = $state<"catalogos" | "usuarios" | "general" | "plantillas" | "modulos" | "responsiva">("catalogos");
    let activeCatalog = $state<"edificios" | "dependencias" | "accesos" | "dias" | "medios">("edificios");

    // Campos editables de configuración de responsiva
    let pickupDaysInput = $state(settingsState.responsivaPickupDays);
    let warnDaysInput = $state(settingsState.responsivaWarnDays);
    let coreTypesInput = $state(settingsState.coreTypesRequired);

    // Sincronizar inputs cuando cambia el store (ej. reset)
    $effect(() => {
        pickupDaysInput = settingsState.responsivaPickupDays;
        warnDaysInput = settingsState.responsivaWarnDays;
        coreTypesInput = settingsState.coreTypesRequired;
    });

    async function handleSaveResponsivaSettings() {
        try {
            await settingsState.setResponsivaPickupDays(pickupDaysInput);
            await settingsState.setResponsivaWarnDays(warnDaysInput);
            await settingsState.setCoreTypesRequired(coreTypesInput);
            toast.success("Configuración de responsiva guardada");
        } catch {
            handleError(new Error("No se pudo guardar la configuración"), "Guardar Configuración");
        }
    }

    async function handleResetResponsivaSettings() {
        await settingsState.resetToDefaults();
        coreTypesInput = settingsState.coreTypesRequired;
        toast.success("Valores restablecidos");
    }

    let currentUser = $derived.by(() =>
        userState.currentUser ?? { name: "", email: "", avatar: null, role: "viewer" },
    );

    let buildings = $derived(catalogState.buildings);
    let dependencies = $derived(catalogState.dependencies);
    let specialAccesses = $derived(catalogState.specialAccesses);
    let schedules = $derived(catalogState.schedules);
    let mediaTypes = $derived(catalogState.mediaTypes);

    let canEdit = $derived(
        (currentUser.role === "admin" || currentUser.role === "operator") && networkStore.isOnline,
    );

    let isGeneratingTemplate = $state(false);
    let isGeneratingKoneTemplate = $state(false);

    // Medios activos seleccionados para incluir en la plantilla (por defecto: todos)
    let selectedMediaKeys = $state<string[]>([]);
    $effect(() => {
        const active = mediaTypes.filter((m) => m.active !== false).map((m) => m.key);
        if (selectedMediaKeys.length === 0 && active.length > 0) selectedMediaKeys = active;
    });

    function toggleMedia(key: string) {
        selectedMediaKeys = selectedMediaKeys.includes(key)
            ? selectedMediaKeys.filter((k) => k !== key)
            : [...selectedMediaKeys, key];
    }

    async function handleGenerateTemplate() {
        isGeneratingTemplate = true;
        const loadingToast = toast.loading("Generando plantilla...");
        try {
            const selected = mediaTypes.filter((m) => selectedMediaKeys.includes(m.key));
            await generateMediaTemplate({ buildings: buildings as any[], dependencies: dependencies as any[], specialAccesses: specialAccesses as any[], schedules: schedules as any[], mediaTypes: selected as any[] });
            toast.success("Plantilla generada correctamente", { id: loadingToast });
        } catch (e) {
            toast.dismiss(loadingToast);
            handleError(e, "Generar Plantilla de Solicitudes");
        } finally {
            isGeneratingTemplate = false;
        }
    }

    async function handleGenerateKoneTemplate() {
        isGeneratingKoneTemplate = true;
        const loadingToast = toast.loading("Generando plantilla de conteo...");
        try {
            const cfg = moduleState.config("conteo_uso");
            const label = cfg.mediaKey ? capitalize(cfg.mediaKey) : "Uso de tarjetas";
            await generateUsageTemplate(label);
            toast.success("Plantilla generada correctamente", { id: loadingToast });
        } catch (e) {
            toast.dismiss(loadingToast);
            handleError(e, "Generar Plantilla de Conteo");
        } finally {
            isGeneratingKoneTemplate = false;
        }
    }

    const catalogTabs = [
        { id: "edificios", label: "Edificios", icon: Building2 },
        { id: "dependencias", label: "Dependencias", icon: Briefcase },
        { id: "accesos", label: "Accesos", icon: Key },
        { id: "medios", label: "Medios", icon: CreditCard },
        { id: "dias", label: "Horarios", icon: Calendar },
    ] as const;
</script>

<div class="space-y-6">
    <SectionHeader title="Configuración del Sistema" />

    <div class="flex flex-col lg:flex-row gap-6 items-start">
        <!-- Sidebar Navigation (sólida y ancha en desktop, pestañas horizontales en móvil) -->
        <aside class="w-full lg:w-80 shrink-0 lg:sticky lg:top-6 bg-white border border-slate-200 rounded-3xl shadow-sm">
            <div class="px-6 py-5 border-b border-slate-100 rounded-t-3xl">
                <h3 class="font-extrabold text-slate-900 tracking-tight uppercase text-xs tracking-[0.1em]">Administración</h3>
                <p class="text-[11px] font-bold text-slate-400 mt-1">Configura el ecosistema Nexa</p>
            </div>

            <nav class="flex lg:flex-col p-3 gap-1.5 overflow-x-auto scrollbar-none">
                {#each [{ id: "catalogos", label: "Catálogos", icon: Building2 }, ...(currentUser.role === "admin" ? [{ id: "usuarios", label: "Usuarios", icon: Users }] : [])] as item}
                    {@const Icon = item.icon}
                    <button
                        class="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 text-left active:scale-[0.98] {activeTab === item.id ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}"
                        onclick={() => (activeTab = item.id as typeof activeTab)}
                    >
                        <div class={activeTab === item.id ? "text-white" : "text-slate-400"}><Icon size={18} strokeWidth={2.5} /></div>
                        {item.label}
                    </button>
                {/each}
                <button
                    class="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 text-left active:scale-[0.98] {activeTab === 'general' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}"
                    onclick={() => (activeTab = "general")}
                >
                    <div class={activeTab === "general" ? "text-white" : "text-slate-400"}><Settings2 size={18} strokeWidth={2.5} /></div>
                    General
                </button>
                <button
                    class="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 text-left active:scale-[0.98] {activeTab === 'plantillas' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}"
                    onclick={() => (activeTab = "plantillas")}
                >
                    <div class={activeTab === "plantillas" ? "text-white" : "text-slate-400"}><FileText size={18} strokeWidth={2.5} /></div>
                    Plantillas
                </button>
                <button
                    class="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 text-left active:scale-[0.98] {activeTab === 'modulos' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}"
                    onclick={() => (activeTab = "modulos")}
                >
                    <div class={activeTab === "modulos" ? "text-white" : "text-slate-400"}><Puzzle size={18} strokeWidth={2.5} /></div>
                    Módulos
                </button>
                <button
                    class="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 text-left active:scale-[0.98] {activeTab === 'responsiva' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}"
                    onclick={() => (activeTab = "responsiva")}
                >
                    <div class={activeTab === "responsiva" ? "text-white" : "text-indigo-500"}>
                        <FileSignature size={18} strokeWidth={2.5} />
                    </div>
                    Responsiva
                </button>
            </nav>

            <div class="px-4 py-4 border-t border-slate-100">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-3">Herramientas</p>
                <ExportDropdown
                    icon={FileDown}
                    label={isGeneratingTemplate ? "Generando..." : "Plantilla de Solicitudes"}
                    disabled={isGeneratingTemplate || !networkStore.isOnline}
                    menuWidth="w-80"
                >
                    {#snippet items()}
                        <div class="p-3 space-y-1">
                            <p class="px-1 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Medios a incluir
                            </p>
                            {#each mediaTypes.filter((m) => m.active !== false) as m}
                                <label class="flex items-center gap-2.5 px-1 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-sm font-semibold text-slate-700">
                                    <input
                                        type="checkbox"
                                        class="accent-emerald-600 w-4 h-4"
                                        checked={selectedMediaKeys.includes(m.key)}
                                        onchange={() => toggleMedia(m.key)}
                                    />
                                    <span>{m.name || m.key}</span>
                                </label>
                            {/each}
                            {#if mediaTypes.filter((m) => m.active !== false).length === 0}
                                <p class="px-1 py-2 text-xs text-slate-400">No hay medios configurados.</p>
                            {/if}
                            <button
                                class="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                                onclick={handleGenerateTemplate}
                                disabled={isGeneratingTemplate || selectedMediaKeys.length === 0}
                            >
                                <FileDown size={16} />
                                Descargar plantilla
                            </button>
                        </div>
                    {/snippet}
                </ExportDropdown>
                {#if moduleState.isEnabled("conteo_uso")}
                    <button
                        class="w-full flex items-center gap-3 px-4 py-3 mt-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-sky-50 hover:text-sky-700 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                        onclick={handleGenerateKoneTemplate}
                        disabled={isGeneratingKoneTemplate || !networkStore.isOnline}
                    >
                        <FileDown size={18} strokeWidth={2.5} class="text-sky-500" />
                        {isGeneratingKoneTemplate ? "Generando..." : "Plantilla de Conteo de Uso"}
                    </button>
                {/if}
            </div>
        </aside>

        <!-- Content Area -->
        <div class="flex-1 min-w-0 space-y-6">
            {#if activeTab === "catalogos"}
                <!-- Catalog sub-tabs -->
                <div class="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
                    {#each catalogTabs as item}
                        {@const Icon = item.icon}
                        <button
                            class="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-[13px] font-extrabold whitespace-nowrap transition-all duration-200 active:scale-95 {activeCatalog === item.id ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800'}"
                            onclick={() => (activeCatalog = item.id)}
                        >
                            <Icon size={16} strokeWidth={2.5} /> {item.label}
                        </button>
                    {/each}
                </div>

                {#if activeCatalog === "edificios"}
                    <BuildingCatalog {canEdit} />
                {:else if activeCatalog === "dependencias"}
                    <DependencyCatalog {canEdit} />
                {:else if activeCatalog === "accesos"}
                    <AccessCatalog {canEdit} />
                {:else if activeCatalog === "medios"}
                    <MediaTypeCatalog {canEdit} />
                {:else if activeCatalog === "dias"}
                    <ScheduleCatalog {canEdit} />
                {/if}
            {:else if activeTab === "usuarios"}
                <UserManagementSection />
            {:else if activeTab === "general"}
                <GeneralSettingsView />
            {:else if activeTab === "plantillas"}
                <PlantillasCatalog />
            {:else if activeTab === "modulos"}
                <ModulesCatalog />
            {:else if activeTab === "responsiva"}
                <!-- Responsiva Settings -->
                <div class="flex items-center gap-3 pb-4">
                    <SectionPill
                        icon={FileSignature}
                        label="Configuración de Responsiva"
                        className="bg-slate-100 text-slate-700"
                    />
                </div>
                <Card class="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden max-w-2xl">
                    <div class="max-w-xl space-y-8">
                        <!-- Descripción -->
                        <div class="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                                <AlertTriangle size={20} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h4 class="text-sm font-bold text-slate-800 mb-1">Umbrales de Firma Responsiva</h4>
                                <p class="text-xs font-medium text-slate-500 leading-relaxed">
                                    Estos valores determinan cuándo se muestran las etiquetas de advertencia en las tarjetas de Firma Responsiva.
                                    Afectan tanto a la vista de tickets como a la exportación a Excel.
                                </p>
                            </div>
                        </div>

                        <!-- Ajuste: Días para baja de registro -->
                        <div class="space-y-2">
                            <div class="flex items-center justify-between gap-4">
                                <label for="pickup-days" class="text-sm font-bold text-slate-800">
                                    Días para baja de registro
                                </label>
                                <span class="inline-flex items-center gap-1 text-xs font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg shrink-0">
                                    {settingsState.responsivaPickupDays} días
                                </span>
                            </div>
                            <p class="text-[11px] font-medium text-slate-400">
                                Si el acceso no se recoge después de este plazo, se marca como "Baja de Registro" (etiqueta roja).
                            </p>
                            <input
                                id="pickup-days"
                                type="range"
                                min="1"
                                max="90"
                                bind:value={pickupDaysInput}
                                class="w-full h-2 rounded-full appearance-none cursor-pointer accent-blue-600 bg-slate-200"
                            />
                            <div class="flex justify-between text-[10px] font-bold text-slate-400 px-1">
                                <span>1 día</span>
                                <span>90 días</span>
                            </div>
                        </div>

                        <!-- Ajuste: Días para advertencia "Por vencer" -->
                        <div class="space-y-2">
                            <div class="flex items-center justify-between gap-4">
                                <label for="warn-days" class="text-sm font-bold text-slate-800">
                                    Días para advertencia "Por vencer"
                                </label>
                                <span class="inline-flex items-center gap-1 text-xs font-black text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg shrink-0">
                                    {settingsState.responsivaWarnDays} días
                                </span>
                            </div>
                            <p class="text-[11px] font-medium text-slate-400">
                                A partir de este número de días sin recoger, se muestra la etiqueta ámbar. Debe ser menor al plazo de baja.
                            </p>
                            <input
                                id="warn-days"
                                type="range"
                                min="1"
                                max={Math.max(1, pickupDaysInput - 1)}
                                bind:value={warnDaysInput}
                                class="w-full h-2 rounded-full appearance-none cursor-pointer accent-blue-600 bg-slate-200"
                            />
                            <div class="flex justify-between text-[10px] font-bold text-slate-400 px-1">
                                <span>1 día</span>
                                <span>{Math.max(1, pickupDaysInput - 1)} días</span>
                            </div>
                        </div>

                        <!-- Vista previa de etiquetas -->
                        <div class="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                            <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Vista previa de etiquetas
                            </h4>
                            <div class="flex flex-wrap items-center gap-3">
                                <!-- Semáforo por días restantes: verde (recién creado) → ámbar (por vencer) → rojo (vencido) -->
                                <span class="inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                    Restan {pickupDaysInput} días · Pendiente
                                </span>
                                <span class="inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/60">
                                    Restan {Math.max(1, pickupDaysInput - warnDaysInput)} días · Por vencer
                                </span>
                                <span class="inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/60">
                                    Plazo vencido · Baja de Registro
                                </span>
                            </div>
                        </div>

                        <!-- Umbral de tipos core para estado Activo -->
                        <div class="pt-3 border-t border-slate-100 space-y-2">
                            <div class="flex items-center justify-between gap-4">
                                <label for="core-types-required" class="text-sm font-bold text-slate-800">
                                    Tipos de acceso requeridos para "Activo/a"
                                </label>
                            </div>
                            <p class="text-[11px] text-slate-400">
                                Cantidad de medios con pisos listos (programados y firmados) que una persona necesita.
                                Aplica al listado, dashboard e historial tras recargar.
                            </p>
                            <input
                                id="core-types-required"
                                type="number"
                                min="1"
                                max="10"
                                bind:value={coreTypesInput}
                                class="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm tabular-nums focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        <!-- Botones de acción -->
                        <div class="flex items-center gap-3 pt-2">
                            <Button
                                variant="indigo"
                                class="flex items-center gap-2 px-6 py-2.5 rounded-xl"
                                onclick={handleSaveResponsivaSettings}
                                disabled={!networkStore.isOnline}
                            >
                                <Settings2 size={16} strokeWidth={2.5} />
                                Guardar configuración
                            </Button>
                            <Button
                                variant="secondary"
                                class="flex items-center gap-2 px-5 py-2.5 rounded-xl"
                                onclick={handleResetResponsivaSettings}
                            >
                                <RotateCcw size={16} strokeWidth={2} />
                                Restablecer
                            </Button>
                        </div>
                    </div>
                </Card>
            {/if}
        </div>
    </div>
</div>
