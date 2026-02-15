<script lang="ts">
    import { historyState, personnelState, ticketState } from "../stores";
    import SectionHeader from "../components/SectionHeader.svelte";
    import Card from "../components/Card.svelte";
    import DataTable from "../components/DataTable.svelte";
    import Badge from "../components/Badge.svelte";
    import Button from "../components/Button.svelte";
    import HistoryFilters from "../components/HistoryFilters.svelte";

    // State
    let historyFilterPerson = $state("");
    let historyFilterCardType = $state("Todos");
    let historyFilterFolio = $state("");
    let historyFilterAction = $state("Todas");

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
                const details =
                    typeof log.details === "string"
                        ? log.details
                        : log.details?.message ||
                          JSON.stringify(log.details) ||
                          "";
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
                variant="outline"
                onclick={() => {
                    import("../utils/xlsxExport").then((m) => {
                        m.exportHistoryToExcel(derivedHistoryLogs);
                    });
                }}
            >
                Exportar Excel
            </Button>
        {/snippet}
    </SectionHeader>

    <Card class="overflow-hidden">
        <DataTable
            data={derivedHistoryLogs}
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
</div>
