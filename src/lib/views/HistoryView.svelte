<script lang="ts">
    import { historyState } from "../stores";
    import type { HistoryLog } from "../types";
    import type { HistoryStory } from "../stores/history.svelte";
    import {
        SectionHeader, DataTable, Badge, Button, HistoryFilters,
        Pagination, ContentView,
    } from "../components";
    import {
        FileSpreadsheet,
        RotateCw,
        History,
        Layers,
        List,
        ChevronDown,
        ChevronUp,
        User,
    } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import { handleError, formatDateTime } from "../utils";
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
            if (viewMode === "flow") historyState.refreshFlows(1);
            else historyState.refresh(1);
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

    let stories = $derived(historyState.storiesPagination.items);
    let totalStories = $derived(historyState.storiesPagination.totalRecords);
    let storiesPage = $derived(historyState.storiesPagination.currentPage);
    let storiesPageSize = $derived(historyState.storiesPagination.pageSize);
    let storiesLoading = $derived(historyState.storiesPagination.isLoading);

    // Vista: individual (por fila) o por flujo (historias).
    let viewMode = $state<"individual" | "flow">("flow");
    let expandedStory = $state<string | null>(null);

    // Color de punto por acción (Tailwind literales).
    const DOT_CLASS_BY_COLOR: Record<string, string> = {
        rose: "bg-rose-400",
        emerald: "bg-emerald-400",
        violet: "bg-violet-400",
        amber: "bg-amber-400",
        blue: "bg-sky-400",
        slate: "bg-slate-400",
        orange: "bg-orange-400",
        red: "bg-red-400",
    };
    function actionDot(action: string): string {
        return DOT_CLASS_BY_COLOR[(actionColors as any)[action]] || "bg-slate-400";
    }
    function actionIconBg(action: string): string {
        const c = (actionColors as any)[action];
        return c === "rose" ? "bg-rose-50 text-rose-600"
            : c === "emerald" ? "bg-emerald-50 text-emerald-600"
            : c === "violet" ? "bg-violet-50 text-violet-600"
            : c === "amber" ? "bg-amber-50 text-amber-600"
            : c === "orange" ? "bg-orange-50 text-orange-600"
            : c === "blue" ? "bg-sky-50 text-sky-600"
            : "bg-slate-100 text-slate-600";
    }
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

