<script lang="ts">
    import {
        personnelState,
        catalogState,
        userState,
        ticketState,
        moduleState,
    } from "../stores";
    import {
        SectionHeader, FilterGroup, FilterSelect, Button, DataTable,
        Badge, PermissionGuard, FloatingActionButton, Pagination,
        ContentView, SearchInput, ExportDropdown,
        UsoTarjetasImportModal,
    } from "../components";
    import {
        FileSpreadsheet,
        Plus,
        Upload,
        FileStack,
        FolderArchive,
        Users,
        Check,
    } from "lucide-svelte";
    import { personnelService } from "../services/personnel";
    import { cardService } from "../services/cards";
    import { exportPersonnelToExcel, exportPersonnelAllDependenciesAsZip, handleError, createSimpleDebounce } from "../utils";
    import { mediaTypeVariant } from "../utils/mediaTypeAppearance";
    import { toast } from "svelte-sonner";
    import { networkStore } from "../stores/network.svelte";
    import { getPersonnelStatusVariant } from "../constants/status";

    let personnel = $derived(personnelState.pagination.items);
    let dependencies = $derived(catalogState.dependencies);
    let buildings = $derived(catalogState.buildings);

    let dependencyNames = $derived(dependencies.map((d) => d.name));
    let buildingNames = $derived([
        ...buildings.map((b) => b.name),
        "Sin Edificio",
    ]);

    // Tipos de acceso (medios) para las columnas/KPIs de la exportación Excel.
    let exportCardTypes = $state<string[]>([]);
    let mediaTypeNames = $derived(catalogState.activeMediaTypeNames());
    // Inicializar una vez que el catálogo de medios esté cargado.
    $effect(() => {
        if (mediaTypeNames.length > 0 && exportCardTypes.length === 0) {
            exportCardTypes = [...mediaTypeNames];
        }
    });

    const TYPE_DOT_CLASSES = [
        "bg-amber-400",
        "bg-sky-400",
        "bg-emerald-400",
        "bg-violet-400",
        "bg-rose-400",
        "bg-indigo-400",
    ];

    function toggleExportCardType(type: string) {
        if (exportCardTypes.includes(type) && exportCardTypes.length === 1) {
            // Siempre al menos un tipo seleccionado (el exportador no puede omitir todos)
            return;
        }
        exportCardTypes = exportCardTypes.includes(type)
            ? exportCardTypes.filter((t) => t !== type)
            : [...exportCardTypes, type];
    }

    let dependencyFilter = $state("");
    let buildingFilter = $state("");

    // Sincronizar los filtros de nombre → ID con el store
    $effect(() => {
        const bldgId = buildingFilter === "Sin Edificio"
            ? "__none__"
            : buildings.find((b) => b.name === buildingFilter)?.id || "";
        personnelState.filters.buildingId = bldgId;
    });
    $effect(() => {
        const depId = dependencies.find((d) => d.name === dependencyFilter)?.id || "";
        personnelState.filters.dependencyId = depId;
    });

    // Estado del modal
    let isDetailsOpen = $derived(personnelState.isDetailsOpen);
    let selectedPersonId = $derived(personnelState.selectedPersonId);
    let selectedPerson = $derived(
        personnel.find((p) => p.id === selectedPersonId) || null,
    );

    const FILTER_DEBOUNCE_MS = 300;
    let filterDebounce: ReturnType<typeof setTimeout>;
    $effect(() => {
        personnelState.filters.search;
        personnelState.filters.status;
        personnelState.filters.dependencyId;
        personnelState.filters.buildingId;

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

    let showKoneUsageModal = $state(false);
    let isZipExporting = $state(false);

    async function handleExportExcel(splitByDependency: boolean = false) {
        const loadingToast = toast.loading("Preparando exportación...");
        try {
            const depId =
                dependencies.find((d) => d.name === dependencyFilter)?.id || "";
            const bldgId =
                buildingFilter === "Sin Edificio"
                    ? "__none__"
                    : buildings.find((b) => b.name === buildingFilter)?.id || "";
            const data = await personnelService.fetchForExport(
                personnelState.filters.search,
                personnelState.filters.status,
                depId,
                bldgId,
            );

            exportPersonnelToExcel(data as any[], {
                filters: {
                    status: personnelState.filters.status,
                    dependency: dependencyFilter,
                    building: buildingFilter,
                    search: personnelState.filters.search,
                },
                splitByDependency,
                cardTypes: exportCardTypes,
                mediaTypes: catalogState.mediaTypes,
            });
            toast.success("Exportación completada", { id: loadingToast });
        } catch (error) {
            toast.dismiss(loadingToast);
            handleError(error, "Exportar Personal");
        }
    }

    async function handleExportAllDepsZip() {
        if (dependencies.length === 0) {
            toast.error("No hay dependencias registradas");
            return;
        }
        const zipBldgId =
            buildingFilter === "Sin Edificio"
                ? "__none__"
                : buildings.find((b) => b.name === buildingFilter)?.id || "";
        isZipExporting = true;
        const loadingToast = toast.loading("Preparando ZIP...");
        try {
            await exportPersonnelAllDependenciesAsZip(
                dependencies,
                {
                    status: personnelState.filters.status,
                    search: personnelState.filters.search,
                    buildingId: zipBldgId,
                    buildingName: buildingFilter,
                },
                (_current, _total, label) => {
                    toast.loading(`Procesando: ${label}`, { id: loadingToast });
                },
                exportCardTypes,
                catalogState.mediaTypes,
            );
            toast.success("ZIP descargado", { id: loadingToast });
        } catch (error) {
            toast.dismiss(loadingToast);
            handleError(error, "Exportar ZIP Personal");
        } finally {
            isZipExporting = false;
        }
    }
</script>

{#snippet renderName(row: any)}
    {@const hasPendingModification = ticketState.pendingItems?.some(
        (t: any) =>
            t.person_id === row.id && t.type === "Modificación de Datos",
    )}
    <div class="flex items-center gap-2">
        <span class="font-bold text-slate-900">{row.name}</span>
        {#if hasPendingModification}
            <Badge
                variant="amber"
                class="text-[8px] px-1 py-0 h-4 border-amber-200 bg-amber-50 text-amber-700 animate-pulse"
                title="Esta persona tiene cambios pendientes de aprobación"
            >
                MODIFICACIÓN PENDIENTE
            </Badge>
        {/if}
    </div>    {/snippet}

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
            <Badge
                variant={mediaTypeVariant(card.type)}
                class="px-1.5 py-0"
            >
                {card.type}
            </Badge>
        {/each}
    </div>
{/snippet}

{#snippet mobilePersonnelCard(row: any)}
    <article
        class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
        <div class="p-4 space-y-3">
            <div class="flex justify-between items-start">
                {@render renderName(row)}
                {@render renderStatus(row)}
            </div>
            <div class="text-sm text-slate-500">ID: {row.employee_no}</div>
            {@render renderDependency(row)}
            <div>
                <div
                    class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1"
                >
                    Tarjetas
                </div>
                {@render renderCards(row)}
            </div>
        </div>
        <div
            class="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex justify-end"
        >
            <Button
                variant="soft-blue"
                size="sm"
                class="h-9 px-4 rounded-xl"
                onclick={() => onOpenDetails(row)}
            >
                Ver detalles
            </Button>
        </div>
    </article>
{/snippet}

<div class="space-y-6">
    <SectionHeader title="Directorio de Personal">
        {#snippet filters()}
            <FilterGroup
                label="Estado"
                options={[
                    "Todos",
                    "Activo/a",
                    "Parcial",
                    "Sin Acceso",
                    "Bloqueado/a",
                    "Baja",
                ]}
                bind:value={personnelState.filters.status}
            />
            <FilterSelect
                label="Dependencia"
                options={dependencyNames}
                placeholder="Todas las dependencias"
                bind:value={dependencyFilter}
            />
            <FilterSelect
                label="Edificio"
                options={buildingNames}
                placeholder="Todos los edificios"
                bind:value={buildingFilter}
            />
            <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Buscar</span>
                <SearchInput
                    placeholder="Nombre, No. Empleado..."
                    bind:value={personnelState.filters.search}
                    oninput={() => {}}
                    class="h-9 text-xs font-bold"
                />
            </div>
        {/snippet}

        {#snippet actions()}
            {#if moduleState.isEnabled("conteo_uso")}
                <PermissionGuard requireEdit>
                    <Button
                        variant="soft-blue"
                        onclick={() => (showKoneUsageModal = true)}
                        class="flex items-center gap-2.5 h-10 px-5"
                        disabled={!networkStore.isOnline}
                    >
                        <Upload
                            size={18}
                            strokeWidth={2.5}
                            class="text-blue-600/80"
                        />
                        Importar Conteo de Uso
                    </Button>
                </PermissionGuard>
            {/if}

            <ExportDropdown
                icon={FileSpreadsheet}
                label="Exportar Excel"
                disabled={personnel.length === 0 || !networkStore.isOnline}
                class="h-10 px-5"
            >
                {#snippet items()}
                    <button
                        class="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left"
                        onclick={() => handleExportExcel(false)}
                    >
                        <span
                            class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600"
                        >
                            <FileSpreadsheet size={16} />
                        </span>
                        Hoja Única
                    </button>
                    <button
                        class="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left"
                        onclick={() => handleExportExcel(true)}
                    >
                        <span
                            class="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600"
                        >
                            <FileStack size={16} />
                        </span>
                        Separado por Dependencia
                    </button>
                    <div class="mx-3 my-1 border-t border-slate-100"></div>
                    <div class="px-4 py-2">
                        <p class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                            Tipos de tarjeta
                        </p>
                        <div class="flex flex-col gap-0.5">
                            {#each mediaTypeNames as t, i}
                                <button
                                    type="button"
                                    class="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[12px] font-bold transition-colors {exportCardTypes.includes(t)
                                        ? 'bg-slate-50 text-slate-800'
                                        : 'text-slate-400 hover:text-slate-600'}"
                                    onclick={() => toggleExportCardType(t)}
                                >
                                    <span
                                        class="w-4 h-4 rounded flex items-center justify-center border transition-colors {exportCardTypes.includes(t)
                                            ? 'bg-blue-600 border-blue-600 text-white'
                                            : 'border-slate-300 text-transparent'}"
                                    >
                                        <Check size={11} strokeWidth={3.5} />
                                    </span>
                                    <span class="w-2 h-2 rounded-full {TYPE_DOT_CLASSES[i % TYPE_DOT_CLASSES.length]}"></span>
                                    {t}
                                </button>
                            {/each}
                        </div>
                        <p class="text-[10px] text-slate-400 mt-1.5">
                            Solo se incluirán las columnas de los tipos seleccionados.
                        </p>
                    </div>
                    <div class="mx-3 my-1 border-t border-slate-100"></div>
                    <button
                        class="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left disabled:opacity-50"
                        onclick={handleExportAllDepsZip}
                        disabled={isZipExporting || dependencies.length === 0}
                    >
                        <span
                            class="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600"
                        >
                            <FolderArchive size={16} />
                        </span>
                        Todas las Dependencias (ZIP)
                    </button>
                {/snippet}
            </ExportDropdown>

            <PermissionGuard requireEdit>
                <Button
                    variant="primary"
                    class="flex items-center gap-2.5 h-10 px-6 shadow-lg shadow-blue-500/20"
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

    <ContentView
        isLoading={personnelState.pagination.isLoading}
        data={personnel}
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
                        key: "name",
                        label: "Nombre completo",
                        render: renderName,
                        width: "220px",
                    },
                    { key: "employee_no", label: "No. Empleado", width: "100px" },
                    {
                        key: "dependency",
                        label: "Dependencia / Edificio",
                        render: renderDependency,
                        width: "250px",
                    },
                    {
                        key: "cards",
                        label: "Tarjetas",
                        render: renderCards,
                        sortable: false,
                        width: "140px",
                    },
                    {
                        key: "status",
                        label: "Estado",
                        render: renderStatus,
                        width: "120px",
                    },
                ]}
                mobileCard={mobilePersonnelCard}
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
