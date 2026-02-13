<script lang="ts">
    import {
        X,
        AlertCircle,
        FileText,
        Users,
        CreditCard,
        Briefcase,
        Search,
    } from "lucide-svelte";
    import Button from "./Button.svelte";
    import Badge from "./Badge.svelte";
    import { ticketService } from "../services/data";
    import { HistoryService } from "../services/history";

    let {
        isOpen = $bindable(false),
        personnel = [],
        dependencies = [],
        currentUser = null,
        onSave,
    } = $props();

    let description = $state("");
    let type = $state("Reporte de Fallo");
    let priority = $state("Media");
    let selectedPersonId = $state("");
    let searchQuery = $state("");

    // Conditional fields state
    let accessType = $state("P2000");
    let cardType = $state("Todas");

    // Solicitor info state
    let solicitorName = $state("");
    let solicitorDept = $state("");
    let solicitorExt = $state("");
    let solicitorEmail = $state("");

    let showResults = $state(false);
    let isSubmitting = $state(false);
    let error = $state("");

    const ticketTypes = [
        "Modificación de Datos",
        "Solicitud de Acceso",
        "Bloqueo de Tarjeta",
        "Baja de Tarjeta",
        "Baja de Persona",
        "Reposición",
        "Reporte de Fallo",
        "Otro",
    ];

    const priorities = ["Baja", "Media", "Alta", "Crítica"];

    let filteredPersonnel = $derived.by(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query || selectedPersonId) return [];

        return personnel
            .filter((p) => {
                const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
                const employeeNo = (p.employee_no || "").toLowerCase();
                const hasMatchingCard = (p.cards || []).some((c: any) =>
                    c.folio.toLowerCase().includes(query),
                );

                return (
                    fullName.includes(query) ||
                    employeeNo.includes(query) ||
                    hasMatchingCard
                );
            })
            .slice(0, 5);
    });

    let selectedPerson = $derived(
        personnel.find((p) => p.id === selectedPersonId),
    );

    async function handleSubmit() {
        if (!type) {
            error = "Por favor selecciona un tipo de ticket.";
            return;
        }

        isSubmitting = true;
        error = "";

        try {
            const newTicket = {
                title: type, // Title is now the ticket type
                description,
                type,
                priority,
                person_id: selectedPersonId || null,
                payload: {
                    accessType:
                        type === "Solicitud de Acceso" ? accessType : undefined,
                    cardType: [
                        "Baja de Tarjeta",
                        "Reposición",
                        "Bloqueo de Tarjeta",
                    ].includes(type)
                        ? cardType
                        : undefined,
                    creator: currentUser
                        ? {
                              name:
                                  currentUser.name ||
                                  `${currentUser.first_name} ${currentUser.last_name}`,
                              email: currentUser.email,
                          }
                        : undefined,
                    solicitor: {
                        name: solicitorName,
                        department: solicitorDept,
                        extension: solicitorExt,
                        email: solicitorEmail,
                    },
                },
            };

            await ticketService.create(newTicket);

            // Log history
            const creatorName = currentUser
                ? currentUser.name ||
                  `${currentUser.first_name} ${currentUser.last_name}`
                : "Sistema";
            await HistoryService.log(
                "TICKET",
                selectedPersonId || "SYSTEM", // If no person, maybe system or just leave empty ID? Ticket creation usually has a person or is general.
                // Actually the log function expects entityId as string.
                // If it's a general ticket, maybe we log it against the ticket itself? But we don't have the ticket ID yet as create returns void.
                // Let's log against PERSONNEL if selected, otherwise SYSTEM.
                "CREATE_TICKET",
                { message: `Ticket tipo ${type} creado por ${creatorName}` },
            );

            onSave(); // Refresh data
            isOpen = false;
            resetForm();
        } catch (e) {
            console.error(e);
            error = "Error al crear el ticket. Inténtalo de nuevo.";
        } finally {
            isSubmitting = false;
        }
    }

    function selectPerson(person: any) {
        selectedPersonId = person.id;
        searchQuery = `${person.first_name} ${person.last_name}`;
        showResults = false;
    }

    function clearSelection() {
        selectedPersonId = "";
        searchQuery = "";
    }

    function resetForm() {
        description = "";
        type = "Reporte de Fallo";
        priority = "Media";
        selectedPersonId = "";
        searchQuery = "";

        // Reset conditional fields
        accessType = "Temporal";
        cardType = "P2000";

        // Reset conditional fields
        accessType = "P2000";
        cardType = "Todas";

        // Reset solicitor info (manual entry)
        solicitorName = "";
        solicitorDept = "";
        solicitorExt = "";
        solicitorEmail = "";

        error = "";
    }
