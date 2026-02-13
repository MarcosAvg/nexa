<script lang="ts">
    import { appState } from "../state.svelte";
    import Card from "../components/Card.svelte";
    import Badge from "../components/Badge.svelte";
    import DataTable from "../components/DataTable.svelte";
    import Button from "../components/Button.svelte";
    import {
        CreditCard,
        FileSignature,
        Lock,
        Users,
        Activity,
        Plus,
        FileText,
    } from "lucide-svelte";

    let { pendingItems, personnel, extraCards, filteredHistoryLogs } =
        $derived(appState);

    // Props
    let { onOpenAddPerson, onOpenAddTicket, onOpenAddCard, currentUser } =
        $props<{
            onOpenAddPerson: () => void;
            onOpenAddTicket: () => void;
            onOpenAddCard: () => void;
            currentUser?: any;
        }>();

    // Metrics
    let activePersonnelCount = $derived(
        personnel.filter(
            (p) => p.status === "active" || p.status === "Activo/a",
        ).length,
    );

    let availableCardsCount = $derived(
        extraCards.filter((c) => c.status === "available").length,
    );

    let pendingSignaturesCount = $derived(
        pendingItems.filter((t) => t.type === "Firma Responsiva").length,
    );

    import {
        ACTION_NAMES as actionNames,
        ACTION_COLORS as actionColors,
        translateDetails,
    } from "../constants/history";

    let recentActivity = $derived(
        (filteredHistoryLogs || []).slice(0, 5).map((log) => {
            const message =
                log.details?.message ||
                (typeof log.details === "string"
                    ? log.details
                    : JSON.stringify(log.details));

            const formattedDetails = translateDetails(
                message
                    .replace(/\sID:?\s?[a-f0-9-]{8,}/gi, "")
                    .replace(/\s(de|ID)\s?[a-f0-9-]{8,}/gi, ""),
            );

            return {
                ...log,
                actionLabel: actionNames[log.action] || log.action,
                actionColor: actionColors[log.action] || "slate",
                formattedDetails,
            };
        }),
    );

    function translateStatus(status: string) {
        if (!status) return "-";
        const s = status.toLowerCase();
        if (s === "pending" || s === "pendiente") return "Pendiente";
        if (s === "completed" || s === "completado" || s === "done")
            return "Completado";
        if (s === "in_progress" || s === "en proceso") return "En Proceso";
        return status;
    }

    function getStatusVariant(status: string) {
        if (!status) return "slate";
        const s = status.toLowerCase();
        if (
            ["active", "completado", "activo/a", "done", "completed"].includes(
                s,
            )
        )
            return "emerald";
        if (["urgente", "bloqueado/a", "blocked", "high"].includes(s))
            return "rose";
        if (s === "en proceso" || s === "in_progress") return "blue";
        if (["pendiente", "pending"].includes(s)) return "amber";
        return "slate";
    }
</script>

