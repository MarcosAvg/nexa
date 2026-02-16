<script lang="ts">
    import { historyState, personnelState, ticketState } from "../stores";
    import SectionHeader from "../components/SectionHeader.svelte";
    import Card from "../components/Card.svelte";
    import DataTable from "../components/DataTable.svelte";
    import Badge from "../components/Badge.svelte";
    import Button from "../components/Button.svelte";
    import HistoryFilters from "../components/HistoryFilters.svelte";
    import { ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-svelte";

    const PAGE_SIZE = 50;

    // State
    let historyFilterPerson = $state("");
    let historyFilterCardType = $state("Todos");
    let historyFilterFolio = $state("");
    let historyFilterAction = $state("Todas");
    let currentPage = $state(1);

    // Reset page when filters change
    $effect(() => {
        historyFilterPerson;
        historyFilterCardType;
        historyFilterFolio;
        historyFilterAction;
        currentPage = 1;
    });

    // Get data from Stores
    let filteredHistoryLogs = $derived(historyState.filteredHistoryLogs);
    let personnel = $derived(personnelState.personnel);
    let extraCards = $derived(personnelState.extraCards);
    let pendingItems = $derived(ticketState.pendingItems);

    // Helper to resolve entity name based on type and ID
    function resolveEntity(type: string, id: string) {
        if (!type || !id) return "-";
        type = type.toUpperCase();

        if (type === "SISTEMA" || type === "SYSTEM") return "Sistema";

        if (type === "PERSONNEL" || type === "PERSON") {
            const p = (personnel || []).find((p: any) => p.id == id);
            return p
                ? `${p.first_name} ${p.last_name} (${p.dependency})`
                : `Personal (${id})`;
        }

        if (type === "CARD") {
            // Check extra cards first
            let c = (extraCards || []).find((c: any) => c.id == id);
            if (c) return `Tarjeta: ${c.folio} (${c.type})`;

            // Check assigned cards
            for (const p of personnel || []) {
                if (p.cards) {
                    c = p.cards.find((card: any) => card.id == id);
                    if (c) return `Tarjeta: ${c.folio} (${c.type})`;
                }
            }
            return `Tarjeta (${id})`;
        }

        if (type === "TICKET") {
            const t = (pendingItems || []).find((item: any) => item.id == id);
            return t ? `Ticket #${id}: ${t.title}` : `Ticket #${id}`;
        }

        return `${type} (${id})`;
    }

    let derivedHistoryLogs = $derived.by(() => {
        if (!filteredHistoryLogs) return [];
        return filteredHistoryLogs
            .map((log: any) => {
                let details = "";
                if (typeof log.details === "string") {
                    details = log.details;
                } else if (log.details?.message) {
                    details = log.details.message;
                } else if (log.details && typeof log.details === "object") {
                    // Extract meaningful text from object values instead of JSON
                    const vals = Object.entries(log.details)
                        .filter(
                            ([k, v]) =>
                                v !== null && v !== undefined && k !== "id",
                        )
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ");
                    details = vals || "—";
                } else {
                    details = "—";
                }
                const entityType = log.entity_type || "SISTEMA";
                const action = log.action || "Desconocida";
                const entityId = log.entity_id || "";

                const resolvedName = resolveEntity(entityType, entityId);

                const searchStr = (
                    details +
                    " " +
                    entityType +
                    " " +
                    action +
                    " " +
                    resolvedName
                ).toLowerCase();

                const actionLabel = actionNames[action] || action;

                const matchPerson =
                    historyFilterPerson === "" ||
                    searchStr.includes(historyFilterPerson.toLowerCase());

                const matchType =
                    historyFilterCardType === "Todos" ||
                    (historyFilterCardType === "Sistema" &&
                        (entityType === "SYSTEM" ||
                            entityType === "SISTEMA")) ||
                    (historyFilterCardType === "Tarjeta" &&
                        entityType === "CARD") ||
                    (historyFilterCardType === "Personal" &&
                        (entityType === "PERSONNEL" ||
                            entityType === "PERSON")) ||
                    // Specific card type search in the resolved name
                    (entityType === "CARD" &&
                        resolvedName
                            .toLowerCase()
                            .includes(historyFilterCardType.toLowerCase()));

                const matchFolio =
                    historyFilterFolio === "" ||
                    searchStr.includes(historyFilterFolio.toLowerCase());

                const matchAction =
                    historyFilterAction === "Todas" ||
                    actionLabel
                        .toLowerCase()
                        .includes(historyFilterAction.toLowerCase());

                if (matchPerson && matchType && matchFolio && matchAction) {
                    return { ...log, resolvedName };
                }
                return null;
            })
            .filter(Boolean);
    });

    let totalPages = $derived(
        Math.max(1, Math.ceil(derivedHistoryLogs.length / PAGE_SIZE)),
    );

    let paginatedLogs = $derived.by(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return derivedHistoryLogs.slice(start, start + PAGE_SIZE);
    });

    function goToPage(page: number) {
        currentPage = Math.max(1, Math.min(page, totalPages));
    }

    import {
        ACTION_NAMES as actionNames,
        ACTION_COLORS as actionColors,
        translateDetails,
    } from "../constants/history";
</script>

{#snippet renderEntity(row: any)}
    <div class="flex flex-col">
        <span class="font-medium text-slate-900 text-[10px] uppercase"
            >{row.entity_type === "PERSONNEL" || row.entity_type === "PERSON"
                ? "PERSONAL"
                : row.entity_type === "CARD"
                  ? "TARJETA"
                  : row.entity_type}</span
        >
        <span class="text-xs text-slate-600 font-bold leading-tight mt-0.5">
            {row.resolvedName || resolveEntity(row.entity_type, row.entity_id)}
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
                bind:personName={historyFilterPerson}
                bind:cardType={historyFilterCardType}
                bind:cardFolio={historyFilterFolio}
                bind:action={historyFilterAction}
            />
        {/snippet}

        {#snippet actions()}
            <Button
                variant="soft-emerald"
                class="flex items-center gap-2.5 h-10 px-6"
                onclick={() => {
                    import("../utils/xlsxExport").then((m) => {
                        m.exportHistoryToExcel(derivedHistoryLogs);
                    });
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

    <Card class="overflow-hidden">
        <DataTable
            data={paginatedLogs}
            columns={[
                { key: "timestamp", label: "Fecha / Hora", render: renderDate },
                {
                    key: "entity",
                    label: "Entidad Afectada",
                    render: renderEntity,
                },
                { key: "action", label: "Acción", render: renderHistoryAction },
                { key: "details", label: "Descripción", render: renderDetails },
            ]}
        />
    </Card>

    <!-- Pagination Controls -->
    {#if totalPages > 1}
        <div class="flex items-center justify-between px-2">
            <p class="text-xs text-slate-500">
                Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(
                    currentPage * PAGE_SIZE,
                    derivedHistoryLogs.length,
                )} de {derivedHistoryLogs.length} registros
            </p>
            <div class="flex items-center gap-2">
                <Button
                    variant="outline"
                    onclick={() => goToPage(currentPage - 1)}
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
                    onclick={() => goToPage(currentPage + 1)}
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
