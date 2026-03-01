<script lang="ts">
    import { personnelState, userState, uiState } from "../stores";
    import { onMount, onDestroy } from "svelte";
    import { appEvents, EVENTS } from "../utils/appEvents";
    import SectionHeader from "../components/SectionHeader.svelte";
    import FilterGroup from "../components/FilterGroup.svelte";
    import Button from "../components/Button.svelte";
    import Card from "../components/Card.svelte";
    import DataTable from "../components/DataTable.svelte";
    import Badge from "../components/Badge.svelte";
    import PermissionGuard from "../components/PermissionGuard.svelte";
    import {
        Search,
        User,
        Lock,
        Trash2,
        RefreshCw,
        Ban,
        Plus,
        FileSpreadsheet,
    } from "lucide-svelte";
    import FloatingActionButton from "../components/FloatingActionButton.svelte";
    import AddCardModal from "../components/modals/AddCardModal.svelte";
    import { cardService } from "../services/cards";
    import { toast } from "svelte-sonner";
    import { personnelService } from "../services/personnel";
    import ConfirmationModal from "../components/modals/ConfirmationModal.svelte";
    import { networkStore } from "../stores/network.svelte";

    let personnel = $derived(personnelState.personnel);
    let extraCards = $derived(personnelState.extraCards);

    // Filters
    let cardStatusFilter = $state("Todas");
    let cardTypeFilter = $state("Todos");
    let cardSearch = $state("");

    // Modal State
    let isModalOpen = $state(false);
    let editingCard = $state<any>(null);
    let replacingCard = $state<any>(null);

    let confirmModal = $state({
        isOpen: false,
        title: "",
        description: "",
        variant: "danger" as "danger" | "warning" | "info",
        confirmText: "Confirmar",
        onConfirm: async () => {},
    });

    // State for cards (Decoupled from Personnel Store)
    let cards = $state<any[]>([]);

    let currentPage = $state(1);
    let pageSize = $state(50);
    let totalRecords = $state(0);
    let totalPages = $derived(Math.ceil(totalRecords / pageSize));
    let isLoading = $state(false);

    // Props
    // Phase 2 Refactor: Use appState and stores instead of props

    let currentUser = $derived.by(() => {
        if (!userState.profile) return null;
        return {
            name: userState.profile.full_name || "Usuario",
            email: userState.profile.email,
            avatar: userState.profile.avatar_url,
            role: userState.profile.role,
        };
    });

    // Handlers
    function onOpenAddCard() {
        editingCard = null;
        isModalOpen = true;
    }

    async function refreshData(page: number = 1) {
        isLoading = true;
        currentPage = page;
        try {
            const result = await cardService.fetchAll(
                currentPage,
                pageSize,
                cardSearch,
                cardTypeFilter,
                cardStatusFilter,
            );
            cards = result.data;
            totalRecords = result.count;
        } finally {
            isLoading = false;
        }
    }

    // Debounced Search
    let searchTimeout: any;
    function onSearch(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        cardSearch = value;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            refreshData(1);
        }, 300);
    }

    function onFilterChange() {
        refreshData(1);
    }

    let unsubs: (() => void)[] = [];

    onMount(() => {
        refreshData();

        // Auto-refresh when cards change from other views (e.g. PersonDetailsPanel)
        unsubs.push(
            appEvents.on(EVENTS.CARDS_CHANGED, () => refreshData(currentPage)),
            appEvents.on(EVENTS.PERSONNEL_CHANGED, () =>
                refreshData(currentPage),
            ),
        );
    });

    onDestroy(() => unsubs.forEach((fn) => fn()));

    async function onBlockCard(card: any) {
        const isReactivation =
            card.status === "blocked" || card.status === "inactive";
        confirmModal = {
            isOpen: true,
            title: isReactivation
                ? "¿Reactivar tarjeta?"
                : "¿Bloquear tarjeta?",
            description: isReactivation
                ? "La tarjeta volverá a estar disponible o activa según su asignación."
                : "Se denegará el acceso a esta tarjeta hasta que sea desbloqueada.",
            variant: isReactivation ? "info" : "warning",
            confirmText: isReactivation ? "Reactivar" : "Bloquear",
            onConfirm: async () => {
                const newStatus = isReactivation ? "active" : "blocked";
                await cardService.updateStatus(card.id, newStatus);
                toast.success(
                    newStatus === "blocked"
                        ? "Tarjeta Bloqueada"
                        : "Tarjeta Reactivada",
                );
                await refreshData();
            },
        };
    }

    async function onUnassignCard(card: any) {
        confirmModal = {
            isOpen: true,
            title: "¿Desvincular tarjeta?",
            description:
                "La tarjeta quedará disponible en inventario y dejará de pertenecer a esta persona.",
            variant: "warning",
            confirmText: "Desvincular",
            onConfirm: async () => {
                await cardService.unassign(card.id);
                toast.success("Tarjeta desvinculada");
                await refreshData();
            },
        };
    }

    async function onDeleteCard(card: any) {
        const isInactive = card.status === "inactive";
        confirmModal = {
            isOpen: true,
            title: isInactive
                ? "¿Eliminar permanentemente?"
                : "¿Inactivar tarjeta?",
            description: isInactive
                ? "Esta acción no se puede deshacer. Se borrará todo registro de la tarjeta."
                : "La tarjeta quedará en estado de BAJA y no podrá ser utilizada.",
            variant: "danger",
            confirmText: isInactive
                ? "Eliminar Definitivamente"
                : "SÍ, Inactivar",
            onConfirm: async () => {
                if (isInactive) {
                    await cardService.delete(card.id);
                    toast.success("Tarjeta eliminada permanentemente");
                } else {
                    await cardService.updateStatus(card.id, "inactive");
                    toast.success("Tarjeta inactivada");
                }
                await refreshData();
            },
        };
    }

    function onViewPerson(card: any) {
        if (!card.personId) return;
        personnelState.selectPerson(card.personId);
        uiState.setActivePage("Directorio de Personal");
    }

    function onReplaceCard(card: any) {
        replacingCard = card;
        isModalOpen = true;
    }

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

    function getPageRange(curr: number, total: number): (number | "...")[] {
        const delta = 2; // Number of pages valid before and after current page
        const range: number[] = [];
        const rangeWithDots: (number | "...")[] = [];

        for (let i = 1; i <= total; i++) {
            if (
                i === 1 ||
                i === total ||
                (i >= curr - delta && i <= curr + delta)
            ) {
                range.push(i);
            }
        }

        let l: number | null = null;
        for (const i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l !== 1) {
                    rangeWithDots.push("...");
                }
            }
            rangeWithDots.push(i);
            l = i;
        }

        return rangeWithDots;
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
        <button
            type="button"
            class="group/name flex items-center gap-2 text-left outline-none"
            onclick={() => onViewPerson(row)}
        >
            <div
                class="font-medium text-slate-900 group-hover/name:text-blue-600 group-hover/name:underline underline-offset-4 decoration-blue-300 decoration-2 transition-all"
            >
                {row.personName}
            </div>
            <div
                class="opacity-0 group-hover/name:opacity-100 -translate-x-2 group-hover/name:translate-x-0 transition-all text-blue-500"
            >
                <User size={12} />
            </div>
        </button>
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
            {#if row.responsiva_status === "legacy"}
                <Badge variant="slate" class="text-[8px] px-1 py-0 h-4"
                    >LEGACY</Badge
                >
            {:else if row.responsiva_status !== "signed"}
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
                label="Tipo"
                options={["Todos", "KONE", "P2000"]}
                bind:value={cardTypeFilter}
                onchange={() => onFilterChange()}
            />
            <FilterGroup
                label="Estado"
                options={["Todas", "Disponible", "Activa", "Bloqueada", "Baja"]}
                bind:value={cardStatusFilter}
                onchange={() => onFilterChange()}
            />
            <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                <span
                    class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap"
                    >Buscar</span
                >
                <div class="relative">
                    <input
                        type="text"
                        placeholder="Folio..."
                        value={cardSearch}
                        oninput={onSearch}
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
                variant="soft-emerald"
                class="flex items-center gap-2.5 h-10 px-6"
                disabled={!networkStore.isOnline}
                onclick={async () => {
                    const loadingToast = toast.loading(
                        "Preparando exportación...",
                    );
                    try {
                        const data = await cardService.fetchForExport(
                            cardSearch,
                            cardTypeFilter,
                            cardStatusFilter,
                        );
                        const m = await import("../utils/xlsxExport");
                        m.exportCardsToExcel(data, {
                            filters: {
                                status: cardStatusFilter,
                                search: cardSearch,
                            },
                        });
                        toast.success("Exportación completada", {
                            id: loadingToast,
                        });
                    } catch (e) {
                        console.error(e);
                        toast.error("Error al exportar", { id: loadingToast });
                    }
                }}
            >
                <FileSpreadsheet
                    size={18}
                    strokeWidth={2.5}
                    class="text-emerald-600/80"
                />
                Exportar Excel
            </Button>
            <PermissionGuard requireEdit>
                <Button
                    variant="primary"
                    class="flex items-center gap-2.5 h-10 px-6 shadow-lg shadow-blue-500/20"
                    onclick={onOpenAddCard}
                    disabled={!networkStore.isOnline}
                >
                    <Plus size={18} strokeWidth={3} />
                    Nueva Tarjeta
                </Button>
            </PermissionGuard>
        {/snippet}
    </SectionHeader>

    <!-- Top Pagination (hidden on mobile) -->
    {#if totalRecords > 0}
        <div
            class="hidden sm:flex flex-col sm:flex-row justify-between items-center gap-4 py-2"
        >
            <div class="text-sm text-slate-500">
                Mostrando <span class="font-medium text-slate-900"
                    >{(currentPage - 1) * pageSize + 1}</span
                >
                a
                <span class="font-medium text-slate-900"
                    >{Math.min(currentPage * pageSize, totalRecords)}</span
                >
                de
                <span class="font-medium text-slate-900">{totalRecords}</span>
                registros
            </div>

            <div class="flex items-center gap-2">
                <Button
                    variant="soft-blue"
                    size="sm"
                    disabled={currentPage === 1}
                    onclick={() => refreshData(currentPage - 1)}
                >
                    Anterior
                </Button>

                <div class="flex items-center gap-1">
                    {#each getPageRange(currentPage, totalPages) as page}
                        {#if page === "..."}
                            <span class="px-2 text-slate-400">...</span>
                        {:else}
                            <button
                                class="w-8 h-8 rounded-lg text-sm font-medium transition-colors {currentPage ===
                                page
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                    : 'text-slate-600 hover:bg-slate-100'}"
                                onclick={() => refreshData(page as number)}
                            >
                                {page}
                            </button>
                        {/if}
                    {/each}
                </div>

                <Button
                    variant="soft-blue"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onclick={() => refreshData(currentPage + 1)}
                >
                    Siguiente
                </Button>
            </div>
        </div>
    {/if}

    <Card class="overflow-hidden">
        <DataTable
            data={cards}
            columns={[
                {
                    key: "type",
                    label: "Tipo",
                    render: renderCardType,
                },
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
                {
                    key: "status",
                    label: "Estado",
                    render: renderCardStatus,
                },
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

                    <PermissionGuard requireEdit>
                        {#if row.status === "inactive"}
                            <!-- Reactivar: Emerald -->
                            <button
                                type="button"
                                class="p-1.5 rounded-full transition-colors {networkStore.isOnline
                                    ? 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50'
                                    : 'text-slate-300 cursor-not-allowed opacity-50'}"
                                onclick={() => onBlockCard(row)}
                                disabled={!networkStore.isOnline}
                                title="Reactivar Tarjeta"
                            >
                                <RefreshCw size={16} />
                            </button>
                        {:else}
                            <!-- Bloquear: Amber -->
                            <button
                                type="button"
                                class="p-1.5 rounded-full transition-colors {networkStore.isOnline
                                    ? 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
                                    : 'text-slate-300 cursor-not-allowed opacity-50'}"
                                onclick={() => onBlockCard(row)}
                                disabled={!networkStore.isOnline}
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
                                class="p-1.5 rounded-full transition-colors {networkStore.isOnline
                                    ? 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-50'
                                    : 'text-slate-300 cursor-not-allowed opacity-50'}"
                                onclick={() => onReplaceCard(row)}
                                disabled={!networkStore.isOnline}
                                title="Reposición por extravío"
                            >
                                <RefreshCw size={16} />
                            </button>

                            <!-- Dar de baja/Desvincular: Rose -->
                            <button
                                type="button"
                                class="p-1.5 rounded-full transition-colors {networkStore.isOnline
                                    ? 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'
                                    : 'text-slate-300 cursor-not-allowed opacity-50'}"
                                onclick={() => onUnassignCard(row)}
                                disabled={!networkStore.isOnline}
                                title="Dar de baja (Desvincular)"
                            >
                                <Ban size={16} />
                            </button>
                        {/if}

                        <!-- Eliminar / Baja permanente -->
                        <button
                            type="button"
                            class="p-1.5 rounded-full transition-colors {networkStore.isOnline
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-100'
                                : 'text-slate-300 cursor-not-allowed opacity-50'}"
                            onclick={() => onDeleteCard(row)}
                            disabled={!networkStore.isOnline}
                            title={row.status === "inactive"
                                ? "Eliminar permanentemente"
                                : "Dar de baja (Inactivar)"}
                        >
                            <Trash2 size={16} />
                        </button>
                    </PermissionGuard>
                </div>
            {/snippet}
        </DataTable>
    </Card>

    <!-- Pagination Controls -->
    {#if totalRecords > 0}
        <div
            class="flex flex-col sm:flex-row justify-between items-center gap-4 py-4"
        >
            <div class="text-sm text-slate-500">
                Mostrando <span class="font-medium text-slate-900"
                    >{(currentPage - 1) * pageSize + 1}</span
                >
                a
                <span class="font-medium text-slate-900"
                    >{Math.min(currentPage * pageSize, totalRecords)}</span
                >
                de
                <span class="font-medium text-slate-900">{totalRecords}</span>
                registros
            </div>

            <div class="flex items-center gap-2">
                <Button
                    variant="soft-blue"
                    size="sm"
                    disabled={currentPage === 1}
                    onclick={() => refreshData(currentPage - 1)}
                >
                    Anterior
                </Button>

                <div class="flex items-center gap-1">
                    {#each getPageRange(currentPage, totalPages) as page}
                        {#if page === "..."}
                            <span class="px-2 text-slate-400">...</span>
                        {:else}
                            <button
                                class="w-8 h-8 rounded-lg text-sm font-medium transition-colors {currentPage ===
                                page
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                    : 'text-slate-600 hover:bg-slate-100'}"
                                onclick={() => refreshData(page as number)}
                            >
                                {page}
                            </button>
                        {/if}
                    {/each}
                </div>

                <Button
                    variant="soft-blue"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onclick={() => refreshData(currentPage + 1)}
                >
                    Siguiente
                </Button>
            </div>
        </div>
    {/if}
</div>

<AddCardModal
    bind:isOpen={isModalOpen}
    mode={replacingCard ? "assign" : "inventory"}
    {replacingCard}
    onSave={async (card, replacementOptions) => {
        try {
            await cardService.save(
                {
                    ...card,
                    person_id: replacingCard?.personId,
                },
                replacementOptions,
            );
            toast.success(
                replacingCard
                    ? "Tarjeta reemplazada exitosamente"
                    : "Tarjeta creada en inventario",
            );
            await refreshData();
            isModalOpen = false;
        } catch (e) {
            console.error(e);
            throw e;
        }
    }}
    onclose={() => {
        replacingCard = null;
        isModalOpen = false;
    }}
/>

<ConfirmationModal
    bind:isOpen={confirmModal.isOpen}
    title={confirmModal.title}
    description={confirmModal.description}
    variant={confirmModal.variant}
    confirmText={confirmModal.confirmText}
    onConfirm={confirmModal.onConfirm}
    onCancel={() => (confirmModal.isOpen = false)}
/>

<PermissionGuard requireEdit>
    {#if networkStore.isOnline}
        <FloatingActionButton onclick={onOpenAddCard} label="Nueva Tarjeta" />
    {/if}
</PermissionGuard>
