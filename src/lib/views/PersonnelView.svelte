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
        ChevronDown,
        FileStack,
        Upload,
    } from "lucide-svelte";
    import FloatingActionButton from "../components/FloatingActionButton.svelte";
    import KoneUsageImportModal from "../components/modals/KoneUsageImportModal.svelte";
    import { personnelService } from "../services/personnel";
    import { cardService } from "../services/cards";
    import { exportPersonnelToExcel } from "../utils/xlsxExport";
    import { toast } from "svelte-sonner";
    import { networkStore } from "../stores/network.svelte";

    import { onMount } from "svelte";

    let personnel = $derived(personnelState.personnel);
    let dependencies = $derived(catalogState.dependencies);
    let buildings = $derived(catalogState.buildings);

    let dependencyNames = $derived(dependencies.map((d) => d.name));
    let buildingNames = $derived([
        ...buildings.map((b) => b.name),
        "Sin Edificio",
    ]);

    // Local UI filters
    let statusFilter = $state("Todos");
    let dependencyFilter = $state("");
    let buildingFilter = $state("");
    let personSearch = $state("");

    // Modal State
    let isDetailsOpen = $derived(personnelState.isDetailsOpen);
    let selectedPersonId = $derived(personnelState.selectedPersonId);
    let selectedPerson = $derived(
        personnel.find((p) => p.id === selectedPersonId) || null,
    );

    onMount(() => {
        personnelState.refresh();
    });

    // Filter Logic
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

    // Search Logic (Debounced + stale-result-safe)
    // We track the request ID so that if the user types faster than the API responds,
    // only the latest in-flight request will update the store.
    let searchTimeout: ReturnType<typeof setTimeout>;
    let lastSearchId = 0;
    async function onSearch(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        personSearch = value;
        clearTimeout(searchTimeout);
        const thisId = ++lastSearchId;
        searchTimeout = setTimeout(async () => {
            await personnelState.search(value);
            // If another request was fired while this one was in flight, discard result
            if (thisId !== lastSearchId) return;
        }, 300);
    }

    /* Pagination Helpers */
    let currentPage = $derived(personnelState.currentPage);
    let pageSize = $derived(personnelState.pageSize);
    let totalRecords = $derived(personnelState.totalRecords);
    let totalPages = $derived(Math.ceil(totalRecords / pageSize));

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

    let currentUser = $derived.by(() => {
        if (!userState.profile) return null;
        return {
            name: userState.profile.full_name || "Usuario",
            email: userState.profile.email,
            avatar: userState.profile.avatar_url,
            role: userState.profile.role,
        };
    });

    function onOpenAddModal() {
        personnelState.openEditModal(null);
    }

    function onOpenDetails(person: any) {
        personnelState.selectPerson(person.id);
    }

    function onEditPerson(person: any) {
        personnelState.openEditModal(person);
    }

    let showExportMenu = $state(false);
    let showKoneUsageModal = $state(false);

    async function handleExportExcel(splitByDependency: boolean = false) {
        showExportMenu = false;
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
            console.error("Export Error:", error);
            toast.error("Error al exportar los datos", { id: loadingToast });
        }
    }

    function getStatusVariant(status: string) {
        if (status === "Activo/a") return "emerald";
        if (status === "Parcial") return "amber";
        if (status === "Sin Acceso") return "slate";
        if (status === "Bloqueado/a") return "rose";
        if (status === "Baja") return "slate";
        return "slate";
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
    </div>
{/snippet}

{#snippet renderStatus(row: any)}
    <div class="flex items-center gap-2">
        <Badge variant={getStatusVariant(row.status)}>
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

            <div class="relative">
                <Button
                    variant="soft-emerald"
                    onclick={() => (showExportMenu = !showExportMenu)}
                    class="flex items-center gap-2.5 h-10 px-5"
                    disabled={personnel.length === 0 || !networkStore.isOnline}
                >
                    <FileSpreadsheet
                        size={18}
                        strokeWidth={2.5}
                        class="text-emerald-600/80"
                    />
                    Exportar Excel
                    <ChevronDown
                        size={14}
                        class="ml-1 opacity-50 transition-transform {showExportMenu
                            ? 'rotate-180'
                            : ''}"
                    />
                </Button>

                {#if showExportMenu}
                    <div
                        class="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 z-50 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
                    >
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
                    </div>
                {/if}
            </div>

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
                >
                    Ver detalles
                </Button>
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
                    onclick={() => personnelState.prevPage()}
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
                                onclick={() =>
                                    personnelState.goToPage(page as number)}
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
                    onclick={() => personnelState.nextPage()}
                >
                    Siguiente
                </Button>
            </div>
        </div>
    {/if}
</div>

<PermissionGuard requireEdit>
    <FloatingActionButton onclick={onOpenAddModal} label="Nueva Alta" />
</PermissionGuard>

<KoneUsageImportModal bind:isOpen={showKoneUsageModal} />
