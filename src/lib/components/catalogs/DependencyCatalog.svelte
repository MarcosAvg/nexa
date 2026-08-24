<script lang="ts">
    import { toast } from "svelte-sonner";
    import { catalogService } from "../../services";
    import { catalogState } from "../../stores";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import Modal from "../Modal.svelte";
    import DataTable from "../DataTable.svelte";
    import DeleteConfirmTypedModal from "../DeleteConfirmTypedModal.svelte";
    import CatalogSectionHeader from "./CatalogSectionHeader.svelte";
    import { Plus, Edit2, Trash2, GripVertical } from "lucide-svelte";

    /**
     * DependencyCatalog — Gestión de dependencias (CRUD).
     *
     * @example
     * <DependencyCatalog canEdit={isAdmin} />
     */
    type Props = {
        /** Si es true, muestra botones de crear/editar/eliminar. */
        canEdit: boolean;
    };

    let { canEdit }: Props = $props();

    let dependencies = $derived(catalogState.dependencies);

    // Estado de reordenamiento (evita clics consecutivos en vuelo)
    let isReordering = $state(false);

    // Add/Edit modal state
    let isModalOpen = $state(false);
    let editingId = $state<number | null>(null);
    let dependencyName = $state("");

    // Delete modal state
    let isDeleteModalOpen = $state(false);
    let deleteTarget = $state<any>(null);

    async function fetchDependencies() {
        const data = await catalogService.fetchDependencies();
        catalogState.setDependencies(data);
    }

    /** Mueve un elemento de la posición `from` a la posición `to` y persiste el orden. */
    async function handleDrop(from: number, to: number) {
        if (isReordering || from === to) return;
        const next = [...dependencies];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        isReordering = true;
        // Actualización optimista: los desplegables reflejan el nuevo orden al instante
        catalogState.setDependencies(next);
        try {
            await catalogService.reorderCatalog("dependencies", next);
            toast.success("Orden actualizado");
        } catch {
            toast.error("Error al actualizar el orden");
            await fetchDependencies();
        } finally {
            isReordering = false;
        }
    }

    function openModal(dep?: any) {
        if (dep) {
            editingId = dep.id;
            dependencyName = dep.name;
        } else {
            editingId = null;
            dependencyName = "";
        }
        isModalOpen = true;
    }

    async function saveDependency() {
        if (!dependencyName.trim()) {
            toast.error("El nombre de la dependencia es requerido");
            return;
        }
        try {
            await catalogService.saveDependency(editingId, { name: dependencyName });
            await fetchDependencies();
            isModalOpen = false;
            toast.success(editingId ? "Dependencia actualizada" : "Dependencia creada");
        } catch {
            toast.error("Error al guardar la dependencia");
        }
    }

    function openDeleteModal(item: any) {
        deleteTarget = { ...item, type: "dependency" };
        isDeleteModalOpen = true;
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            await catalogService.deleteCatalogItem("dependencies", deleteTarget.id, deleteTarget.name);
            await fetchDependencies();
            toast.success(`"${deleteTarget.name}" eliminado correctamente`);
        } catch {
            toast.error("Error al eliminar la dependencia");
        }
        isDeleteModalOpen = false;
        deleteTarget = null;
    }
</script>

<div>
    <CatalogSectionHeader
        title="Dependencias"
        subtitle="Áreas y departamentos registrados"
        actionLabel="Nueva Dependencia"
        icon={Plus}
        {canEdit}
        onNew={() => openModal()}
    />

    <DataTable
        data={dependencies}
        columns={[{ key: "name", label: "Nombre", sortable: false }]}
        dnd={{ onDrop: handleDrop, disabled: isReordering }}
    >
        {#snippet actions(row: any)}
            {#if canEdit}
                <div class="flex justify-end gap-1">
                    <span class="p-1.5 text-slate-300 group-hover:text-slate-400 cursor-grab transition-colors" title="Arrastrar para reordenar" aria-hidden="true">
                        <GripVertical size={16} />
                    </span>
                    <button class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" onclick={() => openModal(row)} title="Editar dependencia" aria-label="Editar dependencia">
                        <Edit2 size={16} />
                    </button>
                    <button class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" onclick={() => openDeleteModal(row)} title="Eliminar dependencia" aria-label="Eliminar dependencia">
                        <Trash2 size={16} />
                    </button>
                </div>
            {/if}
        {/snippet}
    </DataTable>
</div>

<!-- Add/Edit Dependency Modal -->
<Modal bind:isOpen={isModalOpen} title={editingId ? "Editar Dependencia" : "Nueva Dependencia"} description="Registra una nueva dependencia o área.">
    <div class="space-y-4">
        <div>
            <label for="dependency-name" class="block text-sm font-medium text-slate-700 mb-1">Nombre de la Dependencia</label>
            <Input id="dependency-name" placeholder="Ej. Dirección General" bind:value={dependencyName} />
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isModalOpen = false)}>Cancelar</Button>
        <Button variant="primary" onclick={saveDependency}>{editingId ? "Actualizar" : "Guardar"}</Button>
    {/snippet}
</Modal>

<!-- Delete Dependency Modal -->
<DeleteConfirmTypedModal
    bind:isOpen={isDeleteModalOpen}
    title="Eliminar Dependencia"
    targetName={deleteTarget?.name ?? ""}
    confirmText="Eliminar permanentemente"
    onConfirm={confirmDelete}
    onCancel={() => (isDeleteModalOpen = false)}
/>
