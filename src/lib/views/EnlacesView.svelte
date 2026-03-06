<script lang="ts">
    import { onMount } from "svelte";
    import { enlaceService } from "../services/enlaces";
    import type { Enlace } from "../types";
    import SectionHeader from "../components/SectionHeader.svelte";
    import FloatingActionButton from "../components/FloatingActionButton.svelte";
    import PermissionGuard from "../components/PermissionGuard.svelte";
    import AddEnlaceModal from "../components/modals/AddEnlaceModal.svelte";
    import ConfirmationModal from "../components/modals/ConfirmationModal.svelte";
    import DataTable from "../components/DataTable.svelte";
    import { catalogState } from "../stores";
    import { Trash2, Search, Contact, UserPlus } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import Input from "../components/Input.svelte";

    let enlaces = $state<Enlace[]>([]);
    let isLoading = $state(true);
    let isAddModalOpen = $state(false);
    let searchQuery = $state("");

    let isConfirmOpen = $state(false);
    let selectedEnlace = $state<Enlace | null>(null);

    let dependencies = $derived(catalogState.dependencies);

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
        if (!searchQuery.trim()) return enlaces;
        const term = searchQuery.toLowerCase();
        return enlaces.filter((e) => {
            const name =
                `${e.personnel?.first_name || ""} ${e.personnel?.last_name || ""}`.toLowerCase();
            const email = (e.personnel?.email || "").toLowerCase();
            const ext = (e.extension || "").toLowerCase();
            return (
                name.includes(term) ||
                email.includes(term) ||
                ext.includes(term)
            );
        });
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
            <div class="flex-1 min-w-[200px] w-full relative sm:max-w-xs">
                <Search
                    class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                />
                <Input
                    id="enlaces-search"
                    placeholder="Buscar por nombre, correo o extensión..."
                    class="pl-10 h-9 text-xs font-bold"
                    bind:value={searchQuery}
                />
            </div>
        {/snippet}
        {#snippet actions()}
            <PermissionGuard requireEdit>
                {#snippet children({ disabled })}
                    <div class="w-full xl:w-auto mt-4 xl:mt-0 flex justify-end">
                        <button
                            type="button"
                            class="hidden sm:flex items-center justify-center gap-2 h-10 px-6 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/10"
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
                <PermissionGuard requireEdit>
                    {#snippet children({ disabled })}
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
            {/snippet}
        </DataTable>
    {/if}
</div>

<AddEnlaceModal bind:isOpen={isAddModalOpen} onComplete={loadData} />

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
        <!-- FAB for mobile -->
        <div class="sm:hidden">
            <FloatingActionButton
                onclick={() => (isAddModalOpen = true)}
                label="Asignar"
                icon={UserPlus}
            />
        </div>
    {/snippet}
</PermissionGuard>
