<script lang="ts">
    import { historyState } from "../stores";
    import type { HistoryLog } from "../types";
    import {
        SectionHeader, DataTable, Badge, Button, HistoryFilters,
        Pagination, ContentView,
    } from "../components";
    import {
        FileSpreadsheet,
        RotateCw,
        History,
    } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import { handleError } from "../utils";
    import { HistoryService } from "../services/history";
    import { networkStore } from "../stores/network.svelte";
    import {
        ACTION_NAMES as actionNames,
        ACTION_COLORS as actionColors,
        entityTypeLabel,
        displayEntityName,
        cleanMessage,
    } from "../utils/historyFormat";

    // ── Debounce para filtros con tecleo ──
    let filterDebounce: ReturnType<typeof setTimeout>;

    $effect(() => {
        // Rastrear dependencias reactivas para que el effect se dispare
        // cuando cambie cualquier filtro (incluyendo date range).
        const f = historyState.filters;
        f.person;
        f.cardType;
        f.folio;
        f.action;
        f.startDate;
        f.endDate;

        clearTimeout(filterDebounce);
        filterDebounce = setTimeout(() => {
            historyState.refresh(1);
        }, 400);

        // Cleanup: si el componente se desmonta mientras hay un timeout pendiente,
        // evitamos refrescar datos en un componente destruido.
        return () => {
            clearTimeout(filterDebounce);
        };
    });

    // ── Datos derivados del store ──
    let historyLogs = $derived(historyState.pagination.items);
    let totalRecords = $derived(historyState.pagination.totalRecords);
    let currentPage = $derived(historyState.pagination.currentPage);
    let pageSize = $derived(historyState.pagination.pageSize);
</script>

{#snippet renderEntity(row: HistoryLog)}
    {@const label = entityTypeLabel(row.entity_type)}
    {@const name = displayEntityName(row)}

    <div class="flex flex-col">
        <span class="font-medium text-slate-500 text-[10px] tracking-wider uppercase">
            {label}
        </span>
        <span class="text-xs text-slate-900 font-bold leading-tight mt-0.5 break-words max-w-[220px]">
            {name}
        </span>
    </div>
{/snippet}

{#snippet renderDetails(row: HistoryLog)}
    <span class="text-slate-600 text-sm">
        {cleanMessage(row)}
    </span>
{/snippet}

{#snippet renderDate(row: HistoryLog)}
    <span class="text-slate-500 text-xs whitespace-nowrap">
        {new Date(row.timestamp).toLocaleString("es-MX", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })}
    </span>
{/snippet}

{#snippet renderHistoryAction(row: HistoryLog)}
    <Badge variant={(actionColors[row.action] as any) || "slate"}>
        {actionNames[row.action] || row.action}
    </Badge>
{/snippet}

<div class="space-y-6">
    <SectionHeader title="Historial de acciones">
        {#snippet filters()}
            <HistoryFilters
                bind:personName={historyState.filters.person}
                bind:cardType={historyState.filters.cardType}
                bind:cardFolio={historyState.filters.folio}
                bind:action={historyState.filters.action}
                bind:startDate={historyState.filters.startDate}
                bind:endDate={historyState.filters.endDate}
            />
        {/snippet}

        {#snippet actions()}
            <Button
                variant="outline"
                class="flex items-center gap-2.5 h-10 px-4 group"
                disabled={historyState.pagination.isLoading}
                onclick={() => historyState.refresh(1)}
            >
                <RotateCw
                    size={16}
                    class="text-slate-500 transition-transform duration-700 {historyState.pagination.isLoading
                        ? 'animate-spin'
                        : 'group-hover:rotate-180'}"
                />
                <span class="text-slate-600">Actualizar</span>
            </Button>

            <Button
                variant="soft-emerald"
                class="flex items-center gap-2.5 h-10 px-6"
                disabled={!networkStore.isOnline}
                onclick={async () => {
                    const loadingToast = toast.loading(
                        "Preparando exportación...",
                    );
                    try {
                        const data = await HistoryService.fetchForExport(
                            historyState.filters,
                        );
                        const m = await import("../utils/xlsxExport");
                        m.exportHistoryToExcel(data);
                        toast.success("Exportación completada", {
                            id: loadingToast,
                        });
                    } catch (e) {
                        toast.dismiss(loadingToast);
                        handleError(e, "Exportar Historial");
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
        {/snippet}
    </SectionHeader>

    <ContentView
        isLoading={historyState.pagination.isLoading}
        data={historyLogs}
        emptyTitle="No hay registros de historial"
        emptyDescription="Los cambios realizados en el personal, tarjetas y tickets aparecerán aquí."
        emptyIcon={History}
        emptyIconBgClass="from-slate-100 to-slate-200 text-slate-400"
        skeletonColumns={4}
        skeletonRows={5}
        cardClass="overflow-hidden"
    >
        {#snippet children()}
            <DataTable
                data={historyLogs}
                columns={[
                    {
                        key: "timestamp",
                        label: "Fecha / Hora",
                        render: renderDate,
                        width: "160px",
                    },
                    {
                        key: "entity",
                        label: "Entidad Afectada",
                        render: renderEntity,
                        width: "250px",
                    },
                    {
                        key: "action",
                        label: "Acción",
                        render: renderHistoryAction,
                        width: "140px",
                    },
                    {
                        key: "details",
                        label: "Descripción",
                        render: renderDetails,
                        width: "350px",
                    },
                ]}
            />
        {/snippet}
    </ContentView>

    <Pagination
        {currentPage}
        {pageSize}
        {totalRecords}
        onPrevPage={() => historyState.prevPage()}
        onNextPage={() => historyState.nextPage()}
        onGoToPage={(page) => historyState.goToPage(page)}
        isLoading={historyState.pagination.isLoading}
    />
</div>
