<script lang="ts">
    import { appState } from "../state.svelte";
    import SectionHeader from "../components/SectionHeader.svelte";
    import FilterGroup from "../components/FilterGroup.svelte";
    import Button from "../components/Button.svelte";
    import Card from "../components/Card.svelte";
    import DataTable from "../components/DataTable.svelte";
    import Badge from "../components/Badge.svelte";
    import { Search, User, Lock, Trash2, RefreshCw, Ban } from "lucide-svelte";

    let { personnel, extraCards } = $derived(appState);

    // Filters
    let cardStatusFilter = $state("Todas");
    let cardSearch = $state("");

    // Computed Cards Data
    let allCards = $derived.by(() => {
        const cards: any[] = [];
        personnel.forEach((person) => {
            if (person.cards) {
                person.cards.forEach((card: any) => {
                    cards.push({
                        ...card,
                        id: card.id,
                        personId: person.id,
                        personName: person.name,
                        personStatus: person.status,
                    });
                });
            }
        });
        cards.push(
            ...extraCards.map((c) => ({ ...c, personName: "Sin asignar" })),
        );
        return cards;
    });

    let filteredCards = $derived.by(() => {
        let result = allCards;
        if (cardStatusFilter !== "Todas") {
            const statusMap: Record<string, string> = {
                Activa: "active",
                Bloqueada: "blocked",
                Baja: "inactive",
            };
            result = result.filter(
                (c) => c.status === statusMap[cardStatusFilter],
            );
        }
        if (cardSearch.trim() !== "") {
            const search = cardSearch.toLowerCase();
            result = result.filter(
                (c) =>
                    c.folio.toLowerCase().includes(search) ||
                    c.personName.toLowerCase().includes(search),
            );
        }
        return result;
    });

    // Props
    let {
        onOpenAddCard,
        onBlockCard,
        onDeleteCard,
        onViewPerson,
        onUnassignCard,
        onReplaceCard,
        currentUser,
    } = $props<{
        onOpenAddCard: () => void;
        onBlockCard: (card: any) => void;
        onDeleteCard: (card: any) => void;
        onViewPerson: (card: any) => void;
        onUnassignCard: (card: any) => void;
        onReplaceCard: (card: any) => void;
        currentUser?: any;
    }>();

    // Snippets
    function getStatusVariant(status: string) {
        if (status === "active") return "emerald";
        if (status === "blocked") return "rose";
        if (status === "inactive") return "slate";
        return "blue";
    }

    function getStatusLabel(status: string) {
        if (status === "active") return "Activa";
        if (status === "blocked") return "Bloqueada";
        if (status === "inactive") return "Baja";
        return "Disponible";
    }
</script>

