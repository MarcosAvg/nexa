<script lang="ts">
    import { cardlessRegistryState, catalogState, userState } from '../stores';
    import { pullRefresh } from '../stores';
    import {
        SectionHeader,
        FilterSelect,
        FilterToolbar,
        Button,
        Card,
        DataTable,
        DataList,
        Badge,
        PermissionGuard,
        Pagination,
        FloatingActionButton,
        ContentView,
        SearchInput,
        Input,
        ExportDropdown,
        ExportMenuItem,
        CardlessRegistryModal,
        ConfirmationModal,
        PageSizeControl,
    } from '../components';
    import { FileSpreadsheet, Plus, Loader2, Trash2, FolderArchive, FileX } from 'lucide-svelte';
    import { cardlessRegistryService } from '../services/cardlessRegistry';
    import { confirm } from '../utils/confirmModal.svelte';
    import { handleError, formatDate } from '../utils';
    import { reasonVariant } from '../constants/appearance';
    import type { CardlessRegistry } from '../types';
    import { toast } from 'svelte-sonner';

    import { networkStore } from '../stores/network.svelte';
    let registries = $derived(cardlessRegistryState.pagination.items);

    $effect(() => pullRefresh.register(() => reloadRegistryTable()));
    let totalCount = $derived(cardlessRegistryState.pagination.totalRecords);
    let currentPage = $derived(cardlessRegistryState.pagination.currentPage);
    let pageSize = $derived(cardlessRegistryState.pagination.pageSize);
    let isLoading = $derived(cardlessRegistryState.pagination.isLoading);

    let dateRangeError = $state('');

    // Filtros que mapean nombre → ID antes de aplicar
    let depNameFilter = $state('');

    $effect(() => {
        const depId = depNameFilter
            ? String(dependencies.find((d) => d.name === depNameFilter)?.id ?? '')
            : '';
        cardlessRegistryState.filters.dependencyId = depId;
    });

    let buildings = $derived(catalogState.buildings);
    let dependencies = $derived(catalogState.dependencies);
    let dependencyNames = $derived(dependencies.map((d) => d.name));
    let reasons = $derived(cardlessRegistryService.REASONS);

    function clearRegistroFilters() {
        depNameFilter = '';
        cardlessRegistryState.setFilters({
            startDate: '',
            endDate: '',
            reason: '',
            search: '',
            dependencyId: '',
        });
    }

    // Chips de filtros activos para el toolbar.
    let registroChips = $derived.by(() => {
        const chips: { label: string; value: string; onClear: () => void }[] = [];
        const f = cardlessRegistryState.filters;
        if (f.startDate || f.endDate) {
            chips.push({
                label: 'Fechas',
                value: [f.startDate || '…', f.endDate || '…'].join(' → '),
                onClear: () => cardlessRegistryState.setFilters({ startDate: '', endDate: '' }),
            });
        }
        if (depNameFilter) {
            chips.push({ label: 'Dependencia', value: depNameFilter, onClear: () => (depNameFilter = '') });
        }
        if (f.reason) {
            chips.push({
                label: 'Motivo',
                value: f.reason,
                onClear: () => cardlessRegistryState.setFilters({ reason: '' }),
            });
        }
        return chips;
    });

    let isModalOpen = $state(false);
    let editingRegistry = $state<CardlessRegistry | null>(null);
    let isExporting = $state(false);
    let isZipExporting = $state(false);

    let isConfirmDeleteOpen = $state(false);
    let registryToDelete = $state<CardlessRegistry | null>(null);
    let registriesToDelete = $state<CardlessRegistry[]>([]);

    // Selección masiva (solo admin, igual que Personal/Tarjetas).
    let selectedRegistries = $state<CardlessRegistry[]>([]);

    // Cantidad de filas visibles al seleccionar (50/100/250/500/Todos).
    // Solo vive mientras hay selección; al vaciarse se restaura a 50.
    const DEFAULT_TABLE_PAGE_SIZE = 50;
    const TABLE_ALL_CONFIRM_THRESHOLD = 2000;
    let tablePageSize = $state<number | 'all'>(DEFAULT_TABLE_PAGE_SIZE);

    function clearRegistrySelection() {
        selectedRegistries = [];
        resetTablePageSize();
    }

    /** Restaura la paginación común (50/pág.). Sin refresh: el caller refresca. */
    function resetTablePageSize() {
        tablePageSize = DEFAULT_TABLE_PAGE_SIZE;
        cardlessRegistryState.pagination.pageSize = DEFAULT_TABLE_PAGE_SIZE;
    }

    /** Recarga respetando la cantidad expandida (rama 'Todos' por lotes). */
    function reloadRegistryTable() {
        if (tablePageSize === 'all') return doLoadAllRegistryRows();
        return cardlessRegistryState.refresh(1);
    }

    async function applyTablePageSize(next: number | 'all') {
        if (!networkStore.isOnline) {
            toast.error('Sin conexión: no se puede cambiar la cantidad.');
            return;
        }
        tablePageSize = next;
        if (next === 'all') {
            await doLoadAllRegistryRows();
            return;
        }
        cardlessRegistryState.pagination.pageSize = next;
        await cardlessRegistryState.refresh(1);
    }

    async function doLoadAllRegistryRows() {
        const total = cardlessRegistryState.pagination.totalRecords;
        if (total > TABLE_ALL_CONFIRM_THRESHOLD) {
            confirm.open({
                title: `¿Cargar los ${total} registros?`,
                description:
                    'Mostrar todos los registros puede tardar en cargarse y en mostrarse en la tabla.',
                variant: 'info',
                confirmText: 'Cargar todo',
                onConfirm: () => void doLoadAllRegistryRows(),
            });
            return;
        }
        cardlessRegistryState.pagination.setLoading(true);
        try {
            const data = await cardlessRegistryService.fetchAllMatching(cardlessRegistryState.filters);
            if (selectedRegistries.length === 0) return; // selección liberada durante la carga
            cardlessRegistryState.pagination.pageSize = Math.max(data.length, 1);
            cardlessRegistryState.pagination.setItems(data, data.length);
            cardlessRegistryState.pagination.currentPage = 1;
        } catch {
            toast.error('Error al cargar todos los registros');
            resetTablePageSize();
        } finally {
            cardlessRegistryState.pagination.setLoading(false);
        }
    }

    // Si la selección se vacía manualmente, se vuelve a la paginación común.
    $effect(() => {
        if (selectedRegistries.length === 0 && tablePageSize !== DEFAULT_TABLE_PAGE_SIZE) {
            resetTablePageSize();
            void cardlessRegistryState.refresh(1);
        }
    });

    // No onMount necesario: el $effect debounced dispara la carga inicial automáticamente

    function dependencyIdFromName(name: string): string {
        if (!name) return '';
        return String(dependencies.find((d) => d.name === name)?.id ?? '');
    }

    function registryDisplayName(reg: CardlessRegistry | null): string {
        if (!reg) return 'este registro';
        return (
            reg.personName ||
            [reg.first_name, reg.last_name].filter(Boolean).join(' ') ||
            `registro #${reg.id}`
        );
    }

    function isValidDateRange(start: string, end: string): boolean {
        if (!start || !end) return true;
        return start <= end;
    }

    let filterDebounce: ReturnType<typeof setTimeout>;
    $effect(() => {
        cardlessRegistryState.filters.startDate;
        cardlessRegistryState.filters.endDate;
        cardlessRegistryState.filters.reason;
        cardlessRegistryState.filters.search;
        cardlessRegistryState.filters.dependencyId;

        clearTimeout(filterDebounce);
        filterDebounce = setTimeout(() => {
            if (
                isValidDateRange(
                    cardlessRegistryState.filters.startDate,
                    cardlessRegistryState.filters.endDate,
                )
            ) {
                dateRangeError = '';
                // Nueva consulta => se vuelve a la paginación común.
                if (tablePageSize !== DEFAULT_TABLE_PAGE_SIZE) {
                    tablePageSize = DEFAULT_TABLE_PAGE_SIZE;
                    cardlessRegistryState.pagination.pageSize = DEFAULT_TABLE_PAGE_SIZE;
                }
                cardlessRegistryState.refresh(1);
            }
        }, 400);
    });

    function refreshData() {
        cardlessRegistryState.refresh(cardlessRegistryState.pagination.currentPage);
    }

    function openAddModal() {
        editingRegistry = null;
        isModalOpen = true;
    }

    function openEditModal(registry: CardlessRegistry) {
        editingRegistry = registry;
        isModalOpen = true;
    }

    function handleModalSave() {
        isModalOpen = false;
        refreshData();
    }

    function requestDelete(registry: CardlessRegistry) {
        registryToDelete = registry;
        registriesToDelete = [];
        isConfirmDeleteOpen = true;
    }

    function requestBulkDelete() {
        if (selectedRegistries.length === 0) return;
        registryToDelete = null;
        registriesToDelete = [...selectedRegistries];
        isConfirmDeleteOpen = true;
    }

    function bulkDeleteTargets(): CardlessRegistry[] {
        return registryToDelete ? [registryToDelete] : registriesToDelete;
    }

    function bulkDeleteDescription(): string {
        if (registryToDelete)
            return `¿Eliminar el registro de ${registryDisplayName(registryToDelete)}? Esta acción no se puede deshacer.`;
        return `¿Eliminar ${registriesToDelete.length} registro(s) seleccionado(s)? Esta acción no se puede deshacer.`;
    }

    async function handleDeleteConfirm() {
        const targets = bulkDeleteTargets();
        if (targets.length === 0) return;
        if (!networkStore.isOnline) {
            toast.error('Sin conexión: no se pueden eliminar registros.');
            return;
        }

        const results = await Promise.allSettled(targets.map((r) => cardlessRegistryService.delete(r.id)));
        const ok = results.filter((res) => res.status === 'fulfilled' && res.value === true).length;
        const failed = results.length - ok;
        if (failed > 0) {
            toast.error(`${ok} registro(s) eliminado(s), ${failed} con error`);
        } else {
            toast.success(targets.length === 1 ? 'Registro eliminado' : `${ok} registro(s) eliminado(s)`);
        }

        const remaining = Math.max(0, totalCount - ok);
        const maxPage = Math.max(1, Math.ceil(remaining / pageSize) || 1);
        if (currentPage > maxPage) {
            cardlessRegistryState.pagination.currentPage = maxPage;
        }
        registryToDelete = null;
        registriesToDelete = [];
        clearRegistrySelection();
        await refreshData();
    }

    async function handleExportSelected() {
        if (selectedRegistries.length === 0) return;
        if (!networkStore.isOnline) {
            toast.error('Sin conexión: no se puede exportar.');
            return;
        }
        isExporting = true;
        try {
            await cardlessRegistryService.exportToExcel([...selectedRegistries], {
                startDate: cardlessRegistryState.filters.startDate || undefined,
                endDate: cardlessRegistryState.filters.endDate || undefined,
                reason: cardlessRegistryState.filters.reason || undefined,
                dependency: depNameFilter || undefined,
                search: cardlessRegistryState.filters.search || undefined,
            });
            toast.success(`Selección exportada (${selectedRegistries.length} registros)`);
        } catch {
            toast.error('Error al exportar');
        } finally {
            isExporting = false;
        }
    }

    function handleDeleteFromModal(registry: CardlessRegistry) {
        isModalOpen = false;
        requestDelete(registry);
    }

    async function handleExport() {
        isExporting = true;
        try {
            const rows = await cardlessRegistryService.fetchAllMatching(cardlessRegistryState.filters);
            if (rows.length === 0) {
                toast.error('No hay registros para exportar');
                return;
            }
            await cardlessRegistryService.exportToExcel(rows, {
                startDate: cardlessRegistryState.filters.startDate || undefined,
                endDate: cardlessRegistryState.filters.endDate || undefined,
                reason: cardlessRegistryState.filters.reason || undefined,
                dependency: depNameFilter || undefined,
                search: cardlessRegistryState.filters.search || undefined,
            });
            toast.success(`Reporte exportado (${rows.length} registros)`);
        } catch {
            toast.error('Error al exportar');
        } finally {
            isExporting = false;
        }
    }

    async function handleExportAllDepsZip() {
        if (dependencies.length === 0) {
            toast.error('No hay dependencias registradas');
            return;
        }
        isZipExporting = true;
        const loadingToast = toast.loading('Preparando ZIP...');
        try {
            const { exportCardlessRegistryAllDependenciesAsZip } = await import('../utils/zipExport');
            await exportCardlessRegistryAllDependenciesAsZip(
                dependencies,
                {
                    startDate: cardlessRegistryState.filters.startDate || undefined,
                    endDate: cardlessRegistryState.filters.endDate || undefined,
                    reason: cardlessRegistryState.filters.reason || undefined,
                    search: cardlessRegistryState.filters.search || undefined,
                },
                (_current, _total, label) => {
                    toast.loading(`Procesando: ${label}`, { id: loadingToast });
                },
            );
            toast.success('ZIP descargado', { id: loadingToast });
        } catch (error) {
            toast.dismiss(loadingToast);
            handleError(error, 'Exportar ZIP Sin Tarjeta');
        } finally {
            isZipExporting = false;
        }
    }

    function changePage(page: number) {
        if (page === currentPage) return;
        cardlessRegistryState.pagination.currentPage = page;
        refreshData();
    }
