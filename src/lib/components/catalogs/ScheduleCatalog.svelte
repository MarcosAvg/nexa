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
    import CatalogRowActions from "./CatalogRowActions.svelte";
    import { useCatalogReorder } from "./useCatalogReorder.svelte";
    import { Plus, Calendar } from "lucide-svelte";

    /**
     * ScheduleCatalog — Gestión de horarios con días laborales (CRUD).
     *
     * @example
     * <ScheduleCatalog canEdit={isAdmin} />
     */
    type Props = {
        /** Si es true, muestra botones de crear/editar/eliminar. */
        canEdit: boolean;
    };

    let { canEdit }: Props = $props();

    let schedules = $derived(catalogState.schedules);

    // Reordenamiento con actualización optimista y rollback
    const { isReordering, handleDrop } = useCatalogReorder({
        table: "schedules",
        getItems: () => schedules,
        setItems: (items: any[]) => catalogState.setSchedules(items),
        fetchFn: fetchSchedules,
    });

    // Add/Edit modal state
    let isModalOpen = $state(false);
    let editingId = $state<number | null>(null);
    let scheduleName = $state("");
    let scheduleDays = $state<string[]>([]);

    // Delete modal state
    let isDeleteModalOpen = $state(false);
    let deleteTarget = $state<any>(null);

    async function fetchSchedules() {
        const data = await catalogService.fetchSchedules();
        catalogState.setSchedules(data);
    }

    function openModal(schedule?: any) {
        if (schedule) {
            editingId = schedule.id;
            scheduleName = schedule.name;
            scheduleDays = [...(schedule.days || [])];
        } else {
            editingId = null;
            scheduleName = "";
            scheduleDays = [];
        }
        isModalOpen = true;
    }

    function toggleDay(day: string) {
        if (scheduleDays.includes(day)) {
            scheduleDays = scheduleDays.filter((d) => d !== day);
        } else {
            scheduleDays = [...scheduleDays, day];
        }
    }

    async function saveSchedule() {
        if (!scheduleName.trim()) {
            toast.error("El nombre del horario es requerido");
            return;
        }
        if (scheduleDays.length === 0) {
            toast.error("Debes seleccionar al menos un día");
            return;
        }
        try {
            await catalogService.saveSchedule(editingId, {
                name: scheduleName,
                days: scheduleDays,
            });
            await fetchSchedules();
            isModalOpen = false;
            toast.success(editingId ? "Horario actualizado" : "Horario creado");
        } catch {
            toast.error("Error al guardar el horario");
        }
    }

    function openDeleteModal(item: any) {
        deleteTarget = { ...item, type: "schedule" };
        isDeleteModalOpen = true;
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            await catalogService.deleteCatalogItem("schedules", deleteTarget.id, deleteTarget.name);
            await fetchSchedules();
            toast.success(`"${deleteTarget.name}" eliminado correctamente`);
        } catch {
            toast.error("Error al eliminar el horario");
        }
        isDeleteModalOpen = false;
        deleteTarget = null;
    }
</script>

<div>
    <CatalogSectionHeader
        title="Horarios"
        subtitle="Configuración de jornadas"
        actionLabel="Nuevo Horario"
        icon={Plus}
        {canEdit}
        onNew={() => openModal()}
    />

    {#snippet renderDays(row: any)}
        <div class="flex flex-wrap gap-1">
            {#each row.days as day}
                <span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200">
                    {day.slice(0, 3)}
                </span>
            {/each}
        </div>
    {/snippet}

    <DataTable
        data={schedules}
        columns={[
            { key: "name", label: "Nombre", sortable: false },
            { key: "days", label: "Días", render: renderDays, sortable: false },
        ]}
        dnd={{ onDrop: handleDrop, disabled: isReordering }}
    >
        {#snippet actions(row: any)}
            {#if canEdit}
                <CatalogRowActions onEdit={() => openModal(row)} onDelete={() => openDeleteModal(row)} />
            {/if}
        {/snippet}
    </DataTable>
</div>

<!-- Add/Edit Schedule Modal -->
<Modal bind:isOpen={isModalOpen} title={editingId ? "Editar Horario" : "Nuevo Horario"} description="Registra un nuevo esquema de días laborales.">
    <div class="space-y-4">
        <div>
            <label for="schedule-name" class="block text-sm font-medium text-slate-700 mb-1">Nombre del Horario</label>
            <Input id="schedule-name" placeholder="Ej. Medio Tiempo" bind:value={scheduleName} />
        </div>
        <div>
            <span class="block text-sm font-medium text-slate-700 mb-2">Días Laborales</span>
            <div class="grid grid-cols-2 gap-2">
                {#each ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as day}
                    <label class="flex items-center gap-2 p-2 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" class="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            checked={scheduleDays.includes(day)}
                            onchange={() => toggleDay(day)}
                        />
                        <span class="text-sm text-slate-700">{day}</span>
                    </label>
                {/each}
            </div>
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isModalOpen = false)}>Cancelar</Button>
        <Button variant="primary" onclick={saveSchedule}>{editingId ? "Actualizar" : "Guardar"}</Button>
    {/snippet}
</Modal>

<!-- Delete Schedule Modal -->
<DeleteConfirmTypedModal
    bind:isOpen={isDeleteModalOpen}
    title="Eliminar Horario"
    targetName={deleteTarget?.name ?? ""}
    confirmText="Eliminar permanentemente"
    onConfirm={confirmDelete}
    onCancel={() => (isDeleteModalOpen = false)}
/>
