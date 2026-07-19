<script lang="ts">
    import { toast } from "svelte-sonner";
    import { catalogService } from "../../services";
    import { catalogState } from "../../stores";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import Modal from "../Modal.svelte";
    import DataTable from "../DataTable.svelte";
    import { Plus, Edit2, Trash2, Calendar } from "lucide-svelte";

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

    // Add/Edit modal state
    let isModalOpen = $state(false);
    let editingId = $state<number | null>(null);
    let scheduleName = $state("");
    let scheduleDays = $state<string[]>([]);

    // Delete modal state
    let isDeleteModalOpen = $state(false);
    let deleteTarget = $state<any>(null);
    let deleteConfirmation = $state("");

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
        deleteConfirmation = "";
        isDeleteModalOpen = true;
    }

    async function confirmDelete() {
        if (!deleteTarget || deleteConfirmation !== deleteTarget.name) return;
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
    <div class="flex justify-between items-center mb-8">
        <div>
            <h3 class="text-xl font-black text-slate-900 tracking-tight">Horarios</h3>
            <p class="text-sm font-medium text-slate-500 mt-0.5">Configuración de jornadas</p>
        </div>
        {#if canEdit}
            <Button variant="primary" size="sm" class="h-10 px-5 rounded-xl shadow-lg shadow-blue-500/10" onclick={() => openModal()}>
                <Plus size={18} strokeWidth={3} class="mr-2" /> Nuevo Horario
            </Button>
        {/if}
    </div>

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
            { key: "name", label: "Nombre" },
            { key: "days", label: "Días", render: renderDays },
        ]}
    >
        {#snippet actions(row: any)}
            {#if canEdit}
                <div class="flex justify-end gap-1">
                    <button class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" onclick={() => openModal(row)} title="Editar horario" aria-label="Editar horario">
                        <Edit2 size={16} />
                    </button>
                    <button class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" onclick={() => openDeleteModal(row)} title="Eliminar horario" aria-label="Eliminar horario">
                        <Trash2 size={16} />
                    </button>
                </div>
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
<Modal bind:isOpen={isDeleteModalOpen} title="Eliminar Horario" description={`Estás a punto de eliminar "${deleteTarget?.name}". Esta acción es irreversible.`} size="sm">
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
            <label for="schedule-delete-confirm" class="block text-sm font-medium text-slate-700 mb-1">Confirmación</label>
            <Input id="schedule-delete-confirm" placeholder={deleteTarget?.name} bind:value={deleteConfirmation} class="border-rose-300 focus:ring-rose-500" />
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isDeleteModalOpen = false)}>Cancelar</Button>
        <Button variant="danger" onclick={confirmDelete} disabled={deleteConfirmation !== deleteTarget?.name}>Eliminar permanentemente</Button>
    {/snippet}
</Modal>
