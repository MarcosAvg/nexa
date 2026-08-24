<script lang="ts">
    import { toast } from "svelte-sonner";
    import { catalogService } from "../../services";
    import { catalogState } from "../../stores";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import Modal from "../Modal.svelte";
    import DataTable from "../DataTable.svelte";
    import Badge from "../Badge.svelte";
    import DeleteConfirmTypedModal from "../DeleteConfirmTypedModal.svelte";
    import CatalogSectionHeader from "./CatalogSectionHeader.svelte";
    import CatalogRowActions from "./CatalogRowActions.svelte";
    import { useCatalogReorder } from "./useCatalogReorder.svelte";
    import ToggleRow from "../ToggleRow.svelte";
    import { Plus, CreditCard, Layers, Power, Palette } from "lucide-svelte";
    import { MEDIA_COLOR_OPTIONS } from "../../utils/mediaTypeAppearance";

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

    /** Edificios asignados por tipo de medio (del embed de la tabla puente). */
    let buildingsByMedia = $derived.by(() => {
        const map: Record<string, number[]> = {};
        for (const m of mediaTypes) {
            const rels = (m as any).access_media_type_buildings || [];
            if (rels.length > 0) {
                map[m.id] = rels.map((r: any) => Number(r.building_id));
            }
        }
        return map;
    });

    // Reordenamiento con actualización optimista y rollback
    const { isReordering, handleDrop } = useCatalogReorder({
        table: "access_media_types",
        getItems: () => mediaTypes,
        setItems: (items: any[]) => catalogState.setMediaTypes(items),
        fetchFn: fetchMediaTypes,
    });

    // Add/Edit modal state
    let isModalOpen = $state(false);
    let editingId = $state<string | null>(null);
    let mediaName = $state("");
    let mediaHasFloors = $state(true);
    let mediaActive = $state(true);
    /** Edificios seleccionados en el modal (multi-edificio). */
    let mediaBuildings = $state<number[]>([]);
    /** Color de la paleta (variante) para el medio. */
    let mediaColor = $state<string>("emerald");
    let mediaRequiresProgramming = $state(true);
    let mediaRequiresResponsiva = $state(true);
    let mediaRequiresIdentifier = $state(true);

    // Delete modal state
    let isDeleteModalOpen = $state(false);
    let deleteTarget = $state<any>(null);

    async function fetchMediaTypes() {
        const data = await catalogService.fetchMediaTypes();
        catalogState.setMediaTypes(data);
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

    function openModal(type?: any) {
        if (type) {
            editingId = type.id;
            mediaName = type.name;
            mediaHasFloors = !!type.has_floors;
            mediaActive = type.active !== false;
            mediaBuildings = [...(buildingsByMedia[type.id] || [])];
            mediaColor = type.color || "emerald";
            mediaRequiresProgramming = type.requires_programming !== false;
            mediaRequiresResponsiva = type.requires_responsiva !== false;
            mediaRequiresIdentifier = type.requires_identifier !== false;
        } else {
            editingId = null;
            mediaName = "";
            mediaHasFloors = true;
            mediaActive = true;
            mediaBuildings = [];
            mediaColor = "emerald";
            mediaRequiresProgramming = true;
            mediaRequiresResponsiva = true;
            mediaRequiresIdentifier = true;
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
                color: mediaColor,
                requires_programming: mediaRequiresProgramming,
                requires_responsiva: mediaRequiresResponsiva,
                requires_identifier: mediaRequiresIdentifier,
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
        isDeleteModalOpen = true;
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
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
    <CatalogSectionHeader
        title="Medios de Acceso"
        subtitle="Sistemas de acceso por edificio"
        actionLabel="Nuevo Medio"
        icon={Plus}
        {canEdit}
        onNew={() => openModal()}
    />

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
                <CatalogRowActions onEdit={() => openModal(row)} onDelete={() => openDeleteModal(row)} />
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
        <div>
            <p class="block text-sm font-medium text-slate-700 mb-2">Color del medio</p>
            <div class="flex flex-wrap gap-2">
                {#each MEDIA_COLOR_OPTIONS as opt}
                    {@const selected = mediaColor === opt.id}
                    <button
                        type="button"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border-2 transition-all active:scale-95 {selected
                            ? 'border-slate-900 text-slate-900 bg-slate-50'
                            : 'border-slate-200 text-slate-500 hover:border-slate-400'}"
                        onclick={() => (mediaColor = opt.id)}
                        title={`Color ${opt.label}`}
                    >
                        <span class="{opt.dot} w-2.5 h-2.5 rounded-full inline-block"></span>
                        {opt.label}
                    </button>
                {/each}
            </div>
            <p class="text-[11px] text-slate-400 mt-1.5">Personaliza el color con el que se muestra este medio en la app.</p>
        </div>
        <div class="space-y-2 pt-1">
            <ToggleRow label="Maneja pisos" checked={mediaHasFloors} onChange={(v) => (mediaHasFloors = v)} />
            <ToggleRow label="Requiere programación" checked={mediaRequiresProgramming} onChange={(v) => (mediaRequiresProgramming = v)} />
            <ToggleRow label="Requiere responsiva" checked={mediaRequiresResponsiva} onChange={(v) => (mediaRequiresResponsiva = v)} />
            <ToggleRow label="Requiere identificador (folio)" checked={mediaRequiresIdentifier} onChange={(v) => (mediaRequiresIdentifier = v)} />
            {#if editingId}
                <ToggleRow label="Activo" checked={mediaActive} onChange={(v) => (mediaActive = v)} />
            {/if}
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => (isModalOpen = false)}>Cancelar</Button>
        <Button variant="primary" onclick={saveMediaType}>{editingId ? "Actualizar" : "Guardar"}</Button>
    {/snippet}
</Modal>

<!-- Delete Media Type Modal -->
<DeleteConfirmTypedModal
    bind:isOpen={isDeleteModalOpen}
    title="Eliminar Medio de Acceso"
    targetName={deleteTarget?.name ?? ""}
    confirmText="Eliminar permanentemente"
    onConfirm={confirmDelete}
    onCancel={() => (isDeleteModalOpen = false)}
/>