{#snippet renderCardType(row: any)}
    <Badge variant={row.type === "KONE" ? "blue" : "amber"}>
        {row.type}
    </Badge>
{/snippet}

{#snippet renderCardPerson(row: any)}
    {#if row.personName === "Sin asignar"}
        <span class="text-slate-400 italic text-sm">{row.personName}</span>
    {:else}
        <div class="font-medium text-slate-900">{row.personName}</div>
    {/if}
{/snippet}

{#snippet renderCardStatus(row: any)}
    <Badge variant={getStatusVariant(row.status)}>
        {getStatusLabel(row.status)}
    </Badge>
{/snippet}

{#snippet renderCardFolio(row: any)}
    <div class="flex items-center gap-2">
        <span class="font-medium text-slate-700">{row.folio}</span>
        {#if row.personId}
            {#if row.responsiva_status !== "signed"}
                <Badge variant="rose" class="text-[8px] px-1 py-0 h-4"
                    >SIN RESPONSIVA</Badge
                >
            {/if}
            {#if row.programming_status !== "done"}
                <Badge variant="blue" class="text-[8px] px-1 py-0 h-4"
                    >SIN PROGRAMAR</Badge
                >
            {/if}
        {/if}
    </div>
{/snippet}

<div class="space-y-6">
    <SectionHeader title="Gestión de tarjetas">
        {#snippet filters()}
            <FilterGroup
                label="Filtros"
                options={["Todas", "Activa", "Bloqueada", "Baja"]}
                bind:value={cardStatusFilter}
            />
            <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                <span
                    class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap"
                    >Buscar</span
                >
                <div class="relative">
                    <input
                        type="text"
                        placeholder="Folio o Persona..."
                        bind:value={cardSearch}
                        class="h-9 pl-9 pr-4 rounded-lg border border-slate-200 bg-slate-50/50 text-xs font-bold text-slate-700 focus:bg-white focus:border-slate-900 transition-all outline-none"
                    />
                    <div
                        class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    >
                        <Search size={14} />
                    </div>
                </div>
            </div>
        {/snippet}

        {#snippet actions()}
            <Button
                variant="outline"
                onclick={() => {
                    import("../utils/xlsxExport").then((m) => {
                        m.exportCardsToExcel(filteredCards, {
                            filters: {
                                status: cardStatusFilter,
                                search: cardSearch,
                            },
                        });
                    });
                }}
            >
                Exportar Excel
            </Button>
            {#if currentUser?.role !== "viewer"}
                <Button variant="primary" onclick={onOpenAddCard}
                    >Nueva Tarjeta</Button
                >
            {/if}
        {/snippet}
    </SectionHeader>

    <Card class="overflow-hidden">
        <DataTable
            data={filteredCards}
            columns={[
                { key: "type", label: "Tipo", render: renderCardType },
                {
                    key: "folio",
                    label: "Folio / No. Tarjeta",
                    render: renderCardFolio,
                },
                {
                    key: "personName",
                    label: "Asignada a",
                    render: renderCardPerson,
                },
                { key: "status", label: "Estado", render: renderCardStatus },
            ]}
        >
            {#snippet actions(row: any)}
                <div class="flex items-center justify-end gap-1">
                    {#if row.personId}
                        <!-- Ver Dueño -->
                        <button
                            type="button"
                            class="p-1.5 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            onclick={() => onViewPerson(row)}
                            title="Ver Dueño"
                        >
                            <User size={16} />
                        </button>
                    {/if}

                    {#if currentUser?.role !== "viewer"}
                        {#if row.status === "inactive"}
                            <!-- Reactivar: Emerald -->
                            <button
                                type="button"
                                class="p-1.5 rounded-full text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors"
                                onclick={() => onBlockCard(row)}
                                title="Reactivar Tarjeta"
                            >
                                <RefreshCw size={16} />
                            </button>
                        {:else}
                            <!-- Bloquear: Amber -->
                            <button
                                type="button"
                                class="p-1.5 rounded-full text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                                onclick={() => onBlockCard(row)}
                                title={row.status === "blocked"
                                    ? "Desbloquear"
                                    : "Bloquear"}
                            >
                                <Lock size={16} />
                            </button>
                        {/if}

                        {#if row.personId && row.status !== "inactive"}
                            <!-- Reposición: Indigo -->
                            <button
                                type="button"
                                class="p-1.5 rounded-full text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                                onclick={() => onReplaceCard(row)}
                                title="Reposición por extravío"
                            >
                                <RefreshCw size={16} />
                            </button>

                            <!-- Dar de baja/Desvincular: Rose -->
                            <button
                                type="button"
                                class="p-1.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                onclick={() => onUnassignCard(row)}
                                title="Dar de baja (Desvincular)"
                            >
                                <Ban size={16} />
                            </button>
                        {/if}

                        <!-- Eliminar / Baja permanente -->
                        <button
                            type="button"
                            class="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-100 transition-colors"
                            onclick={() => onDeleteCard(row)}
                            title={row.status === "inactive"
                                ? "Eliminar permanentemente"
                                : "Dar de baja (Inactivar)"}
                        >
                            <Trash2 size={16} />
                        </button>
                    {/if}
                </div>
            {/snippet}
        </DataTable>
    </Card>
</div>
