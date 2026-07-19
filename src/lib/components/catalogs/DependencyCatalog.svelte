<script lang="ts">
    import { toast } from "svelte-sonner";
    import { catalogService } from "../../services";
    import { catalogState } from "../../stores";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import Modal from "../Modal.svelte";
    import DataTable from "../DataTable.svelte";
    import { Plus, Edit2, Trash2 } from "lucide-svelte";

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

    // Add/Edit modal state
    let isModalOpen = $state(false);
    let editingId = $state<number | null>(null);
    let dependencyName = $state("");

    // Delete modal state
    let isDeleteModalOpen = $state(false);
    let deleteTarget = $state<any>(null);
    let deleteConfirmation = $state("");

    async function fetchDependencies() {
        const data = await catalogService.fetchDependencies();
        catalogState.setDependencies(data);
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
        deleteConfirmation = "";
        isDeleteModalOpen = true;
    }

    async function confirmDelete() {
        if (!deleteTarget || deleteConfirmation !== deleteTarget.name) return;
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
    <div class="flex justify-between items-center mb-8">
        <div>
            <h3 class="text-xl font-black text-slate-900 tracking-tight">Dependencias</h3>
            <p class="text-sm font-medium text-slate-500 mt-0.5">Áreas y departamentos registrados</p>
        </div>
        {#if canEdit}
            <Button variant="primary" size="sm" class="h-10 px-5 rounded-xl shadow-lg shadow-blue-500/10" onclick={() => openModal()}>
                <Plus size={18} strokeWidth={3} class="mr-2" /> Nueva Dependencia
            </Button>
        {/if}
    </div>

    <DataTable data={dependencies} columns={[{ key: "name", label: "Nombre" }]}>
        {#snippet actions(row: any)}
            {#if canEdit}
                <div class="flex justify-end gap-1">
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
<Modal bind:isOpen={isDeleteModalOpen} title="Eliminar Dependencia" description={`Estás a punto de eliminar "${deleteTarget?.name}". Esta acción es irreversible.`} size="sm">
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
            <label for="dep-delete-confirm" class="block text-sm font-medium text-slate-700 mb-1">Confirmación</label>
            <Input id="dep-delete-confirm" placeholder={deleteTarget?.name} bind:value={deleteConfirmation} class="border-rose-300 focus:ring-rose-500" />
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isDeleteModalOpen = false)}>Cancelar</Button>
        <Button variant="danger" onclick={confirmDelete} disabled={deleteConfirmation !== deleteTarget?.name}>Eliminar permanentemente</Button>
    {/snippet}
</Modal>
