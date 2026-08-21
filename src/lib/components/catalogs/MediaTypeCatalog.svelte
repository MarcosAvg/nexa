<script lang="ts">
    import { toast } from "svelte-sonner";
    import { catalogService } from "../../services";
    import { catalogState } from "../../stores";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import Modal from "../Modal.svelte";
    import DataTable from "../DataTable.svelte";
    import Badge from "../Badge.svelte";
    import { Plus, Edit2, Trash2, CreditCard, GripVertical, Layers, Power } from "lucide-svelte";

    /**
     * MediaTypeCatalog — Gestión de medios de acceso por edificio (CRUD).
     *
     * Cada edificio establece qué sistemas de acceso opera. La creación se
     * limita a las plantillas conocidas (P2000/KONE/AccessPRO) porque el
     * frontend usa la llave para clasificar pisos.
     *
     * @example
     * <MediaTypeCatalog canEdit={isAdmin} />
     */
    type Props = {
        /** Si es true, muestra botones de crear/editar/eliminar. */
        canEdit: boolean;
    };

    let { canEdit }: Props = $props();

    let buildings = $derived(catalogState.buildings);
    let mediaTypes = $derived(catalogState.mediaTypes);

    /** Edificios asignados por tipo de medio (de la tabla puente). */
    let buildingsByMedia = $state<Record<string, number[]>>({});

    // Estado de reordenamiento (evita clics consecutivos en vuelo)
    let isReordering = $state(false);

    // Add/Edit modal state
    let isModalOpen = $state(false);
    let editingId = $state<string | null>(null);
    let mediaName = $state("");
    let mediaHasFloors = $state(true);
    let mediaActive = $state(true);
    /** Edificios seleccionados en el modal (multi-edificio). */
    let mediaBuildings = $state<number[]>([]);

    // Delete modal state
    let isDeleteModalOpen = $state(false);
    let deleteTarget = $state<any>(null);
    let deleteConfirmation = $state("");

    async function fetchMediaTypes() {
        const data = await catalogService.fetchMediaTypes();
        catalogState.setMediaTypes(data);
        // Cargar asignaciones de edificios desde la tabla puente.
        const { supabase } = await import("../../supabase");
        const { data: rows } = await supabase
            .from("access_media_type_buildings")
            .select("media_type_id, building_id");
        const map: Record<string, number[]> = {};
        for (const r of rows || []) {
            if (!map[r.media_type_id]) map[r.media_type_id] = [];
            map[r.media_type_id].push(Number(r.building_id));
        }
        buildingsByMedia = map;
    }

    function buildingNames(ids: number[] | undefined): string {
        return (
            (ids || [])
                .map((id) => buildings.find((b) => Number(b.id) === id)?.name ?? "")
                .filter(Boolean)
                .join(", ") || "Sin edificio"
        );
    }

    function toggleMediaBuilding(bid: number) {
        mediaBuildings = mediaBuildings.includes(bid)
            ? mediaBuildings.filter((b) => b !== bid)
            : [...mediaBuildings, bid];
    }

    /** Mueve un elemento de la posición `from` a la posición `to` y persiste el orden. */
    async function handleDrop(from: number, to: number) {
        if (isReordering || from === to) return;
        const next = [...mediaTypes];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        isReordering = true;
        // Actualización optimista: los desplegables reflejan el nuevo orden al instante
        catalogState.setMediaTypes(
            next,
        );
        try {
            await catalogService.reorderCatalog("access_media_types", next);
            toast.success("Orden actualizado");
        } catch {
            toast.error("Error al actualizar el orden");
            await fetchMediaTypes();
        } finally {
            isReordering = false;
        }
    }

    function openModal(type?: any) {
        if (type) {
            editingId = type.id;
            mediaName = type.name;
            mediaHasFloors = !!type.has_floors;
            mediaActive = type.active !== false;
            mediaBuildings = [...(buildingsByMedia[type.id] || [])];
        } else {
            editingId = null;
            mediaName = "";
            mediaHasFloors = true;
            mediaActive = true;
            mediaBuildings = [];
        }
        isModalOpen = true;
    }

    async function saveMediaType() {
        try {
            const payload = {
                name: mediaName.trim() || "Medio de acceso",
                has_floors: mediaHasFloors,
                active: mediaActive,
                buildingIds: mediaBuildings,
            };
            await catalogService.saveMediaType(editingId, payload);
            await fetchMediaTypes();
            isModalOpen = false;
            toast.success(editingId ? "Medio actualizado" : "Medio creado");
        } catch {
            toast.error("Error al guardar el medio");
        }
    }

    function openDeleteModal(item: any) {
        deleteTarget = { ...item, type: "media_type" };
        deleteConfirmation = "";
        isDeleteModalOpen = true;
    }

    async function confirmDelete() {
        if (!deleteTarget || deleteConfirmation !== deleteTarget.name) return;
        try {
            await catalogService.deleteCatalogItem("access_media_types", deleteTarget.id, deleteTarget.name);
            await fetchMediaTypes();
            toast.success(`"${deleteTarget.name}" eliminado correctamente`);
        } catch {
            toast.error("No se pudo eliminar: el medio tiene tarjetas asociadas");
        }
        isDeleteModalOpen = false;
        deleteTarget = null;
    }
</script>

