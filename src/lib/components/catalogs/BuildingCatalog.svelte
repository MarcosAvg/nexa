<script lang="ts">
    import { toast } from "svelte-sonner";
    import { catalogService } from "../../services";
    import { catalogState } from "../../stores";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import Modal from "../Modal.svelte";
    import { Plus, Edit2, Trash2, Building2 } from "lucide-svelte";

    type Props = {
        canEdit: boolean;
    };

    let { canEdit }: Props = $props();

    let buildings = $derived(catalogState.buildings);

    // Add/Edit modal state
    let isModalOpen = $state(false);
    let editingId = $state<number | null>(null);
    let buildingName = $state("");
    let buildingFloors = $state("");

    // Delete modal state
    let isDeleteModalOpen = $state(false);
    let deleteTarget = $state<any>(null);
    let deleteConfirmation = $state("");

    async function fetchBuildings() {
        const data = await catalogService.fetchBuildings();
        catalogState.setBuildings(data);
    }

    function openModal(building?: any) {
        if (building) {
            editingId = building.id;
            buildingName = building.name;
            buildingFloors = (building.floors || []).join(", ");
        } else {
            editingId = null;
            buildingName = "";
            buildingFloors = "";
        }
        isModalOpen = true;
    }

    async function saveBuilding() {
        if (!buildingName.trim()) {
            toast.error("El nombre del edificio es requerido");
            return;
        }
        const floors = buildingFloors
            .split(",")
            .map((f) => f.trim())
            .filter((f) => f);
        if (floors.length === 0) {
            toast.error("Debes agregar al menos un piso");
            return;
        }

        try {
            await catalogService.saveBuilding(editingId, {
                name: buildingName,
                floors,
            });
            await fetchBuildings();
            isModalOpen = false;
            toast.success(editingId ? "Edificio actualizado" : "Edificio creado");
        } catch {
            toast.error("Error al guardar el edificio");
        }
    }

    function openDeleteModal(building: any) {
        deleteTarget = { ...building, type: "building" };
        deleteConfirmation = "";
        isDeleteModalOpen = true;
    }

    async function confirmDelete() {
        if (!deleteTarget || deleteConfirmation !== deleteTarget.name) return;
        try {
            await catalogService.deleteCatalogItem("buildings", deleteTarget.id, deleteTarget.name);
            await fetchBuildings();
            toast.success(`"${deleteTarget.name}" eliminado correctamente`);
        } catch {
            toast.error("Error al eliminar el edificio");
        }
        isDeleteModalOpen = false;
        deleteTarget = null;
    }
</script>

<div>
    <div class="flex justify-between items-center mb-8">
        <div>
            <h3 class="text-xl font-black text-slate-900 tracking-tight">Edificios y Pisos</h3>
            <p class="text-sm font-medium text-slate-500 mt-0.5">Gestión de infraestructura física</p>
        </div>
        {#if canEdit}
            <Button variant="primary" size="sm" class="h-10 px-5 rounded-xl shadow-lg shadow-blue-500/10" onclick={() => openModal()}>
                <Plus size={18} strokeWidth={3} class="mr-2" /> Nuevo Edificio
            </Button>
        {/if}
    </div>

    <div class="grid sm:grid-cols-2 lg:grid-cols-2 gap-6">
        {#each buildings as building}
            <div class="group p-6 border border-slate-200/50 rounded-[24px] bg-white/40 hover:bg-white transition-all duration-500 hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
                <div class="flex justify-between items-start mb-5 relative z-10">
                    <div>
                        <h4 class="font-extrabold text-slate-900 text-[16px] tracking-tight group-hover:text-blue-600 transition-colors">{building.name}</h4>
                        <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1.5 flex items-center gap-2">
                            <span class="w-1.5 h-1.5 rounded-full bg-blue-500/40"></span>
                            {building.floors.length} pisos configurados
                        </p>
                    </div>
                    {#if canEdit}
                        <div class="flex gap-1.5">
                            <button class="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50/80 rounded-xl transition-all active:scale-95" onclick={() => openModal(building)}>
                                <Edit2 size={16} strokeWidth={2.5} />
                            </button>
                            <button class="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 rounded-xl transition-all active:scale-95" onclick={() => openDeleteModal(building)}>
                                <Trash2 size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    {/if}
                </div>
                <div class="flex flex-wrap gap-2 relative z-10">
                    {#each building.floors as floor}
                        <span class="px-3.5 py-1.5 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-600 shadow-sm group-hover:border-blue-100 transition-colors">
                            {floor}
                        </span>
                    {/each}
                </div>
                <div class="absolute -right-6 -bottom-6 text-slate-400/5 group-hover:text-blue-500/8 rotate-12 transition-all duration-700 pointer-events-none">
                    <Building2 size={100} />
                </div>
            </div>
        {/each}
    </div>
</div>

<!-- Add/Edit Building Modal -->
<Modal bind:isOpen={isModalOpen} title={editingId ? "Editar Edificio" : "Nuevo Edificio"} description="Registra un nuevo edificio y sus pisos correspondientes.">
    <div class="space-y-4">
        <div>
            <label for="building-name" class="block text-sm font-medium text-slate-700 mb-1">Nombre del Edificio</label>
            <Input id="building-name" placeholder="Ej. Torre Administrativa" bind:value={buildingName} />
        </div>
        <div>
            <label for="building-floors" class="block text-sm font-medium text-slate-700 mb-1">Pisos (separados por coma)</label>
            <Input id="building-floors" placeholder="Ej. PB, 1, 2, 3" bind:value={buildingFloors} />
            <p class="text-xs text-slate-500 mt-1">Ingresa los identificadores de los pisos separados por comas.</p>
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isModalOpen = false)}>Cancelar</Button>
        <Button variant="primary" onclick={saveBuilding}>{editingId ? "Actualizar" : "Guardar"} Edificio</Button>
    {/snippet}
</Modal>

<!-- Delete Building Modal -->
<Modal bind:isOpen={isDeleteModalOpen} title="Eliminar Edificio" description={`Estás a punto de eliminar "${deleteTarget?.name}". Esta acción es irreversible.`} size="sm">
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
            <label for="building-delete-confirm" class="block text-sm font-medium text-slate-700 mb-1">Confirmación</label>
            <Input id="building-delete-confirm" placeholder={deleteTarget?.name} bind:value={deleteConfirmation} class="border-rose-300 focus:ring-rose-500" />
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isDeleteModalOpen = false)}>Cancelar</Button>
        <Button variant="danger" onclick={confirmDelete} disabled={deleteConfirmation !== deleteTarget?.name}>Eliminar permanentemente</Button>
    {/snippet}
</Modal>
