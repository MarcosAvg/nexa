<script lang="ts">
    import {
        ticketState,
        userState,
        personnelState,
        catalogState,
    } from "../stores";
    import SectionHeader from "../components/SectionHeader.svelte";
    import TaskBanner from "../components/TaskBanner.svelte";
    import Button from "../components/Button.svelte";
    import FilterGroup from "../components/FilterGroup.svelte";
    import FilterSelect from "../components/FilterSelect.svelte";
    import Input from "../components/Input.svelte";
    import TicketModal from "../components/modals/TicketModal.svelte";
    import ConfirmationModal from "../components/modals/ConfirmationModal.svelte";
    import ModificationCompareModal from "../components/modals/ModificationCompareModal.svelte";
    import ManualTicketDetailsModal from "../components/modals/ManualTicketDetailsModal.svelte";
    import { Search, Plus, FileSpreadsheet } from "lucide-svelte";
    import { ticketService } from "../services/tickets";
    import { cardService } from "../services/cards";
    import { personnelService } from "../services/personnel";
    import { toast } from "svelte-sonner";
    import ImportPreviewModal from "../components/modals/ImportPreviewModal.svelte";
    import ConfirmAltaModal from "../components/modals/ConfirmAltaModal.svelte";
    import TicketImportedDetailsModal from "../components/modals/TicketImportedDetailsModal.svelte";

    let pendingItems = $derived(ticketState.pendingItems);

    // Filters
    let typeFilter = $state("Todos");
    let priorityFilter = $state("Todas");
    let searchQuery = $state("");

    // Modal State
    let isModalOpen = $state(false);
    let editingTicket = $state<any>(null);

    // Manual Details State
    let isManualDetailsOpen = $state(false);
    let manualTicket = $state<any>(null);

    // Import modal
    let isImportOpen = $state(false);

    // Smart ticket modals (from plantilla import)
    let isAltaOpen = $state(false);
    let altaTicket = $state<any>(null);
    let isImportedOpen = $state(false);
    let importedTicket = $state<any>(null);

    // Confirmation States
    let isConfirm1Open = $state(false);
    let isConfirm2Open = $state(false);
    let ticketToComplete = $state<any>(null);

    // Modification Compare Modal
    let isCompareOpen = $state(false);
    let compareTicket = $state<any>(null);

    let personnel = $derived(personnelState.personnel);

    let filteredTickets = $derived.by(() => {
        let items = pendingItems.filter((ticket) => {
            // ... (filters remain the same)
            // 1. Type Filter
            const matchType =
                typeFilter === "Todos" || ticket.type === typeFilter;

            // 2. Priority Filter
            const matchPriority =
                priorityFilter === "Todas" ||
                ticket.priority.toLowerCase() === priorityFilter.toLowerCase();

            // Helper for search
            let pName = "Desconocido";
            if (ticket.personnel) {
                pName = `${ticket.personnel.first_name} ${ticket.personnel.last_name}`;
            } else if (ticket.payload?.relatedPerson?.name) {
                pName = ticket.payload.relatedPerson.name;
            }

            // 3. Search Filter
            const searchLower = searchQuery.toLowerCase();
            const matchSearch =
                searchQuery === "" ||
                ticket.title.toLowerCase().includes(searchLower) ||
                ticket.description.toLowerCase().includes(searchLower) ||
                pName.toLowerCase().includes(searchLower) ||
                (ticket.cardFolio || "").toLowerCase().includes(searchLower);

            return matchType && matchPriority && matchSearch;
        });

        // Basic sort by date desc
        items.sort((a: any, b: any) => {
            return (
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            );
        });

        return items.map((t) => {
            let personName = "Desconocido";

            // Use joined data if available
            if (t.personnel) {
                personName = `${t.personnel.first_name} ${t.personnel.last_name}`;
            } else if (t.payload?.relatedPerson?.name) {
                personName = t.payload.relatedPerson.name;
            }

            return {
                ...t,
                personName,
            };
        });
    });

    const ticketTypes = [
        "Todos",
        "Programación",
        "Firma Responsiva",
        "Modificación de datos",
        "Solicitud de acceso",
        "Reposición",
        "Bloqueo de tarjeta",
        "Baja de tarjeta",
        "Bloqueo de persona",
        "Baja de Persona",
        "Reporte de Fallo",
        "Otro",
    ];

    import { onMount } from "svelte";

    // ... imports

    // ... existing code ...

    async function refreshData() {
        // ... existing refresh logic
        const [tickets, personnel, extraCards] = await Promise.all([
            ticketService.fetchAll(),
            personnelService.fetchAll(),
            cardService.fetchExtra(),
        ]);
        ticketState.setTickets(tickets);
        personnelState.setPersonnel(personnel.data, personnel.count);
        personnelState.setCards(extraCards);
    }

    onMount(() => {
        refreshData();
    });

    // Handlers
    const IMPORTED_TYPES = new Set([
        "Alta de Persona",
        "Modificación",
        "Baja de Persona",
        "Reposición",
        "Reporte de Falla",
    ]);

    function onManageTicket(ticket: any) {
        // Route imported ticket types to dedicated modals
        if (ticket.type === "Alta de Persona") {
            altaTicket = ticket;
            isAltaOpen = true;
            return;
        }
        if (
            IMPORTED_TYPES.has(ticket.type) &&
            ticket.type !== "Alta de Persona"
        ) {
            importedTicket = ticket;
            isImportedOpen = true;
            return;
        }
        if (ticket.type === "Modificación de datos") {
            compareTicket = ticket;
            isCompareOpen = true;
            return;
        }
        // Default: manual details
        manualTicket = ticket;
        isManualDetailsOpen = true;
    }

    function onOpenAddTicket() {
        editingTicket = null;
        isModalOpen = true; // Still use TicketModal for creating new tickets
    }

    function onStartCompletion(ticket: any) {
        if (ticket.type === "Firma Responsiva") {
            if (ticket.person_id) {
                personnelState.selectPerson(ticket.person_id);
                personnelState.highlightedCardId = ticket.card_id;
            } else {
                toast.error("Este ticket no tiene una persona vinculada");
            }
            return;
        }

        if (ticket.type === "Modificación de datos") {
            compareTicket = ticket;
            isCompareOpen = true;
            return;
        }

        // For other types, we can use the manual modal flow or quick complete
        // defaulting to manual modal for consistent "review" experience if clicked via banner
        // But onStartCompletion is triggered by the "check" button on banner

        ticketToComplete = ticket;
        isConfirm1Open = true;
    }

    function handleConfirm1() {
        isConfirm1Open = false;
        setTimeout(() => {
            isConfirm2Open = true;
        }, 300);
    }

    async function handleFinalConfirm() {
        if (!ticketToComplete) return;

        try {
            // 1. Update card status if it's a programming ticket
            if (
                ticketToComplete.type === "Programación" &&
                ticketToComplete.card_id
            ) {
                await cardService.updateProgrammingStatus(
                    ticketToComplete.card_id,
                    "done",
                );
            }
            // 2. Delete ticket
            await ticketService.delete(ticketToComplete.id);

            toast.success("Ticket completado");
            await refreshData();
        } catch (e) {
            console.error(e);
            toast.error("Error al completar el ticket");
        } finally {
            ticketToComplete = null;
            isConfirm2Open = false;
        }
    }
