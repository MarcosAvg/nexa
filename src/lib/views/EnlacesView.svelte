<script lang="ts">
    import { onMount } from "svelte";
    import { enlaceService } from "../services/enlaces";
    import type { Enlace } from "../types";
    import SectionHeader from "../components/SectionHeader.svelte";
    import FloatingActionButton from "../components/FloatingActionButton.svelte";
    import PermissionGuard from "../components/PermissionGuard.svelte";
    import AddEnlaceModal from "../components/modals/AddEnlaceModal.svelte";
    import EditEnlaceModal from "../components/modals/EditEnlaceModal.svelte";
    import ConfirmationModal from "../components/modals/ConfirmationModal.svelte";
    import DataTable from "../components/DataTable.svelte";
    import { catalogState } from "../stores";
    import {
        Trash2,
        Search,
        Contact,
        UserPlus,
        Edit,
        Copy,
        Mail,
        Send,
    } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import Input from "../components/Input.svelte";
    import Select from "../components/Select.svelte";

    let enlaces = $state<Enlace[]>([]);
    let isLoading = $state(true);
    let isAddModalOpen = $state(false);
    let searchQuery = $state("");
    let filterDependency = $state("");
    let filterFloor = $state("");

    let isConfirmOpen = $state(false);
    let selectedEnlace = $state<Enlace | null>(null);

    let isEditOpen = $state(false);
    let selectedEnlaceForEdit = $state<Enlace | null>(null);

    let dependencies = $derived(catalogState.dependencies);

    let availableFloors = $derived.by(() => {
        const floors = new Set(enlaces.map(e => e.personnel?.floor).filter(Boolean).filter(f => f !== "N/A"));
        return Array.from(floors).sort((a, b) => (a as string).localeCompare(b as string, undefined, { numeric: true, sensitivity: 'base' }));
    });

    async function loadData() {
        isLoading = true;
        try {
            enlaces = await enlaceService.fetchAll();
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        loadData();
    });

    let filteredEnlaces = $derived.by(() => {
        let list = enlaces.map((e) => {
            const depId = (e.personnel as any)?.dependency_id;
            const dep = dependencies.find((d) => d.id === depId);
            const dependencyName = dep ? dep.name : "N/A";

            return {
                ...e,
                name: `${e.personnel?.first_name || ""} ${e.personnel?.last_name || ""}`.trim() || "Desconocido",
                dependency: dependencyName,
                floor: e.personnel?.floor || "N/A",
                email: e.personnel?.email || "N/A",
            };
        });

        if (searchQuery.trim()) {
            const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
            list = list.filter((e) => {
                const name = e.name.toLowerCase();
                const email = e.email.toLowerCase();
                const ext = (e.extension || "").toLowerCase();
                const depName = e.dependency.toLowerCase();
                return terms.every((term) =>
                    name.includes(term) ||
                    email.includes(term) ||
                    ext.includes(term) ||
                    depName.includes(term)
                );
            });
        }

        if (filterDependency) {
            list = list.filter((e) => e.dependency === filterDependency);
        }

        if (filterFloor) {
            list = list.filter((e) => e.floor === filterFloor);
        }

        // Orden por defecto: "Piso base"
        list.sort((a, b) => {
            const aVal = a.floor;
            const bVal = b.floor;
            if (aVal === "N/A" && bVal !== "N/A") return 1;
            if (bVal === "N/A" && aVal !== "N/A") return -1;
            return aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
        });

        return list;
    });

    const columns = [
        {
            key: "name",
            label: "Nombre completo",
            render: renderName,
            sortable: true,
        },
        {
            key: "dependency",
            label: "Dependencia",
            render: renderDependency,
            sortable: true,
        },
        {
            key: "floor",
            label: "Piso base",
            render: renderFloor,
            sortable: true,
        },
        {
            key: "email",
            label: "Correo",
            render: renderEmail,
            sortable: true,
        },
        {
            key: "extension",
            label: "Extensión",
            render: renderExtension,
            sortable: true,
        },
    ];

    function requestRemove(enlace: Enlace) {
        selectedEnlace = enlace;
        isConfirmOpen = true;
    }

    async function handleRemoveConfirm() {
        if (!selectedEnlace) return;
        try {
            await enlaceService.remove(
                selectedEnlace.id,
                `${selectedEnlace.personnel?.first_name} ${selectedEnlace.personnel?.last_name}`,
            );
            toast.success("Enlace removido");
            loadData();
        } catch (error) {
            toast.error("Error al remover enlace");
        } finally {
            isConfirmOpen = false;
            selectedEnlace = null;
        }
    }

    function requestEdit(row: Enlace) {
        selectedEnlaceForEdit = row;
        isEditOpen = true;
    }

    async function copyEmail(email: string) {
        if (!email || email === "N/A") return;
        try {
            await navigator.clipboard.writeText(email);
            toast.success("Correo copiado al portapapeles");
        } catch {
            toast.error("Error al copiar el correo");
        }
    }

    function sendEmail(email: string) {
        if (!email || email === "N/A") return;
        window.location.href = `mailto:${email}`;
    }

    function broadcastEmail() {
        const emails = filteredEnlaces
            .map((e) => e.personnel?.email)
            .filter((email) => email && email.trim() !== "" && email !== "N/A");

        if (emails.length === 0) {
            toast.error("No hay correos disponibles en esta lista.");
            return;
        }
        window.location.href = `mailto:?bcc=${emails.join(",")}`;
    }
</script>

