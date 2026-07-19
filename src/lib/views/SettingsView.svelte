<script lang="ts">
    import { SectionHeader, Card, BuildingCatalog, DependencyCatalog, AccessCatalog, ScheduleCatalog, UserManagementSection } from "../components";
    import { Building2, Briefcase, Key, Calendar, Users, FileDown } from "lucide-svelte";
    import { userState, catalogState } from "../stores";
    import { networkStore } from "../stores/network.svelte";
    import { generateRequestTemplate, generateKoneUsageTemplate, handleError } from "../utils";
    import { toast } from "svelte-sonner";

    let activeTab = $state<"catalogos" | "usuarios">("catalogos");
    let activeCatalog = $state<"edificios" | "dependencias" | "accesos" | "dias">("edificios");

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
            </nav>
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
            {/if}
        </div>
    </div>
</div>
