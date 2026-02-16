<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import Select from "../Select.svelte";
    import Badge from "../Badge.svelte";
    import {
        ticketService,
        personnelService,
        profileService,
    } from "../../services";
    import { toast } from "svelte-sonner";
    import {
        ticketState,
        personnelState,
        userState,
        catalogState,
    } from "../../stores";
    import { Search, X, User as UserIcon } from "lucide-svelte";
    import { onMount } from "svelte";

    let {
        isOpen = $bindable(false),
        editingTicket = null,
        onSave,
    }: {
        isOpen: boolean;
        editingTicket?: any;
        onSave?: () => void;
    } = $props();

    // Data Sources
    let users = $state<any[]>([]);
    let dependencies = $derived(catalogState.dependencies);
    let currentUser = $derived(userState.profile);

    // Form State
    let formData = $state({
        createdBy: "",
        type: "Reporte de Fallo",
        priority: "Media",
        title: "", // Still kept for internal summary or email subject
        description: "",
        assignedTo: "",
        // Requestor Data
        requestor: {
            name: "",
            dependency: "",
            extension: "",
            email: "",
        },
        // Related Person
        relatedPersonId: "",
        personNotListed: false,
        notListedPersonName: "",
    });

    // Validations & Search
    let isLoading = $state(false);
    let searchTerm = $state("");
    let searchResults = $state<any[]>([]);
    let selectedPerson = $state<any>(null);
    let showSearchResults = $state(false);

    // Options
    const ticketTypes = [
        "Modificación de datos",
        "Solicitud de acceso",
        "Bloqueo de tarjeta",
        "Baja de tarjeta",
        "Bloqueo de persona",
        "Baja de Persona",
        "Reposicion",
        "Reporte de Fallo",
        "Otro",
    ];

    onMount(async () => {
        // Load users for "Created By" and "Assigned To"
        const pro = await profileService.fetchAll();
        users = pro;
    });

    $effect(() => {
        if (isOpen) {
            if (editingTicket) {
                // Edit Implementation (Basic mapping)
                formData.type = editingTicket.type;
                formData.title = editingTicket.title;
                formData.description = editingTicket.description;
                formData.priority = editingTicket.priority;
                // TODO: Map payload fields back if editing is fully supported
            } else {
                // Reset
                formData = {
                    createdBy: currentUser?.id || "",
                    type: "Reporte de Fallo",
                    priority: "Media",
                    title: "",
                    description: "",
                    assignedTo: "",
                    requestor: {
                        name: currentUser?.full_name || "",
                        dependency: "",
                        extension: "",
                        email: currentUser?.email || "",
                    },
                    relatedPersonId: "",
                    personNotListed: false,
                    notListedPersonName: "",
                };
                searchTerm = "";
                selectedPerson = null;
                showSearchResults = false;
            }
        }
    });

    // Search Logic
    function handleSearch(e: Event) {
        const term = (e.target as HTMLInputElement).value.toLowerCase();
        searchTerm = term;

        if (term.length < 2) {
            searchResults = [];
            showSearchResults = false;
            return;
        }

        const all = personnelState.personnel;
        searchResults = all
            .filter(
                (p) =>
                    p.name.toLowerCase().includes(term) ||
                    p.employee_no.toLowerCase().includes(term) ||
                    p.cards.some((c) => c.folio.toLowerCase().includes(term)),
            )
            .slice(0, 5);

        showSearchResults = true;
    }

    function selectPerson(person: any) {
        selectedPerson = person;
        formData.relatedPersonId = person.id;
        formData.personNotListed = false;
        searchTerm = "";
        showSearchResults = false;
    }

    function clearSelectedPerson() {
        selectedPerson = null;
        formData.relatedPersonId = "";
    }

    function toggleNotListed() {
        formData.personNotListed = !formData.personNotListed;
        if (formData.personNotListed) {
            clearSelectedPerson();
            searchTerm = "";
        }
    }

    async function handleSubmit() {
        // Validation
        if (!formData.description || !formData.type) {
            toast.error(
                "Complete los campos obligatorios (Tipo y Descripción)",
            );
            return;
        }

        isLoading = true;
        try {
            // Construct Payload
            const payload = {
                createdBy: formData.createdBy,
                assignedTo: formData.assignedTo,
                requestor: formData.requestor,
                relatedPerson: formData.personNotListed
                    ? { name: formData.notListedPersonName, type: "external" }
                    : {
                          id: formData.relatedPersonId,
                          name: selectedPerson?.name,
                          type: "system",
                      },
            };

            const title = `${formData.type} - ${formData.personNotListed ? formData.notListedPersonName : selectedPerson?.name || "General"}`;

            const ticketData = {
                title: title,
                description: formData.description,
                type: formData.type,
                priority: formData.priority,
                person_id: formData.relatedPersonId || null,
                payload: payload,
                // status defaults to pending in backend or service
            };

            await ticketService.create(ticketData);
            toast.success("Ticket creado exitosamente");
            onSave?.();

            isOpen = false;
        } catch (e) {
            console.error(e);
            toast.error("Error al crear ticket");
        } finally {
            isLoading = false;
        }
    }
