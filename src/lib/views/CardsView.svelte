<script lang="ts">
    import { personnelState, userState, uiState, cardState, catalogState } from '../stores';
    import { pullRefresh } from '../stores';
    import { confirm } from '../utils/confirmModal.svelte';
    import { handleError, toastWithUndo, haptic } from '../utils';
    import {
        SectionHeader,
        FilterSelect,
        FilterToolbar,
        Button,
        Card,
        DataTable,
        Badge,
        PermissionGuard,
        FloatingActionButton,
        ContentView,
        SearchInput,
        Pagination,
        StatusBadge,
        IconButton,
        DataList,
        AddCardModal,
        ResponsivaProgramBadges,
    } from '../components';
    import {
        User,
        Lock,
        Trash2,
        RefreshCw,
        Ban,
        Plus,
        FileSpreadsheet,
        CreditCard,
        Upload,
    } from 'lucide-svelte';

    import { cardService } from '../services/cards';
    import { toast } from 'svelte-sonner';
    import { networkStore } from '../stores/network.svelte';
    import { mediaTypeVariant } from '../utils/mediaTypeAppearance';
    import MediosImportModal from '../components/modals/MediosImportModal.svelte';

    let dependencies = $derived(catalogState.dependencies);
    let dependencyNames = $derived(dependencies.map((d) => d.name));

    // Estado local de filtros (determinista: se escribe al store justo antes de refrescar).
    let typeFilter = $state('Todos');
    let statusFilter = $state('Todas');
    let searchFilter = $state('');
    // Nombre de dependencia → ID (mapeo local)
    let depNameFilter = $state('');

    function clearCardFilters() {
        typeFilter = 'Todos';
        statusFilter = 'Todas';
        searchFilter = '';
        depNameFilter = '';
    }

    // ─── Selección múltiple y acciones masivas ───────────────────────────
    let selectedCards = $state<any[]>([]);

    $effect(() => pullRefresh.register(() => cardState.refresh(1)));

    function clearSelection() {
        selectedCards = [];
    }

    function bulkSetStatus(status: 'blocked' | 'active') {
        if (!networkStore.isOnline) {
            toast.error('Sin conexión: no se pueden modificar tarjetas.');
            return;
        }
        const targets = selectedCards.filter((c) =>
            status === 'blocked' ? c.status !== 'blocked' : c.status === 'blocked' || c.status === 'inactive',
        );
        if (targets.length === 0) {
            toast.info('No hay tarjetas que actualizar en la selección.');
            return;
        }
        const previous = targets.map((c) => ({ id: c.id, status: c.status }));
        const label = status === 'blocked' ? 'Bloquear' : 'Reactivar';
        confirm.open({
            title: `¿${label} ${targets.length} tarjeta(s)?`,
            description:
                status === 'blocked'
                    ? 'Se denegará el acceso a las tarjetas seleccionadas.'
                    : 'Las tarjetas seleccionadas volverán a estar activas.',
            variant: status === 'blocked' ? 'warning' : 'info',
            confirmText: label,
            onConfirm: async () => {
                try {
                    await Promise.all(targets.map((c) => cardService.updateStatus(c.id, status)));
                    toastWithUndo({
                        message: `${targets.length} tarjeta(s) ${status === 'blocked' ? 'bloqueadas' : 'reactivadas'}`,
                        onUndo: async () => {
                            await Promise.all(previous.map((p) => cardService.updateStatus(p.id, p.status)));
                            await cardState.refresh();
                        },
                    });
                    clearSelection();
                    await cardState.refresh();
                } catch (e) {
                    handleError(e, `${label} tarjetas`);
                }
            },
        });
    }

    function bulkInactivate() {
        if (!networkStore.isOnline) {
            toast.error('Sin conexión: no se pueden modificar tarjetas.');
            return;
        }
        const targets = selectedCards.filter((c) => c.status !== 'inactive');
        if (targets.length === 0) {
            toast.info('No hay tarjetas que inactivar en la selección.');
            return;
        }
        const previous = targets.map((c) => ({ id: c.id, status: c.status }));
        confirm.open({
            title: `¿Inactivar ${targets.length} tarjeta(s)?`,
            description: 'Las tarjetas quedarán en estado de BAJA (no se eliminan) y no podrán utilizarse.',
            variant: 'danger',
            confirmText: 'Inactivar',
            onConfirm: async () => {
                try {
                    await Promise.all(targets.map((c) => cardService.updateStatus(c.id, 'inactive')));
                    toastWithUndo({
                        message: `${targets.length} tarjeta(s) inactivada(s)`,
                        onUndo: async () => {
                            await Promise.all(previous.map((p) => cardService.updateStatus(p.id, p.status)));
                            await cardState.refresh();
                        },
                    });
                    clearSelection();
                    await cardState.refresh();
                } catch (e) {
                    handleError(e, 'Inactivar tarjetas');
                }
            },
        });
    }

    function bulkDelete() {
        if (!networkStore.isOnline) {
            toast.error('Sin conexión: no se pueden eliminar tarjetas.');
            return;
        }
        const targets = [...selectedCards];
        if (targets.length === 0) {
            toast.info('No hay tarjetas seleccionadas.');
            return;
        }
        confirm.open({
            title: `¿Eliminar ${targets.length} tarjeta(s) permanentemente?`,
            description:
                'Se eliminarán permanentemente del inventario. Esta acción no se puede deshacer y cancelará tickets/asignaciones asociados.',
            variant: 'danger',
            confirmText: 'Eliminar',
            onConfirm: async () => {
                try {
                    await Promise.all(targets.map((c) => cardService.delete(c.id)));
                    toast.success(`${targets.length} tarjeta(s) eliminada(s)`);
                    clearSelection();
                    await cardState.refresh();
                } catch (e) {
                    handleError(e, 'Eliminar tarjetas');
                }
            },
        });
    }

    function bulkUnassign() {
        if (!networkStore.isOnline) {
            toast.error('Sin conexión: no se pueden desvincular tarjetas.');
            return;
        }
        const targets = selectedCards.filter((c) => c.person_id && c.status !== 'inactive');
        if (targets.length === 0) {
            toast.info('No hay tarjetas asignadas para desvincular.');
            return;
        }
        confirm.open({
            title: `¿Desvincular ${targets.length} tarjeta(s)?`,
            description:
                'Las tarjetas volverán al inventario como disponibles y se cancelarán sus tickets pendientes.',
            variant: 'warning',
            confirmText: 'Desvincular',
            onConfirm: async () => {
                try {
                    await Promise.all(targets.map((c) => cardService.unassign(c.id)));
                    toast.success(`${targets.length} tarjeta(s) desvinculada(s)`);
                    clearSelection();
                    await cardState.refresh();
                } catch (e) {
                    handleError(e, 'Desvincular tarjetas');
                }
            },
        });
    }

    async function bulkExportSelected() {
        if (selectedCards.length === 0) return;
        const loadingToast = toast.loading('Preparando exportación...');
        try {
            const { exportCardsToExcel } = await import('../utils/xlsxExport');
            exportCardsToExcel(selectedCards, {
                filters: {
                    type: typeFilter,
                    status: statusFilter,
                    dependency: depNameFilter,
                    search: searchFilter,
                },
            });
            toast.success(`Exportación completada (${selectedCards.length})`, {
                id: loadingToast,
            });
        } catch (e) {
            toast.dismiss(loadingToast);
            handleError(e, 'Exportar Tarjetas Seleccionadas');
        }
    }

    // Chips de filtros activos para el toolbar.
    let cardChips = $derived.by(() => {
        const chips: { label: string; value: string; onClear: () => void }[] = [];
        if (typeFilter !== 'Todos') {
            chips.push({ label: 'Tipo', value: typeFilter, onClear: () => (typeFilter = 'Todos') });
        }
        if (statusFilter !== 'Todas') {
            chips.push({ label: 'Estado', value: statusFilter, onClear: () => (statusFilter = 'Todas') });
        }
        if (depNameFilter) {
            chips.push({ label: 'Dependencia', value: depNameFilter, onClear: () => (depNameFilter = '') });
        }
        return chips;
    });

    // Estado del modal
    let isModalOpen = $state(false);
    let editingCard = $state<any>(null);
    let replacingCard = $state<any>(null);
    let isMediosImportOpen = $state(false);
    // Estado derivado del store
    let cards = $derived(cardState.pagination.items);
    let currentPage = $derived(cardState.pagination.currentPage);
    let pageSize = $derived(cardState.pagination.pageSize);
    let totalRecords = $derived(cardState.pagination.totalRecords);
    let isLoading = $derived(cardState.pagination.isLoading);
    let mediaTypeNames = $derived(catalogState.activeMediaTypeNames());

    // No onMount necesario: el $effect debounced dispara la carga inicial automáticamente

    // Debounced auto-refresh cuando cambian los filtros.
    // Se escribe explícitamente al store y luego se refresca, de modo que la
    // consulta siempre usa el valor seleccionado (independientemente del binding).
    let filterDebounce: ReturnType<typeof setTimeout>;
    $effect(() => {
        typeFilter;
        statusFilter;
        searchFilter;
        depNameFilter;

        clearTimeout(filterDebounce);
        filterDebounce = setTimeout(() => {
            const depId = depNameFilter
                ? String(dependencies.find((d) => d.name === depNameFilter)?.id ?? '')
                : '';
            cardState.setFilters(typeFilter, statusFilter, depId);
            cardState.setSearch(searchFilter);
            cardState.refresh(1);
        }, 300);
    });

    // Manejadores
    function onOpenAddCard() {
        editingCard = null;
        isModalOpen = true;
    }

    async function onBlockCard(card: any) {
        const isReactivation = card.status === 'blocked' || card.status === 'inactive';
        confirm.open({
            title: isReactivation ? '¿Reactivar tarjeta?' : '¿Bloquear tarjeta?',
            description: isReactivation
                ? 'La tarjeta volverá a estar disponible o activa según su asignación.'
                : 'Se denegará el acceso a esta tarjeta hasta que sea desbloqueada.',
            variant: isReactivation ? 'info' : 'warning',
            confirmText: isReactivation ? 'Reactivar' : 'Bloquear',
            onConfirm: async () => {
                const previousStatus = card.status;
                const newStatus = isReactivation ? 'active' : 'blocked';
                await cardService.updateStatus(card.id, newStatus);
                toastWithUndo({
                    message: newStatus === 'blocked' ? 'Tarjeta bloqueada' : 'Tarjeta reactivada',
                    description: `Folio ${card.folio}`,
                    onUndo: async () => {
                        await cardService.updateStatus(card.id, previousStatus);
                        await cardState.refresh();
                    },
                });
                await cardState.refresh();
            },
        });
    }

    async function onUnassignCard(card: any) {
        confirm.open({
            title: '¿Desvincular tarjeta?',
            description: 'La tarjeta quedará disponible en inventario y dejará de pertenecer a esta persona.',
            variant: 'warning',
            confirmText: 'Desvincular',
            onConfirm: async () => {
                await cardService.unassign(card.id);
                toast.success('Tarjeta desvinculada');
                await cardState.refresh();
            },
        });
    }

    async function onDeleteCard(card: any) {
        const isInactive = card.status === 'inactive';
        confirm.open({
            title: isInactive ? '¿Eliminar permanentemente?' : '¿Inactivar tarjeta?',
            description: isInactive
                ? 'Esta acción no se puede deshacer. Se borrará todo registro de la tarjeta.'
                : 'La tarjeta quedará en estado de BAJA y no podrá ser utilizada.',
            variant: 'danger',
            confirmText: isInactive ? 'Eliminar Definitivamente' : 'SÍ, Inactivar',
            onConfirm: async () => {
                if (isInactive) {
                    await cardService.delete(card.id);
                    toast.success('Tarjeta eliminada permanentemente');
                } else {
                    const previousStatus = card.status;
                    await cardService.updateStatus(card.id, 'inactive');
                    toastWithUndo({
                        message: 'Tarjeta inactivada',
                        description: `Folio ${card.folio}`,
                        onUndo: async () => {
                            await cardService.updateStatus(card.id, previousStatus);
                            await cardState.refresh();
                        },
                    });
                }
                await cardState.refresh();
            },
        });
    }

    function onViewPerson(card: any) {
        if (!card.person_id) return;
        personnelState.selectPerson(card.person_id);
        uiState.setActivePage('Directorio de Personal');
    }

    function onReplaceCard(card: any) {
        replacingCard = card;
        isModalOpen = true;
    }

    /** Acciones disponibles al deslizar una tarjeta en móvil. */
    function mobileActionsFor(row: any) {
        const list: { label: string; tone: any; onAction: () => void }[] = [];
        if (row.status === 'inactive') {
            list.push({ label: 'Reactivar', tone: 'emerald', onAction: () => onBlockCard(row) });
        } else {
            list.push({
                label: row.status === 'blocked' ? 'Desbloquear' : 'Bloquear',
                tone: 'amber',
                onAction: () => onBlockCard(row),
            });
        }
        if (row.person_id && row.status !== 'inactive') {
            list.push({
                label: 'Desvincular',
                tone: 'rose',
                onAction: () => onUnassignCard(row),
            });
        }
        list.push({ label: 'Eliminar', tone: 'slate', onAction: () => onDeleteCard(row) });
        return list;
    }