</script>

{#snippet renderPersonName(row: CardlessRegistry)}
    <div class="flex flex-col gap-0.5">
        <span class="font-bold text-slate-900 truncate">
            {row.personName || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Sin nombre'}
        </span>
        <span class="text-xs text-slate-500">{row.employee_no || 'Sin # empleado'}</span>
        {#if row.person_id}
            <span
                class="inline-flex w-fit items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 leading-none"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="8"
                    height="8"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
                >
                Registrado
            </span>
        {:else}
            <span
                class="inline-flex w-fit items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 leading-none"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="8"
                    height="8"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg
                >
                No Registrado
            </span>
        {/if}
    </div>
{/snippet}

{#snippet renderDependency(row: CardlessRegistry)}
    <span class="text-sm text-slate-700">{row.dependencyName || '-'}</span>
{/snippet}

{#snippet renderLocation(row: CardlessRegistry)}
    <div class="flex flex-col">
        <span class="font-medium text-slate-900">{row.buildingName || '-'}</span>
        <span class="text-xs text-slate-500">{row.floor || 'Sin piso'}</span>
    </div>
{/snippet}

{#snippet renderReason(row: CardlessRegistry)}
    <Badge variant={reasonVariant(row.reason)}>
        {row.reason}
    </Badge>
{/snippet}

{#snippet renderDate(row: CardlessRegistry)}
    <div class="flex flex-col">
        <span class="text-sm text-slate-700">{formatDate(row.recorded_at)}</span>
        <span class="text-xs text-slate-500"
            >{new Date(row.recorded_at).toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
            })}</span
        >
    </div>
{/snippet}

{#snippet renderRecordedBy(row: CardlessRegistry)}
    <span class="text-sm text-slate-600">{row.recordedByName || '-'}</span>
{/snippet}

{#snippet renderResponsiva(row: CardlessRegistry)}
    {#if !row.person_id}
        <span class="text-xs text-slate-400">—</span>
    {:else if row.responsiva_status_at_registration === null}
        <!-- Legacy record: no snapshot stored, showing live status as fallback -->
        {#if row.pendingResponsiva}
            <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap"
                title="Estado actual (registro anterior al historial de snapshots)"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line
                        x1="12"
                        y1="16"
                        x2="12.01"
                        y2="16"
                    /></svg
                >
                Pendiente
                <span class="text-rose-400 text-[9px]">~</span>
            </span>
        {:else}
            <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap"
                title="Estado actual (registro anterior al historial de snapshots)"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
                >
                Entregada
                <span class="text-emerald-400 text-[9px]">~</span>
            </span>
        {/if}
    {:else if row.responsiva_status_at_registration}
        <span
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap"
            title="Estado al momento del registro"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line
                    x1="12"
                    y1="16"
                    x2="12.01"
                    y2="16"
                /></svg
            >
            Pendiente
        </span>
    {:else}
        <span
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap"
            title="Estado al momento del registro"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >
            Entregada
        </span>
    {/if}
{/snippet}

{#snippet mobileList(rows: CardlessRegistry[])}
    <DataList
        items={rows}
        key={(r: CardlessRegistry) => r.id}
        selectable={userState.isAdmin}
        bind:selectedRows={selectedRegistries}
        sheetTitle={(r: CardlessRegistry) => r.personName}
        sheetSubtitle={(r: CardlessRegistry) => r.reason}
    >
        {#snippet leading()}
            <div class="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <FileX size={14} strokeWidth={2.5} />
            </div>
        {/snippet}
        {#snippet title(r: CardlessRegistry)}
            {r.personName}
        {/snippet}
        {#snippet subtitle(r: CardlessRegistry)}
            {r.dependencyName || '-'} · {formatDate(r.recorded_at)}
        {/snippet}
        {#snippet trailing(r: CardlessRegistry)}
            {@render renderReason(r)}
        {/snippet}
        {#snippet details(r: CardlessRegistry)}
            <div class="space-y-3 text-sm">
                <div>
                    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Persona
                    </div>
                    {@render renderPersonName(r)}
                </div>
                <div>
                    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Motivo
                    </div>
                    {@render renderReason(r)}
                </div>
                <div>
                    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Dependencia
                    </div>
                    {@render renderDependency(r)}
                </div>
                <div>
                    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Ubicación
                    </div>
                    {@render renderLocation(r)}
                </div>
                <div>
                    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Fecha
                    </div>
                    {@render renderDate(r)}
                </div>
                <div>
                    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Registrado por
                    </div>
                    {@render renderRecordedBy(r)}
                </div>
                <div>
                    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Responsiva
                    </div>
                    {@render renderResponsiva(r)}
                </div>
            </div>
        {/snippet}
        {#snippet sheetActions(r: CardlessRegistry)}
            <PermissionGuard allowedRoles={['admin', 'operator']}>
                <Button variant="soft-blue" size="sm" class="flex-1" onclick={() => openEditModal(r)}>
                    Editar
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    class="text-rose-600 hover:bg-rose-50"
                    onclick={() => requestDelete(r)}
                    disabled={!networkStore.isOnline}
                >
                    <Trash2 size={16} />
                </Button>
            </PermissionGuard>
        {/snippet}
    </DataList>
{/snippet}

<div class="space-y-4">
    <SectionHeader
        title="Sin Tarjeta"
        filtersCount={registroChips.length}
        onClearFilters={clearRegistroFilters}
    >
        {#snippet filters()}
            <FilterToolbar chips={registroChips} onClearAll={clearRegistroFilters}>
                {#snippet primary()}
                    <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span
                            class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap"
                            >Fecha Inicio</span
                        >
                        <Input
                            type="date"
                            bind:value={cardlessRegistryState.filters.startDate}
                            max={cardlessRegistryState.filters.endDate || undefined}
                            class="h-9 text-xs font-bold {dateRangeError ? 'border-rose-400' : ''}"
                        />
                    </div>
                    <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span
                            class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap"
                            >Fecha Fin</span
                        >
                        <Input
                            type="date"
                            bind:value={cardlessRegistryState.filters.endDate}
                            min={cardlessRegistryState.filters.startDate || undefined}
                            class="h-9 text-xs font-bold {dateRangeError ? 'border-rose-400' : ''}"
                        />
                    </div>
                    <div class="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-[200px] w-full">
                        <span
                            class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap"
                            >Búsqueda</span
                        >
                        <SearchInput
                            placeholder="Nombre o # empleado..."
                            bind:value={cardlessRegistryState.filters.search}
                            oninput={() => {}}
                            class="h-9 text-xs font-bold w-full sm:w-48"
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
                    <FilterSelect
                        label="Motivo"
                        options={reasons}
                        placeholder="Todos"
                        bind:value={cardlessRegistryState.filters.reason}
                    />
                {/snippet}
            </FilterToolbar>
        {/snippet}

        {#snippet actions()}
            <ExportDropdown
                icon={FileSpreadsheet}
                label="Exportar Excel"
                disabled={totalCount === 0 || !networkStore.isOnline || isExporting || isZipExporting}
            >
                {#snippet items()}
                    <ExportMenuItem
                        icon={FileSpreadsheet}
                        label={isExporting ? 'Exportando...' : 'Exportar (Filtro actual)'}
                        disabled={isExporting}
                        onclick={handleExport}
                    />
                    <div class="mx-3 my-1 border-t border-slate-100"></div>
                    <ExportMenuItem
                        icon={FolderArchive}
                        label={isZipExporting ? 'Generando ZIP...' : 'Todas las Dependencias (ZIP)'}
                        iconBgClass="bg-violet-50"
                        iconColorClass="text-violet-600"
                        disabled={isZipExporting || dependencies.length === 0}
                        onclick={handleExportAllDepsZip}
                    />
                {/snippet}
            </ExportDropdown>

            <PermissionGuard allowedRoles={['admin', 'operator']}>
                <Button
                    variant="primary"
                    class="flex items-center gap-2.5 h-10 px-6 shadow-lg shadow-blue-500/20"
                    onclick={openAddModal}
                    disabled={!networkStore.isOnline}
                >
                    <Plus size={18} strokeWidth={3} class="mr-2" />
                    Nuevo Registro
                </Button>
            </PermissionGuard>
        {/snippet}
    </SectionHeader>

    {#if userState.isAdmin && selectedRegistries.length > 0}
        <div
            class="flex flex-wrap items-center gap-3 p-3 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur max-lg:fixed max-lg:inset-x-3 max-lg:bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] max-lg:z-40 max-lg:shadow-2xl"
        >
            <span class="text-sm font-extrabold text-blue-800">
                {selectedRegistries.length} registro(s) seleccionado(s)
            </span>
            <div class="flex flex-wrap items-center gap-2 ml-auto">
                <PageSizeControl
                    value={tablePageSize}
                    onchange={applyTablePageSize}
                    disabled={!networkStore.isOnline || isLoading}
                />
                <Button variant="soft-slate" size="sm" onclick={clearRegistrySelection}>Limpiar</Button>
                <Button
                    variant="soft-blue"
                    size="sm"
                    disabled={!networkStore.isOnline || isExporting}
                    onclick={handleExportSelected}
                >
                    <FileSpreadsheet size={15} class="mr-1.5" />
                    Exportar selección
                </Button>
                <Button
                    variant="danger"
                    size="sm"
                    disabled={!networkStore.isOnline}
                    onclick={requestBulkDelete}
                >
                    Eliminar
                </Button>
            </div>
        </div>
    {/if}

    <Card class="overflow-hidden relative min-h-[200px]">
        <ContentView
            {isLoading}
            data={registries}
            error={cardlessRegistryState.pagination.error}
            onRetry={() => cardlessRegistryState.refresh(1)}
            emptyTitle="No hay registros"
            emptyDescription="Ajusta los filtros o crea un nuevo registro."
            emptyIcon={FileX}
            emptyIconBgClass="from-slate-100 to-slate-200 text-slate-400"
            skeletonColumns={7}
            skeletonRows={5}
            skeletonHasActions={true}
        >
            {#snippet children()}
                <DataTable
                    data={registries}
                    actionsWidth="140px"
                    selectable={userState.isAdmin}
                    bind:selectedRows={selectedRegistries}
                    columns={[
                        {
                            key: 'personName',
                            label: 'Persona',
                            render: renderPersonName,
                            width: '200px',
                        },
                        {
                            key: 'dependencyName',
                            label: 'Dependencia',
                            render: renderDependency,
                            width: '180px',
                        },
                        {
                            key: 'location',
                            label: 'Ubicación',
                            render: renderLocation,
                            width: '160px',
                        },
                        {
                            key: 'reason',
                            label: 'Motivo',
                            render: renderReason,
                            width: '220px',
                        },
                        {
                            key: 'recorded_at',
                            label: 'Fecha',
                            render: renderDate,
                            width: '140px',
                        },
                        {
                            key: 'recorded_by',
                            label: 'Registrado por',
                            render: renderRecordedBy,
                            width: '140px',
                        },
                        {
                            key: 'responsiva_status_at_registration',
                            label: 'Estado de responsiva',
                            render: renderResponsiva,
                            width: '160px',
                        },
                    ]}
                    {mobileList}
                >
                    {#snippet actions(row: CardlessRegistry)}
                        <PermissionGuard allowedRoles={['admin', 'operator']}>
                            <div class="flex items-center justify-end gap-1">
                                <Button
                                    variant="soft-blue"
                                    size="sm"
                                    class="h-9 px-4 rounded-xl"
                                    onclick={() => openEditModal(row)}
                                    title="Editar registro"
                                >
                                    Editar
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    class="h-9 px-3 rounded-xl text-rose-600 hover:bg-rose-50"
                                    onclick={() => requestDelete(row)}
                                    disabled={!networkStore.isOnline}
                                    title="Eliminar"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        </PermissionGuard>
                    {/snippet}
                </DataTable>
            {/snippet}
        </ContentView>
        {#if isLoading}
            <div class="absolute inset-0 bg-white/50 flex items-center justify-center pointer-events-none">
                <Loader2 class="animate-spin text-blue-600" size={24} />
            </div>
        {/if}
    </Card>

    <Pagination
        {currentPage}
        {pageSize}
        totalRecords={totalCount}
        onPrevPage={() => changePage(currentPage - 1)}
        onNextPage={() => changePage(currentPage + 1)}
        onGoToPage={(p) => changePage(p)}
        {isLoading}
    />
</div>

<PermissionGuard allowedRoles={['admin', 'operator']}>
    <FloatingActionButton onclick={openAddModal} label="Nuevo Registro" />
</PermissionGuard>

{#if isModalOpen}
    <CardlessRegistryModal
        bind:isOpen={isModalOpen}
        {editingRegistry}
        onSave={handleModalSave}
        onDelete={handleDeleteFromModal}
    />
{/if}

<ConfirmationModal
    bind:isOpen={isConfirmDeleteOpen}
    title={registryToDelete ? 'Eliminar registro' : `Eliminar ${registriesToDelete.length} registros`}
    description={bulkDeleteDescription()}
    confirmText="Eliminar"
    variant="danger"
    onConfirm={handleDeleteConfirm}
    onCancel={() => {
        registryToDelete = null;
        registriesToDelete = [];
    }}
/>
