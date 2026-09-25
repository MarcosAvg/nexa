<script lang="ts">
    import { personnelState, catalogState, userState, ticketState, moduleState } from '../stores';
    import { pullRefresh } from '../stores';
    import {
        SectionHeader,
        FilterSelect,
        FilterToolbar,
        Button,
        DataTable,
        Badge,
        PermissionGuard,
        FloatingActionButton,
        Pagination,
        ContentView,
        SearchInput,
        ExportDropdown,
        ExportMenuItem,
        UsoTarjetasImportModal,
        RegistrosImportModal,
        BulkDeletePersonnelModal,
        DataList,
    } from '../components';
    import { FileSpreadsheet, Plus, Upload, FileStack, FolderArchive, Users, Check } from 'lucide-svelte';
    import { personnelService } from '../services/personnel';
    import { cardService } from '../services/cards';
    import { handleError, createSimpleDebounce, toastWithUndo, haptic } from '../utils';
    import { confirm } from '../utils/confirmModal.svelte';
    import { mediaTypeVariant, mediaTypeDotClass } from '../utils/mediaTypeAppearance';
    import { toast } from 'svelte-sonner';
    import { networkStore } from '../stores/network.svelte';
    import { getPersonnelStatusVariant } from '../constants/status';

    let personnel = $derived(personnelState.pagination.items);
    let dependencies = $derived(catalogState.dependencies);
    let buildings = $derived(catalogState.buildings);

    let mediaFilter = $state('');
    let dependencyNames = $derived(dependencies.map((d) => d.name));
    let buildingNames = $derived([...buildings.map((b) => b.name), 'Sin Edificio']);
    let mediaTypeOptions = $derived.by(() => {
        const options: { value: string; label: string }[] = [];
        const seen = new Set<string>();
        for (const media of catalogState.mediaTypes) {
            if ((media as any).active === false) continue;
            const id = String(media.id ?? '');
            const label = media.name ?? '';
            if (!id || !label || seen.has(id)) continue;
            seen.add(id);
            options.push({ value: id, label });
        }
        return [...options, { value: '__none__', label: 'Sin tarjeta' }];
    });
    let mediaTypeName = $derived(
        mediaFilter === '__none__'
            ? 'Sin tarjeta'
            : (catalogState.mediaTypes.find((media) => String(media.id) === mediaFilter)?.name ?? ''),
    );

    // Tipos de acceso (medios) para las columnas/KPIs de la exportación Excel.
    let exportCardTypes = $state<string[]>([]);
    let mediaTypeNames = $derived(catalogState.activeMediaTypeNames());
    // Inicializar una vez que el catálogo de medios esté cargado.
    $effect(() => {
        if (mediaTypeNames.length > 0 && exportCardTypes.length === 0) {
            exportCardTypes = [...mediaTypeNames];
        }
    });

    function toggleExportCardType(type: string) {
        if (exportCardTypes.includes(type) && exportCardTypes.length === 1) {
            // Siempre al menos un tipo seleccionado (el exportador no puede omitir todos)
            return;
        }
        exportCardTypes = exportCardTypes.includes(type)
            ? exportCardTypes.filter((t) => t !== type)
            : [...exportCardTypes, type];
    }

    let dependencyFilter = $state('');
    let buildingFilter = $state('');
    let floorFilter = $state('');

    // Pisos canónicos del edificio seleccionado (dependencia directa del filtro de edificio).
    let selectedBuildingFloors = $derived.by(() => {
        if (buildingFilter === '' || buildingFilter === 'Sin Edificio') return [] as string[];
        const building = buildings.find((b) => b.name === buildingFilter);
        const floors = (building as { floors?: unknown } | undefined)?.floors;
        if (!Array.isArray(floors)) return [] as string[];
        return floors.filter((floor): floor is string => typeof floor === 'string');
    });
    let floorOptions = $derived([
        ...selectedBuildingFloors.map((floor) => ({ value: floor, label: floor })),
        { value: '__none__', label: 'Sin piso base' },
    ]);
    let isFloorFilterEnabled = $derived(buildingFilter !== '' && buildingFilter !== 'Sin Edificio');
    let floorFilterLabel = $derived(floorFilter === '__none__' ? 'Sin piso base' : floorFilter);
    let floorPlaceholder = $derived(
        buildingFilter === ''
            ? 'Selecciona un edificio'
            : buildingFilter === 'Sin Edificio'
              ? 'No aplica sin edificio'
              : selectedBuildingFloors.length > 0
                ? 'Todos los pisos'
                : 'Sin pisos',
    );

    // Sincronizar los filtros de nombre → ID con el store
    $effect(() => {
        const bldgId =
            buildingFilter === 'Sin Edificio'
                ? '__none__'
                : buildings.find((b) => b.name === buildingFilter)?.id || '';
        personnelState.filters.buildingId = bldgId;
        if (
            (!bldgId ||
                bldgId === '__none__' ||
                (floorFilter !== '__none__' && !selectedBuildingFloors.includes(floorFilter))) &&
            floorFilter !== ''
        ) {
            floorFilter = '';
        }
    });
    $effect(() => {
        personnelState.filters.floor = floorFilter;
    });
    $effect(() => {
        const media = catalogState.mediaTypes.find((item) => String(item.id) === mediaFilter);
        if (mediaFilter && mediaFilter !== '__none__' && !media) {
            mediaFilter = '';
        }
        personnelState.filters.mediaTypeId = mediaFilter;
    });
    $effect(() => {
        const depId = dependencies.find((d) => d.name === dependencyFilter)?.id || '';
        personnelState.filters.dependencyId = depId;
    });

    function clearPersonnelFilters() {
        personnelState.filters.status = 'Todos';
        personnelState.filters.search = '';
        dependencyFilter = '';
        buildingFilter = '';
        floorFilter = '';
        mediaFilter = '';
    }

    // Chips de filtros activos para el toolbar.
    let personnelChips = $derived.by(() => {
        const chips: { label: string; value: string; onClear: () => void }[] = [];
        if (personnelState.filters.status !== 'Todos') {
            chips.push({
                label: 'Estado',
                value: personnelState.filters.status,
                onClear: () => (personnelState.filters.status = 'Todos'),
            });
        }
        if (dependencyFilter) {
            chips.push({
                label: 'Dependencia',
                value: dependencyFilter,
                onClear: () => (dependencyFilter = ''),
            });
        }
        if (buildingFilter) {
            chips.push({ label: 'Edificio', value: buildingFilter, onClear: () => (buildingFilter = '') });
        }
        if (floorFilter) {
            chips.push({
                label: 'Piso',
                value: floorFilterLabel || floorFilter,
                onClear: () => (floorFilter = ''),
            });
        }
        if (mediaFilter) {
            chips.push({
                label: 'Tarjeta',
                value: mediaTypeName || mediaFilter,
                onClear: () => (mediaFilter = ''),
            });
        }
        return chips;
    });

    // Estado del modal
    let isDetailsOpen = $derived(personnelState.isDetailsOpen);
    let selectedPersonId = $derived(personnelState.selectedPersonId);
    let selectedPerson = $derived(personnel.find((p) => p.id === selectedPersonId) || null);

    const FILTER_DEBOUNCE_MS = 300;
    let filterDebounce: ReturnType<typeof setTimeout>;
    $effect(() => {
        personnelState.filters.search;
        personnelState.filters.status;
        personnelState.filters.dependencyId;
        personnelState.filters.buildingId;
        personnelState.filters.floor;
        personnelState.filters.mediaTypeId;

        clearTimeout(filterDebounce);
        filterDebounce = setTimeout(() => personnelState.refresh(1), FILTER_DEBOUNCE_MS);
    });

    /* Pagination Helpers */
    let currentPage = $derived(personnelState.pagination.currentPage);
    let pageSize = $derived(personnelState.pagination.pageSize);
    let totalRecords = $derived(personnelState.pagination.totalRecords);

    let currentUser = $derived(userState.currentUser);

    function onOpenAddModal() {
        personnelState.openEditModal(null);
    }

    function onOpenDetails(person: any) {
        personnelState.selectPerson(person.id);
    }

    function onEditPerson(person: any) {
        personnelState.openEditModal(person);
    }

    /** Bloquea/reactiva una persona desde la fila (swipe) con confirmación. */
    function togglePersonBlock(person: any) {
        haptic('medium');
        const reactivating = person.status_raw === 'blocked';
        confirm.open({
            title: reactivating ? '¿Reactivar persona?' : '¿Bloquear persona?',
            description: reactivating
                ? 'Volverá a tener acceso según sus tarjetas activas.'
                : 'Se denegará el acceso a todas las instalaciones.',
            variant: reactivating ? 'info' : 'warning',
            confirmText: reactivating ? 'Reactivar' : 'Bloquear',
            onConfirm: async () => {
                const previous = person.status_raw;
                await personnelService.updateStatus(person.id, reactivating ? 'active' : 'blocked');
                toastWithUndo({
                    message: reactivating ? 'Persona reactivada' : 'Persona bloqueada',
                    onUndo: async () => {
                        await personnelService.updateStatus(person.id, previous);
                        await personnelState.refresh(1);
                    },
                });
                await personnelState.refresh(1);
            },
        });
    }

    /** Acciones al deslizar una tarjeta de personal en móvil. */
    function personActionsFor(
        row: any,
    ): { label: string; tone: 'emerald' | 'amber' | 'blue'; onAction: () => void }[] {
        const reactivating = row.status_raw === 'blocked';
        return [
            {
                label: reactivating ? 'Reactivar' : 'Bloquear',
                tone: reactivating ? 'emerald' : 'amber',
                onAction: () => togglePersonBlock(row),
            },
            {
                label: 'Detalles',
                tone: 'blue',
                onAction: () => onOpenDetails(row),
            },
        ];
    }

    let showKoneUsageModal = $state(false);
    let showRegistrosImport = $state(false);
    let isZipExporting = $state(false);

    async function handleExportExcel(splitByDependency: boolean = false) {
        const loadingToast = toast.loading('Preparando exportación...');
        try {
            const depId = dependencies.find((d) => d.name === dependencyFilter)?.id || '';
            const bldgId =
                buildingFilter === 'Sin Edificio'
                    ? '__none__'
                    : buildings.find((b) => b.name === buildingFilter)?.id || '';
            const data = await personnelService.fetchForExport(
                personnelState.filters.search,
                personnelState.filters.status,
                depId,
                bldgId,
                floorFilter,
                personnelState.filters.mediaTypeId,
            );

            const { exportPersonnelToExcel } = await import('../utils/xlsxExport');
            exportPersonnelToExcel(data as any[], {
                filters: {
                    status: personnelState.filters.status,
                    dependency: dependencyFilter,
                    building: buildingFilter,
                    floor: floorFilterLabel,
                    mediaType: mediaTypeName,
                    search: personnelState.filters.search,
                },
                splitByDependency,
                cardTypes: exportCardTypes,
                mediaTypes: catalogState.mediaTypes,
            });
            toast.success('Exportación completada', { id: loadingToast });
        } catch (error) {
            toast.dismiss(loadingToast);
            handleError(error, 'Exportar Personal');
        }
    }

    async function handleExportAllDepsZip() {
        if (dependencies.length === 0) {
            toast.error('No hay dependencias registradas');
            return;
        }
        const zipBldgId =
            buildingFilter === 'Sin Edificio'
                ? '__none__'
                : buildings.find((b) => b.name === buildingFilter)?.id || '';
        isZipExporting = true;
        const loadingToast = toast.loading('Preparando ZIP...');
        try {
            const { exportPersonnelAllDependenciesAsZip } = await import('../utils/zipExport');
            await exportPersonnelAllDependenciesAsZip(
                dependencies,
                {
                    status: personnelState.filters.status,
                    search: personnelState.filters.search,
                    buildingId: zipBldgId,
                    buildingName: buildingFilter,
                    floor: floorFilter,
                    floorName: floorFilterLabel,
                    mediaTypeId: personnelState.filters.mediaTypeId,
                    mediaTypeName,
                },
                (_current, _total, label) => {
                    toast.loading(`Procesando: ${label}`, { id: loadingToast });
                },
                exportCardTypes,
                catalogState.mediaTypes,
            );
            toast.success('ZIP descargado', { id: loadingToast });
        } catch (error) {
            toast.dismiss(loadingToast);
            handleError(error, 'Exportar ZIP Personal');
        } finally {
            isZipExporting = false;
        }
    }

    // ─── Selección múltiple y acciones masivas ───────────────────────────
    let selectedPeople = $state<any[]>([]);

    $effect(() => pullRefresh.register(() => personnelState.refresh(1)));

    function clearPeopleSelection() {
        selectedPeople = [];
    }

    function bulkSetStatus(status: 'blocked' | 'active' | 'inactive') {
        if (!networkStore.isOnline) {
            toast.error('Sin conexión: no se puede modificar personal.');
            return;
        }
        const targets = selectedPeople.filter((p) => {
            if (status === 'blocked') return p.status_raw !== 'blocked';
            if (status === 'active') return p.status_raw === 'blocked' || p.status_raw === 'inactive';
            return p.status_raw !== 'inactive'; // inactive
        });
        if (targets.length === 0) {
            toast.info('No hay personas que actualizar en la selección.');
            return;
        }
        const previous = targets.map((p) => ({ id: p.id, status_raw: p.status_raw }));
        const config = {
            blocked: {
                title: `¿Bloquear ${targets.length} persona(s)?`,
                description: 'Se denegará el acceso a las personas seleccionadas.',
                variant: 'warning' as const,
                confirmText: 'Bloquear',
                message: `${targets.length} persona(s) bloqueada(s)`,
            },
            active: {
                title: `¿Reactivar ${targets.length} persona(s)?`,
                description: 'Las personas seleccionadas volverán a tener acceso.',
                variant: 'info' as const,
                confirmText: 'Reactivar',
                message: `${targets.length} persona(s) reactivada(s)`,
            },
            inactive: {
                title: `¿Dar de baja ${targets.length} persona(s)?`,
                description:
                    'Las personas seleccionadas quedarán en BAJA (reversible). Sus tarjetas se liberan al inventario, se revocan asignaciones y se cancelan tickets pendientes.',
                variant: 'danger' as const,
                confirmText: 'Dar de baja',
                message: `${targets.length} persona(s) dada(s) de baja`,
            },
        }[status];

        confirm.open({
            title: config.title,
            description: config.description,
            variant: config.variant,
            confirmText: config.confirmText,
            onConfirm: async () => {
                try {
                    await Promise.all(targets.map((p) => personnelService.updateStatus(p.id, status)));
                    toastWithUndo({
                        message: config.message,
                        onUndo: async () => {
                            await Promise.all(
                                previous.map((p) => personnelService.updateStatus(p.id, p.status_raw)),
                            );
                            await personnelState.refresh(1);
                        },
                    });
                    clearPeopleSelection();
                    await personnelState.refresh(1);
                } catch (e) {
                    handleError(e, 'Actualizar estado de personal');
                }
            },
        });
    }

    function bulkUnassignCards() {
        if (!networkStore.isOnline) {
            toast.error('Sin conexión: no se pueden desvincular tarjetas.');
            return;
        }
        const targets = selectedPeople.filter((p) =>
            (p.cards || []).some((c: any) => c.status !== 'inactive'),
        );
        if (targets.length === 0) {
            toast.info('No hay tarjetas asignadas para desvincular.');
            return;
        }
        const count = targets.reduce(
            (n, p) => n + (p.cards || []).filter((c: any) => c.status !== 'inactive').length,
            0,
        );
        confirm.open({
            title: `¿Desvincular ${count} tarjeta(s)?`,
            description:
                'Las tarjetas volverán al inventario como disponibles. Las personas permanecen activas.',
            variant: 'warning',
            confirmText: 'Desvincular',
            onConfirm: async () => {
                try {
                    for (const p of targets) {
                        for (const c of p.cards || []) {
                            if (c.status !== 'inactive') await cardService.unassign(c.id);
                        }
                    }
                    toast.success(`${count} tarjeta(s) desvinculada(s)`);
                    clearPeopleSelection();
                    await personnelState.refresh(1);
                } catch (e) {
                    handleError(e, 'Desvincular tarjetas');
                }
            },
        });
    }

    let bulkDeleteState = $state<{ isOpen: boolean; people: any[] }>({
        isOpen: false,
        people: [],
    });

    function openBulkDelete() {
        if (selectedPeople.length === 0) return;
        bulkDeleteState = { isOpen: true, people: [...selectedPeople] };
    }

    async function handleBulkDelete(action: 'keep' | 'delete') {
        const people = bulkDeleteState.people;
        if (people.length === 0) return;
        const results = await Promise.allSettled(
            people.map((p) => {
                const cardActionMap: Record<string, 'delete' | 'keep'> = {};
                for (const c of p.cards || []) cardActionMap[c.id] = action;
                return personnelService.delete(p.id, cardActionMap);
            }),
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        const ok = results.length - failed;
        if (failed > 0) {
            toast.error(`${ok} persona(s) eliminada(s), ${failed} con error`);
        } else {
            toast.success(`${ok} persona(s) eliminada(s)`);
        }
        clearPeopleSelection();
        await personnelState.refresh(1);
    }

    async function bulkExportSelected() {
        const ids = new Set(selectedPeople.map((p) => p.id));
        if (ids.size === 0) return;
        const loadingToast = toast.loading('Preparando exportación...');
        try {
            const depId = dependencies.find((d) => d.name === dependencyFilter)?.id || '';
            const bldgId =
                buildingFilter === 'Sin Edificio'
                    ? '__none__'
                    : buildings.find((b) => b.name === buildingFilter)?.id || '';
            const all = await personnelService.fetchForExport(
                personnelState.filters.search,
                personnelState.filters.status,
                depId,
                bldgId,
                floorFilter,
                personnelState.filters.mediaTypeId,
            );
            const selected = all.filter((p) => ids.has(p.id));
            const { exportPersonnelToExcel } = await import('../utils/xlsxExport');
            exportPersonnelToExcel(selected as any[], {
                filters: {
                    status: personnelState.filters.status,
                    dependency: dependencyFilter,
                    building: buildingFilter,
                    floor: floorFilterLabel,
                    mediaType: mediaTypeName,
                    search: personnelState.filters.search,
                },
                cardTypes: exportCardTypes,
                mediaTypes: catalogState.mediaTypes,
            });
            toast.success(`Exportación completada (${selected.length})`, {
                id: loadingToast,
            });
        } catch (error) {
            toast.dismiss(loadingToast);
            handleError(error, 'Exportar Personal Seleccionado');
        }
    }
</script>

{#snippet renderName(row: any)}
    {@const hasPendingModification = ticketState.pendingItems?.some(
        (t: any) => t.person_id === row.id && t.type === 'Modificación de Datos',
    )}
    <div class="flex items-center gap-2">
        <span class="font-semibold lg:font-bold text-slate-900">{row.name}</span>
        {#if hasPendingModification}
            <Badge
                variant="amber"
                class="text-[8px] px-1 py-0 h-4 border-amber-200 bg-amber-50 text-amber-700 animate-pulse"
                title="Esta persona tiene cambios pendientes de aprobación"
            >
                MODIFICACIÓN PENDIENTE
            </Badge>
        {/if}
    </div>
{/snippet}

{#snippet renderStatus(row: any)}
    <div class="flex items-center gap-2">
        <Badge variant={getPersonnelStatusVariant(row.status)}>
            {row.status}
        </Badge>
    </div>
{/snippet}

{#snippet renderDependency(row: any)}
    <div class="flex flex-col">
        <span class="font-medium text-slate-900">{row.dependency}</span>
        <span class="text-xs text-slate-500">{row.building} ({row.floor})</span>
    </div>
{/snippet}

{#snippet renderCards(row: any)}
    <div class="flex flex-wrap gap-1">
        {#each row.cards || [] as card}
            <Badge variant={mediaTypeVariant(card.type)} class="px-1.5 py-0">
                {card.type}
            </Badge>
        {/each}
    </div>
{/snippet}

{#snippet mobileList(rows: any[])}
    <DataList
        items={rows}
        key={(r: any) => r.id}
        selectable={userState.isAdmin}
        bind:selectedRows={selectedPeople}
        onOpen={onOpenDetails}
        actions={personActionsFor}
    >
        {#snippet leading(r: any)}
            <div
                class="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-[10px] font-bold"
            >
                {(r.name || '?')
                    .split(' ')
                    .map((w: string) => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
            </div>
        {/snippet}
        {#snippet title(r: any)}
            {@render renderName(r)}
        {/snippet}
        {#snippet subtitle(r: any)}
            <span>{r.employee_no} · {r.dependency}</span>
        {/snippet}
        {#snippet trailing(r: any)}
            {@render renderStatus(r)}
        {/snippet}
    </DataList>
{/snippet}

<div class="space-y-4">
    <SectionHeader
        title="Directorio de Personal"
        filtersCount={personnelChips.length}
        onClearFilters={clearPersonnelFilters}
    >
        {#snippet filters()}
            <FilterToolbar chips={personnelChips} onClearAll={clearPersonnelFilters}>
                {#snippet primary()}
                    <FilterSelect
                        label="Estado"
                        options={[
                            'Todos',
                            'Activo/a',
                            'No Activos',
                            'Parcial',
                            'En proceso',
                            'Media de otro edificio',
                            'Otro edificio en proceso',
                            'Sin Acceso',
                            'Bloqueado/a',
                            'Baja',
                        ]}
                        bind:value={personnelState.filters.status}
                    />
                    <FilterSelect
                        label="Edificio"
                        options={buildingNames}
                        placeholder="Todos los edificios"
                        bind:value={buildingFilter}
                    />
                    <div class="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-[200px] w-full">
                        <span
                            class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap"
                            >Buscar</span
                        >
                        <SearchInput
                            placeholder="Nombre, No. Empleado..."
                            bind:value={personnelState.filters.search}
                            oninput={() => {}}
                            class="h-9 text-xs font-bold"
                        />
                    </div>
                {/snippet}
                {#snippet overflow()}
                    <FilterSelect
                        label="Dependencia"
                        options={dependencyNames}
                        placeholder="Todas las dependencias"
                        bind:value={dependencyFilter}
                    />
                    <FilterSelect
                        label="Piso base"
                        options={isFloorFilterEnabled ? floorOptions : []}
                        placeholder={floorPlaceholder}
                        bind:value={floorFilter}
                        disabled={!isFloorFilterEnabled}
                    />
                    <FilterSelect
                        label="Tipo de tarjeta"
                        options={mediaTypeOptions}
                        placeholder="Todos los tipos"
                        bind:value={mediaFilter}
                    />
                {/snippet}
            </FilterToolbar>
        {/snippet}

        {#snippet actions()}
            {#if moduleState.isEnabled('conteo_uso')}
                <PermissionGuard requireEdit>
                    <Button
                        variant="soft-blue"
                        onclick={() => (showKoneUsageModal = true)}
                        class="flex items-center gap-2.5 h-11 sm:h-10 px-5"
                        disabled={!networkStore.isOnline}
                    >
                        <Upload size={18} strokeWidth={2.5} class="text-blue-600/80" />
                        Importar Conteo de Uso
                    </Button>
                </PermissionGuard>
            {/if}

            <PermissionGuard requireEdit>
                <Button
                    variant="soft-emerald"
                    onclick={() => (showRegistrosImport = true)}
                    class="flex items-center gap-2.5 h-11 sm:h-10 px-5"
                    disabled={!networkStore.isOnline}
                >
                    <Upload size={18} strokeWidth={2.5} class="text-emerald-600/80" />
                    Importar Registros
                </Button>
            </PermissionGuard>

            <ExportDropdown
                icon={FileSpreadsheet}
                label="Exportar Excel"
                disabled={personnel.length === 0 || !networkStore.isOnline}
                class="h-11 sm:h-10 px-5"
            >
                {#snippet items()}
                    <ExportMenuItem
                        icon={FileSpreadsheet}
                        label="Hoja Única"
                        iconBgClass="bg-blue-50"
                        iconColorClass="text-blue-600"
                        onclick={() => handleExportExcel(false)}
                    />
                    <ExportMenuItem
                        icon={FileStack}
                        label="Separado por Dependencia"
                        onclick={() => handleExportExcel(true)}
                    />
                    <div class="mx-3 my-1 border-t border-slate-100"></div>
                    <div class="px-4 py-2">
                        <p class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                            Tipos de tarjeta
                        </p>
                        <div class="flex flex-col gap-0.5">
                            {#each mediaTypeNames as t}
                                <button
                                    type="button"
                                    class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12px] font-bold transition-colors {exportCardTypes.includes(
                                        t,
                                    )
                                        ? 'bg-slate-50 text-slate-800'
                                        : 'text-slate-400 hover:text-slate-600'}"
                                    onclick={() => toggleExportCardType(t)}
                                >
                                    <span
                                        class="w-4 h-4 rounded flex items-center justify-center border transition-colors {exportCardTypes.includes(
                                            t,
                                        )
                                            ? 'bg-blue-600 border-blue-600 text-white'
                                            : 'border-slate-300 text-transparent'}"
                                    >
                                        <Check size={11} strokeWidth={3.5} />
                                    </span>
                                    <span class="w-2 h-2 rounded-full {mediaTypeDotClass(t)}"></span>
                                    {t}
                                </button>
                            {/each}
                        </div>
                        <p class="text-[10px] text-slate-400 mt-1.5">
                            Solo se incluirán las columnas de los tipos seleccionados.
                        </p>
                    </div>
                    <div class="mx-3 my-1 border-t border-slate-100"></div>
                    <ExportMenuItem
                        icon={FolderArchive}
                        label="Todas las Dependencias (ZIP)"
                        iconBgClass="bg-violet-50"
                        iconColorClass="text-violet-600"
                        disabled={isZipExporting || dependencies.length === 0}
                        onclick={handleExportAllDepsZip}
                    />
                {/snippet}
            </ExportDropdown>

            <PermissionGuard requireEdit>
                <Button
                    variant="primary"
                    class="flex items-center gap-2.5 h-11 sm:h-10 px-6 shadow-lg shadow-blue-500/20"
                    onclick={onOpenAddModal}
                    disabled={!networkStore.isOnline}
                >
                    <Plus size={18} strokeWidth={3} class="mr-2" />
                    Nueva Alta
                </Button>
            </PermissionGuard>
        {/snippet}
    </SectionHeader>

    <!-- Top Pagination removed per request -->

    {#if userState.isAdmin && selectedPeople.length > 0}
        <div
            class="flex flex-wrap items-center gap-3 p-3 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur max-lg:fixed max-lg:inset-x-3 max-lg:bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] max-lg:z-40 max-lg:shadow-2xl"
        >
            <span class="text-sm font-extrabold text-blue-800">
                {selectedPeople.length} persona(s) seleccionada(s)
            </span>
            <div class="flex flex-wrap items-center gap-2 ml-auto">
                <Button variant="soft-slate" size="sm" onclick={clearPeopleSelection}>Limpiar</Button>
                <Button
                    variant="soft-blue"
                    size="sm"
                    disabled={!networkStore.isOnline}
                    onclick={bulkExportSelected}
                >
                    <FileSpreadsheet size={15} class="mr-1.5" />
                    Exportar selección
                </Button>

                <span class="hidden sm:block w-px h-5 bg-slate-200"></span>

                <PermissionGuard requireEdit>
                    <Button
                        variant="soft-emerald"
                        size="sm"
                        disabled={!networkStore.isOnline}
                        onclick={() => bulkSetStatus('active')}
                    >
                        Reactivar
                    </Button>
                    <Button
                        variant="amber"
                        size="sm"
                        disabled={!networkStore.isOnline}
                        onclick={() => bulkSetStatus('blocked')}
                    >
                        Bloquear
                    </Button>

                    <span class="hidden sm:block w-px h-5 bg-slate-200"></span>

                    <Button
                        variant="soft-slate"
                        size="sm"
                        disabled={!networkStore.isOnline}
                        onclick={bulkUnassignCards}
                    >
                        Desvincular tarjetas
                    </Button>

                    <span class="hidden sm:block w-px h-5 bg-slate-200"></span>

                    <Button
                        variant="soft-rose"
                        size="sm"
                        disabled={!networkStore.isOnline}
                        onclick={() => bulkSetStatus('inactive')}
                    >
                        Dar de baja
                    </Button>
                    <Button
                        variant="danger"
                        size="sm"
                        disabled={!networkStore.isOnline}
                        onclick={openBulkDelete}
                    >
                        Eliminar
                    </Button>
                </PermissionGuard>
            </div>
        </div>
    {/if}

    <ContentView
        isLoading={personnelState.pagination.isLoading}
        data={personnel}
        error={personnelState.pagination.error}
        onRetry={() => personnelState.refresh(1)}
        emptyTitle="Aún no hay personal registrado"
        emptyDescription="Comienza registrando la primera persona en el sistema."
        emptyIcon={Users}
        emptyIconBgClass="from-slate-100 to-slate-200 text-slate-400"
        skeletonColumns={5}
        skeletonRows={5}
        skeletonHasActions={true}
        cardClass="overflow-hidden"
    >
        {#snippet children()}
            <DataTable
                data={personnel}
                actionsWidth="130px"
                columns={[
                    {
                        key: 'name',
                        label: 'Nombre completo',
                        render: renderName,
                        width: '220px',
                    },
                    { key: 'employee_no', label: 'No. Empleado', width: '100px' },
                    {
                        key: 'dependency',
                        label: 'Dependencia / Edificio',
                        render: renderDependency,
                        width: '250px',
                    },
                    {
                        key: 'cards',
                        label: 'Tarjetas',
                        render: renderCards,
                        sortable: false,
                        width: '140px',
                    },
                    {
                        key: 'status',
                        label: 'Estado',
                        render: renderStatus,
                        width: '120px',
                    },
                ]}
                {mobileList}
                selectable={userState.isAdmin}
                bind:selectedRows={selectedPeople}
            >
                {#snippet actions(row: any)}
                    <Button
                        variant="soft-blue"
                        size="sm"
                        class="h-9 px-4 rounded-xl"
                        onclick={() => onOpenDetails(row)}
                        title="Ver detalles de la persona"
                    >
                        Ver detalles
                    </Button>
                {/snippet}
            </DataTable>
        {/snippet}
    </ContentView>

    <Pagination
        {currentPage}
        {pageSize}
        {totalRecords}
        onPrevPage={() => personnelState.prevPage()}
        onNextPage={() => personnelState.nextPage()}
        onGoToPage={(page) => personnelState.goToPage(page)}
    />
</div>

<PermissionGuard requireEdit>
    <FloatingActionButton onclick={onOpenAddModal} label="Nueva Alta" />
</PermissionGuard>

<UsoTarjetasImportModal bind:isOpen={showKoneUsageModal} />

<RegistrosImportModal bind:isOpen={showRegistrosImport} onComplete={() => personnelState.refresh(1)} />

<BulkDeletePersonnelModal
    bind:isOpen={bulkDeleteState.isOpen}
    people={bulkDeleteState.people}
    onConfirm={handleBulkDelete}
    onCancel={() => (bulkDeleteState = { ...bulkDeleteState, people: [] })}
/>
