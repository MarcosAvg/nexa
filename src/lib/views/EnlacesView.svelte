<script lang="ts">
    import { onMount } from 'svelte';
    import { enlaceService } from '../services/enlaces';
    import type { Enlace } from '../types';
    import { confirm } from '../utils/confirmModal.svelte';
    import { fullName } from '../utils';
    import {
        SectionHeader,
        FloatingActionButton,
        PermissionGuard,
        DataTable,
        FilterSelect,
        FilterToolbar,
        Button,
        ContentView,
        SearchInput,
        DataList,
        AddEnlaceModal,
        EditEnlaceModal,
        IconButton,
    } from '../components';
    import { catalogState } from '../stores';
    import { pullRefresh } from '../stores';
    import { Trash2, Contact, UserPlus, Edit, Copy, Mail, Send, Link2 } from 'lucide-svelte';
    import { toast } from 'svelte-sonner';

    let enlaces = $state<Enlace[]>([]);
    let isLoading = $state(true);
    let loadError = $state<string | null>(null);
    let isAddModalOpen = $state(false);
    let searchQuery = $state('');
    let filterDependency = $state('');
    let filterFloor = $state('');

    function clearEnlaceFilters() {
        searchQuery = '';
        filterDependency = '';
        filterFloor = '';
    }

    // Chips de filtros activos para el toolbar.
    let enlaceChips = $derived.by(() => {
        const chips: { label: string; value: string; onClear: () => void }[] = [];
        if (filterDependency) {
            chips.push({
                label: 'Dependencia',
                value: filterDependency,
                onClear: () => (filterDependency = ''),
            });
        }
        if (filterFloor) {
            chips.push({ label: 'Piso', value: filterFloor, onClear: () => (filterFloor = '') });
        }
        return chips;
    });

    let isEditOpen = $state(false);
    let selectedEnlaceForEdit = $state<Enlace | null>(null);

    let dependencies = $derived(catalogState.dependencies);
    let buildings = $derived(catalogState.buildings);
    let dependencyNames = $derived(dependencies.map((d) => d.name));

    let availableFloors = $derived.by(() => {
        const floors = new Set(
            enlaces
                .map((e) => e.personnel?.floor)
                .filter((floor): floor is string => Boolean(floor) && floor !== 'N/A'),
        );
        return Array.from(floors).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
        );
    });

    async function loadData() {
        isLoading = true;
        loadError = null;
        try {
            enlaces = await enlaceService.fetchAll();
        } catch (e) {
            loadError = e instanceof Error ? e.message : 'No se pudieron cargar los enlaces.';
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        loadData();
    });

    $effect(() => pullRefresh.register(() => loadData()));

    let filteredEnlaces = $derived.by(() => {
        let list = enlaces.map((e) => {
            const depId = (e.personnel as any)?.dependency_id;
            const dep = dependencies.find((d) => d.id === depId);
            const dependencyName = dep ? dep.name : 'N/A';

            const bldgId = (e.personnel as any)?.building_id;
            const bldg = buildings.find((b) => b.id === bldgId);
            const buildingName = bldg ? bldg.name : '';

            return {
                ...e,
                name: fullName(e.personnel?.first_name, e.personnel?.last_name) || 'Desconocido',
                dependency: dependencyName,
                building: buildingName,
                floor: e.personnel?.floor || 'N/A',
                email: e.personnel?.email || 'N/A',
            };
        });

        if (searchQuery.trim()) {
            const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
            list = list.filter((e) => {
                const name = e.name.toLowerCase();
                const email = e.email.toLowerCase();
                const ext = (e.extension || '').toLowerCase();
                const depName = e.dependency.toLowerCase();
                return terms.every(
                    (term) =>
                        name.includes(term) ||
                        email.includes(term) ||
                        ext.includes(term) ||
                        depName.includes(term),
                );
            });
        }

        if (filterDependency) {
            list = list.filter((e) => e.dependency === filterDependency);
        }

        if (filterFloor) {
            list = list.filter((e) => e.floor === filterFloor);
        }

        // Orden por defecto: "Piso base"
        list.sort((a, b) => {
            const aVal = a.floor;
            const bVal = b.floor;
            if (aVal === 'N/A' && bVal !== 'N/A') return 1;
            if (bVal === 'N/A' && aVal !== 'N/A') return -1;
            return aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
        });

        return list;
    });

    const columns = [
        {
            key: 'name',
            label: 'Nombre completo',
            render: renderName,
            sortable: true,
            width: '220px',
        },
        {
            key: 'dependency',
            label: 'Dependencia / Ubicación',
            render: renderDependency,
            sortable: true,
            width: '280px',
        },
        {
            key: 'email',
            label: 'Correo',
            render: renderEmail,
            sortable: true,
            width: '220px',
        },
        {
            key: 'extension',
            label: 'Extensión',
            render: renderExtension,
            sortable: true,
            width: '100px',
        },
    ];

    function requestRemove(enlace: Enlace) {
        const name = fullName(enlace.personnel?.first_name, enlace.personnel?.last_name);
        confirm.open({
            title: 'Remover Enlace',
            description: `¿Estás seguro de que deseas quitar a ${name} de los enlaces administrativos?`,
            variant: 'danger',
            confirmText: 'Remover',
            onConfirm: async () => {
                try {
                    await enlaceService.remove(enlace.id, name);
                    toast.success('Enlace removido');
                    loadData();
                } catch (e) {
                    toast.error('Error al remover enlace');
                }
            },
        });
    }

    function requestEdit(row: Enlace) {
        selectedEnlaceForEdit = row;
        isEditOpen = true;
    }

    async function copyEmail(email: string) {
        if (!email || email === 'N/A') return;
        try {
            await navigator.clipboard.writeText(email);
            toast.success('Correo copiado al portapapeles');
        } catch {
            toast.error('Error al copiar el correo');
        }
    }

    function sendEmail(email: string) {
        if (!email || email === 'N/A') return;
        window.location.href = `mailto:${email}`;
    }

    /** Acciones de swipe para un enlace (solo lectura). */
    function enlaceSwipeActions(row: Enlace) {
        const list: { label: string; tone: 'blue' | 'indigo'; onAction: () => void }[] = [];
        const email = row.personnel?.email;
        if (email && email !== 'N/A') {
            list.push({ label: 'Copiar', tone: 'blue', onAction: () => copyEmail(email) });
            list.push({ label: 'Correo', tone: 'indigo', onAction: () => sendEmail(email) });
        }
        return list;
    }

    function broadcastEmail() {
        const emails = filteredEnlaces
            .map((e) => e.personnel?.email)
            .filter((email) => email && email.trim() !== '' && email !== 'N/A');

        if (emails.length === 0) {
            toast.error('No hay correos disponibles en esta lista.');
            return;
        }
        window.location.href = `mailto:?bcc=${emails.join(',')}`;
    }
