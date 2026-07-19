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
    import { handleError } from "../../utils";
    import {
        ticketState,
        personnelState,
        userState,
        catalogState,
    } from "../../stores";
    import { Search, X, User as UserIcon } from "lucide-svelte";
    import { onMount } from "svelte";
    import FormSection from "../FormSection.svelte";
    import FormField from "../FormField.svelte";
    import DependencySelect from "../DependencySelect.svelte";

    let {
        /** Controla la visibilidad del modal (two-way bindable). */
        isOpen = $bindable(false),
        /** Ticket a editar (null = modo creación). */
        editingTicket = null,
        /** Callback al guardar el ticket. */
        onSave,
    }: {
        isOpen: boolean;
        editingTicket?: any;
        onSave?: () => void;
    } = $props();

    // Fuentes de datos
    let users = $state<any[]>([]);
    let dependencies = $derived(catalogState.dependencies);
    let currentUser = $derived(userState.profile);

    // Estado del formulario
    let formData = $state({
        createdBy: "",
        type: "Reporte de Falla",
        priority: "Media",            title: "", // Se mantiene para resumen interno o asunto de correo
        description: "",
        assignedTo: "",
        // Datos del solicitante
        requestor: {
            name: "",
            dependency: "",
            extension: "",
            email: "",
        },
        // Persona relacionada
        relatedPersonId: "",
        personNotListed: false,
        notListedPersonName: "",
        notListedPersonEmployeeNo: "",
        notListedPersonDependency: "",
    });

    // Validaciones y búsqueda
    let isLoading = $state(false);
    let searchTerm = $state("");
    let searchResults = $state<any[]>([]);
    let selectedPerson = $state<any>(null);
    let showSearchResults = $state(false);
    let searchDebounce: ReturnType<typeof setTimeout>;

    // Opciones
    const ticketTypes = [
        "Modificación",
        "Solicitud de acceso",
        "Bloqueo de tarjeta",
        "Baja de tarjeta",
        "Bloqueo de persona",
        "Baja de Persona",
        "Reposición",
        "Reporte de Falla",
        "Otro",
    ];

    onMount(async () => {
        // Cargar usuarios para "Creado por" y "Asignado a"
        const pro = await profileService.fetchAll();
        users = pro;
    });

    $effect(() => {
        if (isOpen) {
            if (editingTicket) {
                // ... existing edit logic
                formData.type = editingTicket.type;
                formData.title = editingTicket.title;
                formData.description = editingTicket.description;
                formData.priority = editingTicket.priority;
            } else {
                // ... existing reset logic
                formData = {
                    createdBy: currentUser?.id || "",
                    type: "Reporte de Falla",
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
                    notListedPersonEmployeeNo: "",
                    notListedPersonDependency: "",
                };
                searchTerm = "";
                selectedPerson = null;
                showSearchResults = false;
            }
        }
    });

    let allPersonnel = $derived(personnelState.personnelOptions);

    // Lógica de búsqueda
    function handleSearch(e: Event) {
        const val = (e.target as HTMLInputElement).value;
        searchTerm = val;

        clearTimeout(searchDebounce);

        if (val.trim().length >= 1) {
            searchDebounce = setTimeout(async () => {
                try {
                    const results = await personnelService.searchByName(
                        "",
                        val,
                    );
                    if (searchTerm === val) {
                        searchResults = results
                            .map((p) => ({
                                ...p,
                                name: `${p.first_name} ${p.last_name}`.trim(),
                            }))
                            .slice(0, 5);
                        showSearchResults = true;
                    }
                } catch {
                    // Manejar errores de búsqueda silenciosamente (no crítico)
                }
            }, 300);
        } else {
            searchResults = [];
            showSearchResults = false;
        }
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
        // Validación
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
                    ? {
                          name: formData.notListedPersonName,
                          employee_no: formData.notListedPersonEmployeeNo,
                          dependency: formData.notListedPersonDependency,
                          type: "external",
                      }
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
            handleError(e, "Crear Ticket");
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
        <FormSection title="Clasificación">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Creado Por" for="createdBy">
                    <Select id="createdBy" bind:value={formData.createdBy}>
                        {#each users as u}
                            <option value={u.id}>{u.full_name || u.email}</option>
                        {/each}
                    </Select>
                </FormField>

                <FormField label="Asignado A" for="assignedTo">
                    <Select id="assignedTo" bind:value={formData.assignedTo}>
                        {#each users as u}
                            <option value={u.id}>{u.full_name || u.email}</option>
                        {/each}
                    </Select>
                </FormField>

                <FormField label="Tipo de Ticket" for="type">
                    <Select id="type" bind:value={formData.type}>
                        {#each ticketTypes as t}
                            <option value={t}>{t}</option>
                        {/each}
                    </Select>
                </FormField>

                <FormField label="Prioridad" for="priority">
                    <Select id="priority" bind:value={formData.priority}>
                        <option value="Baja">Baja</option>
                        <option value="Media">Media</option>
                        <option value="Alta">Alta</option>
                        <option value="Critica">Crítica</option>
                    </Select>
                </FormField>
            </div>
        </FormSection>

        <!-- SECTION 2: Related Person (Search) -->
        <FormSection title="Personal Relacionado">
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
                <div class="space-y-4">
                    <FormField label="Nombre Completo" for="notListedPersonName">
                        <Input
                            id="notListedPersonName"
                            placeholder="Nombre de la persona..."
                            bind:value={formData.notListedPersonName}
                        />
                    </FormField>

                    <div class="grid grid-cols-2 gap-4">
                        <FormField label="No. Empleado" for="notListedPersonEmployeeNo">
                            <Input
                                id="notListedPersonEmployeeNo"
                                placeholder="Ej: 12345"
                                bind:value={formData.notListedPersonEmployeeNo}
                            />
                        </FormField>
                        <FormField label="Dependencia" for="notListedPersonDependency">
                            <DependencySelect
                                id="notListedPersonDependency"
                                bind:value={formData.notListedPersonDependency}
                                placeholder="Seleccione..."
                            />
                        </FormField>
                    </div>

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
        </FormSection>

        <!-- SECTION 3: Requestor Data -->
        <FormSection title="Datos del Solicitante">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Nombre" for="reqName">
                    <Input id="reqName" bind:value={formData.requestor.name} />
                </FormField>
                <FormField label="Dependencia" for="reqDep">
                    <DependencySelect
                        id="reqDep"
                        bind:value={formData.requestor.dependency}
                    />
                </FormField>
                <FormField label="Extensión" for="reqExt">
                    <Input
                        id="reqExt"
                        bind:value={formData.requestor.extension}
                        placeholder="1234"
                    />
                </FormField>
                <FormField label="Correo" for="reqEmail">
                    <Input
                        id="reqEmail"
                        type="email"
                        bind:value={formData.requestor.email}
                        placeholder="usuario@correo.com"
                    />
                </FormField>
            </div>
        </FormSection>

        <!-- SECTION 4: Description -->
        <FormSection title="Detalles">
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
        </FormSection>
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
