<script lang="ts">
    import { toast } from "svelte-sonner";
    import { catalogService } from "../../services";
    import { catalogState } from "../../stores";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import Modal from "../Modal.svelte";
    import { Plus, Edit2, Trash2, Building2, GripVertical, X, ArrowUp, ArrowDown } from "lucide-svelte";

    /**
     * BuildingCatalog — Gestión de edificios con pisos (CRUD).
     *
     * @example
     * <BuildingCatalog canEdit={isAdmin} />
     */
    type Props = {
        /** Si es true, muestra botones de crear/editar/eliminar. */
        canEdit: boolean;
    };

    let { canEdit }: Props = $props();

    let buildings = $derived(catalogState.buildings);

    // Estado de reordenamiento (evita clics consecutivos en vuelo)
    let isReordering = $state(false);

    // Estado del drag & drop de tarjetas
    let draggingIndex = $state<number | null>(null);
    let dragOverIndex = $state<number | null>(null);


    // Add/Edit modal state
    let isModalOpen = $state(false);
    let editingId = $state<number | null>(null);
    let buildingName = $state("");
    /** Pisos ordenados del edificio (el orden define sort_order). */
    let floorItems = $state<string[]>([]);
    let newFloorInput = $state("");
    // Generador de secuencia
    let seqLevels = $state(10);
    let seqIncludePB = $state(true);

    // Delete modal state
    let isDeleteModalOpen = $state(false);
    let deleteTarget = $state<any>(null);
    let deleteConfirmation = $state("");

    function addFloor() {
        const label = newFloorInput.trim();
        if (!label) return;
        if (label.length > 40) {
            toast.error("El identificador del piso no puede exceder 40 caracteres");
            return;
        }
        if (floorItems.some((f) => f.toLowerCase() === label.toLowerCase())) {
            toast.error(`El piso "${label}" ya existe`);
            return;
        }
        floorItems = [...floorItems, label];
        newFloorInput = "";
    }

    function removeFloor(index: number) {
        floorItems = floorItems.filter((_, i) => i !== index);
    }

    function moveFloor(index: number, dir: -1 | 1) {
        const j = index + dir;
        if (j < 0 || j >= floorItems.length) return;
        const next = [...floorItems];
        [next[index], next[j]] = [next[j], next[index]];
        floorItems = next;
    }

    /** Genera "PB" (opcional) + niveles 1..N y los anexa sin duplicar. */
    function generateSequence() {
        const levels = Math.floor(Number(seqLevels));
        if (!Number.isFinite(levels) || levels < 1 || levels > 200) {
            toast.error("Los niveles deben ser un número entre 1 y 200");
            return;
        }
        const generated: string[] = [];
        if (seqIncludePB) generated.push("PB");
        for (let n = 1; n <= levels; n++) generated.push(String(n));

        const existing = new Set(floorItems.map((f) => f.toLowerCase()));
        const added: string[] = [];
        for (const g of generated) {
            if (!existing.has(g.toLowerCase())) {
                added.push(g);
                existing.add(g.toLowerCase());
            }
        }
        if (added.length === 0) {
            toast.info("No hay pisos nuevos que agregar");
            return;
        }
        floorItems = [...floorItems, ...added];
        newFloorInput = "";
    }

    async function fetchBuildings() {
        const data = await catalogService.fetchBuildings();
        catalogState.setBuildings(data);
    }

    /** Intercambia la tarjeta `from` con la `to` (drag & drop en grid) y persiste el orden. */
    async function handleDrop(from: number, to: number) {
        if (isReordering || from === to) return;
        const next = [...buildings];
        [next[from], next[to]] = [next[to], next[from]];
        isReordering = true;
        // Actualización optimista: los desplegables reflejan el nuevo orden al instante
        catalogState.setBuildings(next);
        try {
            await catalogService.reorderCatalog("buildings", next);
            toast.success("Orden actualizado");
        } catch {
            toast.error("Error al actualizar el orden");
            await fetchBuildings();
        } finally {
            isReordering = false;
        }
    }

    function buildingDragStart(e: DragEvent, index: number) {
        if (isReordering) return;
        e.dataTransfer!.effectAllowed = "move";
        e.dataTransfer!.setData("text/plain", String(index));
        draggingIndex = index;
        dragOverIndex = null;
    }

    function buildingDragOver(e: DragEvent, index: number) {
        if (draggingIndex === null || draggingIndex === index) return;
        e.preventDefault();
        e.dataTransfer!.dropEffect = "move";
        if (dragOverIndex !== index) dragOverIndex = index;
    }

    function buildingDragLeave(e: DragEvent, index: number) {
        // No limpiar si el puntero se mueve a un hijo de la tarjeta (evita parpadeo)
        const related = e.relatedTarget;
        if (related instanceof Node && e.currentTarget instanceof Node && e.currentTarget.contains(related)) return;
        if (dragOverIndex === index) dragOverIndex = null;
    }

    function buildingDrop(e: DragEvent, index: number) {
        if (draggingIndex === null) return;
        e.preventDefault();
        if (draggingIndex !== index) handleDrop(draggingIndex, index);
        draggingIndex = null;
        dragOverIndex = null;
    }

    function buildingDragEnd() {
        draggingIndex = null;
        dragOverIndex = null;
    }

    function openModal(building?: any) {
        if (building) {
            editingId = building.id;
            buildingName = building.name;
            floorItems = [...(building.floors || [])];
        } else {
            editingId = null;
            buildingName = "";
            floorItems = [];
            newFloorInput = "";
            seqLevels = 10;
            seqIncludePB = true;
        }
        isModalOpen = true;
    }

    async function saveBuilding() {
        if (!buildingName.trim()) {
            toast.error("El nombre del edificio es requerido");
            return;
        }
        // Red de seguridad anti-duplicados (case-insensitive) antes de enviar.
        const seen = new Set<string>();
        const floors: string[] = [];
        for (const f of floorItems) {
            const label = f.trim();
            if (!label) continue;
            const k = label.toLowerCase();
            if (seen.has(k)) continue;
            seen.add(k);
            floors.push(label);
        }
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

    <div class="grid sm:grid-cols-2 lg:grid-cols-2 gap-6" role="list">
        {#each buildings as building, i}
            <div
                role="listitem"
                class="group p-6 border border-slate-200/50 rounded-[24px] bg-white/40 hover:bg-white transition-all duration-500 hover:shadow-xl hover:-translate-y-1 relative overflow-hidden {canEdit && !isReordering ? 'cursor-grab active:cursor-grabbing' : ''} {draggingIndex === i ? 'opacity-40' : ''} {draggingIndex !== null && dragOverIndex === i && draggingIndex !== i ? 'ring-2 ring-blue-400 border-blue-200 scale-[1.02]' : ''}"
                draggable={canEdit && !isReordering}
                ondragstart={(e) => buildingDragStart(e, i)}
                ondragover={(e) => buildingDragOver(e, i)}
                ondragleave={(e) => buildingDragLeave(e, i)}
                ondrop={(e) => buildingDrop(e, i)}
                ondragend={buildingDragEnd}
            >
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
                            <span class="p-2.5 text-slate-300 group-hover:text-slate-400 cursor-grab transition-colors" title="Arrastrar para reordenar" aria-hidden="true">
                                <GripVertical size={16} strokeWidth={2.5} />
                            </span>
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
            <p class="block text-sm font-medium text-slate-700 mb-1.5">Pisos</p>

            <!-- Chips de pisos (orden = sort_order) -->
            {#if floorItems.length > 0}
                <div class="flex flex-wrap gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/50 mb-3">
                    {#each floorItems as floor, i}
                        <span
                            class="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 shadow-sm"
                        >
                            {floor}
                            {#if canEdit && floorItems.length > 1}
                                <button
                                    type="button"
                                    class="text-slate-300 hover:text-blue-600 transition-colors disabled:opacity-30"
                                    title="Subir piso"
                                    aria-label={`Subir piso ${floor}`}
                                    disabled={i === 0}
                                    onclick={() => moveFloor(i, -1)}
                                >
                                    <ArrowUp size={11} strokeWidth={3} />
                                </button>
                                <button
                                    type="button"
                                    class="text-slate-300 hover:text-blue-600 transition-colors disabled:opacity-30"
                                    title="Bajar piso"
                                    aria-label={`Bajar piso ${floor}`}
                                    disabled={i === floorItems.length - 1}
                                    onclick={() => moveFloor(i, 1)}
                                >
                                    <ArrowDown size={11} strokeWidth={3} />
                                </button>
                            {/if}
                            {#if canEdit}
                                <button
                                    type="button"
                                    class="text-slate-300 hover:text-rose-500 transition-colors"
                                    title="Quitar piso"
                                    aria-label={`Quitar piso ${floor}`}
                                    onclick={() => removeFloor(i)}
                                >
                                    <X size={12} strokeWidth={3} />
                                </button>
                            {/if}
                        </span>
                    {/each}
                </div>
            {:else}
                <p class="text-xs text-slate-400 mb-3 italic">Sin pisos aún — agrega uno o genera una secuencia.</p>
            {/if}

            {#if canEdit}
                <!-- Agregar piso individual -->
                <form
                    class="flex gap-2"
                    onsubmit={(e) => {
                        e.preventDefault();
                        addFloor();
                    }}
                >
                    <input
                        type="text"
                        bind:value={newFloorInput}
                        placeholder="Ej. PB, 1, 2, Mezzanine…"
                        maxlength={40}
                        class="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        aria-label="Nuevo piso"
                    />
                    <Button type="submit" variant="secondary" size="sm" class="h-10 shrink-0">
                        <Plus size={15} strokeWidth={3} class="mr-1" /> Agregar
                    </Button>
                </form>

                <!-- Generador de secuencia -->
                <div class="mt-3 p-3 rounded-xl border border-dashed border-slate-200 bg-white">
                    <p class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">Generador de secuencia</p>
                    <div class="flex items-center gap-3 flex-wrap">
                        <label class="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                            <input type="checkbox" bind:checked={seqIncludePB} class="w-4 h-4 accent-blue-600" />
                            Incluir Planta Baja
                        </label>
                        <label class="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                            Niveles
                            <input
                                type="number"
                                min={1}
                                max={200}
                                bind:value={seqLevels}
                                class="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-sm tabular-nums focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                        </label>
                        <Button variant="secondary" size="sm" onclick={generateSequence}>
                            Generar
                        </Button>
                    </div>
                    <p class="text-[10px] text-slate-400 mt-2">Anexa "PB" (opcional) y los niveles 1…N, sin duplicar los ya agregados.</p>
                </div>
            {/if}
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