</script>

<div class="space-y-6">
    <SectionHeader title="Tickets de trabajo">
        {#snippet filters()}
            <div
                class="flex flex-col xl:flex-row flex-wrap gap-4 items-center w-full"
            >
                <!-- Type Filters -->
                <div class="w-full xl:w-auto">
                    <FilterSelect
                        label="Tipo"
                        options={ticketTypes}
                        bind:value={typeFilter}
                    />
                </div>

                <!-- Priority -->
                <div class="w-full xl:w-auto">
                    <FilterSelect
                        label="Prioridad"
                        options={["Todas", "Alta", "Media", "Baja"]}
                        bind:value={priorityFilter}
                    />
                </div>

                <!-- Search -->
                <div class="flex-1 min-w-[200px] w-full relative">
                    <Search
                        class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        size={16}
                    />
                    <Input
                        id="ticket-search"
                        placeholder="Buscar por folio, persona..."
                        class="pl-10 h-9 text-xs font-bold"
                        bind:value={searchQuery}
                    />
                </div>
            </div>
        {/snippet}

        {#snippet actions()}
            <Button
                variant="outline"
                onclick={() => (isImportOpen = true)}
                class="flex items-center gap-2 h-10 px-4 border-slate-300"
            >
                <FileSpreadsheet size={16} />
                Importar Plantilla
            </Button>
            <Button
                variant="primary"
                onclick={onOpenAddTicket}
                class="flex items-center gap-2.5 h-10 px-6 shadow-lg shadow-blue-500/20"
            >
                <Plus size={18} strokeWidth={3} />
                Nuevo Ticket
            </Button>
        {/snippet}
    </SectionHeader>

    <div class="flex flex-col gap-4">
        {#if filteredTickets.length === 0}
            <div
                class="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-200 border-dashed"
            >
                No hay tickets pendientes
            </div>
        {:else}
            {#each filteredTickets as ticket (ticket.id)}
                <TaskBanner
                    {ticket}
                    onManage={onManageTicket}
                    onComplete={onStartCompletion}
                />
            {/each}
        {/if}
    </div>
</div>

<TicketModal bind:isOpen={isModalOpen} {editingTicket} />

<ManualTicketDetailsModal
    bind:isOpen={isManualDetailsOpen}
    ticket={manualTicket}
    onComplete={refreshData}
/>

<ConfirmationModal
    bind:isOpen={isConfirm1Open}
    title="Paso 1: Programación Física"
    description="¿Has programado físicamente la tarjeta de acceso en el sistema externo?"
    confirmText="Sí, está programada"
    cancelText="Aún no"
    variant="warning"
    onConfirm={handleConfirm1}
/>

<ConfirmationModal
    bind:isOpen={isConfirm2Open}
    title="Paso 2: Finalizar Proceso"
    description="Esto actualizará el estado de la tarjeta y eliminará este ticket del sistema. ¿Deseas continuar?"
    confirmText="Finalizar Registro"
    cancelText="Regresar"
    variant="info"
    onConfirm={handleFinalConfirm}
/>

<ModificationCompareModal
    bind:isOpen={isCompareOpen}
    ticket={compareTicket}
    onComplete={refreshData}
/>

<ImportPreviewModal bind:isOpen={isImportOpen} onComplete={refreshData} />

<ConfirmAltaModal
    bind:isOpen={isAltaOpen}
    ticket={altaTicket}
    onComplete={refreshData}
/>

<TicketImportedDetailsModal
    bind:isOpen={isImportedOpen}
    ticket={importedTicket}
    onComplete={refreshData}
/>