</script>

<Modal
    bind:isOpen
    title={editingTicket ? "Editar Ticket" : "Nuevo Ticket"}
    size="xl"
>
    <div class="space-y-6">
        <!-- SECTION 1: Classification -->
        <fieldset
            class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
        >
            <legend
                class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
            >
                Clasificación
            </legend>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                    <label
                        class="text-xs font-bold text-slate-600 block"
                        for="createdBy"
                    >
                        Creado Por
                    </label>
                    <Select id="createdBy" bind:value={formData.createdBy}>
                        {#each users as u}
                            <option value={u.id}
                                >{u.full_name || u.email}</option
                            >
                        {/each}
                    </Select>
                </div>

                <div class="space-y-1.5">
                    <label
                        class="text-xs font-bold text-slate-600 block"
                        for="assignedTo"
                    >
                        Asignado A
                    </label>
                    <Select id="assignedTo" bind:value={formData.assignedTo}>
                        {#each users as u}
                            <option value={u.id}
                                >{u.full_name || u.email}</option
                            >
                        {/each}
                    </Select>
                </div>

                <div class="space-y-1.5">
                    <label
                        class="text-xs font-bold text-slate-600 block"
                        for="type"
                    >
                        Tipo de Ticket
                    </label>
                    <Select id="type" bind:value={formData.type}>
                        {#each ticketTypes as t}
                            <option value={t}>{t}</option>
                        {/each}
                    </Select>
                </div>

                <div class="space-y-1.5">
                    <label
                        class="text-xs font-bold text-slate-600 block"
                        for="priority"
                    >
                        Prioridad
                    </label>
                    <Select id="priority" bind:value={formData.priority}>
                        <option value="Baja">Baja</option>
                        <option value="Media">Media</option>
                        <option value="Alta">Alta</option>
                        <option value="Critica">Crítica</option>
                    </Select>
                </div>
            </div>
        </fieldset>

        <!-- SECTION 2: Related Person (Search) -->
        <fieldset
            class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
        >
            <legend
                class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
            >
                Personal Relacionado
            </legend>

            {#if selectedPerson}
                <div
                    class="bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative"
                >
                    <button
                        onclick={clearSelectedPerson}
                        class="absolute top-2 right-2 text-slate-400 hover:text-rose-500"
                    >
                        <X size={16} />
                    </button>
                    <div class="flex items-center gap-3">
                        <div
                            class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
                        >
                            <UserIcon size={20} />
                        </div>
                        <div>
                            <p class="text-sm font-bold text-slate-800">
                                {selectedPerson.name}
                            </p>
                            <p class="text-xs text-slate-500">
                                {selectedPerson.dependency}
                            </p>
                            <Badge
                                variant={selectedPerson.status === "Activo/a"
                                    ? "emerald"
                                    : "slate"}
                            >
                                {selectedPerson.status}
                            </Badge>
                        </div>
                    </div>
                </div>
            {:else if formData.personNotListed}
                <div class="space-y-2">
                    <Input
                        placeholder="Nombre de la persona..."
                        bind:value={formData.notListedPersonName}
                    />
                    <p class="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                        Persona externa o no registrada en el sistema.
                    </p>
                    <button
                        type="button"
                        class="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors bg-blue-100 text-blue-700 border border-blue-200"
                        onclick={toggleNotListed}
                    >
                        <Search size={14} />
                        Buscar en sistema
                    </button>
                </div>
            {:else}
                <div class="relative">
                    <div class="relative">
                        <Search
                            class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size={16}
                        />
                        <Input
                            placeholder="Buscar (Nombre, Nómina, Tarjeta)..."
                            class="pl-9"
                            value={searchTerm}
                            oninput={handleSearch}
                        />
                    </div>

                    {#if showSearchResults}
                        <div
                            class="absolute z-10 w-full mt-1 bg-white rounded-lg border border-slate-200 shadow-lg max-h-60 overflow-y-auto"
                        >
                            {#if searchResults.length === 0}
                                <div
                                    class="p-3 text-sm text-slate-500 text-center"
                                >
                                    No se encontraron resultados
                                </div>
                            {:else}
                                {#each searchResults as p}
                                    <button
                                        class="w-full text-left p-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center gap-2"
                                        onclick={() => selectPerson(p)}
                                    >
                                        <div
                                            class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0"
                                        >
                                            <UserIcon size={14} />
                                        </div>
                                        <div>
                                            <p
                                                class="text-sm font-bold text-slate-700"
                                            >
                                                {p.name}
                                            </p>
                                            <p class="text-xs text-slate-500">
                                                {p.employee_no}
                                            </p>
                                        </div>
                                    </button>
                                {/each}
                            {/if}
                        </div>
                    {/if}

                    <button
                        type="button"
                        class="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors {formData.personNotListed
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'text-slate-500 border border-slate-200 hover:bg-slate-50'}"
                        onclick={toggleNotListed}
                    >
                        Persona no listada / Externa
                    </button>
                </div>
            {/if}
        </fieldset>

        <!-- SECTION 3: Requestor Data -->
        <fieldset
            class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
        >
            <legend
                class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
            >
                Datos del Solicitante
            </legend>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                    <label
                        class="text-xs font-bold text-slate-600 block mb-1"
                        for="reqName">Nombre</label
                    >
                    <Input id="reqName" bind:value={formData.requestor.name} />
                </div>
                <div class="space-y-1.5">
                    <label
                        class="text-xs font-bold text-slate-600 block mb-1"
                        for="reqDep">Dependencia</label
                    >
                    <Select
                        id="reqDep"
                        bind:value={formData.requestor.dependency}
                    >
                        {#each dependencies as d}
                            <option value={d.name}>{d.name}</option>
                        {/each}
                    </Select>
                </div>
                <div class="space-y-1.5">
                    <label
                        class="text-xs font-bold text-slate-600 block mb-1"
                        for="reqExt">Extensión</label
                    >
                    <Input
                        id="reqExt"
                        bind:value={formData.requestor.extension}
                        placeholder="1234"
                    />
                </div>
                <div class="space-y-1.5">
                    <label
                        class="text-xs font-bold text-slate-600 block mb-1"
                        for="reqEmail">Correo</label
                    >
                    <Input
                        id="reqEmail"
                        type="email"
                        bind:value={formData.requestor.email}
                        placeholder="usuario@correo.com"
                    />
                </div>
            </div>
        </fieldset>

        <!-- SECTION 4: Description -->
        <fieldset
            class="space-y-4 p-4 rounded-xl border border-slate-200 bg-white"
        >
            <legend
                class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
            >
                Detalles
            </legend>
            <div class="space-y-1.5">
                <label
                    class="text-xs font-bold text-slate-600 block"
                    for="desc"
                >
                    Descripción General <span class="text-rose-500">*</span>
                </label>
                <textarea
                    id="desc"
                    rows="6"
                    class="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                    placeholder="Describa el problema, solicitud o incidente detalladamente..."
                    bind:value={formData.description}
                ></textarea>
            </div>
        </fieldset>
    </div>

    {#snippet footer()}
        <Button
            variant="ghost"
            onclick={() => (isOpen = false)}
            disabled={isLoading}
        >
            Cancelar
        </Button>
        <Button variant="primary" onclick={handleSubmit} loading={isLoading}>
            Crear Ticket / Reporte
        </Button>
    {/snippet}
</Modal>
