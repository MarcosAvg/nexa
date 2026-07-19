<script lang="ts">
    import {
        personnelState,
        catalogState,
        userState,
        ticketState,
    } from "../stores";
    import SectionHeader from "../components/SectionHeader.svelte";
    import FilterGroup from "../components/FilterGroup.svelte";
    import FilterSelect from "../components/FilterSelect.svelte";
    import Button from "../components/Button.svelte";
    import Card from "../components/Card.svelte";
    import DataTable from "../components/DataTable.svelte";
    import Badge from "../components/Badge.svelte";
    import PermissionGuard from "../components/PermissionGuard.svelte";
    import {
        Search,
        FileSpreadsheet,
        Plus,
        Upload,
        FileStack,
        FolderArchive,
    } from "lucide-svelte";
    import FloatingActionButton from "../components/FloatingActionButton.svelte";
    import SkeletonTable from "../components/SkeletonTable.svelte";
    import Pagination from "../components/Pagination.svelte";
    import KoneUsageImportModal from "../components/modals/KoneUsageImportModal.svelte";
    import { personnelService } from "../services/personnel";
    import { cardService } from "../services/cards";
    import { exportPersonnelToExcel, exportPersonnelAllDependenciesAsZip, handleError, createSimpleDebounce } from "../utils";
    import { toast } from "svelte-sonner";
    import { networkStore } from "../stores/network.svelte";
    import { getPersonnelStatusVariant } from "../constants/status";
    import ExportDropdown from "../components/ExportDropdown.svelte";

    import { onMount } from "svelte";

    let personnel = $derived(personnelState.personnel);
    let dependencies = $derived(catalogState.dependencies);
    let buildings = $derived(catalogState.buildings);

    let dependencyNames = $derived(dependencies.map((d) => d.name));
    let buildingNames = $derived([
        ...buildings.map((b) => b.name),
        "Sin Edificio",
    ]);

    // Filtros locales de UI
    let statusFilter = $state("Todos");
    let dependencyFilter = $state("");
    let buildingFilter = $state("");
    let personSearch = $state("");

    // Estado del modal
    let isDetailsOpen = $derived(personnelState.isDetailsOpen);
    let selectedPersonId = $derived(personnelState.selectedPersonId);
    let selectedPerson = $derived(
        personnel.find((p) => p.id === selectedPersonId) || null,
    );

    onMount(() => {
        personnelState.refresh();
    });

    // Lógica de filtrado
    function handleFilterChange() {
        const depId =
            dependencies.find((d) => d.name === dependencyFilter)?.id || "";
        personnelState.filter(statusFilter, depId);
    }

    $effect(() => {
        const depId =
            dependencies.find((d) => d.name === dependencyFilter)?.id || "";
        const bldgId =
            buildingFilter === "Sin Edificio"
                ? "__none__"
                : buildings.find((b) => b.name === buildingFilter)?.id || "";
        if (
            statusFilter !== personnelState.statusFilter ||
            depId !== personnelState.dependencyId ||
            bldgId !== personnelState.buildingId
        ) {
            personnelState.filter(statusFilter, depId, bldgId);
        }
    });

    // Lógica de búsqueda (Debounced)
    const debouncedSearch = createSimpleDebounce((value: string) => {
        personnelState.search(value);
    }, 300);

    function onSearch(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        personSearch = value;
        debouncedSearch(value);
    }

    /* Pagination Helpers */
    let currentPage = $derived(personnelState.currentPage);
    let pageSize = $derived(personnelState.pageSize);
    let totalRecords = $derived(personnelState.totalRecords);

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
            const data = await personnelService.fetchForExport(
                personSearch,
                statusFilter,
                depId,
            );

            exportPersonnelToExcel(data as any[], {
                filters: {
                    status: statusFilter,
                    dependency: dependencyFilter,
                    search: personSearch,
                },
                splitByDependency,
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
        isZipExporting = true;
        const loadingToast = toast.loading("Preparando ZIP...");
        try {
            await exportPersonnelAllDependenciesAsZip(
                dependencies,
                { status: statusFilter, search: personSearch },
                (_current, _total, label) => {
                    toast.loading(`Procesando: ${label}`, { id: loadingToast });
                },
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
                variant={card.type === "KONE" ? "blue" : "amber"}
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
                bind:value={statusFilter}
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
                <span
                    class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap"
                    >Buscar</span
                >
                <div class="relative">
                    <input
                        type="text"
                        placeholder="Nombre, No. Empleado..."
                        value={personSearch}
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
                    Importar Conteo KONE
                </Button>
            </PermissionGuard>

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

    <Card class="overflow-hidden">
        {#if personnelState.isLoading && personnel.length === 0}
            <SkeletonTable columns={5} rows={5} hasActions />
        {:else}
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
            >                {#snippet actions(row: any)}
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
        {/if}
    </Card>

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

<KoneUsageImportModal bind:isOpen={showKoneUsageModal} />
