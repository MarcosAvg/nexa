<script lang="ts">
    import { Plus } from "lucide-svelte";
    import { appState } from "../state.svelte";
    import SectionHeader from "../components/SectionHeader.svelte";
    import FilterGroup from "../components/FilterGroup.svelte";
    import FilterSelect from "../components/FilterSelect.svelte";
    import TaskBanner from "../components/TaskBanner.svelte";
    import Button from "../components/Button.svelte";

    let { pendingItems } = $derived(appState);

    // Filters
    let ticketFilter = $state("Todos");
    let sortOrder = $state("Más antiguos");

    let filteredTickets = $derived.by(() => {
        let items = [...pendingItems];

        // Apply category filter
        if (ticketFilter !== "Todos") {
            if (ticketFilter === "Programación")
                items = items.filter((t: any) => t.type === "Programación");
            else if (ticketFilter === "Firmas")
                items = items.filter((t: any) => t.type === "Firma Responsiva");
            else if (ticketFilter === "Cobros")
                items = items.filter((t: any) => t.type === "Cobro");
            else if (ticketFilter === "P2000")
                items = items.filter((t: any) => t.cardType === "P2000");
            else if (ticketFilter === "KONE")
                items = items.filter((t: any) => t.cardType === "KONE");
        }

        // Apply sorting
        items.sort((a: any, b: any) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return sortOrder === "Más recientes"
                ? dateB - dateA
                : dateA - dateB;
        });

        return items;
    });

    // Props
    let {
        onManageTicket,
        onOpenAddTicket,
        personnel = [],
        onRefresh,
        currentUser,
        dependencies,
    } = $props<{
        onManageTicket: (ticket: any) => void;
        onOpenAddTicket: () => void;
        personnel?: any[];
        onRefresh?: () => void;
        currentUser?: any;
        dependencies?: any[];
    }>();
</script>

<div class="space-y-6">
    <SectionHeader title="Tickets de trabajo">
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
        {#snippet filters()}
            <div class="flex flex-wrap items-center gap-4">
                <FilterGroup
                    label="Filtros"
                    options={[
                        "Todos",
                        "P2000",
                        "KONE",
                        "Programación",
                        "Firmas",
                        "Cobros",
                    ]}
                    bind:value={ticketFilter}
                />
                <FilterSelect
                    label="Ordenar por"
                    options={["Más recientes", "Más antiguos"]}
                    bind:value={sortOrder}
                />
            </div>
        {/snippet}
    </SectionHeader>

    <div class="flex flex-col gap-4">
        {#each filteredTickets as ticket (ticket.id)}
            <TaskBanner {ticket} onManage={onManageTicket} />
        {/each}
    </div>
</div>
