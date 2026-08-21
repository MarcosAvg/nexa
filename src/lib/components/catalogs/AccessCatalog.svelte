<script lang="ts">
    import { toast } from "svelte-sonner";
    import { catalogService } from "../../services";
    import { catalogState } from "../../stores";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import Modal from "../Modal.svelte";
    import DataTable from "../DataTable.svelte";
    import { Plus, Edit2, Trash2, Key, GripVertical } from "lucide-svelte";

    /**
     * AccessCatalog — Gestión de accesos especiales (CRUD).
     *
     * @example
     * <AccessCatalog canEdit={isAdmin} />
     */
    type Props = {
        /** Si es true, muestra botones de crear/editar/eliminar. */
        canEdit: boolean;
    };

    let { canEdit }: Props = $props();

    let buildings = $derived(catalogState.buildings);
    let specialAccesses = $derived(catalogState.specialAccesses);

    // Catálogo por edificio: el usuario elige qué edificio gestionar.
    let selectedBuildingId = $state<number>(1);
    let filteredAccesses = $derived(
        specialAccesses.filter((a) => Number(a.building_id) === selectedBuildingId),
    );

    // Estado de reordenamiento (evita clics consecutivos en vuelo)
    let isReordering = $state(false);

    // Add/Edit modal state
    let isModalOpen = $state(false);
    let editingId = $state<number | null>(null);
    let accessName = $state("");

    // Delete modal state
    let isDeleteModalOpen = $state(false);
    let deleteTarget = $state<any>(null);
    let deleteConfirmation = $state("");

    async function fetchAccesses() {
        const data = await catalogService.fetchAccesses();
        catalogState.setSpecialAccesses(data);
    }

    /** Mueve un elemento de la posición `from` a la posición `to` y persiste el orden. */
    async function handleDrop(from: number, to: number) {
        if (isReordering || from === to) return;
        const next = [...filteredAccesses];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        isReordering = true;
        // Actualización optimista: los desplegables reflejan el nuevo orden al instante
        catalogState.setSpecialAccesses(
            specialAccesses.map((a) => {
                if (Number(a.building_id) !== selectedBuildingId) return a;
                const idx = filteredAccesses.indexOf(a);
                return idx >= 0 ? next[idx] : a;
            }),
        );
        try {
            await catalogService.reorderCatalog("special_accesses", next);
            toast.success("Orden actualizado");
        } catch {
            toast.error("Error al actualizar el orden");
            await fetchAccesses();
        } finally {
            isReordering = false;
        }
    }

    function openModal(access?: any) {
        if (access) {
            editingId = access.id;
            accessName = access.name;
        } else {
            editingId = null;
            accessName = "";
        }
        isModalOpen = true;
    }

    async function saveAccess() {
        if (!accessName.trim()) {
            toast.error("El nombre del acceso es requerido");
            return;
        }
        try {
            await catalogService.saveAccess(editingId, {
                name: accessName,
                buildingId: selectedBuildingId,
            });
            await fetchAccesses();
            isModalOpen = false;
            toast.success(editingId ? "Acceso actualizado" : "Acceso creado");
        } catch {
            toast.error("Error al guardar el acceso");
        }
    }

    function openDeleteModal(item: any) {
        deleteTarget = { ...item, type: "access" };
        deleteConfirmation = "";
        isDeleteModalOpen = true;
    }

    async function confirmDelete() {
        if (!deleteTarget || deleteConfirmation !== deleteTarget.name) return;
        try {
            await catalogService.deleteCatalogItem("special_accesses", deleteTarget.id, deleteTarget.name);
            await fetchAccesses();
            toast.success(`"${deleteTarget.name}" eliminado correctamente`);
        } catch {
            toast.error("Error al eliminar el acceso");
        }
        isDeleteModalOpen = false;
        deleteTarget = null;
    }
</script>

