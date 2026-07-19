<script lang="ts">
    import {
        cardlessRegistryState,
        catalogState,
    } from "../stores";
    import {
        SectionHeader, FilterSelect, Button, Card, DataTable,
        Badge, PermissionGuard, Pagination, FloatingActionButton,
        ContentView, SearchInput, Input,
        CardlessRegistryModal, ConfirmationModal,
    } from "../components";
    import {
        FileSpreadsheet,
        Plus,
        Loader2,
        Trash2,
        FolderArchive,
        ChevronDown,
        FileX,
    } from "lucide-svelte";
    import { cardlessRegistryService } from "../services/cardlessRegistry";
    import { exportCardlessRegistryAllDependenciesAsZip, handleError } from "../utils";
    import type { CardlessRegistry } from "../types";
    import { toast } from "svelte-sonner";
    
    import { networkStore } from "../stores/network.svelte";
    import { onMount } from "svelte";

    let registries = $derived(cardlessRegistryState.registries);
    let totalCount = $derived(cardlessRegistryState.totalCount);
    let currentPage = $derived(cardlessRegistryState.currentPage);
    let pageSize = $derived(cardlessRegistryState.pageSize);
    let isLoading = $derived(cardlessRegistryState.isLoading);

    let startDate = $state("");
    let endDate = $state("");
    let reasonFilter = $state("");
    let searchFilter = $state("");
    let dependencyFilter = $state("");
    let dateRangeError = $state("");

    let buildings = $derived(catalogState.buildings);
    let dependencies = $derived(catalogState.dependencies);
    let dependencyNames = $derived(dependencies.map((d) => d.name));
    let reasons = $derived(cardlessRegistryService.REASONS);

    let searchTimeout: ReturnType<typeof setTimeout> | undefined;

    let isModalOpen = $state(false);
    let editingRegistry = $state<CardlessRegistry | null>(null);
    let isExporting = $state(false);
    let isZipExporting = $state(false);
    let showExportMenu = $state(false);

    let isConfirmDeleteOpen = $state(false);
    let registryToDelete = $state<CardlessRegistry | null>(null);

    let fetchSeq = 0;

    onMount(() => {
        refreshData();
    });

    function dependencyIdFromName(name: string): string {
        if (!name) return "";
        return String(dependencies.find((d) => d.name === name)?.id ?? "");
    }

    function registryDisplayName(reg: CardlessRegistry | null): string {
        if (!reg) return "este registro";
        return (
            reg.personName ||
            [reg.first_name, reg.last_name].filter(Boolean).join(" ") ||
            `registro #${reg.id}`
        );
    }

    function isValidDateRange(start: string, end: string): boolean {
        if (!start || !end) return true;
        return start <= end;
    }

    function applyFiltersAndRefresh() {
        if (!isValidDateRange(startDate, endDate)) {
            dateRangeError = "La fecha de inicio no puede ser posterior a la fecha fin";
            toast.error(dateRangeError);
            return;
        }
        dateRangeError = "";

        cardlessRegistryState.setFilters({
            startDate,
            endDate,
            reason: reasonFilter,
            search: searchFilter,
            dependencyId: dependencyIdFromName(dependencyFilter),
        });
        refreshData();
    }

    function handleSearchInput(e: Event) {
        searchFilter = (e.target as HTMLInputElement).value;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(applyFiltersAndRefresh, 350);
    }

    async function refreshData() {
        const seq = ++fetchSeq;
        cardlessRegistryState.setLoading(true);
        try {
            const { data, count } = await cardlessRegistryService.fetchAll(
                cardlessRegistryState.currentPage,
                cardlessRegistryState.pageSize,
                cardlessRegistryState.currentFilters
            );
            if (seq !== fetchSeq) return;
            cardlessRegistryState.setRegistries(data, count);
        } catch {
            if (seq !== fetchSeq) return;
            // handleError ya mostró toast en el servicio
        } finally {
            if (seq === fetchSeq) {
                cardlessRegistryState.setLoading(false);
            }
        }
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
        isConfirmDeleteOpen = true;
    }

    function handleDeleteFromModal(registry: CardlessRegistry) {
        isModalOpen = false;
        requestDelete(registry);
    }

    async function handleDeleteConfirm() {
        if (!registryToDelete) return;

        const ok = await cardlessRegistryService.delete(registryToDelete.id);
        if (!ok) return;

        toast.success("Registro eliminado");

        const remaining = Math.max(0, totalCount - 1);
        const maxPage = Math.max(1, Math.ceil(remaining / pageSize) || 1);
        if (currentPage > maxPage) {
            cardlessRegistryState.setPage(maxPage);
        }
        registryToDelete = null;
        await refreshData();
    }

    async function handleExport() {
        showExportMenu = false;
        isExporting = true;
        try {
            const rows = await cardlessRegistryService.fetchAllMatching(
                cardlessRegistryState.currentFilters
            );
            if (rows.length === 0) {
                toast.error("No hay registros para exportar");
                return;
            }
            await cardlessRegistryService.exportToExcel(rows, {
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                reason: reasonFilter || undefined,
                dependency: dependencyFilter || undefined,
                search: searchFilter || undefined,
            });
            toast.success(`Reporte exportado (${rows.length} registros)`);
        } catch {
            toast.error("Error al exportar");
        } finally {
            isExporting = false;
        }
    }

    async function handleExportAllDepsZip() {
        showExportMenu = false;
        if (dependencies.length === 0) {
            toast.error("No hay dependencias registradas");
            return;
        }
        isZipExporting = true;
        const loadingToast = toast.loading("Preparando ZIP...");
        try {
            await exportCardlessRegistryAllDependenciesAsZip(
                dependencies,
                {
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                    reason: reasonFilter || undefined,
                    search: searchFilter || undefined,
                },
                (_current, _total, label) => {
                    toast.loading(`Procesando: ${label}`, { id: loadingToast });
                },
            );
            toast.success("ZIP descargado", { id: loadingToast });
        } catch (error) {
            toast.dismiss(loadingToast);
            handleError(error, "Exportar ZIP Sin Tarjeta");
        } finally {
            isZipExporting = false;
        }
    }

    function changePage(page: number) {
        if (page === currentPage) return;
        cardlessRegistryState.setPage(page);
        refreshData();
    }

    function getReasonVariant(reason: string) {
        if (
            reason.includes("Olvidada") ||
            reason === "No la porta" ||
            reason === "En resguardo de Enlace Administrativo"
        ) {
            return "amber";
        }
        if (reason === "Extraviada" || reason === "Robada") return "rose";
        if (
            reason === "Dañada" ||
            reason === "Desmagnetizada / No funciona" ||
            reason === "Bloqueada por Seguridad"
        ) {
            return "slate";
        }
        if (
            reason === "No se le ha entregado" ||
            reason.includes("proceso") ||
            reason.includes("ingreso") ||
            reason.includes("Reposición")
        ) {
            return "blue";
        }
        return "slate";
    }