</script>

{#if isOpen}
    <div
        class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300"
        role="dialog"
        aria-modal="true"
    >
        <div
            class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        >
            <!-- Header -->
            <div
                class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"
            >
                <div>
                    <h2 class="text-xl font-bold text-slate-900">
                        Nuevo Ticket
                    </h2>
                    <p class="text-sm text-slate-500 mt-0.5">
                        Crea una tarea o reporte manual
                    </p>
                </div>
                <button
                    onclick={() => (isOpen = false)}
                    class="p-2 hover:bg-slate-200/50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <!-- Content -->
            <div class="p-6 overflow-y-auto space-y-5">
                {#if error}
                    <div
                        class="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-sm text-red-600"
                    >
                        <AlertCircle size={18} class="mt-0.5" />
                        <p>{error}</p>
                    </div>
                {/if}

                <div class="space-y-5">
                    <!-- Creator Info (Read Only) -->
                    {#if currentUser}
                        <div
                            class="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl"
                        >
                            <div
                                class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500"
                            >
                                <Users size={16} />
                            </div>
                            <div>
                                <p
                                    class="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                                >
                                    Creado por
                                </p>
                                <p class="text-sm font-bold text-slate-900">
                                    {currentUser.name ||
                                        `${currentUser.first_name} ${currentUser.last_name}`}
                                </p>
                            </div>
                        </div>
                    {/if}

                    <!-- Type & Priority Row -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1.5">
                            <span
                                class="text-xs font-bold text-slate-700 uppercase tracking-wider"
                            >
                                Tipo
                            </span>
                            <div class="relative">
                                <Briefcase
                                    size={18}
                                    class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                                <select
                                    bind:value={type}
                                    class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all appearance-none font-medium text-slate-700"
                                >
                                    {#each ticketTypes as t}
                                        <option value={t}>{t}</option>
                                    {/each}
                                </select>
                            </div>
                        </div>

                        <div class="space-y-1.5">
                            <span
                                class="text-xs font-bold text-slate-700 uppercase tracking-wider"
                            >
                                Prioridad
                            </span>
                            <div class="relative">
                                <AlertCircle
                                    size={18}
                                    class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                                <select
                                    bind:value={priority}
                                    class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all appearance-none font-medium text-slate-700"
                                >
                                    {#each priorities as p}
                                        <option value={p}>{p}</option>
                                    {/each}
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Conditional Fields -->
                    {#if type === "Solicitud de Acceso"}
                        <div class="space-y-1.5">
                            <span
                                class="text-xs font-bold text-slate-700 uppercase tracking-wider"
                            >
                                Tipo de Acceso
                            </span>
                            <div class="relative">
                                <select
                                    bind:value={accessType}
                                    class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all appearance-none font-medium text-slate-700"
                                >
                                    <option value="P2000">P2000</option>
                                    <option value="KONE">KONE</option>
                                </select>
                            </div>
                        </div>
                    {/if}

                    {#if ["Baja de Tarjeta", "Reposición", "Bloqueo de Tarjeta"].includes(type)}
                        <div class="space-y-1.5">
                            <span
                                class="text-xs font-bold text-slate-700 uppercase tracking-wider"
                            >
                                Tipo de Tarjeta
                            </span>
                            <div class="relative">
                                <select
                                    bind:value={cardType}
                                    class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all appearance-none font-medium text-slate-700"
                                >
                                    <option value="Todas">Todas</option>
                                </select>
                            </div>
                        </div>
                    {/if}

                    <!-- Related Person: Intelligent Search -->
                    <div class="space-y-1.5 relative">
                        <span
                            class="text-xs font-bold text-slate-700 uppercase tracking-wider"
                        >
                            Personal Relacionado (Opcional)
                        </span>
                        <div class="relative">
                            <Search
                                size={18}
                                class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                                type="text"
                                bind:value={searchQuery}
                                onfocus={() => (showResults = true)}
                                placeholder="Nombre, No. Nómina o Folio Tarjeta..."
                                class="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium"
                                readonly={!!selectedPersonId}
                            />
                            {#if selectedPersonId}
                                <button
                                    type="button"
                                    onclick={clearSelection}
                                    class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X size={16} />
                                </button>
                            {/if}
                        </div>

                        <!-- Results Portal -->
                        {#if showResults && filteredPersonnel.length > 0}
                            <div
                                class="absolute z-10 w-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden max-h-60 overflow-y-auto"
                            >
                                {#each filteredPersonnel as person}
                                    <button
                                        type="button"
                                        class="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors flex flex-col gap-0.5"
                                        onclick={() => selectPerson(person)}
                                    >
                                        <div
                                            class="flex items-center justify-between"
                                        >
                                            <span
                                                class="text-sm font-bold text-slate-900"
                                            >
                                                {person.first_name}
                                                {person.last_name}
                                            </span>
                                            <span
                                                class="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded"
                                            >
                                                {person.employee_no}
                                            </span>
                                        </div>
                                        {#if person.cards?.length > 0}
                                            <div
                                                class="flex flex-wrap gap-1 mt-1"
                                            >
                                                {#each person.cards as card}
                                                    <Badge
                                                        variant={card.type ===
                                                        "KONE"
                                                            ? "blue"
                                                            : "amber"}
                                                        class="text-[8px] px-1 py-0 h-3.5"
                                                    >
                                                        {card.type}: {card.folio}
                                                    </Badge>
                                                {/each}
                                            </div>
                                        {/if}
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>

                    <!-- Solicitor Info -->
                    <div
                        class="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4"
                    >
                        <div class="flex items-center gap-2 mb-2">
                            <Users size={16} class="text-slate-500" />
                            <h3 class="text-sm font-bold text-slate-900">
                                Datos del Solicitante
                            </h3>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1.5">
                                <span
                                    class="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                                    >Nombre</span
                                >
                                <input
                                    type="text"
                                    bind:value={solicitorName}
                                    class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                                />
                            </div>
                            <div class="space-y-1.5">
                                <span
                                    class="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                                    >Dependencia</span
                                >
                                <div class="relative">
                                    <Briefcase
                                        size={14}
                                        class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    />
                                    <select
                                        bind:value={solicitorDept}
                                        class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 appearance-none"
                                    >
                                        <option value="" disabled selected
                                            >Seleccionar...</option
                                        >
                                        {#each dependencies as dep}
                                            <option value={dep.name}
                                                >{dep.name}</option
                                            >
                                        {/each}
                                    </select>
                                </div>
                            </div>
                            <div class="space-y-1.5">
                                <span
                                    class="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                                    >Extensión</span
                                >
                                <input
                                    type="text"
                                    bind:value={solicitorExt}
                                    class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                                />
                            </div>
                            <div class="space-y-1.5">
                                <span
                                    class="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                                    >Correo</span
                                >
                                <input
                                    type="email"
                                    bind:value={solicitorEmail}
                                    class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Description -->
                    <div class="space-y-1.5">
                        <span
                            class="text-xs font-bold text-slate-700 uppercase tracking-wider"
                        >
                            Descripción General
                        </span>
                        <textarea
                            bind:value={description}
                            rows="3"
                            class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium resize-none"
                            placeholder="Describe el problema o solicitud con más detalle..."
                        ></textarea>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div
                class="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3"
            >
                <Button
                    variant="secondary"
                    onclick={() => (isOpen = false)}
                    disabled={isSubmitting}
                >
                    Cancelar
                </Button>
                <Button
                    variant="primary"
                    onclick={handleSubmit}
                    disabled={isSubmitting}
                    class="min-w-[120px]"
                >
                    {#if isSubmitting}
                        Guardando...
                    {:else}
                        Crear Ticket
                    {/if}
                </Button>
            </div>
        </div>
    </div>
{/if}