{#snippet renderUser(row: HistoryLog)}
    <span class="text-slate-700 text-sm whitespace-nowrap">
        {row.performed_by_name || "—"}
    </span>
{/snippet}

{#snippet renderDate(row: HistoryLog)}
    <span class="text-slate-500 text-xs whitespace-nowrap">
        {formatDateTime(row.timestamp)}
    </span>
{/snippet}

{#snippet renderHistoryAction(row: HistoryLog)}
    <Badge variant={(actionColors[row.action] as any) || "slate"}>
        {actionNames[row.action] || row.action}
    </Badge>
{/snippet}

{#snippet renderStoryStep(step: HistoryLog, isLast: boolean)}
    <div class="relative flex gap-3 pl-10 pr-5 py-3">
        <!-- Punto de la línea de tiempo (alineado con la línea continua) -->
        <span class="absolute left-4 top-1.5 -translate-x-1/2 z-10 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm {actionDot(step.action)}"></span>
        <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge variant={(actionColors[step.action] as any) || "slate"} class="text-[9px] px-1.5 py-0.5">
                    {actionNames[step.action] || step.action}
                </Badge>
                <span class="text-[10px] tracking-wider uppercase text-slate-400 font-bold">
                    {entityTypeLabel(step.entity_type)}
                </span>
                <span class="text-xs text-slate-900 font-bold leading-tight break-words">
                    {displayEntityName(step)}
                </span>
            </div>
            <div class="text-xs text-slate-600 mt-0.5">
                {cleanMessage(step)}
            </div>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                <span class="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
                    <User size={10} class="text-slate-400" /> {step.performed_by_name || "—"}
                </span>
                <span class="text-[10px] text-slate-400 whitespace-nowrap">
                    {formatDateTime(step.timestamp)}
                </span>
            </div>
        </div>
    </div>
{/snippet}

{#snippet renderStory(story: HistoryStory)}
    {@const isExpanded = expandedStory === story.flowId}
    {@const firstTs = story.steps[0]?.timestamp}
    {@const lastTs = story.steps[story.steps.length - 1]?.timestamp}
    <div>
        <button
            type="button"
            class="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition-colors text-left"
            onclick={() => (expandedStory = isExpanded ? null : story.flowId)}
        >
            <span class="w-9 h-9 rounded-xl {actionIconBg(story.latest.action)} flex items-center justify-center shrink-0">
                <Layers size={16} strokeWidth={2.5} />
            </span>
            <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Badge variant={(actionColors[story.latest.action] as any) || "slate"} class="text-[9px] px-1.5 py-0.5">
                        {actionNames[story.latest.action] || story.latest.action}
                    </Badge>
                    <span class="text-[10px] tracking-wider uppercase text-slate-400 font-bold">
                        {entityTypeLabel(story.latest.entity_type)}
                    </span>
                    <span class="text-sm text-slate-900 font-bold leading-tight break-words">
                        {displayEntityName(story.latest)}
                    </span>
                </div>
                <div class="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span class="inline-flex items-center gap-1 font-medium">
                        <User size={10} class="text-slate-400" /> {story.latest.performed_by_name || "—"}
                    </span>
                    <span>{story.steps.length} paso{story.steps.length !== 1 ? "s" : ""}</span>
                    <span class="text-[10px] text-slate-400">
                        {firstTs && lastTs ? `${formatDateTime(firstTs)} → ${formatDateTime(lastTs)}` : ""}
                    </span>
                </div>
            </div>
            <div class="shrink-0">
                {#if isExpanded}
                    <ChevronUp size={16} class="text-slate-400" />
                {:else}
                    <ChevronDown size={16} class="text-slate-400" />
                {/if}
            </div>
        </button>
        {#if isExpanded}
            <div class="relative ml-6 mt-1 border-t border-slate-100/60 bg-slate-50/60">
                <!-- Línea vertical continua detrás de los puntos -->
                <span class="absolute left-4 top-2 bottom-4 -translate-x-1/2 w-px bg-slate-300"></span>
                {#each story.steps as step, i}
                    {@render renderStoryStep(step, i === story.steps.length - 1)}
                {/each}
            </div>
        {/if}
    </div>
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
            <div class="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80">
                <button
                    type="button"
                    class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold uppercase tracking-wider transition-colors {viewMode === 'flow' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}"
                    onclick={() => (viewMode = "flow")}
                >
                    <Layers size={13} /> Por flujo
                </button>
                <button
                    type="button"
                    class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold uppercase tracking-wider transition-colors {viewMode === 'individual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}"
                    onclick={() => (viewMode = "individual")}
                >
                    <List size={13} /> Individual
                </button>
            </div>

            <Button
                variant="outline"
                class="flex items-center gap-2.5 h-10 px-4 group"
                disabled={viewMode === "flow" ? storiesLoading : historyState.pagination.isLoading}
                onclick={() => (viewMode === "flow" ? historyState.refreshFlows(1) : historyState.refresh(1))}
            >
                <RotateCw
                    size={16}
                    class="text-slate-500 transition-transform duration-700 {viewMode === 'flow'
                        ? storiesLoading
                        : historyState.pagination.isLoading
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
        isLoading={viewMode === "flow" ? storiesLoading : historyState.pagination.isLoading}
        data={viewMode === "flow" ? stories : historyLogs}
        emptyTitle="No hay registros de historial"
        emptyDescription="Los cambios realizados en el personal, tarjetas y tickets aparecerán aquí."
        emptyIcon={History}
        emptyIconBgClass="from-slate-100 to-slate-200 text-slate-400"
        skeletonColumns={4}
        skeletonRows={5}
        cardClass="overflow-hidden"
    >
        {#snippet children()}
            {#if viewMode === "flow"}
                <div class="divide-y divide-slate-100/60">
                    {#each stories as story}
                        {@render renderStory(story)}
                    {/each}
                </div>
            {:else}
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
                            key: "user",
                            label: "Usuario",
                            render: renderUser,
                            width: "150px",
                        },
                        {
                            key: "details",
                            label: "Descripción",
                            render: renderDetails,
                            width: "350px",
                        },
                    ]}
                />
            {/if}
        {/snippet}
    </ContentView>

    {#if viewMode === "flow"}
        <Pagination
            currentPage={storiesPage}
            pageSize={storiesPageSize}
            totalRecords={totalStories}
            onPrevPage={() => historyState.prevFlowPage()}
            onNextPage={() => historyState.nextFlowPage()}
            onGoToPage={(page) => historyState.goToFlowPage(page)}
            isLoading={storiesLoading}
        />
    {:else}
        <Pagination
            {currentPage}
            {pageSize}
            {totalRecords}
            onPrevPage={() => historyState.prevPage()}
            onNextPage={() => historyState.nextPage()}
            onGoToPage={(page) => historyState.goToPage(page)}
            isLoading={historyState.pagination.isLoading}
        />
    {/if}
</div>