</script>

{#snippet renderPersonName(row: CardlessRegistry)}
    <div class="flex flex-col gap-0.5">
        <span class="font-bold text-slate-900 truncate">
            {row.personName || [row.first_name, row.last_name].filter(Boolean).join(" ") || "Sin nombre"}
        </span>
        <span class="text-xs text-slate-500">{row.employee_no || "Sin # empleado"}</span>
        {#if row.person_id}
            <span class="inline-flex w-fit items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 leading-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Registrado
            </span>
        {:else}
            <span class="inline-flex w-fit items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 leading-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                No Registrado
            </span>
        {/if}
    </div>
{/snippet}

{#snippet renderDependency(row: CardlessRegistry)}
    <span class="text-sm text-slate-700">{row.dependencyName || "-"}</span>
{/snippet}

{#snippet renderLocation(row: CardlessRegistry)}
    <div class="flex flex-col">
        <span class="font-medium text-slate-900">{row.buildingName || "-"}</span>
        <span class="text-xs text-slate-500">{row.floor || "Sin piso"}</span>
    </div>
{/snippet}

{#snippet renderReason(row: CardlessRegistry)}
    <Badge variant={getReasonVariant(row.reason)}>
        {row.reason}
    </Badge>
{/snippet}

{#snippet renderDate(row: CardlessRegistry)}
    <div class="flex flex-col">
        <span class="text-sm text-slate-700">{new Date(row.recorded_at).toLocaleDateString("es-MX")}</span>
        <span class="text-xs text-slate-500">{new Date(row.recorded_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
    </div>
{/snippet}

{#snippet renderRecordedBy(row: CardlessRegistry)}
    <span class="text-sm text-slate-600">{row.recordedByName || "-"}</span>
{/snippet}

{#snippet renderKoneResponsiva(row: CardlessRegistry)}
    {#if !row.person_id}
        <span class="text-xs text-slate-400">—</span>
    {:else if row.kone_status_at_registration === null}
        <!-- Legacy record: no snapshot stored, showing live status as fallback -->
        {#if row.pendingKoneResponsiva}
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap" title="Estado actual (registro anterior al historial de snapshots)">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Pendiente
                <span class="text-rose-400 text-[9px]">~</span>
            </span>
        {:else}
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap" title="Estado actual (registro anterior al historial de snapshots)">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Entregada
                <span class="text-emerald-400 text-[9px]">~</span>
            </span>
        {/if}
    {:else if row.kone_status_at_registration}
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap" title="Estado al momento del registro">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Pendiente
        </span>
    {:else}
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap" title="Estado al momento del registro">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Entregada
        </span>
    {/if}
{/snippet}

{#snippet mobileCard(row: CardlessRegistry)}
    <article class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-4 space-y-3">
            <div class="flex justify-between items-start gap-2">
                {@render renderPersonName(row)}
                {@render renderReason(row)}
            </div>
            <div class="text-sm text-slate-500">
                <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Dependencia</div>
                {@render renderDependency(row)}
            </div>
            {@render renderLocation(row)}
            <div class="text-sm text-slate-500">
                <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha</div>
                {@render renderDate(row)}
            </div>
            <div class="text-sm text-slate-500">
                <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Registrado por</div>
                {@render renderRecordedBy(row)}
            </div>
        </div>
        <div class="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-2">
            <PermissionGuard allowedRoles={["admin", "operator"]}>
                <Button variant="soft-blue" size="sm" class="h-9 px-4 rounded-xl" onclick={() => openEditModal(row)}>
                    Editar
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    class="h-9 px-3 rounded-xl text-rose-600 hover:bg-rose-50"
                    onclick={() => requestDelete(row)}
                    disabled={!networkStore.isOnline}
                >
                    <Trash2 size={16} />
                </Button>
            </PermissionGuard>
        </div>
    </article>
{/snippet}

<div class="space-y-6">
    <SectionHeader title="Sin Tarjeta">
        {#snippet filters()}
            <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Fecha Inicio</span>
                <Input
                    type="date"
                    bind:value={startDate}
                    max={endDate || undefined}
                    onchange={applyFiltersAndRefresh}
                    class="h-9 text-xs font-bold {dateRangeError ? 'border-rose-400' : ''}"
                />
            </div>
            <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Fecha Fin</span>
                <Input
                    type="date"
                    bind:value={endDate}
                    min={startDate || undefined}
                    onchange={applyFiltersAndRefresh}
                    class="h-9 text-xs font-bold {dateRangeError ? 'border-rose-400' : ''}"
                />
            </div>
            <FilterSelect
                label="Dependencia"
                options={dependencyNames}
                placeholder="Todas"
                bind:value={dependencyFilter}
                onchange={applyFiltersAndRefresh}
            />
            <FilterSelect
                label="Motivo"
                options={reasons}
                placeholder="Todos"
                bind:value={reasonFilter}
                onchange={applyFiltersAndRefresh}
            />
            <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Búsqueda</span>
                <SearchInput
                    placeholder="Nombre o # empleado..."
                    bind:value={searchFilter}
                    oninput={handleSearchInput}
                    class="h-9 text-xs font-bold w-48"
                />
            </div>
        {/snippet}

        {#snippet actions()}
            <div class="relative">
                <Button
                    variant="soft-emerald"
                    onclick={() => (showExportMenu = !showExportMenu)}
                    class="flex items-center gap-2.5 h-10 px-5"
                    disabled={totalCount === 0 || !networkStore.isOnline || isExporting || isZipExporting}
                >
                    <FileSpreadsheet size={18} strokeWidth={2.5} class="text-emerald-600/80" />
                    Exportar Excel
                    <ChevronDown
                        size={14}
                        class="ml-1 opacity-50 transition-transform {showExportMenu ? 'rotate-180' : ''}"
                    />
                </Button>

                {#if showExportMenu}
                    <div
                        class="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 z-50 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
                    >
                        <button
                            class="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left disabled:opacity-50"
                            onclick={handleExport}
                            disabled={isExporting}
                        >
                            <span class="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <FileSpreadsheet size={16} />
                            </span>
                            {#if isExporting}
                                <span class="flex items-center gap-2"><Loader2 size={14} class="animate-spin" /> Exportando...</span>
                            {:else}
                                Exportar (Filtro actual)
                            {/if}
                        </button>
                        <div class="mx-3 my-1 border-t border-slate-100"></div>
                        <button
                            class="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left disabled:opacity-50"
                            onclick={handleExportAllDepsZip}
                            disabled={isZipExporting || dependencies.length === 0}
                        >
                            <span class="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600">
                                <FolderArchive size={16} />
                            </span>
                            {#if isZipExporting}
                                <span class="flex items-center gap-2"><Loader2 size={14} class="animate-spin" /> Generando ZIP...</span>
                            {:else}
                                Todas las Dependencias (ZIP)
                            {/if}
                        </button>
                    </div>
                {/if}
            </div>

            <PermissionGuard allowedRoles={["admin", "operator"]}>
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

    <Card class="overflow-hidden relative min-h-[200px]">
        <ContentView
            isLoading={isLoading}
            data={registries}
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
                    columns={[
                        {
                            key: "personName",
                            label: "Persona",
                            render: renderPersonName,
                            width: "200px",
                        },
                        {
                            key: "dependencyName",
                            label: "Dependencia",
                            render: renderDependency,
                            width: "180px",
                        },
                        {
                            key: "location",
                            label: "Ubicación",
                            render: renderLocation,
                            width: "160px",
                        },
                        {
                            key: "reason",
                            label: "Motivo",
                            render: renderReason,
                            width: "220px",
                        },
                        {
                            key: "recorded_at",
                            label: "Fecha",
                            render: renderDate,
                            width: "140px",
                        },
                        {
                            key: "recorded_by",
                            label: "Registrado por",
                            render: renderRecordedBy,
                            width: "140px",
                        },
                        {
                            key: "pendingKoneResponsiva",
                            label: "Tarjeta KONE",
                            render: renderKoneResponsiva,
                            width: "160px",
                        },
                    ]}
                    mobileCard={mobileCard}
                >
                    {#snippet actions(row: CardlessRegistry)}
                        <PermissionGuard allowedRoles={["admin", "operator"]}>
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

<PermissionGuard allowedRoles={["admin", "operator"]}>
    <FloatingActionButton onclick={openAddModal} label="Nuevo Registro" />
</PermissionGuard>

{#if isModalOpen}
    <CardlessRegistryModal
        bind:isOpen={isModalOpen}
        editingRegistry={editingRegistry}
        onSave={handleModalSave}
        onDelete={handleDeleteFromModal}
    />
{/if}

<ConfirmationModal
    bind:isOpen={isConfirmDeleteOpen}
    title="Eliminar registro"
    description={`¿Eliminar el registro de ${registryDisplayName(registryToDelete)}? Esta acción no se puede deshacer.`}
    confirmText="Eliminar"
    variant="danger"
    onConfirm={handleDeleteConfirm}
    onCancel={() => {
        registryToDelete = null;
    }}
/>
