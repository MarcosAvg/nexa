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
    import { Search, Plus } from "lucide-svelte";
    import { ticketService } from "../services/tickets";
    import { cardService } from "../services/cards";
    import { personnelService } from "../services/personnel";
    import { toast } from "svelte-sonner";

    let pendingItems = $derived(ticketState.pendingItems);

    // Filters
    let typeFilter = $state("Todos");
    let priorityFilter = $state("Todas");
    let searchQuery = $state("");

    // Modal State
    let isModalOpen = $state(false);
    let editingTicket = $state<any>(null);

    // Confirmation States
    let isConfirm1Open = $state(false);
    let isConfirm2Open = $state(false);
    let ticketToComplete = $state<any>(null);

    let filteredTickets = $derived.by(() => {
        let items = pendingItems.filter((ticket) => {
            // 1. Type Filter
            const matchType =
                typeFilter === "Todos" || ticket.type === typeFilter;

            // 2. Priority Filter
            const matchPriority =
                priorityFilter === "Todas" ||
                ticket.priority.toLowerCase() === priorityFilter.toLowerCase();

            // 3. Search Filter
            const searchLower = searchQuery.toLowerCase();
            const matchSearch =
                searchQuery === "" ||
                ticket.title.toLowerCase().includes(searchLower) ||
                ticket.description.toLowerCase().includes(searchLower) ||
                (ticket.personName || "Desconocido")
                    .toLowerCase()
                    .includes(searchLower) ||
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

        return items.map((t) => ({
            ...t,
            personName: t.personName || "Desconocido",
        }));
    });

    let availableTypes = $derived.by(() => {
        const types = new Set(pendingItems.map((t) => t.type));
        return ["Todos", ...Array.from(types)].sort();
    });

    async function refreshData() {
        const [tickets, personnel, extraCards] = await Promise.all([
            ticketService.fetchAll(),
            personnelService.fetchAll(),
            cardService.fetchExtra(),
        ]);
        ticketState.setTickets(tickets);
        personnelState.setPersonnel(personnel);
        personnelState.setCards(extraCards);
    }

    // Handlers
    function onManageTicket(ticket: any) {
        editingTicket = ticket;
        isModalOpen = true;
    }

    function onOpenAddTicket() {
        editingTicket = null;
        isModalOpen = true;
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
                    <FilterGroup
                        label="Tipo"
                        options={availableTypes}
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
                variant="primary"
                onclick={onOpenAddTicket}
                class="flex items-center gap-2"
            >
                <Plus size={18} />
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