{#snippet renderCard(row: any)}
    <div class="flex items-center gap-2">
        <Badge variant={row.cardType === "KONE" ? "blue" : "amber"}>
            {row.cardType}
        </Badge>
        <span class="text-sm text-slate-600">{row.cardFolio}</span>
    </div>
{/snippet}

{#snippet renderStatus(row: any)}
    <Badge variant={getStatusVariant(row.status)}>
        {translateStatus(row.status)}
    </Badge>
{/snippet}

<div class="space-y-8">
    <!-- Header & Quick Actions -->
    <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
        <div>
            <h1 class="text-2xl font-bold text-slate-900 tracking-tight">
                Panel de Control
            </h1>
            <p class="text-slate-500">Resumen operativo y accesos rápidos.</p>
        </div>
        <div class="flex gap-3">
            {#if currentUser?.role !== "viewer"}
                <Button
                    variant="outline"
                    class="gap-2 bg-white"
                    onclick={onOpenAddPerson}
                >
                    <Users size={16} />
                    <span class="hidden lg:inline">Registrar</span> Personal
                </Button>
                <Button
                    variant="outline"
                    class="gap-2 bg-white"
                    onclick={onOpenAddCard}
                >
                    <CreditCard size={16} />
                    <span class="hidden lg:inline">Nueva</span> Tarjeta
                </Button>
            {/if}
            <Button
                variant="primary"
                class="gap-2 shadow-lg shadow-emerald-200"
                onclick={onOpenAddTicket}
            >
                <Plus size={16} />
                Crear Ticket
            </Button>
        </div>
    </div>

    <!-- Metrics Grid -->
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card
            class="p-6 relative overflow-hidden group hover:shadow-md transition-all"
        >
            <div class="flex items-center gap-4">
                <div
                    class="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform"
                >
                    <Users size={24} />
                </div>
                <div>
                    <div
                        class="text-sm font-bold text-slate-500 uppercase tracking-wide"
                    >
                        Personal Activo
                    </div>
                    <div class="text-3xl font-bold text-slate-900 mt-1">
                        {activePersonnelCount}
                    </div>
                </div>
            </div>
        </Card>

        <Card
            class="p-6 relative overflow-hidden group hover:shadow-md transition-all"
        >
            <div class="flex items-center gap-4">
                <div
                    class="p-3 bg-violet-50 text-violet-600 rounded-xl group-hover:scale-110 transition-transform"
                >
                    <FileSignature size={24} />
                </div>
                <div>
                    <div
                        class="text-sm font-bold text-slate-500 uppercase tracking-wide"
                    >
                        Firmas Pendientes
                    </div>
                    <div class="text-3xl font-bold text-slate-900 mt-1">
                        {pendingSignaturesCount}
                    </div>
                </div>
            </div>
        </Card>

        <Card
            class="p-6 relative overflow-hidden group hover:shadow-md transition-all"
        >
            <div class="flex items-center gap-4">
                <div
                    class="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform"
                >
                    <FileText size={24} />
                </div>
                <div>
                    <div
                        class="text-sm font-bold text-slate-500 uppercase tracking-wide"
                    >
                        Total Tickets
                    </div>
                    <div class="text-3xl font-bold text-slate-900 mt-1">
                        {pendingItems.length}
                    </div>
                </div>
            </div>
        </Card>

        <Card
            class="p-6 relative overflow-hidden group hover:shadow-md transition-all"
        >
            <div class="flex items-center gap-4">
                <div
                    class="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform"
                >
                    <CreditCard size={24} />
                </div>
                <div>
                    <div
                        class="text-sm font-bold text-slate-500 uppercase tracking-wide"
                    >
                        Stock Tarjetas
                    </div>
                    <div class="text-3xl font-bold text-slate-900 mt-1">
                        {availableCardsCount}
                    </div>
                </div>
            </div>
            <div
                class="mt-4 flex items-center gap-2 text-xs font-medium text-slate-400"
            >
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span> Dispositivos
                disponibles
            </div>
        </Card>
    </div>

    <!-- Main Content Grid -->
    <div class="grid lg:grid-cols-3 gap-8">
        <!-- Recent Tickets (2/3 width) -->
        <div class="lg:col-span-2 space-y-4">
            <div class="flex items-center justify-between">
                <h2
                    class="text-lg font-bold text-slate-900 flex items-center gap-2"
                >
                    <FileText size={20} class="text-slate-400" />
                    Tickets Recientes
                </h2>
            </div>
            <Card class="overflow-hidden border border-slate-200 shadow-sm">
                <DataTable
                    data={pendingItems.slice(0, 5)}
                    columns={[
                        { key: "personName", label: "Persona" },
                        { key: "type", label: "Tipo" },
                        { key: "priority", label: "Prioridad" },
                        {
                            key: "status",
                            label: "Estado",
                            render: renderStatus,
                        },
                    ]}
                />
            </Card>
        </div>

        <!-- Recent Activity Feed (1/3 width) -->
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2
                    class="text-lg font-bold text-slate-900 flex items-center gap-2"
                >
                    <Activity size={20} class="text-slate-400" />
                    Actividad Reciente
                </h2>
            </div>
            <Card class="p-0 overflow-hidden border border-slate-200 shadow-sm">
                <div class="divide-y divide-slate-100">
                    {#each recentActivity as log}
                        <div class="p-4 hover:bg-slate-50 transition-colors">
                            <div class="flex items-start justify-between mb-1">
                                <Badge
                                    variant={log.actionColor}
                                    class="text-[10px] px-1.5 py-0.5"
                                >
                                    {log.actionLabel}
                                </Badge>
                                <span
                                    class="text-[10px] text-slate-400 font-medium whitespace-nowrap"
                                >
                                    {new Date(log.timestamp).toLocaleTimeString(
                                        [],
                                        { hour: "2-digit", minute: "2-digit" },
                                    )}
                                </span>
                            </div>
                            <p
                                class="text-sm text-slate-700 font-medium line-clamp-2 mb-1"
                            >
                                {log.formattedDetails}
                            </p>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-slate-500">
                                    Por: <span
                                        class="font-medium text-slate-700"
                                        >{log.user || "Sistema"}</span
                                    >
                                </span>
                            </div>
                        </div>
                    {:else}
                        <div
                            class="p-8 text-center text-slate-400 italic text-sm"
                        >
                            No hay actividad reciente.
                        </div>
                    {/each}
                </div>
            </Card>
        </div>
    </div>
</div>
