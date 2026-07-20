<script lang="ts">
    import { onMount } from "svelte";
    import { enlaceService } from "../services/enlaces";
    import type { Enlace } from "../types";
    import { confirm } from "../utils/confirmModal.svelte";
    import {
        SectionHeader, FloatingActionButton, PermissionGuard,
        DataTable, FilterSelect, Button, ContentView, SearchInput,
        AddEnlaceModal, EditEnlaceModal, ConfirmationModal,
    } from "../components";
    import { catalogState } from "../stores";
    import {
        Trash2,
        Contact,
        UserPlus,
        Edit,
        Copy,
        Mail,
        Send,
        Link2,
    } from "lucide-svelte";
    import { toast } from "svelte-sonner";

    let enlaces = $state<Enlace[]>([]);
    let isLoading = $state(true);
    let isAddModalOpen = $state(false);
    let searchQuery = $state("");
    let filterDependency = $state("");
    let filterFloor = $state("");

    let isEditOpen = $state(false);
    let selectedEnlaceForEdit = $state<Enlace | null>(null);

    let dependencies = $derived(catalogState.dependencies);
    let buildings = $derived(catalogState.buildings);
    let dependencyNames = $derived(dependencies.map((d) => d.name));

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

            const bldgId = (e.personnel as any)?.building_id;
            const bldg = buildings.find((b) => b.id === bldgId);
            const buildingName = bldg ? bldg.name : "";

            return {
                ...e,
                name: `${e.personnel?.first_name || ""} ${e.personnel?.last_name || ""}`.trim() || "Desconocido",
                dependency: dependencyName,
                building: buildingName,
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
            width: "220px",
        },
        {
            key: "dependency",
            label: "Dependencia / Ubicación",
            render: renderDependency,
            sortable: true,
            width: "280px",
        },
        {
            key: "email",
            label: "Correo",
            render: renderEmail,
            sortable: true,
            width: "220px",
        },
        {
            key: "extension",
            label: "Extensión",
            render: renderExtension,
            sortable: true,
            width: "100px",
        },
    ];

    function requestRemove(enlace: Enlace) {
        const name = `${enlace.personnel?.first_name || ""} ${enlace.personnel?.last_name || ""}`.trim();
        confirm.open({
            title: "Remover Enlace",
            description: `¿Estás seguro de que deseas quitar a ${name} de los enlaces administrativos?`,
            variant: "danger",
            confirmText: "Remover",
            onConfirm: async () => {
                try {
                    await enlaceService.remove(enlace.id, name);
                    toast.success("Enlace removido");
                    loadData();
                } catch (e) {
                    toast.error("Error al remover enlace");
                }
            },
        });
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
    <span class="font-bold text-slate-900"
        >{`${row.personnel?.first_name || ""} ${row.personnel?.last_name || ""}`.trim() ||
            "Desconocido"}</span
    >
{/snippet}

{#snippet renderDependency(row: Enlace)}
    {@const depId = (row.personnel as any)?.dependency_id}
    {@const dep = dependencies.find((d) => d.id === depId)}
    <div class="flex flex-col">
        <span class="font-medium text-slate-900"
            >{dep ? dep.name : "N/A"}</span
        >
        {#if row.building || row.floor}
            <span class="text-xs text-slate-500"
                >{row.building || ""}{row.building && row.floor
                    ? ` (${row.floor})`
                    : ""}</span
            >
        {/if}
    </div>
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
            <FilterSelect
                label="Dependencia"
                options={dependencyNames}
                placeholder="Todas"
                bind:value={filterDependency}
            />
            <FilterSelect
                label="Piso Base"
                options={availableFloors}
                placeholder="Todos"
                bind:value={filterFloor}
            />
            <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                <span
                    class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap"
                    >Buscar</span
                >
                <SearchInput
                    placeholder="Nombre, correo o ext..."
                    bind:value={searchQuery}
                    class="h-9 text-xs font-bold"
                />
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

    <ContentView
        isLoading={isLoading}
        data={filteredEnlaces}
        emptyTitle="Aún no hay enlaces asignados"
        emptyTitleFiltered="Sin resultados"
        emptyDescription="Los enlaces administrativos son los responsables de cada área. Asigna el primero para empezar."
        emptyDescriptionFiltered="No encontramos enlaces con los filtros actuales. Intenta ajustar tu búsqueda."
        emptyIcon={Link2}
        emptyIconBgClass="from-violet-50 to-violet-100 ring-1 ring-violet-200/50 text-violet-400"
        hasFilters={!!(searchQuery || filterDependency || filterFloor)}
        onClearFilters={() => {
            searchQuery = '';
            filterDependency = '';
            filterFloor = '';
        }}
        skeletonColumns={4}
        skeletonRows={5}
        skeletonHasActions={true}
        cardClass="overflow-hidden"
    >
        {#snippet children()}
            <DataTable data={filteredEnlaces} {columns} actionsWidth="220px">
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
        {/snippet}

        {#snippet emptyActions()}
            <PermissionGuard requireEdit>
                {#snippet children({ disabled })}
                    <Button variant="primary" size="sm" class="h-11 px-7 rounded-xl shadow-lg shadow-violet-500/20" onclick={() => (isAddModalOpen = true)} {disabled}>
                        <UserPlus size={18} strokeWidth={3} class="mr-2" />
                        Asignar primer enlace
                    </Button>
                {/snippet}
            </PermissionGuard>
        {/snippet}
    </ContentView>
</div>

<AddEnlaceModal bind:isOpen={isAddModalOpen} onComplete={loadData} />
<EditEnlaceModal
    bind:isOpen={isEditOpen}
    enlace={selectedEnlaceForEdit}
    onComplete={loadData}
/>

<ConfirmationModal
    bind:isOpen={confirm.isOpen}
    title={confirm.title}
    description={confirm.description}
    variant={confirm.variant}
    confirmText={confirm.confirmText}
    cancelText={confirm.cancelText}
    onConfirm={confirm.onConfirm}
    onCancel={() => confirm.close()}
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
