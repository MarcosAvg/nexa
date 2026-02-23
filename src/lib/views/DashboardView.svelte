<script lang="ts">
    import {
        uiState,
        personnelState,
        ticketState,
        historyState,
        userState,
    } from "../stores";
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
        FileText,
    } from "lucide-svelte";

    // Re-derive from stores for reactivity
    let rawPendingItems = $derived(ticketState.pendingItems);
    let personnel = $derived(personnelState.personnel);
    let extraCards = $derived(personnelState.extraCards);
    let filteredHistoryLogs = $derived(historyState.historyLogs);

    let pendingItems = $derived(
        rawPendingItems.map((t) => {
            const person = personnel.find((p) => p.id == t.person_id);
            return {
                ...t,
                personName: person?.name || "Desconocido",
            };
        }),
    );

    // Props
    // Props - Removed most props as we use stores

    let currentUser = $derived.by(() => {
        if (!userState.profile) return null;
        return {
            name: userState.profile.full_name || "Usuario",
            email: userState.profile.email,
            avatar: userState.profile.avatar_url,
            role: userState.profile.role,
        };
    });

    // Mock functions for now or use a store if we had one for modals.
    // Since we are in Phase 2, and Modals are in Phase 4, we have a bridge problem.
    // I will use custom events or temporary state to make it compile,
    // but ideally we need the Modals available.
    // Let's assume for this step we emit events or log.
    // BETTER: I will move the relevant Modals to MainLayoutWrapper and expose a store/context to open them.
    // Or simpler: I will simply not error out, but actions won't work until I move modals.
    // To make it fully functional, I'll define local handlers that log "Not implemented yet - Waiting for Phase 4".

    // Metrics
    let activePersonnelCount = $derived(
        personnel.filter(
            (p) =>
                p.status === "active" ||
                p.status === "Activo/a" ||
                p.status === "Parcial",
        ).length,
    );

    let koneStock = $derived(
        extraCards.filter((c) => c.status === "available" && c.type === "KONE")
            .length,
    );

    let p2000Stock = $derived(
        extraCards.filter((c) => c.status === "available" && c.type === "P2000")
            .length,
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
        (filteredHistoryLogs || []).slice(0, 5).map((log: any) => {
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
        <div class="flex flex-col gap-1.5">
            <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">
                Panel de Control
            </h1>
            <p class="text-[15px] font-medium text-slate-500">
                Resumen operativo y accesos rápidos.
            </p>
        </div>
    </div>

    <!-- Metrics Grid -->
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card
            class="p-7 relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 bg-white/50 backdrop-blur-md border border-slate-200/50"
        >
            <div class="flex items-center gap-5">
                <div
                    class="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 group-hover:bg-emerald-100 transition-all duration-300"
                >
                    <Users size={28} strokeWidth={2} />
                </div>
                <div>
                    <div
                        class="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-1"
                    >
                        Personal Activo
                    </div>
                    <div
                        class="text-3xl font-black text-slate-900 tabular-nums"
                    >
                        {activePersonnelCount}
                    </div>
                </div>
            </div>
            <div
                class="absolute -right-6 -bottom-6 text-emerald-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"
            >
                <Users size={120} />
            </div>
        </Card>

        <Card
            class="p-7 relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 bg-white/50 backdrop-blur-md border border-slate-200/50"
        >
            <div class="flex items-center gap-5">
                <div
                    class="p-4 bg-violet-50 text-violet-600 rounded-2xl group-hover:scale-110 group-hover:bg-violet-100 transition-all duration-300"
                >
                    <FileSignature size={28} strokeWidth={2} />
                </div>
                <div>
                    <div
                        class="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-1"
                    >
                        Firmas Pendientes
                    </div>
                    <div
                        class="text-3xl font-black text-slate-900 tabular-nums"
                    >
                        {pendingSignaturesCount}
                    </div>
                </div>
            </div>
            <div
                class="absolute -right-6 -bottom-6 text-violet-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"
            >
                <FileSignature size={120} />
            </div>
        </Card>

        <Card
            class="p-7 relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 bg-white/50 backdrop-blur-md border border-slate-200/50"
        >
            <div class="flex items-center gap-5">
                <div
                    class="p-4 bg-amber-50 text-amber-600 rounded-2xl group-hover:scale-110 group-hover:bg-amber-100 transition-all duration-300"
                >
                    <FileText size={28} strokeWidth={2} />
                </div>
                <div>
                    <div
                        class="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-1"
                    >
                        Total Tickets
                    </div>
                    <div
                        class="text-3xl font-black text-slate-900 tabular-nums"
                    >
                        {pendingItems.length}
                    </div>
                </div>
            </div>
            <div
                class="absolute -right-6 -bottom-6 text-amber-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"
            >
                <FileText size={120} />
            </div>
        </Card>

        <Card
            class="p-7 relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 bg-white/50 backdrop-blur-md border border-slate-200/50"
        >
            <div class="flex items-center gap-5">
                <div
                    class="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 group-hover:bg-blue-100 transition-all duration-300"
                >
                    <CreditCard size={28} strokeWidth={2} />
                </div>
                <div>
                    <div
                        class="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-1"
                    >
                        Stock KONE
                    </div>
                    <div
                        class="text-3xl font-black text-slate-900 tabular-nums"
                    >
                        {koneStock}
                    </div>
                </div>
            </div>
            <div
                class="absolute -right-6 -bottom-6 text-blue-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"
            >
                <CreditCard size={120} />
            </div>
        </Card>

        <Card
            class="p-7 relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 bg-white/50 backdrop-blur-md border border-slate-200/50"
        >
            <div class="flex items-center gap-5">
                <div
                    class="p-4 bg-amber-50 text-amber-600 rounded-2xl group-hover:scale-110 group-hover:bg-amber-100 transition-all duration-300"
                >
                    <CreditCard size={28} strokeWidth={2} />
                </div>
                <div>
                    <div
                        class="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-1"
                    >
                        Stock P2000
                    </div>
                    <div
                        class="text-3xl font-black text-slate-900 tabular-nums"
                    >
                        {p2000Stock}
                    </div>
                </div>
            </div>
            <div
                class="absolute -right-6 -bottom-6 text-amber-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"
            >
                <CreditCard size={120} />
            </div>
        </Card>
    </div>

    <!-- Main Content Grid -->
    <div class="grid lg:grid-cols-3 gap-8">
        <!-- Recent Tickets (2/3 width) -->
        <div class="lg:col-span-2 space-y-5">
            <div class="flex items-center justify-between px-1">
                <h2
                    class="text-[15px] font-extrabold text-slate-900 flex items-center gap-2.5 uppercase tracking-wider"
                >
                    <FileText
                        size={18}
                        strokeWidth={2.5}
                        class="text-blue-500"
                    />
                    Tickets Recientes
                </h2>
                <Button
                    variant="ghost"
                    size="sm"
                    class="text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 rounded-xl px-4"
                    onclick={() => uiState.setActivePage("Pendientes")}
                >
                    Ver todos
                </Button>
            </div>
            <Card
                class="overflow-hidden border border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-md rounded-[22px]"
            >
                <DataTable
                    data={pendingItems.slice(0, 5)}
                    columns={[
                        { key: "personName", label: "Persona", width: "40%" },
                        { key: "type", label: "Tipo", width: "20%" },
                        { key: "priority", label: "Prioridad", width: "20%" },
                        {
                            key: "status",
                            label: "Estado",
                            render: renderStatus,
                            width: "20%",
                        },
                    ]}
                />
            </Card>
        </div>

        <!-- Recent Activity Feed (1/3 width) -->
        <div class="space-y-5">
            <div class="flex items-center justify-between px-1">
                <h2
                    class="text-[15px] font-extrabold text-slate-900 flex items-center gap-2.5 uppercase tracking-wider"
                >
                    <Activity
                        size={18}
                        strokeWidth={2.5}
                        class="text-blue-500"
                    />
                    Actividad
                </h2>
                <Button
                    variant="ghost"
                    size="sm"
                    class="text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100/50 rounded-xl px-4"
                    onclick={() => uiState.setActivePage("Historial")}
                >
                    Historial
                </Button>
            </div>
            <Card
                class="p-0 overflow-hidden border border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-md rounded-[22px]"
            >
                <div class="divide-y divide-slate-100/60 font-medium">
                    {#each recentActivity as log}
                        <div
                            class="p-5 hover:bg-blue-50/30 transition-all duration-300 group"
                        >
                            <div class="flex items-start justify-between mb-2">
                                <Badge
                                    variant={log.actionColor}
                                    class="text-[10px] font-extrabold px-2 py-0.5 tracking-wider uppercase opacity-80 group-hover:opacity-100"
                                >
                                    {log.actionLabel}
                                </Badge>
                                <span
                                    class="text-[10px] text-slate-400 font-bold whitespace-nowrap bg-slate-100/50 px-2 py-0.5 rounded-md"
                                >
                                    {new Date(log.timestamp).toLocaleTimeString(
                                        [],
                                        { hour: "2-digit", minute: "2-digit" },
                                    )}
                                </span>
                            </div>
                            <p
                                class="text-[13px] text-slate-700 leading-relaxed line-clamp-2 mb-2 group-hover:text-slate-900 transition-colors"
                            >
                                {log.formattedDetails}
                            </p>
                            <div
                                class="flex items-center justify-between border-t border-slate-100/40 pt-2"
                            >
                                <span
                                    class="text-[11px] text-slate-400 flex items-center gap-1.5"
                                >
                                    Por <span
                                        class="font-extrabold text-slate-600 group-hover:text-blue-600"
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