{#snippet renderName(row: Enlace)}
    <span
        >{`${row.personnel?.first_name || ""} ${row.personnel?.last_name || ""}`.trim() ||
            "Desconocido"}</span
    >
{/snippet}

{#snippet renderDependency(row: Enlace)}
    <span
        >{(() => {
            const depId = (row.personnel as any)?.dependency_id;
            const dep = dependencies.find((d) => d.id === depId);
            return dep ? dep.name : "N/A";
        })()}</span
    >
{/snippet}

{#snippet renderFloor(row: Enlace)}
    <span>{row.personnel?.floor || "N/A"}</span>
{/snippet}

{#snippet renderEmail(row: Enlace)}
    <span>{row.personnel?.email || "N/A"}</span>
{/snippet}

{#snippet renderExtension(row: Enlace)}
    <span>{row.extension || "N/A"}</span>
{/snippet}

<div class="space-y-6">
    <SectionHeader title="Directorio de Enlaces">
        {#snippet filters()}
            <div class="flex flex-col xl:flex-row gap-3 w-full flex-wrap xl:flex-nowrap items-end">
                <div class="flex-1 min-w-[200px] w-full sm:max-w-xs flex flex-col gap-1.5">
                    <label for="enlaces-search" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Buscar Enlace</label>
                    <div class="relative w-full">
                        <Search
                            class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size={16}
                        />
                        <Input
                            id="enlaces-search"
                            placeholder="Nombre, dependencia, correo o ext..."
                            class="pl-10 h-9 text-xs font-bold w-full"
                            bind:value={searchQuery}
                        />
                    </div>
                </div>
                <div class="flex flex-wrap gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label for="filter-dependency" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dependencia</label>
                        <Select id="filter-dependency" bind:value={filterDependency} placeholder="Todas" class="w-full sm:w-auto min-w-[160px] h-9 text-xs font-bold">
                            {#each dependencies as dep}
                                <option value={dep.name}>{dep.name}</option>
                            {/each}
                        </Select>
                    </div>
                    
                    <div class="flex flex-col gap-1.5">
                        <label for="filter-floor" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Piso Base</label>
                        <Select id="filter-floor" bind:value={filterFloor} placeholder="Todos" class="w-full sm:w-auto min-w-[120px] h-9 text-xs font-bold">
                            {#each availableFloors as floor}
                                <option value={floor}>{floor}</option>
                            {/each}
                        </Select>
                    </div>
                </div>
            </div>
        {/snippet}
        {#snippet actions()}
            <PermissionGuard requireEdit>
                {#snippet children({ disabled })}
                    <div
                        class="w-full xl:w-auto mt-4 xl:mt-0 flex gap-2 justify-end"
                    >
                        <button
                            type="button"
                            class="flex items-center justify-center gap-2 h-10 px-4 bg-white text-slate-700 border border-slate-200 font-bold rounded-xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                            onclick={broadcastEmail}
                        >
                            <Send size={16} class="text-slate-400" />
                            Difusión
                        </button>
                        <button
                            type="button"
                            class="flex items-center justify-center gap-2 h-10 px-6 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/10"
                            onclick={() => (isAddModalOpen = true)}
                            {disabled}
                        >
                            <Contact size={18} />
                            Asignar Enlace
                        </button>
                    </div>
                {/snippet}
            </PermissionGuard>
        {/snippet}
    </SectionHeader>

    {#if isLoading}
        <div class="flex justify-center p-12">
            <div
                class="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"
            ></div>
        </div>
    {:else if enlaces.length === 0}
        <div
            class="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-200 border-dashed"
        >
            No hay enlaces administrativos asignados.
        </div>
    {:else}
        <DataTable data={filteredEnlaces} {columns}>
            {#snippet actions(row: Enlace)}
                <div class="flex items-center gap-1 justify-end">
                    {#if row.personnel?.email && row.personnel?.email !== "N/A"}
                        <button
                            type="button"
                            class="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                            onclick={() => copyEmail(row.personnel!.email!)}
                            title="Copiar Correo"
                        >
                            <Copy size={16} />
                        </button>
                        <button
                            type="button"
                            class="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                            onclick={() => sendEmail(row.personnel!.email!)}
                            title="Enviar Correo"
                        >
                            <Mail size={16} />
                        </button>
                    {/if}
                    <PermissionGuard requireEdit>
                        {#snippet children({ disabled })}
                            <button
                                type="button"
                                class="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                                onclick={() => requestEdit(row)}
                                title="Editar Extensión"
                                {disabled}
                            >
                                <Edit size={16} />
                            </button>
                            <button
                                type="button"
                                class="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                                onclick={() => requestRemove(row)}
                                title="Remover"
                                {disabled}
                            >
                                <Trash2 size={16} />
                            </button>
                        {/snippet}
                    </PermissionGuard>
                </div>
            {/snippet}
        </DataTable>
    {/if}
</div>

<AddEnlaceModal bind:isOpen={isAddModalOpen} onComplete={loadData} />
<EditEnlaceModal
    bind:isOpen={isEditOpen}
    enlace={selectedEnlaceForEdit}
    onComplete={loadData}
/>

<ConfirmationModal
    bind:isOpen={isConfirmOpen}
    title="Remover Enlace"
    description={`¿Estás seguro de que deseas quitar a ${selectedEnlace?.personnel?.first_name || ""} ${selectedEnlace?.personnel?.last_name || ""} de los enlaces administrativos?`}
    confirmText="Remover"
    variant="danger"
    onConfirm={handleRemoveConfirm}
/>

<PermissionGuard requireEdit>
    {#snippet children({ disabled })}
        <!-- FAB para móvil -->
        <div class="sm:hidden">
            <FloatingActionButton
                onclick={() => (isAddModalOpen = true)}
                label="Asignar"
                icon={UserPlus}
            />
        </div>
    {/snippet}
</PermissionGuard>