<div>
    <div class="flex justify-between items-center mb-8">
        <div>
            <h3 class="text-xl font-black text-slate-900 tracking-tight">Accesos Especiales</h3>
            <p class="text-sm font-medium text-slate-500 mt-0.5">Zonas restringidas o críticas</p>
        </div>
        {#if canEdit}
            <Button variant="primary" size="sm" class="h-10 px-5 rounded-xl shadow-lg shadow-blue-500/10" onclick={() => openModal()}>
                <Plus size={18} strokeWidth={3} class="mr-2" /> Nuevo Acceso
            </Button>
        {/if}
    </div>

    <div class="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none">
        {#each buildings as b}
            <button
                type="button"
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-extrabold whitespace-nowrap transition-all duration-300 active:scale-95 {Number(b.id) ===
                selectedBuildingId
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-slate-100/60 text-slate-500 hover:bg-slate-100 hover:text-slate-900'}"
                onclick={() => (selectedBuildingId = Number(b.id))}
            >
                <span class="w-1.5 h-1.5 rounded-full {Number(b.id) === selectedBuildingId ? 'bg-white' : 'bg-slate-300'}"></span>
                {b.name}
            </button>
        {/each}
    </div>

    {#snippet renderAccessName(row: any)}
        <div class="flex items-center gap-3">
            <div class="p-2 bg-slate-100 rounded-lg text-slate-500">
                <Key size={16} />
            </div>
            <span class="text-slate-700 font-medium">{row.name}</span>
        </div>
    {/snippet}

    <DataTable
        data={filteredAccesses}
        columns={[{ key: "name", label: "Nombre", render: renderAccessName, sortable: false }]}
        dnd={{ onDrop: handleDrop, disabled: isReordering }}
    >
        {#snippet actions(row: any)}
            {#if canEdit}
                <div class="flex justify-end gap-1">
                    <span class="p-1.5 text-slate-300 group-hover:text-slate-400 cursor-grab transition-colors" title="Arrastrar para reordenar" aria-hidden="true">
                        <GripVertical size={16} />
                    </span>
                    <button class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" onclick={() => openModal(row)} title="Editar acceso especial" aria-label="Editar acceso especial">
                        <Edit2 size={16} />
                    </button>
                    <button class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" onclick={() => openDeleteModal(row)} title="Eliminar acceso especial" aria-label="Eliminar acceso especial">
                        <Trash2 size={16} />
                    </button>
                </div>
            {/if}
        {/snippet}
    </DataTable>
</div>

<!-- Add/Edit Access Modal -->
<Modal
    bind:isOpen={isModalOpen}
    title={editingId ? "Editar Acceso Especial" : "Nuevo Acceso Especial"}
    description={`Registra un nuevo punto de acceso especial para ${buildings.find((b) => Number(b.id) === selectedBuildingId)?.name ?? "el edificio seleccionado"}.`}
>
    <div class="space-y-4">
        <div>
            <label for="access-name" class="block text-sm font-medium text-slate-700 mb-1">Nombre del Acceso</label>
            <Input id="access-name" placeholder="Ej. Laboratorio de Redes" bind:value={accessName} />
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isModalOpen = false)}>Cancelar</Button>
        <Button variant="primary" onclick={saveAccess}>{editingId ? "Actualizar" : "Guardar"}</Button>
    {/snippet}
</Modal>

<!-- Delete Access Modal -->
<Modal bind:isOpen={isDeleteModalOpen} title="Eliminar Acceso Especial" description={`Estás a punto de eliminar "${deleteTarget?.name}". Esta acción es irreversible.`} size="sm">
    <div class="space-y-4">
        <div class="p-4 bg-rose-50 rounded-xl border border-rose-100">
            <div class="flex gap-3">
                <div class="mt-0.5 text-rose-600"><Trash2 size={20} /></div>
                <div>
                    <h4 class="text-sm font-bold text-rose-900">Confirmación requerida</h4>
                    <p class="text-sm text-rose-800 mt-1">Para confirmar, escribe <strong>{deleteTarget?.name}</strong> en el campo de abajo.</p>
                </div>
            </div>
        </div>
        <div>
            <label for="access-delete-confirm" class="block text-sm font-medium text-slate-700 mb-1">Confirmación</label>
            <Input id="access-delete-confirm" placeholder={deleteTarget?.name} bind:value={deleteConfirmation} class="border-rose-300 focus:ring-rose-500" />
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isDeleteModalOpen = false)}>Cancelar</Button>
        <Button variant="danger" onclick={confirmDelete} disabled={deleteConfirmation !== deleteTarget?.name}>Eliminar permanentemente</Button>
    {/snippet}
</Modal>
