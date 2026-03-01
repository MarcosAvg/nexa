<script lang="ts">
    import { historyState, personnelState, ticketState } from "../stores";
    import SectionHeader from "../components/SectionHeader.svelte";
    import Card from "../components/Card.svelte";
    import DataTable from "../components/DataTable.svelte";
    import Badge from "../components/Badge.svelte";
    import Button from "../components/Button.svelte";
    import HistoryFilters from "../components/HistoryFilters.svelte";
    import {
        ChevronLeft,
        ChevronRight,
        FileSpreadsheet,
        RotateCw,
    } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import { HistoryService } from "../services/history";
    import { networkStore } from "../stores/network.svelte";

    const PAGE_SIZE = 50;

    // Debounce refresh so typing in filter inputs doesn't fire on every keystroke
    let filterDebounce: ReturnType<typeof setTimeout>;
    $effect(() => {
        // Track dependencies
        historyState.filters.person;
        historyState.filters.cardType;
        historyState.filters.folio;
        historyState.filters.action;

        clearTimeout(filterDebounce);
        filterDebounce = setTimeout(() => {
            historyState.refresh(1);
        }, 400);
    });

    // Get data directly from Store (already paginated by server)
    let historyLogs = $derived(historyState.historyLogs);
    let totalRecords = $derived(historyState.totalRecords);
    let currentPage = $derived(historyState.currentPage);
    let pageSize = $derived(historyState.pageSize);

    let totalPages = $derived(Math.max(1, Math.ceil(totalRecords / pageSize)));

    function goToPage(page: number) {
        historyState.goToPage(page);
    }

    import {
        ACTION_NAMES as actionNames,
        ACTION_COLORS as actionColors,
        translateDetails,
    } from "../constants/history";
</script>

{#snippet renderEntity(row: any)}
    {@const entityLabel =
        row.entity_type === "PERSONNEL" || row.entity_type === "PERSON"
            ? "PERSONAL"
            : row.entity_type === "CARD"
              ? "TARJETA"
              : row.entity_type}

    <!-- Heuristic for old logs or missing names -->
    {@const fallbackName = (row.details?.message || "")
        .match(
            /(?:Actualización de|Registro de|para tarjeta \w+ folio|con folio)\s+([^,.(]+)/i,
        )?.[1]
        ?.trim()}

    {@const displayName =
        row.entity_name ||
        row.resolvedName ||
        fallbackName ||
        (row.entity_id?.length > 15
            ? `${row.entity_type} (${row.entity_id.slice(0, 8)}...)`
            : `${row.entity_type} (${row.entity_id})`)}

    <div class="flex flex-col">
        <span
            class="font-medium text-slate-500 text-[10px] tracking-wider uppercase"
            >{entityLabel}</span
        >
        <span
            class="text-xs text-slate-900 font-bold leading-tight mt-0.5 break-words max-w-[220px]"
        >
            {displayName}
        </span>
    </div>
{/snippet}

{#snippet renderDetails(row: any)}
    {@const message =
        row.details?.message ||
        (typeof row.details === "string"
            ? row.details
            : JSON.stringify(row.details))}
    <span class="text-slate-600 text-sm">
        {translateDetails(
            row.entity_type === "TICKET"
                ? message
                : message
                      .replace(/\sID:?\s?[a-f0-9-]{8,}/gi, "")
                      .replace(/\s(de|ID)\s?[a-f0-9-]{8,}/gi, ""),
        )}
    </span>
{/snippet}

{#snippet renderDate(row: any)}
    <span class="text-slate-500 text-xs">
        {new Date(row.timestamp).toLocaleString("es-MX", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })}
    </span>
{/snippet}

{#snippet renderHistoryAction(row: any)}
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
            />
        {/snippet}

        {#snippet actions()}
            <Button
                variant="outline"
                class="flex items-center gap-2.5 h-10 px-4 group"
                disabled={historyState.isLoading}
                onclick={() => historyState.refresh(1)}
            >
                <RotateCw
                    size={16}
                    class="text-slate-500 transition-transform duration-700 {historyState.isLoading
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
                        console.error(e);
                        toast.error("Error al exportar", { id: loadingToast });
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

    <!-- Top Pagination (hidden on mobile) -->
    {#if totalRecords > 0}
        <div class="hidden sm:flex items-center justify-between px-2">
            <p class="text-xs text-slate-500">
                Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(
                    currentPage * pageSize,
                    totalRecords,
                )} de {totalRecords} registros
            </p>
            <div class="flex items-center gap-2">
                <Button
                    variant="outline"
                    onclick={() => historyState.prevPage()}
                    disabled={currentPage <= 1}
                    class="flex items-center gap-1 text-xs px-3 py-1.5"
                >
                    <ChevronLeft size={14} />
                    Anterior
                </Button>
                <span class="text-xs text-slate-500 font-bold">
                    {currentPage} / {totalPages}
                </span>
                <Button
                    variant="outline"
                    onclick={() => historyState.nextPage()}
                    disabled={currentPage >= totalPages}
                    class="flex items-center gap-1 text-xs px-3 py-1.5"
                >
                    Siguiente
                    <ChevronRight size={14} />
                </Button>
            </div>
        </div>
    {/if}

    <Card class="overflow-hidden">
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
    </Card>

    <!-- Pagination Controls -->
    {#if totalRecords > 0}
        <div class="flex items-center justify-between px-2">
            <p class="text-xs text-slate-500">
                Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(
                    currentPage * pageSize,
                    totalRecords,
                )} de {totalRecords} registros
            </p>
            <div class="flex items-center gap-2">
                <Button
                    variant="outline"
                    onclick={() => historyState.prevPage()}
                    disabled={currentPage <= 1}
                    class="flex items-center gap-1 text-xs px-3 py-1.5"
                >
                    <ChevronLeft size={14} />
                    Anterior
                </Button>
                <div class="flex items-center gap-1">
                    {#each Array.from({ length: totalPages }, (_, i) => i + 1) as page}
                        {#if page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
                            <button
                                type="button"
                                class="w-8 h-8 rounded-lg text-xs font-bold transition-colors {page ===
                                currentPage
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-600 hover:bg-slate-100'}"
                                onclick={() => goToPage(page)}
                            >
                                {page}
                            </button>
                        {:else if page === currentPage - 2 || page === currentPage + 2}
                            <span class="text-slate-400 text-xs px-1">…</span>
                        {/if}
                    {/each}
                </div>
                <Button
                    variant="outline"
                    onclick={() => historyState.nextPage()}
                    disabled={currentPage >= totalPages}
                    class="flex items-center gap-1 text-xs px-3 py-1.5"
                >
                    Siguiente
                    <ChevronRight size={14} />
                </Button>
            </div>
        </div>
    {/if}
</div>
