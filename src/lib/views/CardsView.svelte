<script lang="ts">
    import { personnelState, userState, uiState, cardState, catalogState } from "../stores";
    import { confirm } from "../utils/confirmModal.svelte";
    import { onMount, onDestroy } from "svelte";
    import { appEvents, EVENTS, handleError, createSimpleDebounce } from "../utils";
    import {
        SectionHeader, FilterGroup, FilterSelect, Button, Card,
        DataTable, Badge, PermissionGuard, FloatingActionButton,
        ContentView, SearchInput, Pagination, SkeletonTable, EmptyState,
        AddCardModal, DetectMissingCardsModal, ConfirmationModal,
    } from "../components";
    import {
        User,
        Lock,
        Trash2,
        RefreshCw,
        Ban,
        Plus,
        FileSpreadsheet,
        FileSearch,
        CreditCard,
        FilterX,
    } from "lucide-svelte";

    import { cardService } from "../services/cards";
    import { toast } from "svelte-sonner";
    import { networkStore } from "../stores/network.svelte";
    import { getCardStatusVariant, getCardStatusLabel } from "../constants/status";

    let dependencies = $derived(catalogState.dependencies);
    let dependencyNames = $derived(dependencies.map((d) => d.name));

    // Filtros locales de UI (vinculados al store)
    let cardStatusFilter = $state(cardState.statusFilter);
    let cardTypeFilter = $state(cardState.typeFilter);
    let cardDependencyFilter = $state(cardState.dependencyFilter);
    let cardSearch = $state(cardState.searchQuery);

    // Estado del modal
    let isModalOpen = $state(false);
    let editingCard = $state<any>(null);
    let replacingCard = $state<any>(null);
    let isDetectModalOpen = $state(false);

    // Estado derivado del store
    let cards = $derived(cardState.cards);
    let currentPage = $derived(cardState.currentPage);
    let pageSize = $derived(cardState.pageSize);
    let totalRecords = $derived(cardState.totalRecords);
    let isLoading = $derived(cardState.isLoading);

    // Inicializar subscripciones
    let cleanup: (() => void) | null = null;

    onMount(() => {
        cardState.refresh();
        cleanup = cardState.initSubscriptions();
    });

    onDestroy(() => {
        cleanup?.();
    });

    // Manejadores
    function onOpenAddCard() {
        editingCard = null;
        isModalOpen = true;
    }

    // Búsqueda con debounce
    const debouncedSearch = createSimpleDebounce(() => {
        cardState.setSearch(cardSearch);
        cardState.refresh(1);
    }, 300);

    function onSearch(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        cardSearch = value;
        debouncedSearch();
    }

    function onFilterChange() {
        const depId = cardDependencyFilter
            ? String(dependencies.find((d) => d.name === cardDependencyFilter)?.id ?? "")
            : "";
        cardState.setFilters(cardTypeFilter, cardStatusFilter, depId);
        cardState.refresh(1);
    }

    async function onBlockCard(card: any) {
        const isReactivation = card.status === "blocked" || card.status === "inactive";
        confirm.open({
            title: isReactivation ? "¿Reactivar tarjeta?" : "¿Bloquear tarjeta?",
            description: isReactivation
                ? "La tarjeta volverá a estar disponible o activa según su asignación."
                : "Se denegará el acceso a esta tarjeta hasta que sea desbloqueada.",
            variant: isReactivation ? "info" : "warning",
            confirmText: isReactivation ? "Reactivar" : "Bloquear",
            onConfirm: async () => {
                const newStatus = isReactivation ? "active" : "blocked";
                await cardService.updateStatus(card.id, newStatus);
                toast.success(newStatus === "blocked" ? "Tarjeta Bloqueada" : "Tarjeta Reactivada");
                await cardState.refresh();
            },
        });
    }

    async function onUnassignCard(card: any) {
        confirm.open({
            title: "¿Desvincular tarjeta?",
            description: "La tarjeta quedará disponible en inventario y dejará de pertenecer a esta persona.",
            variant: "warning",
            confirmText: "Desvincular",
            onConfirm: async () => {
                await cardService.unassign(card.id);
                toast.success("Tarjeta desvinculada");
                await cardState.refresh();
            },
        });
    }

    async function onDeleteCard(card: any) {
        const isInactive = card.status === "inactive";
        confirm.open({
            title: isInactive ? "¿Eliminar permanentemente?" : "¿Inactivar tarjeta?",
            description: isInactive
                ? "Esta acción no se puede deshacer. Se borrará todo registro de la tarjeta."
                : "La tarjeta quedará en estado de BAJA y no podrá ser utilizada.",
            variant: "danger",
            confirmText: isInactive ? "Eliminar Definitivamente" : "SÍ, Inactivar",
            onConfirm: async () => {
                if (isInactive) {
                    await cardService.delete(card.id);
                    toast.success("Tarjeta eliminada permanentemente");
                } else {
                    await cardService.updateStatus(card.id, "inactive");
                    toast.success("Tarjeta inactivada");
                }
                await cardState.refresh();
            },
        });
    }

    function onViewPerson(card: any) {
        if (!card.person_id) return;
        personnelState.selectPerson(card.person_id);
        uiState.setActivePage("Directorio de Personal");
    }

    function onReplaceCard(card: any) {
        replacingCard = card;
        isModalOpen = true;
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
    <Badge variant={getCardStatusVariant(row.status)}>
        {getCardStatusLabel(row.status)}
    </Badge>
{/snippet}

{#snippet renderCardFolio(row: any)}
    <div class="flex items-center gap-2">
        <span class="font-medium text-slate-700">{row.folio}</span>
        {#if row.personId}
            {#if row.responsiva_status === "legacy"}
                <Badge variant="slate" class="text-[8px] px-1 py-0 h-4">LEGACY</Badge>
            {:else if row.responsiva_status !== "signed"}
                <Badge variant="rose" class="text-[8px] px-1 py-0 h-4">SIN RESPONSIVA</Badge>
            {/if}
            {#if row.programming_status !== "done"}
                <Badge variant="blue" class="text-[8px] px-1 py-0 h-4">SIN PROGRAMAR</Badge>
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
            <FilterSelect
                label="Dependencia"
                options={dependencyNames}
                placeholder="Todas"
                bind:value={cardDependencyFilter}
                onchange={() => onFilterChange()}
            />
            <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Buscar</span>
                <SearchInput
                    placeholder="Folio..."
                    bind:value={cardSearch}
                    oninput={onSearch}
                    class="h-9 text-xs font-bold"
                />
            </div>
        {/snippet}

        {#snippet actions()}
            <Button
                variant="soft-emerald"
                class="flex items-center gap-2.5 h-10 px-6"
                disabled={!networkStore.isOnline}
                onclick={async () => {
                    const loadingToast = toast.loading("Preparando exportación...");
                    try {
                        const depId = cardDependencyFilter
                        ? String(dependencies.find((d) => d.name === cardDependencyFilter)?.id ?? "")
                        : "";
                    const data = await cardService.fetchForExport(cardSearch, cardTypeFilter, cardStatusFilter, depId);
                        const m = await import("../utils/xlsxExport");
                        m.exportCardsToExcel(data, { filters: { status: cardStatusFilter, search: cardSearch } });
                        toast.success("Exportación completada", { id: loadingToast });
                    } catch (e) {
                        toast.dismiss(loadingToast);
                        handleError(e, "Exportar Tarjetas");
                    }
                }}
            >
                <FileSpreadsheet size={18} strokeWidth={2.5} class="text-emerald-600/80" />
                Exportar Excel
            </Button>
            <Button
                variant="outline"
                class="flex items-center gap-2.5 h-10 px-4 group border-blue-200 text-blue-700 hover:bg-blue-50"
                disabled={!networkStore.isOnline}
                onclick={() => (isDetectModalOpen = true)}
            >
                <FileSearch size={16} class="text-blue-500 transition-transform group-hover:scale-110" />
                Detectar Faltantes
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

    <ContentView
        isLoading={isLoading}
        data={cards}
        emptyTitle="Aún no hay tarjetas registradas"
        emptyTitleFiltered="Sin resultados"
        emptyDescription="El inventario de tarjetas está vacío. Comienza registrando la primera tarjeta P2000 o KONE."
        emptyDescriptionFiltered="No encontramos tarjetas con los filtros actuales. Intenta ajustar tu búsqueda."
        emptyIcon={CreditCard}
        emptyIconBgClass="from-slate-100 to-slate-200 text-slate-400"
        hasFilters={!!(cardSearch || cardTypeFilter !== "Todos" || cardStatusFilter !== "Todas" || cardDependencyFilter)}
        onClearFilters={() => {
            cardSearch = '';
            cardTypeFilter = 'Todos';
            cardStatusFilter = 'Todas';
            cardDependencyFilter = '';
            cardState.setSearch('');
            cardState.setFilters('Todos', 'Todas', '');
            cardState.refresh(1);
        }}
        skeletonColumns={4}
        skeletonRows={5}
        cardClass="overflow-hidden"
    >
        {#snippet children()}
            <DataTable
                data={cards}
                columns={[
                    { key: "type", label: "Tipo", render: renderCardType },
                    { key: "folio", label: "Folio / No. Tarjeta", render: renderCardFolio },
                    { key: "personName", label: "Asignada a", render: renderCardPerson },
                    { key: "status", label: "Estado", render: renderCardStatus },
                ]}
            >
                {#snippet actions(row: any)}
                    <div class="flex items-center justify-end gap-1">
                        {#if row.person_id}
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
                                <button
                                    type="button"
                                    class="p-1.5 rounded-full transition-colors {networkStore.isOnline ? 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50' : 'text-slate-300 cursor-not-allowed opacity-50'}"
                                    onclick={() => onBlockCard(row)}
                                    disabled={!networkStore.isOnline}
                                    title="Reactivar Tarjeta"
                                >
                                    <RefreshCw size={16} />
                                </button>
                            {:else}
                                <button
                                    type="button"
                                    class="p-1.5 rounded-full transition-colors {networkStore.isOnline ? 'text-slate-400 hover:text-amber-500 hover:bg-amber-50' : 'text-slate-300 cursor-not-allowed opacity-50'}"
                                    onclick={() => onBlockCard(row)}
                                    disabled={!networkStore.isOnline}
                                    title={row.status === "blocked" ? "Desbloquear" : "Bloquear"}
                                >
                                    <Lock size={16} />
                                </button>
                            {/if}

                            {#if row.person_id && row.status !== "inactive"}
                                <button
                                    type="button"
                                    class="p-1.5 rounded-full transition-colors {networkStore.isOnline ? 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-50' : 'text-slate-300 cursor-not-allowed opacity-50'}"
                                    onclick={() => onReplaceCard(row)}
                                    disabled={!networkStore.isOnline}
                                    title="Reposición por extravío"
                                >
                                    <RefreshCw size={16} />
                                </button>

                                <button
                                    type="button"
                                    class="p-1.5 rounded-full transition-colors {networkStore.isOnline ? 'text-slate-400 hover:text-rose-500 hover:bg-rose-50' : 'text-slate-300 cursor-not-allowed opacity-50'}"
                                    onclick={() => onUnassignCard(row)}
                                    disabled={!networkStore.isOnline}
                                    title="Dar de baja (Desvincular)"
                                >
                                    <Ban size={16} />
                                </button>
                            {/if}

                            <button
                                type="button"
                                class="p-1.5 rounded-full transition-colors {networkStore.isOnline ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-100' : 'text-slate-300 cursor-not-allowed opacity-50'}"
                                onclick={() => onDeleteCard(row)}
                                disabled={!networkStore.isOnline}
                                title={row.status === "inactive" ? "Eliminar permanentemente" : "Dar de baja (Inactivar)"}
                            >
                                <Trash2 size={16} />
                            </button>
                        </PermissionGuard>
                    </div>
                {/snippet}
            </DataTable>
        {/snippet}

        {#snippet emptyActions()}
            <PermissionGuard requireEdit>
                <Button variant="primary" size="sm" class="h-11 px-7 rounded-xl shadow-lg shadow-blue-500/20" onclick={onOpenAddCard}>
                    <Plus size={18} strokeWidth={3} class="mr-2" />
                    Crear primera tarjeta
                </Button>
            </PermissionGuard>
        {/snippet}
    </ContentView>

    <Pagination
        {currentPage}
        {pageSize}
        {totalRecords}
        onPrevPage={() => cardState.prevPage()}
        onNextPage={() => cardState.nextPage()}
        onGoToPage={(page) => cardState.goToPage(page)}
    />
</div>

<AddCardModal
    bind:isOpen={isModalOpen}
    mode={replacingCard ? "assign" : "inventory"}
    {replacingCard}
    onSave={async (card, replacementOptions) => {
        try {
            await cardService.save(
                { ...card, person_id: replacingCard?.person_id },
                replacementOptions,
            );
            toast.success(replacingCard ? "Tarjeta reemplazada exitosamente" : "Tarjeta creada en inventario");
            await cardState.refresh();
            isModalOpen = false;
        } catch (e) {
            handleError(e, "Guardar Tarjeta");
            throw e;
        }
    }}
    onclose={() => {
        replacingCard = null;
        isModalOpen = false;
    }}
/>

<DetectMissingCardsModal bind:isOpen={isDetectModalOpen} />

<ConfirmationModal
    bind:isOpen={confirm.isOpen}
    title={confirm.title}
    description={confirm.description}
    variant={confirm.variant}
    confirmText={confirm.confirmText}
    cancelText={confirm.cancelText}
    onConfirm={confirm.onConfirm}
    onCancel={() => confirm.close()}
/>

<PermissionGuard requireEdit>
    {#if networkStore.isOnline}
        <FloatingActionButton onclick={onOpenAddCard} label="Nueva Tarjeta" />
    {/if}
</PermissionGuard>