<div>
    <div class="flex justify-between items-center mb-8">
        <div>
            <h3 class="text-xl font-black text-slate-900 tracking-tight">Medios de Acceso</h3>
            <p class="text-sm font-medium text-slate-500 mt-0.5">Sistemas de acceso por edificio</p>
        </div>
        {#if canEdit}
            <Button variant="primary" size="sm" class="h-10 px-5 rounded-xl shadow-lg shadow-blue-500/10" onclick={() => openModal()}>
                <Plus size={18} strokeWidth={3} class="mr-2" /> Nuevo Medio
            </Button>
        {/if}
    </div>

    {#snippet renderMediaName(row: any)}
        <div class="flex items-center gap-3">
            <div class="p-2 bg-slate-100 rounded-lg text-slate-500">
                <CreditCard size={16} />
            </div>
            <div>
                <span class="text-slate-700 font-medium block">{row.name}</span>
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{row.key}</span>
            </div>
        </div>
    {/snippet}

    {#snippet renderBuildings(row: any)}
        <div class="flex flex-wrap gap-1.5">
            {#each buildingsByMedia[row.id] || [] as bid}
                <span class="px-2 py-0.5 bg-slate-100 border border-slate-200/60 rounded-lg text-[10px] font-bold text-slate-500">
                    {buildings.find((b) => Number(b.id) === bid)?.name ?? bid}
                </span>
            {:else}
                <span class="text-[11px] text-slate-400 italic">Sin edificio</span>
            {/each}
        </div>
    {/snippet}

    {#snippet renderHasFloors(row: any)}
        {#if row.has_floors}
            <span class="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-lg">
                <Layers size={12} /> Pisos
            </span>
        {:else}
            <span class="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg">
                Sin pisos
            </span>
        {/if}
    {/snippet}

    {#snippet renderActive(row: any)}
        <Badge variant={row.active ? "emerald" : "slate"}>
            <span class="inline-flex items-center gap-1"><Power size={11} /> {row.active ? "Activo" : "Inactivo"}</span>
        </Badge>
    {/snippet}

    <DataTable
        data={mediaTypes}
        columns={[
            { key: "name", label: "Medio", render: renderMediaName, sortable: false },
            { key: "buildings", label: "Edificios", render: renderBuildings, sortable: false },
            { key: "has_floors", label: "Pisos", render: renderHasFloors, sortable: false },
            { key: "active", label: "Estado", render: renderActive, sortable: false },
        ]}
        dnd={{ onDrop: handleDrop, disabled: isReordering }}
    >
        {#snippet actions(row: any)}
            {#if canEdit}
                <div class="flex justify-end gap-1">
                    <span class="p-1.5 text-slate-300 group-hover:text-slate-400 cursor-grab transition-colors" title="Arrastrar para reordenar" aria-hidden="true">
                        <GripVertical size={16} />
                    </span>
                    <button class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" onclick={() => openModal(row)} title="Editar medio de acceso" aria-label="Editar medio de acceso">
                        <Edit2 size={16} />
                    </button>
                    <button class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" onclick={() => openDeleteModal(row)} title="Eliminar medio de acceso" aria-label="Eliminar medio de acceso">
                        <Trash2 size={16} />
                    </button>
                </div>
            {/if}
        {/snippet}
    </DataTable>
</div>

<!-- Add/Edit Media Type Modal -->
<Modal
    bind:isOpen={isModalOpen}
    title={editingId ? "Editar Medio de Acceso" : "Nuevo Medio de Acceso"}
    description="Define el sistema de acceso y los edificios donde aplica. La misma tarjeta sirve en todos los edificios seleccionados."
>
    <div class="space-y-4">
        <div>
            <label for="media-name" class="block text-sm font-medium text-slate-700 mb-1">Nombre del Medio</label>
            <Input id="media-name" placeholder={editingId ? "Nombre" : "Ej. P2000, KONE, AccessPRO…"} bind:value={mediaName} />
        </div>
        <div>
            <p class="block text-sm font-medium text-slate-700 mb-2">Edificios donde aplica</p>
            <div class="flex flex-wrap gap-2">
                {#each buildings as b}
                    {@const bid = Number(b.id)}
                    <button
                        type="button"
                        class="px-3 py-1.5 rounded-xl text-[11px] font-bold border-2 transition-all active:scale-95 {mediaBuildings.includes(bid)
                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                            : 'border-slate-200 text-slate-500 hover:border-blue-300'}"
                        onclick={() => toggleMediaBuilding(bid)}
                    >
                        {b.name}
                    </button>
                {/each}
            </div>
            {#if mediaBuildings.length === 0}
                <p class="text-[11px] text-rose-500 mt-1.5">Selecciona al menos un edificio.</p>
            {/if}
        </div>
        <div class="space-y-2 pt-1">
            <label class="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
                <span class="text-sm font-bold text-slate-700">Maneja pisos</span>
                <input type="checkbox" bind:checked={mediaHasFloors} class="w-5 h-5 accent-blue-600" />
            </label>
            {#if editingId}
                <label class="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
                    <span class="text-sm font-bold text-slate-700">Activo</span>
                    <input type="checkbox" bind:checked={mediaActive} class="w-5 h-5 accent-emerald-600" />
                </label>
            {/if}
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isModalOpen = false)}>Cancelar</Button>
        <Button variant="primary" onclick={saveMediaType}>{editingId ? "Actualizar" : "Guardar"}</Button>
    {/snippet}
</Modal>

<!-- Delete Media Type Modal -->
<Modal bind:isOpen={isDeleteModalOpen} title="Eliminar Medio de Acceso" description={`Estás a punto de eliminar "${deleteTarget?.name}". Esta acción es irreversible.`} size="sm">
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
            <label for="media-delete-confirm" class="block text-sm font-medium text-slate-700 mb-1">Confirmación</label>
            <Input id="media-delete-confirm" placeholder={deleteTarget?.name} bind:value={deleteConfirmation} class="border-rose-300 focus:ring-rose-500" />
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isDeleteModalOpen = false)}>Cancelar</Button>
        <Button variant="danger" onclick={confirmDelete} disabled={deleteConfirmation !== deleteTarget?.name}>Eliminar permanentemente</Button>
    {/snippet}
</Modal>