</script>

{#snippet renderName(row: Enlace)}
    <span class="font-semibold lg:font-bold text-slate-900"
        >{fullName(row.personnel?.first_name, row.personnel?.last_name) || 'Desconocido'}</span
    >
{/snippet}

{#snippet renderDependency(row: Enlace)}
    {@const depId = (row.personnel as any)?.dependency_id}
    {@const dep = dependencies.find((d) => d.id === depId)}
    <div class="flex flex-col">
        <span class="font-medium text-slate-900">{dep ? dep.name : 'N/A'}</span>
        {#if row.building || row.floor}
            <span class="text-xs text-slate-500"
                >{row.building || ''}{row.building && row.floor ? ` (${row.floor})` : ''}</span
            >
        {/if}
    </div>
{/snippet}

{#snippet renderEmail(row: Enlace)}
    <span>{row.personnel?.email || 'N/A'}</span>
{/snippet}

{#snippet renderExtension(row: Enlace)}
    <span>{row.extension || 'N/A'}</span>
{/snippet}

{#snippet rowActions(row: Enlace)}
    <div class="flex flex-wrap items-center gap-1 justify-end">
        {#if row.personnel?.email && row.personnel?.email !== 'N/A'}
            <IconButton
                icon={Copy}
                label="Copiar correo"
                title="Copiar Correo"
                tone="blue"
                size="md"
                class="sm:h-9 sm:w-9"
                onclick={() => copyEmail(row.personnel!.email!)}
            />
            <IconButton
                icon={Mail}
                label="Enviar correo"
                title="Enviar Correo"
                tone="indigo"
                size="md"
                class="sm:h-9 sm:w-9"
                onclick={() => sendEmail(row.personnel!.email!)}
            />
        {/if}
        <PermissionGuard requireEdit>
            {#snippet children({ disabled })}
                <IconButton
                    icon={Edit}
                    label="Editar extensión"
                    title="Editar Extensión"
                    tone="emerald"
                    size="md"
                    class="sm:h-9 sm:w-9"
                    {disabled}
                    onclick={() => requestEdit(row)}
                />
                <IconButton
                    icon={Trash2}
                    label="Remover enlace"
                    title="Remover"
                    tone="rose"
                    size="md"
                    class="sm:h-9 sm:w-9"
                    {disabled}
                    onclick={() => requestRemove(row)}
                />
            {/snippet}
        </PermissionGuard>
    </div>
{/snippet}

{#snippet mobileList(rows: Enlace[])}
    <DataList
        items={rows}
        key={(r: Enlace) => r.id}
        actions={enlaceSwipeActions}
        sheetTitle={(r: Enlace) => fullName(r.personnel?.first_name, r.personnel?.last_name)}
    >
        {#snippet leading()}
            <div class="h-8 w-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center">
                <Contact size={14} strokeWidth={2.5} />
            </div>
        {/snippet}
        {#snippet title(r: Enlace)}
            {@render renderName(r)}
        {/snippet}
        {#snippet subtitle(r: Enlace)}
            {@render renderDependency(r)}
        {/snippet}
        {#snippet trailing(r: Enlace)}
            <span class="text-xs font-bold text-slate-500">{r.extension || 'N/A'}</span>
        {/snippet}
        {#snippet details(r: Enlace)}
            <div class="space-y-3 text-sm">
                <div>
                    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Nombre
                    </div>
                    {@render renderName(r)}
                </div>
                <div>
                    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Dependencia
                    </div>
                    {@render renderDependency(r)}
                </div>
                <div class="min-w-0">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Correo
                    </div>
                    <div class="break-all">{@render renderEmail(r)}</div>
                </div>
                <div>
                    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Extensión
                    </div>
                    {@render renderExtension(r)}
                </div>
            </div>
        {/snippet}
        {#snippet sheetActions(r: Enlace)}
            {@render rowActions(r)}
        {/snippet}
    </DataList>
{/snippet}

<div class="space-y-4">
    <SectionHeader
        title="Directorio de Enlaces"
        filtersCount={enlaceChips.length}
        onClearFilters={clearEnlaceFilters}
    >
        {#snippet filters()}
            <FilterToolbar chips={enlaceChips} onClearAll={clearEnlaceFilters}>
                {#snippet primary()}
                    <FilterSelect
                        label="Dependencia"
                        options={dependencyNames}
                        placeholder="Todas"
                        bind:value={filterDependency}
                    />
                    <div class="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-[200px] w-full">
                        <span
                            class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap"
                            >Buscar</span
                        >
                        <SearchInput
                            placeholder="Nombre, correo o ext..."
                            bind:value={searchQuery}
                            class="h-9 text-xs font-bold"
                        />
                    </div>
                {/snippet}
                {#snippet overflow()}
                    <FilterSelect
                        label="Piso Base"
                        options={availableFloors}
                        placeholder="Todos"
                        bind:value={filterFloor}
                    />
                {/snippet}
            </FilterToolbar>
        {/snippet}
        {#snippet actions()}
            <PermissionGuard requireEdit>
                {#snippet children({ disabled })}
                    <div class="w-full xl:w-auto mt-4 xl:mt-0 flex gap-2 justify-end">
                        <Button
                            variant="secondary"
                            class="flex items-center justify-center gap-2 h-10 px-4 rounded-xl"
                            onclick={broadcastEmail}
                        >
                            <Send size={16} class="text-slate-400" />
                            Difusión
                        </Button>
                        <Button
                            variant="primary"
                            class="flex items-center justify-center gap-2 h-10 px-6 rounded-xl shadow-lg shadow-slate-900/10"
                            onclick={() => (isAddModalOpen = true)}
                            {disabled}
                        >
                            <Contact size={18} />
                            Asignar Enlace
                        </Button>
                    </div>
                {/snippet}
            </PermissionGuard>
        {/snippet}
    </SectionHeader>

    <ContentView
        {isLoading}
        data={filteredEnlaces}
        error={loadError}
        onRetry={loadData}
        emptyTitle="Aún no hay enlaces asignados"
        emptyTitleFiltered="Sin resultados"
        emptyDescription="Los enlaces administrativos son los responsables de cada área. Asigna el primero para empezar."
        emptyDescriptionFiltered="No encontramos enlaces con los filtros actuales. Intenta ajustar tu búsqueda."
        emptyIcon={Link2}
        emptyIconBgClass="from-violet-50 to-violet-100 ring-1 ring-violet-200/50 text-violet-400"
        hasFilters={!!(searchQuery || filterDependency || filterFloor)}
        onClearFilters={() => {
            clearEnlaceFilters();
        }}
        skeletonColumns={4}
        skeletonRows={5}
        skeletonHasActions={true}
        cardClass="overflow-hidden"
    >
        {#snippet children()}
            <DataTable data={filteredEnlaces} {columns} actions={rowActions} {mobileList} actionsWidth="220px"
            ></DataTable>
        {/snippet}

        {#snippet emptyActions()}
            <PermissionGuard requireEdit>
                {#snippet children({ disabled })}
                    <Button
                        variant="primary"
                        size="sm"
                        class="h-11 px-7 rounded-xl shadow-lg shadow-violet-500/20"
                        onclick={() => (isAddModalOpen = true)}
                        {disabled}
                    >
                        <UserPlus size={18} strokeWidth={3} class="mr-2" />
                        Asignar primer enlace
                    </Button>
                {/snippet}
            </PermissionGuard>
        {/snippet}
    </ContentView>
</div>

<AddEnlaceModal bind:isOpen={isAddModalOpen} onComplete={loadData} />
<EditEnlaceModal bind:isOpen={isEditOpen} enlace={selectedEnlaceForEdit} onComplete={loadData} />

<PermissionGuard requireEdit>
    {#snippet children({ disabled })}
        <!-- FAB para móvil -->
        <div class="sm:hidden">
            <FloatingActionButton onclick={() => (isAddModalOpen = true)} label="Asignar" icon={UserPlus} />
        </div>
    {/snippet}
</PermissionGuard>