</script>

{#snippet renderCardType(row: any)}
    <Badge variant={mediaTypeVariant(row.type)}>
        {row.type}
    </Badge>
{/snippet}

{#snippet renderCardPerson(row: any)}
    {#if row.personName === 'Sin asignar'}
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
                class="opacity-100 lg:opacity-0 -translate-x-0 lg:-translate-x-2 lg:group-hover/name:opacity-100 lg:group-hover/name:translate-x-0 transition-all text-blue-500"
            >
                <User size={12} />
            </div>
        </button>
    {/if}
{/snippet}

{#snippet renderCardStatus(row: any)}
    <StatusBadge domain="card" value={row.status} />
{/snippet}

{#snippet renderCardFolio(row: any)}
    <div class="flex items-center gap-2">
        <span class="font-medium text-slate-700">{row.folio}</span>
        {#if row.person_id}
            <ResponsivaProgramBadges
                responsiva_status={row.responsiva_status}
                programming_status={row.programming_status}
            />
        {/if}
    </div>
{/snippet}

{#snippet rowActions(row: any)}
    <div class="flex items-center justify-end gap-1">
        {#if row.person_id}
            <IconButton
                icon={User}
                label="Ver dueño"
                title="Ver Dueño"
                tone="blue"
                size="md"
                class="sm:h-8 sm:w-8"
                onclick={() => onViewPerson(row)}
            />
        {/if}

        <PermissionGuard requireEdit>
            {#if row.status === 'inactive'}
                <IconButton
                    icon={RefreshCw}
                    label="Reactivar tarjeta"
                    title="Reactivar Tarjeta"
                    tone="emerald"
                    size="md"
                    class="sm:h-8 sm:w-8"
                    disabled={!networkStore.isOnline}
                    onclick={() => onBlockCard(row)}
                />
            {:else}
                <IconButton
                    icon={Lock}
                    label={row.status === 'blocked' ? 'Desbloquear tarjeta' : 'Bloquear tarjeta'}
                    title={row.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}
                    tone="amber"
                    size="md"
                    class="sm:h-8 sm:w-8"
                    disabled={!networkStore.isOnline}
                    onclick={() => onBlockCard(row)}
                />
            {/if}

            {#if row.person_id && row.status !== 'inactive'}
                <IconButton
                    icon={RefreshCw}
                    label="Reposición por extravío"
                    tone="indigo"
                    size="md"
                    class="sm:h-8 sm:w-8"
                    disabled={!networkStore.isOnline}
                    onclick={() => onReplaceCard(row)}
                />
                <IconButton
                    icon={Ban}
                    label="Dar de baja (desvincular)"
                    tone="rose"
                    size="md"
                    class="sm:h-8 sm:w-8"
                    disabled={!networkStore.isOnline}
                    onclick={() => onUnassignCard(row)}
                />
            {/if}

            <IconButton
                icon={Trash2}
                label={row.status === 'inactive' ? 'Eliminar permanentemente' : 'Dar de baja (inactivar)'}
                title={row.status === 'inactive' ? 'Eliminar permanentemente' : 'Dar de baja (Inactivar)'}
                tone="rose"
                size="md"
                class="sm:h-8 sm:w-8"
                disabled={!networkStore.isOnline}
                onclick={() => onDeleteCard(row)}
            />
        </PermissionGuard>
    </div>
{/snippet}

{#snippet mobileList(rows: any[])}
    <DataList
        items={rows}
        key={(r: any) => r.id}
        selectable={userState.isAdmin}
        bind:selectedRows={selectedCards}
        actions={mobileActionsFor}
        sheetTitle={(r: any) => r.folio}
        sheetSubtitle={(r: any) => r.personName}
    >
        {#snippet leading(r: any)}
            {@render renderCardType(r)}
        {/snippet}
        {#snippet title(r: any)}
            {@render renderCardFolio(r)}
        {/snippet}
        {#snippet subtitle(r: any)}
            <span>{r.personName}</span>
        {/snippet}
        {#snippet trailing(r: any)}
            {@render renderCardStatus(r)}
        {/snippet}
        {#snippet details(r: any)}
            <div class="space-y-3 text-sm">
                <div class="flex items-center justify-between">
                    <span class="text-slate-400 font-bold uppercase text-[11px]">Tipo</span>
                    <span>{@render renderCardType(r)}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-slate-400 font-bold uppercase text-[11px]">Folio</span>
                    <span class="font-semibold text-slate-800">{r.folio}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-slate-400 font-bold uppercase text-[11px]">Asignada a</span>
                    <span>{@render renderCardPerson(r)}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-slate-400 font-bold uppercase text-[11px]">Estado</span>
                    <span>{@render renderCardStatus(r)}</span>
                </div>
            </div>
        {/snippet}
        {#snippet sheetActions(r: any)}
            {@render rowActions(r)}
        {/snippet}
    </DataList>
{/snippet}

<div class="space-y-4">
    <SectionHeader
        title="Gestión de tarjetas"
        filtersCount={cardChips.length}
        onClearFilters={clearCardFilters}
    >
        {#snippet filters()}
            <FilterToolbar chips={cardChips} onClearAll={clearCardFilters}>
                {#snippet primary()}
                    <FilterSelect
                        label="Tipo"
                        options={['Todos', ...mediaTypeNames]}
                        bind:value={typeFilter}
                    />
                    <FilterSelect
                        label="Estado"
                        options={['Todas', 'Disponible', 'Activa', 'Bloqueada', 'Baja']}
                        bind:value={statusFilter}
                    />
                    <div class="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-[200px] w-full">
                        <span
                            class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap"
                            >Buscar</span
                        >
                        <SearchInput
                            placeholder="Folio..."
                            bind:value={searchFilter}
                            oninput={() => {}}
                            class="h-9 text-xs font-bold"
                        />
                    </div>
                {/snippet}
                {#snippet overflow()}
                    <FilterSelect
                        label="Dependencia"
                        options={dependencyNames}
                        placeholder="Todas"
                        bind:value={depNameFilter}
                    />
                {/snippet}
            </FilterToolbar>
        {/snippet}

        {#snippet actions()}
            <Button
                variant="soft-blue"
                class="flex items-center gap-2 h-9 px-4 text-xs"
                disabled={!networkStore.isOnline}
                onclick={() => (isMediosImportOpen = true)}
            >
                <Upload size={14} /> Importar Medios
            </Button>
            <Button
                variant="soft-emerald"
                class="flex items-center gap-2.5 h-10 px-6"
                disabled={!networkStore.isOnline}
                onclick={async () => {
                    const loadingToast = toast.loading('Preparando exportación...');
                    try {
                        const data = await cardService.fetchForExport(
                            searchFilter,
                            typeFilter,
                            statusFilter,
                            depNameFilter
                                ? String(dependencies.find((d) => d.name === depNameFilter)?.id ?? '')
                                : '',
                        );
                        const m = await import('../utils/xlsxExport');
                        m.exportCardsToExcel(data, {
                            filters: {
                                type: typeFilter,
                                status: statusFilter,
                                dependency: depNameFilter,
                                search: searchFilter,
                            },
                        });
                        toast.success('Exportación completada', { id: loadingToast });
                    } catch (e) {
                        toast.dismiss(loadingToast);
                        handleError(e, 'Exportar Tarjetas');
                    }
                }}
            >
                <FileSpreadsheet size={18} strokeWidth={2.5} class="text-emerald-600/80" />
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

    {#if userState.isAdmin && selectedCards.length > 0}
        <div
            class="flex flex-wrap items-center gap-3 p-3 rounded-2xl border border-blue-200 bg-blue-50/95 backdrop-blur max-lg:fixed max-lg:inset-x-3 max-lg:bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] max-lg:z-40 max-lg:shadow-2xl"
        >
            <span class="text-sm font-extrabold text-blue-800">
                {selectedCards.length} tarjeta(s) seleccionada(s)
            </span>
            <div class="flex flex-wrap items-center gap-2 ml-auto">
                <Button variant="soft-slate" size="sm" onclick={clearSelection}>Limpiar</Button>
                <PermissionGuard requireEdit>
                    <Button
                        variant="amber"
                        size="sm"
                        disabled={!networkStore.isOnline}
                        onclick={() => bulkSetStatus('blocked')}
                    >
                        Bloquear
                    </Button>
                    <Button
                        variant="soft-emerald"
                        size="sm"
                        disabled={!networkStore.isOnline}
                        onclick={() => bulkSetStatus('active')}
                    >
                        Reactivar
                    </Button>
                    <Button
                        variant="soft-slate"
                        size="sm"
                        disabled={!networkStore.isOnline}
                        onclick={bulkUnassign}
                    >
                        Desvincular
                    </Button>
                    <Button
                        variant="danger"
                        size="sm"
                        disabled={!networkStore.isOnline}
                        onclick={bulkInactivate}
                    >
                        Inactivar
                    </Button>
                    <Button variant="danger" size="sm" disabled={!networkStore.isOnline} onclick={bulkDelete}>
                        Eliminar
                    </Button>
                </PermissionGuard>
                <Button
                    variant="soft-blue"
                    size="sm"
                    disabled={!networkStore.isOnline}
                    onclick={bulkExportSelected}
                >
                    <FileSpreadsheet size={15} class="mr-1.5" />
                    Exportar selección
                </Button>
            </div>
        </div>
    {/if}

    <ContentView
        {isLoading}
        data={cards}
        error={cardState.pagination.error}
        onRetry={() => cardState.refresh(1)}
        emptyTitle="Aún no hay tarjetas registradas"
        emptyTitleFiltered="Sin resultados"
        emptyDescription="El inventario de tarjetas está vacío. Comienza registrando la primera tarjeta de acceso."
        emptyDescriptionFiltered="No encontramos tarjetas con los filtros actuales. Intenta ajustar tu búsqueda."
        emptyIcon={CreditCard}
        emptyIconBgClass="from-slate-100 to-slate-200 text-slate-400"
        hasFilters={!!(searchFilter || typeFilter !== 'Todos' || statusFilter !== 'Todas' || depNameFilter)}
        onClearFilters={() => {
            clearCardFilters();
            // El $effect se encarga de refrescar
        }}
        skeletonColumns={4}
        skeletonRows={5}
        cardClass="overflow-hidden"
    >
        {#snippet children()}
            <DataTable
                data={cards}
                columns={[
                    { key: 'type', label: 'Tipo', render: renderCardType },
                    { key: 'folio', label: 'Folio / No. Tarjeta', render: renderCardFolio },
                    { key: 'personName', label: 'Asignada a', render: renderCardPerson },
                    { key: 'status', label: 'Estado', render: renderCardStatus },
                ]}
                actions={rowActions}
                actionsWidth="240px"
                {mobileList}
                selectable={userState.isAdmin}
                bind:selectedRows={selectedCards}
            ></DataTable>
        {/snippet}

        {#snippet emptyActions()}
            <PermissionGuard requireEdit>
                <Button
                    variant="primary"
                    size="sm"
                    class="h-11 px-7 rounded-xl shadow-lg shadow-blue-500/20"
                    onclick={onOpenAddCard}
                >
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
    mode={replacingCard ? 'assign' : 'inventory'}
    {replacingCard}
    onSave={async (card, replacementOptions) => {
        try {
            await cardService.save({ ...card, person_id: replacingCard?.person_id }, replacementOptions);
            toast.success(
                replacingCard ? 'Tarjeta reemplazada exitosamente' : 'Tarjeta creada en inventario',
            );
            await cardState.refresh();
            isModalOpen = false;
        } catch (e) {
            handleError(e, 'Guardar Tarjeta');
            throw e;
        }
    }}
    onclose={() => {
        replacingCard = null;
        isModalOpen = false;
    }}
/>

<MediosImportModal bind:isOpen={isMediosImportOpen} onComplete={() => cardState.refresh()} />

<PermissionGuard requireEdit>
    {#if networkStore.isOnline}
        <FloatingActionButton onclick={onOpenAddCard} label="Nueva Tarjeta" />
    {/if}
</PermissionGuard>
