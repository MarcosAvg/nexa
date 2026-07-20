<script lang="ts">
    import { SectionHeader, Card, BuildingCatalog, DependencyCatalog, AccessCatalog, ScheduleCatalog, UserManagementSection } from "../components";
    import { Building2, Briefcase, Key, Calendar, Users, FileDown, Settings2, RotateCcw, AlertTriangle, FileSignature } from "lucide-svelte";
    import { userState, catalogState, settingsState } from "../stores";
    import { networkStore } from "../stores/network.svelte";
    import { generateRequestTemplate, generateKoneUsageTemplate, handleError } from "../utils";
    import { toast } from "svelte-sonner";

    let activeTab = $state<"catalogos" | "usuarios" | "responsiva">("catalogos");
    let activeCatalog = $state<"edificios" | "dependencias" | "accesos" | "dias">("edificios");

    // Campos editables de configuración de responsiva
    let pickupDaysInput = $state(settingsState.responsivaPickupDays);
    let warnDaysInput = $state(settingsState.responsivaWarnDays);

    // Sincronizar inputs cuando cambia el store (ej. reset)
    $effect(() => {
        pickupDaysInput = settingsState.responsivaPickupDays;
        warnDaysInput = settingsState.responsivaWarnDays;
    });

    function handleSaveResponsivaSettings() {
        settingsState.setResponsivaPickupDays(pickupDaysInput);
        settingsState.setResponsivaWarnDays(warnDaysInput);
        toast.success("Configuración de responsiva guardada");
    }

    function handleResetResponsivaSettings() {
        settingsState.resetToDefaults();
        toast.success("Valores restablecidos");
    }

    let currentUser = $derived.by(() =>
        userState.currentUser ?? { name: "", email: "", avatar: null, role: "viewer" },
    );

    let buildings = $derived(catalogState.buildings);
    let dependencies = $derived(catalogState.dependencies);
    let specialAccesses = $derived(catalogState.specialAccesses);
    let schedules = $derived(catalogState.schedules);

    let canEdit = $derived(
        (currentUser.role === "admin" || currentUser.role === "operator") && networkStore.isOnline,
    );

    let isGeneratingTemplate = $state(false);
    let isGeneratingKoneTemplate = $state(false);

    async function handleGenerateTemplate() {
        isGeneratingTemplate = true;
        const loadingToast = toast.loading("Generando plantilla...");
        try {
            await generateRequestTemplate({ buildings: buildings as any[], dependencies: dependencies as any[], specialAccesses: specialAccesses as any[], schedules: schedules as any[] });
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
        const loadingToast = toast.loading("Generando plantilla de KONE...");
        try {
            await generateKoneUsageTemplate();
            toast.success("Plantilla generada correctamente", { id: loadingToast });
        } catch (e) {
            toast.dismiss(loadingToast);
            handleError(e, "Generar Plantilla KONE");
        } finally {
            isGeneratingKoneTemplate = false;
        }
    }

    const catalogTabs = [
        { id: "edificios", label: "Edificios", icon: Building2 },
        { id: "dependencias", label: "Dependencias", icon: Briefcase },
        { id: "accesos", label: "Accesos", icon: Key },
        { id: "dias", label: "Horarios", icon: Calendar },
    ] as const;
</script>

<div class="space-y-6">
    <SectionHeader title="Configuración del Sistema" />
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <!-- Sidebar Navigation -->
        <Card class="lg:col-span-1 p-0 overflow-hidden h-fit bg-white/50 backdrop-blur-md border border-slate-200/50 rounded-[22px] shadow-sm">
            <div class="p-6 border-b border-slate-100/60">
                <h3 class="font-extrabold text-slate-900 tracking-tight uppercase text-xs tracking-[0.1em]">Administración</h3>
                <p class="text-[11px] font-bold text-slate-400 mt-1">Configura el ecosistema Nexa</p>
            </div>
            <nav class="flex flex-col p-3 gap-1.5">
                {#each [{ id: "catalogos", label: "Catálogos", icon: Building2 }, ...(currentUser.role === "admin" ? [{ id: "usuarios", label: "Usuarios", icon: Users }] : [])] as item}
                    {@const Icon = item.icon}
                    <button
                        class="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 text-left active:scale-[0.98] {activeTab === item.id ? 'bg-slate-900 text-white shadow-lg shadow-blue-500/5' : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900'}"
                        onclick={() => (activeTab = item.id as typeof activeTab)}
                    >
                        <div class={activeTab === item.id ? "text-white" : "text-slate-400"}><Icon size={18} strokeWidth={2.5} /></div>
                        {item.label}
                    </button>
                {/each}
                <div class="my-2 border-t border-slate-100/60"></div>
                <button
                    class="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 text-left active:scale-[0.98] {activeTab === 'responsiva' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/10' : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900'}"
                    onclick={() => (activeTab = "responsiva")}
                >
                    <div class={activeTab === "responsiva" ? "text-white" : "text-indigo-500"}>
                        <FileSignature size={18} strokeWidth={2.5} />
                    </div>
                    Responsiva
                </button>
            <div class="p-4 border-t border-slate-100/60">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-3">Herramientas</p>
                <button class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                    onclick={handleGenerateTemplate} disabled={isGeneratingTemplate || !networkStore.isOnline}>
                    <FileDown size={18} strokeWidth={2.5} class="text-emerald-500" />
                    {isGeneratingTemplate ? "Generando..." : "Plantilla de Solicitudes"}
                </button>
                <button class="w-full flex items-center gap-3 px-4 py-3 mt-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-sky-50 hover:text-sky-700 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                    onclick={handleGenerateKoneTemplate} disabled={isGeneratingKoneTemplate || !networkStore.isOnline}>
                    <FileDown size={18} strokeWidth={2.5} class="text-sky-500" />
                    {isGeneratingKoneTemplate ? "Generando..." : "Plantilla de Uso KONE"}
                </button>
            </div>
        </Card>

        <!-- Content Area -->
        <div class="lg:col-span-3 space-y-6">
            {#if activeTab === "catalogos"}
                <!-- Catalog sub-tabs -->
                <div class="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-none">
                    {#each catalogTabs as item}
                        {@const Icon = item.icon}
                        <button
                            class="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-[13px] font-extrabold whitespace-nowrap transition-all duration-300 active:scale-95 {activeCatalog === item.id ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200' : 'bg-slate-100/50 text-slate-500 hover:bg-slate-100 hover:text-slate-900'}"
                            onclick={() => (activeCatalog = item.id)}
                        >
                            <Icon size={16} strokeWidth={2.5} /> {item.label}
                        </button>
                    {/each}
                </div>
                <Card class="p-8 min-h-[400px] bg-white/60 backdrop-blur-md rounded-[22px] border border-slate-200/50 shadow-sm relative overflow-hidden">
                    {#if activeCatalog === "edificios"}
                        <BuildingCatalog {canEdit} />
                    {:else if activeCatalog === "dependencias"}
                        <DependencyCatalog {canEdit} />
                    {:else if activeCatalog === "accesos"}
                        <AccessCatalog {canEdit} />
                    {:else if activeCatalog === "dias"}
                        <ScheduleCatalog {canEdit} />
                    {/if}
                </Card>
            {:else if activeTab === "usuarios"}
                <UserManagementSection />
            {:else if activeTab === "responsiva"}
                <!-- Responsiva Settings -->
                <div class="flex items-center gap-3 pb-4">
                    <div class="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-indigo-50 text-indigo-700">
                        <FileSignature size={16} strokeWidth={2.5} />
                        <span class="text-[13px] font-extrabold">Configuración de Responsiva</span>
                    </div>
                </div>
                <Card class="p-8 bg-white/60 backdrop-blur-md rounded-[22px] border border-slate-200/50 shadow-sm relative overflow-hidden">
                    <div class="max-w-xl space-y-8">
                        <!-- Descripción -->
                        <div class="flex items-start gap-4 p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100/60">
                            <div class="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                <AlertTriangle size={20} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h4 class="text-sm font-bold text-indigo-900 mb-1">Umbrales de Firma Responsiva</h4>
                                <p class="text-xs font-medium text-indigo-700/70 leading-relaxed">
                                    Estos valores determinan cuándo se muestran las etiquetas de advertencia en las tarjetas de Firma Responsiva.
                                    Afectan tanto a la vista de tickets como a la exportación a Excel.
                                </p>
                            </div>
                        </div>

                        <!-- Días para baja de registro -->
                        <div class="space-y-3">
                            <div class="flex items-center justify-between">
                                <div>
                                    <label for="pickup-days" class="text-sm font-bold text-slate-800">
                                        Días para baja de registro
                                    </label>
                                    <p class="text-[11px] font-medium text-slate-400 mt-0.5">
                                        Si el acceso no se recoge después de este plazo, se marca como "Baja de Registro" (etiqueta roja).
                                    </p>
                                </div>
                                <span class="text-xs font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg ml-4 shrink-0">
                                    {settingsState.responsivaPickupDays} días
                                </span>
                            </div>
                            <input
                                id="pickup-days"
                                type="range"
                                min="1"
                                max="90"
                                bind:value={pickupDaysInput}
                                class="w-full h-2 rounded-full appearance-none cursor-pointer accent-rose-500 bg-slate-200"
                            />
                            <div class="flex justify-between text-[10px] font-bold text-slate-400 px-1">
                                <span>1 día</span>
                                <span>90 días</span>
                            </div>
                        </div>

                        <!-- Días para advertencia -->
                        <div class="space-y-3">
                            <div class="flex items-center justify-between">
                                <div>
                                    <label for="warn-days" class="text-sm font-bold text-slate-800">
                                        Días para advertencia "Por vencer"
                                    </label>
                                    <p class="text-[11px] font-medium text-slate-400 mt-0.5">
                                        A partir de este número de días sin recoger, se muestra la etiqueta ámbar de advertencia.
                                        Debe ser menor al plazo de baja.
                                    </p>
                                </div>
                                <span class="text-xs font-black text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg ml-4 shrink-0">
                                    {settingsState.responsivaWarnDays} días
                                </span>
                            </div>
                            <input
                                id="warn-days"
                                type="range"
                                min="1"
                                max={Math.max(1, pickupDaysInput - 1)}
                                bind:value={warnDaysInput}
                                class="w-full h-2 rounded-full appearance-none cursor-pointer accent-amber-500 bg-slate-200"
                            />
                            <div class="flex justify-between text-[10px] font-bold text-slate-400 px-1">
                                <span>1 día</span>
                                <span>{Math.max(1, pickupDaysInput - 1)} días</span>
                            </div>
                        </div>

                        <!-- Vista previa de etiquetas -->
                        <div class="p-5 rounded-2xl bg-slate-50/80 border border-slate-100/60 space-y-3">
                            <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Vista previa de etiquetas
                            </h4>
                            <div class="flex flex-wrap items-center gap-3">
                                <span class="inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                    {warnDaysInput - 1} días · Pendiente
                                </span>
                                <span class="inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/60">
                                    {warnDaysInput} días · Por vencer
                                </span>
                                <span class="inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/60">
                                    {pickupDaysInput} días · Baja de Registro
                                </span>
                            </div>
                        </div>

                        <!-- Botones de acción -->
                        <div class="flex items-center gap-3 pt-2">
                            <button
                                class="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-indigo-200/50"
                                onclick={handleSaveResponsivaSettings}
                                disabled={!networkStore.isOnline}
                            >
                                <Settings2 size={16} strokeWidth={2.5} />
                                Guardar configuración
                            </button>
                            <button
                                class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-extrabold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-all duration-200 active:scale-95"
                                onclick={handleResetResponsivaSettings}
                            >
                                <RotateCcw size={16} strokeWidth={2} />
                                Restablecer
                            </button>
                        </div>
                    </div>
                </Card>
            {/if}
        </div>
    </div>
</div>
