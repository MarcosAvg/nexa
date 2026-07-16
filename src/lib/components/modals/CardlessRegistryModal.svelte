<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import Select from "../Select.svelte";
    import { User, X, LinkIcon } from "lucide-svelte";
    import { cardlessRegistryService } from "../../services/cardlessRegistry";
    import { personnelService } from "../../services/personnel";
    import { catalogState } from "../../stores";
    import type { CardlessRegistry, Person } from "../../types";
    import { toast } from "svelte-sonner";
    import { networkStore } from "../../stores/network.svelte";

    let {
        isOpen = $bindable(false),
        editingRegistry = null,
        onSave,
        onDelete,
    }: {
        isOpen: boolean;
        editingRegistry?: CardlessRegistry | null;
        onSave?: () => void;
        onDelete?: (registry: CardlessRegistry) => void;
    } = $props();

    let buildings = $derived(catalogState.buildings);
    let buildingNames = $derived(buildings.map((b) => b.name));
    let dependencies = $derived(catalogState.dependencies);
    let dependencyNames = $derived(dependencies.map((d) => d.name));
    let reasons = $derived(cardlessRegistryService.REASONS);

    // Person fields — always visible
    let manualFirstName = $state("");
    let manualLastName  = $state("");
    let manualEmployeeNo = $state("");
    let manualDependency = $state("");

    // Linked person (when a suggestion is chosen)
    let selectedPerson = $state<Person | null>(null);

    // Suggestion dropdown
    let searchResults  = $state<Person[]>([]);
    let isSearching    = $state(false);
    let searchTimeout: ReturnType<typeof setTimeout> | undefined;
    let searchSeq = 0;

    // Rest of the form
    let manualBuilding = $state("");
    let manualFloor    = $state("");
    let selectedReason = $state("");
    let comments       = $state("");
    let recordedAt     = $state("");

    let isSubmitting = $state(false);

    // ── helpers ──────────────────────────────────────────────────

    function toDatetimeLocalValue(isoOrEmpty?: string | null): string {
        const d = isoOrEmpty ? new Date(isoOrEmpty) : new Date();
        if (Number.isNaN(d.getTime())) return toDatetimeLocalValue(null);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function toTitleCase(value: string): string {
        return value.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    }

    function handleNameInput(e: Event, field: "first" | "last") {
        const input = e.target as HTMLInputElement;
        const upped = input.value.toUpperCase();
        const pos = input.selectionStart ?? upped.length;
        if (field === "first") manualFirstName = upped;
        else manualLastName = upped;
        requestAnimationFrame(() => input.setSelectionRange(pos, pos));
        triggerPersonSearch();
    }

    // ── auto-search when both name fields have enough text ────────

    function triggerPersonSearch() {
        clearTimeout(searchTimeout);
        // Only search when not already linked
        if (selectedPerson) return;

        const first = manualFirstName.trim();
        const last  = manualLastName.trim();
        const query = [first, last].filter(Boolean).join(" ");

        if (query.length < 3) {
            searchResults = [];
            return;
        }

        const seq = ++searchSeq;
        isSearching = true;
        searchTimeout = setTimeout(async () => {
            try {
                const { data } = await personnelService.fetchAll(1, 8, query);
                if (seq !== searchSeq) return;
                searchResults = data;
            } finally {
                if (seq === searchSeq) isSearching = false;
            }
        }, 350);
    }

    function selectPerson(person: Person) {
        selectedPerson   = person;
        manualFirstName  = person.first_name || "";
        manualLastName   = person.last_name  || "";
        manualEmployeeNo = person.employee_no || "";
        if (person.dependency && person.dependency !== "N/A") manualDependency = person.dependency;
        if (person.building   && person.building   !== "N/A") manualBuilding   = person.building;
        if (person.floor) manualFloor = person.floor;
        searchResults = [];
    }

    function clearSelectedPerson() {
        selectedPerson = null;
        searchResults  = [];
    }

    // ── form lifecycle ───────────────────────────────────────────

    function resetForm() {
        selectedPerson   = null;
        searchResults    = [];
        manualFirstName  = "";
        manualLastName   = "";
        manualEmployeeNo = "";
        manualBuilding   = "";
        manualDependency = "";
        manualFloor      = "";
        selectedReason   = "";
        comments         = "";
        recordedAt       = toDatetimeLocalValue(null);
    }

    function hydrateFromRegistry(reg: CardlessRegistry) {
        if (reg.person_id) {
            selectedPerson = {
                id: reg.person_id,
                first_name:  reg.first_name  || "",
                last_name:   reg.last_name   || "",
                name: reg.personName || [reg.first_name, reg.last_name].filter(Boolean).join(" "),
                employee_no: reg.employee_no || "",
                building:    reg.buildingName   || "",
                dependency:  reg.dependencyName || "",
                status_raw: "", status: "",
                schedule: null, cards: [],
                floors_p2000: [], floors_kone: [], specialAccesses: [],
            };
        } else {
            selectedPerson = null;
        }

        manualFirstName  = reg.first_name   || "";
        manualLastName   = reg.last_name    || "";
        manualEmployeeNo = reg.employee_no  || "";
        manualBuilding   = reg.buildingName  || "";
        manualDependency = reg.dependencyName || "";
        manualFloor      = reg.floor         || "";
        selectedReason   = reg.reason        || "";
        comments         = reg.comments      || "";
        recordedAt       = toDatetimeLocalValue(reg.recorded_at);
    }

    let formKey = $state<string | null>(null);

    $effect(() => {
        if (!isOpen) { if (formKey !== null) formKey = null; return; }
        const key = editingRegistry ? `edit-${editingRegistry.id}` : "new";
        if (formKey === key) return;
        formKey = key;
        if (editingRegistry) hydrateFromRegistry(editingRegistry);
        else resetForm();
    });

    let availableFloors = $derived.by(() => {
        if (!manualBuilding) return [];
        return buildings.find((b) => b.name === manualBuilding)?.floors || [];
    });

    let hasPendingKone = $derived.by(() => {
        if (!selectedPerson) return false;
        if (editingRegistry && selectedPerson.id === editingRegistry.person_id) {
            return !!editingRegistry.pendingKoneResponsiva;
        }
        const koneCard = selectedPerson.cards?.find(c => c.type === "KONE");
        return !!(koneCard && koneCard.responsiva_status !== "signed" && koneCard.responsiva_status !== "legacy");
    });

    /**
     * Three-value snapshot for kone_status_at_registration:
     *   true  → tiene tarjeta KONE asignada y pendiente de firma
     *   false → tiene tarjeta KONE asignada y ya firmada (digital o legacy)
     *   null  → no tiene tarjeta KONE asignada (o persona no vinculada)
     */
    let koneStatusSnapshot = $derived.by((): boolean | null => {
        if (!selectedPerson) return null;
        // When editing, reuse the stored snapshot if the person hasn't changed
        if (editingRegistry && selectedPerson.id === editingRegistry.person_id) {
            return editingRegistry.kone_status_at_registration ?? null;
        }
        const koneCard = selectedPerson.cards?.find(c => c.type === "KONE");
        // No KONE card assigned at all
        if (!koneCard) return null;
        // Has KONE card — check if responsiva is still pending
        const isPending = koneCard.responsiva_status !== "signed" && koneCard.responsiva_status !== "legacy";
        return isPending;
    });


    function resolveBuildingId(): number | null {
        return buildings.find((b) => b.name === manualBuilding)?.id ?? null;
    }

    function resolveDependencyId(): number | null {
        return dependencies.find((d) => d.name === manualDependency)?.id ?? null;
    }

    async function handleSubmit() {
        if (!networkStore.isOnline) { toast.error("Sin conexión a internet"); return; }
        if (!manualFirstName.trim() || !manualLastName.trim()) {
            toast.error("Ingresa nombre y apellidos");
            return;
        }
        if (!manualDependency.trim()) {
            toast.error("Selecciona una dependencia");
            return;
        }
        if (!manualBuilding.trim()) {
            toast.error("Selecciona un edificio");
            return;
        }
        if (!manualFloor.trim()) {
            toast.error("Selecciona un piso");
            return;
        }
        if (!selectedReason) {
            toast.error("Selecciona un motivo");
            return;
        }

        isSubmitting = true;
        try {
            const recordedAtIso = recordedAt
                ? new Date(recordedAt).toISOString()
                : new Date().toISOString();

            const payload = {
                reason:        selectedReason,
                comments:      comments.trim() || null,
                recorded_at:   recordedAtIso,
                building_id:   resolveBuildingId(),
                dependency_id: resolveDependencyId(),
                floor:         manualFloor || null,
                person_id:     selectedPerson?.id ?? null,
                first_name:    manualFirstName.trim(),
                last_name:     manualLastName.trim(),
                employee_no:   manualEmployeeNo.trim() || null,
                // Snapshot: null = no linked person or no KONE card assigned.
                // true = KONE card assigned but responsiva still pending.
                // false = KONE card assigned and already signed (digital or legacy).
                kone_status_at_registration: koneStatusSnapshot,
            };

            let result: CardlessRegistry | null;
            if (editingRegistry) {
                result = await cardlessRegistryService.update(editingRegistry.id, payload);
                if (result) toast.success("Registro actualizado");
            } else {
                result = await cardlessRegistryService.create(payload);
                if (result) toast.success("Registro creado exitosamente");
            }

            if (result) { isOpen = false; onSave?.(); }
        } catch {
            toast.error("Error al guardar registro");
        } finally {
            isSubmitting = false;
        }
    }

    function handleClose() { isOpen = false; resetForm(); }

    let canSubmit = $derived(
        !!selectedReason &&
        !!manualFirstName.trim() &&
        !!manualLastName.trim() &&
        !!manualDependency.trim() &&
        !!manualBuilding.trim() &&
        !!manualFloor.trim()
    );
</script>

<Modal bind:isOpen title={editingRegistry ? "Editar Registro" : "Nuevo Registro"} size="lg" onclose={handleClose}>
    <div class="space-y-5">

        <!-- ── Person fields ─────────────────────────────────────── -->
        <div class="space-y-3 rounded-xl border p-4 transition-colors duration-200
            {selectedPerson
                ? 'bg-emerald-50/60 border-emerald-200'
                : (manualFirstName || manualLastName)
                    ? 'bg-amber-50/60 border-amber-200'
                    : 'bg-slate-50/60 border-slate-200'}">

            <div class="flex items-center justify-between">
                <p class="text-sm font-medium text-slate-700">Datos de la persona</p>
                {#if selectedPerson}
                    <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Vinculado al sistema
                    </span>
                {:else if manualFirstName || manualLastName}
                    <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        Sin vínculo al sistema
                    </span>
                {/if}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1" for="manual-first-name">Nombres <span class="text-rose-500">*</span></label>
                    <Input
                        id="manual-first-name"
                        type="text"
                        bind:value={manualFirstName}
                        oninput={(e) => handleNameInput(e, "first")}
                        placeholder="Nombres"
                        disabled={!!selectedPerson}
                        style="text-transform: uppercase"
                    />
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1" for="manual-last-name">Apellidos <span class="text-rose-500">*</span></label>
                    <Input
                        id="manual-last-name"
                        type="text"
                        bind:value={manualLastName}
                        oninput={(e) => handleNameInput(e, "last")}
                        placeholder="Apellidos"
                        disabled={!!selectedPerson}
                        style="text-transform: uppercase"
                    />
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1" for="manual-employee-no"># Empleado</label>
                    <Input
                        id="manual-employee-no"
                        type="text"
                        bind:value={manualEmployeeNo}
                        placeholder="# Empleado"
                        disabled={!!selectedPerson}
                    />
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Dependencia <span class="text-rose-500">*</span></label>
                    <Select
                        options={dependencyNames}
                        bind:value={manualDependency}
                        placeholder="Seleccionar dependencia"
                        disabled={!!selectedPerson}
                    />
                </div>
            </div>

            <!-- Suggestion list -->
            {#if searchResults.length > 0 && !selectedPerson}
                <div class="rounded-xl border border-blue-200 bg-blue-50/60 overflow-hidden">
                    <div class="px-3 py-2 flex items-center gap-2 border-b border-blue-100">
                        {#if isSearching}
                            <div class="animate-spin h-3.5 w-3.5 border-2 border-blue-300 border-t-blue-600 rounded-full"></div>
                        {:else}
                            <LinkIcon size={14} class="text-blue-500" />
                        {/if}
                        <span class="text-xs font-semibold text-blue-700">Posibles coincidencias — selecciona para vincular</span>
                    </div>
                    <ul class="max-h-44 overflow-auto divide-y divide-blue-100">
                        {#each searchResults as person (person.id)}
                            <li>
                                <button
                                    type="button"
                                    class="w-full text-left px-3 py-2.5 hover:bg-blue-100/60 transition-colors"
                                    onclick={() => selectPerson(person)}
                                >
                                    <div class="font-medium text-slate-900 text-sm">{person.name}</div>
                                    <div class="text-xs text-slate-500">
                                        #{person.employee_no || "—"} · {person.building || "Sin edificio"} · {person.dependency || "Sin dependencia"}
                                    </div>
                                </button>
                            </li>
                        {/each}
                    </ul>
                </div>
            {:else if isSearching}
                <div class="flex items-center gap-2 text-xs text-slate-500 px-1">
                    <div class="animate-spin h-3.5 w-3.5 border-2 border-slate-300 border-t-blue-600 rounded-full"></div>
                    Buscando coincidencias...
                </div>
            {/if}

            <!-- Linked person chip -->
            {#if selectedPerson}
                <div class="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                    <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <div class="p-1.5 bg-emerald-100 rounded-full">
                                <User class="text-emerald-600" size={16} />
                            </div>
                            <div>
                                <div class="flex flex-wrap items-center gap-1.5 mb-0.5">
                                    <p class="text-emerald-800 font-semibold text-sm">{selectedPerson.name}</p>
                                    {#if koneStatusSnapshot === true}
                                        <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 leading-none whitespace-nowrap">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                            Pendiente de recoger KONE
                                        </span>
                                    {:else if koneStatusSnapshot === false}
                                        <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 leading-none whitespace-nowrap">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                            Tarjeta KONE Entregada
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 leading-none whitespace-nowrap">
                                            Sin tarjeta KONE
                                        </span>
                                    {/if}
                                </div>
                                <p class="text-emerald-600 text-xs">
                                    #{selectedPerson.employee_no || "—"} · {selectedPerson.building || "Sin edificio"} · {selectedPerson.dependency || "Sin dependencia"}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            class="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-100 transition-colors"
                            onclick={clearSelectedPerson}
                            title="Desvincular persona"
                        >
                            <X size={15} />
                        </button>
                    </div>
                </div>
            {/if}
        </div><!-- end person fields -->

        <!-- ── Location ──────────────────────────────────────────── -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Edificio <span class="text-rose-500">*</span></label>
                <Select options={buildingNames} bind:value={manualBuilding} placeholder="Seleccionar edificio" disabled={!!selectedPerson} />
            </div>
            <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Piso Base <span class="text-rose-500">*</span></label>
                <Select options={availableFloors} bind:value={manualFloor} placeholder="Seleccionar piso" disabled={!manualBuilding || !!selectedPerson} />
            </div>
        </div>

        <!-- ── Reason + date ─────────────────────────────────────── -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Motivo <span class="text-rose-500">*</span></label>
                <Select options={reasons} bind:value={selectedReason} placeholder="Seleccionar motivo" />
            </div>
            <div>
                <label class="block text-sm font-medium text-slate-700 mb-1" for="recorded-at">Fecha y Hora</label>
                <Input id="recorded-at" type="datetime-local" bind:value={recordedAt} />
            </div>
        </div>

        <!-- ── Comments ──────────────────────────────────────────── -->
        <div>
            <label class="block text-sm font-medium text-slate-700 mb-1" for="comments">Comentarios</label>
            <textarea
                id="comments"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                rows="3"
                bind:value={comments}
                placeholder="Comentarios adicionales..."
            ></textarea>
        </div>
    </div>

    {#snippet footer()}
        <div class="flex w-full items-center justify-between gap-3">
            <div>
                {#if editingRegistry}
                    <Button variant="danger" onclick={() => onDelete?.(editingRegistry)} disabled={isSubmitting || !networkStore.isOnline}>
                        Eliminar
                    </Button>
                {/if}
            </div>
            <div class="flex items-center gap-2">
                <Button variant="ghost" onclick={handleClose} disabled={isSubmitting}>Cancelar</Button>
                <Button onclick={handleSubmit} loading={isSubmitting} disabled={!canSubmit || isSubmitting || !networkStore.isOnline}>
                    {editingRegistry ? "Guardar Cambios" : "Registrar"}
                </Button>
            </div>
        </div>
    {/snippet}
</Modal>
