<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import Select from "../Select.svelte";
    import { Search, User, AlertTriangle, X } from "lucide-svelte";
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

    let searchQuery = $state("");
    let searchResults = $state<Person[]>([]);
    let selectedPerson = $state<Person | null>(null);
    let personNotFound = $state(false);
    let showManualEntry = $state(false);

    let manualFirstName = $state("");
    let manualLastName = $state("");
    let manualEmployeeNo = $state("");
    let manualBuilding = $state("");
    let manualDependency = $state("");
    let manualFloor = $state("");

    let selectedReason = $state("");
    let comments = $state("");
    let recordedAt = $state("");

    let isSubmitting = $state(false);
    let isSearching = $state(false);
    let searchTimeout: ReturnType<typeof setTimeout> | undefined;
    let searchSeq = 0;

    function toDatetimeLocalValue(isoOrEmpty?: string | null): string {
        const d = isoOrEmpty ? new Date(isoOrEmpty) : new Date();
        if (Number.isNaN(d.getTime())) return toDatetimeLocalValue(null);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function resetForm() {
        searchQuery = "";
        searchResults = [];
        selectedPerson = null;
        personNotFound = false;
        showManualEntry = false;
        manualFirstName = "";
        manualLastName = "";
        manualEmployeeNo = "";
        manualBuilding = "";
        manualDependency = "";
        manualFloor = "";
        selectedReason = "";
        comments = "";
        recordedAt = toDatetimeLocalValue(null);
    }

    function hydrateFromRegistry(reg: CardlessRegistry) {
        searchQuery = "";
        searchResults = [];

        if (reg.person_id) {
            selectedPerson = {
                id: reg.person_id,
                first_name: reg.first_name || "",
                last_name: reg.last_name || "",
                name: reg.personName || [reg.first_name, reg.last_name].filter(Boolean).join(" "),
                employee_no: reg.employee_no || "",
                building: reg.buildingName || "",
                dependency: reg.dependencyName || "",
                status_raw: "",
                status: "",
                schedule: null,
                cards: [],
                floors_p2000: [],
                floors_kone: [],
                specialAccesses: [],
            };
            personNotFound = false;
            showManualEntry = false;
        } else {
            selectedPerson = null;
            personNotFound = true;
            showManualEntry = true;
            manualFirstName = reg.first_name || "";
            manualLastName = reg.last_name || "";
            manualEmployeeNo = reg.employee_no || "";
        }

        manualBuilding = reg.buildingName || "";
        manualDependency = reg.dependencyName || "";
        manualFloor = reg.floor || "";
        selectedReason = reg.reason || "";
        comments = reg.comments || "";
        recordedAt = toDatetimeLocalValue(reg.recorded_at);
    }

    let formKey = $state<string | null>(null);

    $effect(() => {
        if (!isOpen) {
            if (formKey !== null) formKey = null;
            return;
        }
        const key = editingRegistry ? `edit-${editingRegistry.id}` : "new";
        if (formKey === key) return;
        formKey = key;
        if (editingRegistry) {
            hydrateFromRegistry(editingRegistry);
        } else {
            resetForm();
        }
    });

    let availableFloors = $derived.by(() => {
        if (!manualBuilding) return [];
        return buildings.find((b) => b.name === manualBuilding)?.floors || [];
    });

    async function onPersonSearch(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        searchQuery = value;
        clearTimeout(searchTimeout);

        if (value.trim().length < 2) {
            searchResults = [];
            personNotFound = false;
            isSearching = false;
            return;
        }

        const seq = ++searchSeq;
        isSearching = true;
        searchTimeout = setTimeout(async () => {
            try {
                const { data } = await personnelService.fetchAll(1, 8, value.trim());
                if (seq !== searchSeq) return;
                searchResults = data;
                personNotFound = data.length === 0;
                if (data.length === 0) {
                    showManualEntry = true;
                }
            } finally {
                if (seq === searchSeq) isSearching = false;
            }
        }, 300);
    }

    function selectPerson(person: Person) {
        selectedPerson = person;
        searchResults = [];
        searchQuery = person.name;
        personNotFound = false;
        showManualEntry = false;

        if (person.building && person.building !== "N/A") {
            manualBuilding = person.building;
        }
        if (person.dependency && person.dependency !== "N/A") {
            manualDependency = person.dependency;
        }
        if (person.floor) {
            manualFloor = person.floor;
        }
    }

    function clearSelectedPerson() {
        selectedPerson = null;
        searchQuery = "";
        searchResults = [];
        personNotFound = false;
        showManualEntry = false;
    }

    function enableManualEntry() {
        selectedPerson = null;
        personNotFound = true;
        showManualEntry = true;
        searchResults = [];
    }

    function resolveBuildingId(): number | null {
        if (!manualBuilding) return null;
        return buildings.find((b) => b.name === manualBuilding)?.id ?? null;
    }

    function resolveDependencyId(): number | null {
        if (!manualDependency) return null;
        return dependencies.find((d) => d.name === manualDependency)?.id ?? null;
    }

    async function handleSubmit() {
        if (!networkStore.isOnline) {
            toast.error("Sin conexión a internet");
            return;
        }

        if (!selectedReason) {
            toast.error("Selecciona un motivo");
            return;
        }

        if (!selectedPerson && (!manualFirstName.trim() || !manualLastName.trim())) {
            toast.error("Busca una persona o ingresa nombre y apellidos");
            return;
        }

        isSubmitting = true;
        try {
            const recordedAtIso = recordedAt
                ? new Date(recordedAt).toISOString()
                : new Date().toISOString();

            const payload = {
                reason: selectedReason,
                comments: comments.trim() || null,
                recorded_at: recordedAtIso,
                building_id: resolveBuildingId(),
                dependency_id: resolveDependencyId(),
                floor: manualFloor || null,
                person_id: selectedPerson?.id ?? null,
                first_name: selectedPerson
                    ? selectedPerson.first_name
                    : manualFirstName.trim(),
                last_name: selectedPerson
                    ? selectedPerson.last_name
                    : manualLastName.trim(),
                employee_no: selectedPerson
                    ? selectedPerson.employee_no || null
                    : manualEmployeeNo.trim() || null,
            };

            let result: CardlessRegistry | null;
            if (editingRegistry) {
                result = await cardlessRegistryService.update(editingRegistry.id, payload);
                if (result) toast.success("Registro actualizado");
            } else {
                result = await cardlessRegistryService.create(payload);
                if (result) toast.success("Registro creado exitosamente");
            }

            if (result) {
                isOpen = false;
                onSave?.();
            }
        } catch {
            toast.error("Error al guardar registro");
        } finally {
            isSubmitting = false;
        }
    }

    function handleClose() {
        isOpen = false;
        resetForm();
    }

    let canSubmit = $derived(
        !!selectedReason &&
            (!!selectedPerson || (!!manualFirstName.trim() && !!manualLastName.trim()))
    );
</script>

<Modal bind:isOpen title={editingRegistry ? "Editar Registro" : "Nuevo Registro"} size="lg" onclose={handleClose}>
    <div class="space-y-6">
        <div>
            <label class="block text-sm font-medium text-slate-700 mb-2" for="cardless-person-search">
                Buscar persona en la base de datos
            </label>
            <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                    id="cardless-person-search"
                    type="text"
                    placeholder="Nombre o # empleado..."
                    class="pl-10"
                    bind:value={searchQuery}
                    oninput={onPersonSearch}
                    disabled={!!selectedPerson}
                />
                {#if isSearching}
                    <div class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <div class="animate-spin h-4 w-4 border-2 border-slate-300 border-t-blue-600 rounded-full"></div>
                    </div>
                {/if}
            </div>

            {#if searchResults.length > 0 && !selectedPerson}
                <ul class="mt-2 max-h-48 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
                    {#each searchResults as person (person.id)}
                        <li>
                            <button
                                type="button"
                                class="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors"
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
            {/if}

            {#if personNotFound && !selectedPerson}
                <p class="mt-2 text-xs text-amber-700">
                    No se encontraron coincidencias.
                    <button type="button" class="underline font-semibold" onclick={enableManualEntry}>
                        Registrar manualmente
                    </button>
                </p>
            {/if}
        </div>

        {#if selectedPerson}
            <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-start gap-3">
                        <div class="p-2 bg-emerald-100 rounded-full">
                            <User class="text-emerald-600" size={20} />
                        </div>
                        <div>
                            <p class="text-emerald-800 font-medium">
                                {selectedPerson.name}
                            </p>
                            <p class="text-emerald-600 text-sm">
                                #{selectedPerson.employee_no || "—"} · {selectedPerson.building || "Sin edificio"} · {selectedPerson.dependency || "Sin dependencia"}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        class="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-100"
                        onclick={clearSelectedPerson}
                        aria-label="Quitar persona"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        {:else if showManualEntry}
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
                <div class="flex items-start gap-3">
                    <div class="p-2 bg-amber-100 rounded-full">
                        <AlertTriangle class="text-amber-600" size={20} />
                    </div>
                    <p class="text-amber-800 font-medium text-sm">
                        Persona no encontrada — captura manual
                    </p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1" for="manual-first-name">Nombres</label>
                        <Input id="manual-first-name" type="text" bind:value={manualFirstName} placeholder="Nombres" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1" for="manual-last-name">Apellidos</label>
                        <Input id="manual-last-name" type="text" bind:value={manualLastName} placeholder="Apellidos" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1" for="manual-employee-no"># Empleado</label>
                        <Input id="manual-employee-no" type="text" bind:value={manualEmployeeNo} placeholder="# Empleado" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Dependencia</label>
                        <Select
                            options={dependencyNames}
                            bind:value={manualDependency}
                            placeholder="Seleccionar dependencia"
                        />
                    </div>
                </div>
            </div>
        {/if}

        {#if selectedPerson || showManualEntry || editingRegistry}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Edificio</label>
                    <Select
                        options={buildingNames}
                        bind:value={manualBuilding}
                        placeholder="Seleccionar edificio"
                    />
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Piso Base</label>
                    <Select
                        options={availableFloors}
                        bind:value={manualFloor}
                        placeholder="Seleccionar piso"
                        disabled={!manualBuilding}
                    />
                </div>
            </div>
        {/if}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Motivo</label>
                <Select
                    options={reasons}
                    bind:value={selectedReason}
                    placeholder="Seleccionar motivo"
                />
            </div>
            <div>
                <label class="block text-sm font-medium text-slate-700 mb-1" for="recorded-at">Fecha y Hora</label>
                <Input
                    id="recorded-at"
                    type="datetime-local"
                    bind:value={recordedAt}
                />
            </div>
        </div>

        <div>
            <label class="block text-sm font-medium text-slate-700 mb-1" for="comments">Comentarios</label>
            <textarea
                id="comments"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                    <Button
                        variant="danger"
                        onclick={() => onDelete?.(editingRegistry)}
                        disabled={isSubmitting || !networkStore.isOnline}
                    >
                        Eliminar
                    </Button>
                {/if}
            </div>
            <div class="flex items-center gap-2">
                <Button variant="ghost" onclick={handleClose} disabled={isSubmitting}>
                    Cancelar
                </Button>
                <Button
                    onclick={handleSubmit}
                    loading={isSubmitting}
                    disabled={!canSubmit || isSubmitting || !networkStore.isOnline}
                >
                    {editingRegistry ? "Guardar Cambios" : "Registrar"}
                </Button>
            </div>
        </div>
    {/snippet}
</Modal>
