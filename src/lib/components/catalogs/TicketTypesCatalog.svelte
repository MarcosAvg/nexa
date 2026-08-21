<script lang="ts">
    import { toast } from "svelte-sonner";
    import { catalogService } from "../../services";
    import { catalogState } from "../../stores";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import Modal from "../Modal.svelte";
    import DataTable from "../DataTable.svelte";
    import Badge from "../Badge.svelte";
    import { Plus, Edit2, Trash2, Ticket } from "lucide-svelte";

    /**
     * TicketTypesCatalog — Gestión de los tipos de ticket (CRUD).
     *
     * Los tipos activos alimentan los filtros y las secciones de la vista de
     * tickets: `section = 'responsivas'` agrupa en la pestaña Responsivas.
     *
     * @example
     * <TicketTypesCatalog canEdit={isAdmin} />
     */
    type Props = {
        /** Si es true, muestra botones de crear/editar/eliminar. */
        canEdit: boolean;
    };

    let { canEdit }: Props = $props();

    let ticketTypes = $derived(catalogState.ticketTypes);

    // Add/Edit modal state
    let isModalOpen = $state(false);
    let editingId = $state<string | null>(null);
    let typeName = $state("");
    let typeSection = $state<"general" | "responsivas">("general");
    let typeActive = $state(true);

    // Delete modal state
    let isDeleteModalOpen = $state(false);
    let deleteTarget = $state<any>(null);
    let deleteConfirmation = $state("");

    async function fetchTicketTypes() {
        const data = await catalogService.fetchTicketTypes();
        catalogState.setTicketTypes(data);
    }

    function openModal(type?: any) {
        if (type) {
            editingId = type.key;
            typeName = type.name;
            typeSection = type.section === "responsivas" ? "responsivas" : "general";
            typeActive = type.active !== false;
        } else {
            editingId = null;
            typeName = "";
            typeSection = "general";
            typeActive = true;
        }
        isModalOpen = true;
    }

    async function saveTicketType() {
        if (!typeName.trim()) {
            toast.error("El nombre del tipo es requerido");
            return;
        }
        try {
            await catalogService.saveTicketType(editingId, {
                name: typeName.trim(),
                section: typeSection,
                active: typeActive,
            });
            await fetchTicketTypes();
            isModalOpen = false;
            toast.success(editingId ? "Tipo actualizado" : "Tipo creado");
        } catch {
            toast.error("Error al guardar el tipo de ticket");
        }
    }

    function openDeleteModal(item: any) {
        deleteTarget = { ...item };
        deleteConfirmation = "";
        isDeleteModalOpen = true;
    }

    async function confirmDelete() {
        if (!deleteTarget || deleteConfirmation !== deleteTarget.name) return;
        try {
            await catalogService.deleteCatalogItem("ticket_types", deleteTarget.key, deleteTarget.name);
            await fetchTicketTypes();
            toast.success(`"${deleteTarget.name}" eliminado correctamente`);
        } catch {
            toast.error("Error al eliminar el tipo");
        }
        isDeleteModalOpen = false;
        deleteTarget = null;
    }
</script>

<div>
    <div class="flex justify-between items-center mb-8">
        <div>
            <h3 class="text-xl font-black text-slate-900 tracking-tight">Tipos de Ticket</h3>
            <p class="text-sm font-medium text-slate-500 mt-0.5">Categorías visibles en filtros y secciones</p>
        </div>
        {#if canEdit}
            <Button variant="primary" size="sm" class="h-10 px-5 rounded-xl shadow-lg shadow-blue-500/10" onclick={() => openModal()}>
                <Plus size={18} strokeWidth={3} class="mr-2" /> Nuevo Tipo
            </Button>
        {/if}
    </div>

    {#snippet renderTypeName(row: any)}
        <div class="flex items-center gap-3">
            <div class="p-2 bg-slate-100 rounded-lg text-slate-500">
                <Ticket size={16} />
            </div>
            <div>
                <span class="text-slate-700 font-medium block">{row.name}</span>
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{row.key}</span>
            </div>
        </div>
    {/snippet}

    {#snippet renderSection(row: any)}
        <Badge variant={row.section === "responsivas" ? "emerald" : "blue"}>
            {row.section === "responsivas" ? "Responsivas" : "General"}
        </Badge>
    {/snippet}

    {#snippet renderActive(row: any)}
        <Badge variant={row.active ? "emerald" : "slate"}>
            {row.active ? "Activo" : "Inactivo"}
        </Badge>
    {/snippet}

    <DataTable
        data={ticketTypes}
        columns={[
            { key: "name", label: "Tipo", render: renderTypeName, sortable: false },
            { key: "section", label: "Sección", render: renderSection, sortable: false },
            { key: "active", label: "Estado", render: renderActive, sortable: false },
        ]}
    >
        {#snippet actions(row: any)}
            {#if canEdit}
                <div class="flex justify-end gap-1">
                    <button class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" onclick={() => openModal(row)} title="Editar tipo" aria-label="Editar tipo">
                        <Edit2 size={16} />
                    </button>
                    <button class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" onclick={() => openDeleteModal(row)} title="Eliminar tipo" aria-label="Eliminar tipo">
                        <Trash2 size={16} />
                    </button>
                </div>
            {/if}
        {/snippet}
    </DataTable>
</div>

<!-- Add/Edit Ticket Type Modal -->
<Modal bind:isOpen={isModalOpen} title={editingId ? "Editar Tipo de Ticket" : "Nuevo Tipo de Ticket"} description="Los tipos activos aparecen en los filtros de la vista de tickets según su sección.">
    <div class="space-y-4">
        <div>
            <label for="ticket-type-name" class="block text-sm font-medium text-slate-700 mb-1">Nombre del Tipo</label>
            <Input id="ticket-type-name" placeholder="Ej. Reporte de Falla" bind:value={typeName} maxlength={60} />
        </div>
        <div>
            <label for="ticket-type-section" class="block text-sm font-medium text-slate-700 mb-1">Sección</label>
            <select
                id="ticket-type-section"
                bind:value={typeSection}
                class="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
                <option value="general">General</option>
                <option value="responsivas">Responsivas</option>
            </select>
        </div>
        <label class="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
            <span class="text-sm font-bold text-slate-700">Activo</span>
            <input type="checkbox" bind:checked={typeActive} class="w-5 h-5 accent-emerald-600" />
        </label>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isModalOpen = false)}>Cancelar</Button>
        <Button variant="primary" onclick={saveTicketType}>{editingId ? "Actualizar" : "Guardar"}</Button>
    {/snippet}
</Modal>

<!-- Delete Ticket Type Modal -->
<Modal bind:isOpen={isDeleteModalOpen} title="Eliminar Tipo de Ticket" description={`Estás a punto de eliminar "${deleteTarget?.name}". Los tickets existentes conservan su tipo.`} size="sm">
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
            <label for="tt-delete-confirm" class="block text-sm font-medium text-slate-700 mb-1">Confirmación</label>
            <Input id="tt-delete-confirm" placeholder={deleteTarget?.name} bind:value={deleteConfirmation} class="border-rose-300 focus:ring-rose-500" />
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isDeleteModalOpen = false)}>Cancelar</Button>
        <Button variant="danger" onclick={confirmDelete} disabled={deleteConfirmation !== deleteTarget?.name}>Eliminar permanentemente</Button>
    {/snippet}
</Modal>