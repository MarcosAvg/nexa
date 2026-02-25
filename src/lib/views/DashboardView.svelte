<script lang="ts">
    import { uiState, personnelState, ticketState, userState } from "../stores";
    import Card from "../components/Card.svelte";
    import Badge from "../components/Badge.svelte";
    import Button from "../components/Button.svelte";
    import {
        CreditCard,
        FileSignature,
        Users,
        FileText,
        Building2,
        Shield,
        AlertTriangle,
        BarChart3,
        TrendingUp,
    } from "lucide-svelte";
    import { onMount, onDestroy } from "svelte";
    import { appEvents, EVENTS } from "../utils/appEvents";

    let unsubs: (() => void)[] = [];

    onMount(() => {
        personnelState.refreshDashboardStats();
        personnelState.refreshDashboardMetrics();

        unsubs.push(
            appEvents.on(EVENTS.PERSONNEL_CHANGED, () => {
                personnelState.refreshDashboardStats();
                personnelState.refreshDashboardMetrics();
            }),
            appEvents.on(EVENTS.CARDS_CHANGED, () => {
                personnelState.refreshDashboardStats();
                personnelState.refreshDashboardMetrics();
            }),
        );
    });

    onDestroy(() => unsubs.forEach((fn) => fn()));

    let pendingItems = $derived(ticketState.pendingItems);

    let currentUser = $derived.by(() => {
        if (!userState.profile) return null;
        return {
            name: userState.profile.full_name || "Usuario",
            email: userState.profile.email,
            avatar: userState.profile.avatar_url,
            role: userState.profile.role,
        };
    });

    // KPI cards
    let activePersonnelCount = $derived(
        personnelState.dashboardStats.activePersonnel,
    );
    let koneStock = $derived(personnelState.dashboardStats.koneStock);
    let p2000Stock = $derived(personnelState.dashboardStats.p2000Stock);
    let pendingSignaturesCount = $derived(
        pendingItems.filter((t) => t.type === "Firma Responsiva").length,
    );

    // Metrics
    let metrics = $derived(personnelState.dashboardMetrics);
    let metricsLoading = $derived(personnelState.metricsLoading);

    // Helpers
    function pct(n: number, total: number) {
        return total > 0 ? Math.round((n / total) * 100) : 0;
    }

    const statusConfig = [
        {
            key: "activo" as const,
            label: "Activo/a",
            color: "bg-emerald-500",
            textColor: "text-emerald-700",
            bgLight: "bg-emerald-50",
        },
        {
            key: "parcial" as const,
            label: "Parcial",
            color: "bg-amber-500",
            textColor: "text-amber-700",
            bgLight: "bg-amber-50",
        },
        {
            key: "inactivo" as const,
            label: "Inactivo/a",
            color: "bg-slate-400",
            textColor: "text-slate-600",
            bgLight: "bg-slate-50",
        },
        {
            key: "bloqueado" as const,
            label: "Bloqueado/a",
            color: "bg-rose-500",
            textColor: "text-rose-700",
            bgLight: "bg-rose-50",
        },
        {
            key: "baja" as const,
            label: "Baja",
            color: "bg-slate-300",
            textColor: "text-slate-500",
            bgLight: "bg-slate-50/50",
        },
    ];

    let qualityItems = $derived([
        {
            label: "Correo Electrónico",
            missing: metrics.dataQuality.sinEmail,
            icon: "✉",
        },
        {
            label: "Días Laborales",
            missing: metrics.dataQuality.sinSchedule,
            icon: "🕐",
        },
        {
            label: "Puesto",
            missing: metrics.dataQuality.sinPosition,
            icon: "💼",
        },
        {
            label: "Área / Función",
            missing: metrics.dataQuality.sinArea,
            icon: "🏷",
        },
    ]);

    let totalFields = $derived(metrics.dataQuality.total * 4);
    let totalMissing = $derived(
        metrics.dataQuality.sinEmail +
            metrics.dataQuality.sinSchedule +
            metrics.dataQuality.sinPosition +
            metrics.dataQuality.sinArea,
    );
    let overallPct = $derived(pct(totalFields - totalMissing, totalFields));
</script>

<div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-1.5">
        <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">
            Panel de Control
        </h1>
        <p class="text-[15px] font-medium text-slate-500">
            Resumen operativo y métricas de personal.
        </p>
    </div>

    <!-- KPI Cards -->
    <div class="grid gap-5 grid-cols-2 lg:grid-cols-3">
        <Card
            class="p-6 relative overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 bg-white/50 backdrop-blur-md border border-slate-200/50 transition-all duration-300"
        >
            <div class="flex items-center gap-4">
                <div
                    class="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform duration-300"
                >
                    <Users size={24} strokeWidth={2} />
                </div>
                <div>
                    <div
                        class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-0.5"
                    >
                        Personal Activo
                    </div>
                    <div
                        class="text-2xl font-black text-slate-900 tabular-nums"
                    >
                        {activePersonnelCount}
                    </div>
                </div>
            </div>
            <div
                class="absolute -right-5 -bottom-5 text-emerald-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"
            >
                <Users size={100} />
            </div>
        </Card>

        <Card
            class="p-6 relative overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 bg-white/50 backdrop-blur-md border border-slate-200/50 transition-all duration-300"
        >
            <div class="flex items-center gap-4">
                <div
                    class="p-3.5 bg-violet-50 text-violet-600 rounded-2xl group-hover:scale-110 transition-transform duration-300"
                >
                    <FileSignature size={24} strokeWidth={2} />
                </div>
                <div>
                    <div
                        class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-0.5"
                    >
                        Firmas Pendientes
                    </div>
                    <div
                        class="text-2xl font-black text-slate-900 tabular-nums"
                    >
                        {pendingSignaturesCount}
                    </div>
                </div>
            </div>
            <div
                class="absolute -right-5 -bottom-5 text-violet-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"
            >
                <FileSignature size={100} />
            </div>
        </Card>

        <Card
            class="p-6 relative overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 bg-white/50 backdrop-blur-md border border-slate-200/50 transition-all duration-300"
        >
            <div class="flex items-center gap-4">
                <div
                    class="p-3.5 bg-amber-50 text-amber-600 rounded-2xl group-hover:scale-110 transition-transform duration-300"
                >
                    <FileText size={24} strokeWidth={2} />
                </div>
                <div>
                    <div
                        class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-0.5"
                    >
                        Total Tickets
                    </div>
                    <div
                        class="text-2xl font-black text-slate-900 tabular-nums"
                    >
                        {pendingItems.length}
                    </div>
                </div>
            </div>
            <div
                class="absolute -right-5 -bottom-5 text-amber-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"
            >
                <FileText size={100} />
            </div>
        </Card>
    </div>

    <!-- Metrics Panels -->
    {#if metricsLoading}
        <div class="grid lg:grid-cols-3 gap-6">
            {#each [1, 2, 3, 4, 5] as _}
                <Card
                    class="p-8 border border-slate-200/50 bg-white/50 backdrop-blur-md rounded-[22px]"
                >
                    <div class="animate-pulse space-y-4">
                        <div class="h-5 bg-slate-200 rounded w-1/3"></div>
                        <div class="h-4 bg-slate-100 rounded w-full"></div>
                        <div class="h-4 bg-slate-100 rounded w-3/4"></div>
                        <div class="h-4 bg-slate-100 rounded w-1/2"></div>
                    </div>
                </Card>
            {/each}
        </div>
    {:else if metrics.totalPersonnel > 0}
        <!-- Row 1: Status + Card Coverage + Data Quality -->
        <div class="grid lg:grid-cols-3 gap-6">
            <!-- Status Distribution -->
            <Card
                class="p-0 overflow-hidden border border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-md rounded-[22px]"
            >
                <div class="px-6 pt-5 pb-3 border-b border-slate-100/60">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-blue-50 text-blue-600 rounded-xl">
                            <BarChart3 size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2
                                class="text-[13px] font-extrabold text-slate-900 uppercase tracking-wider"
                            >
                                Por Estado
                            </h2>
                            <p class="text-[11px] text-slate-400 font-medium">
                                {metrics.totalPersonnel} registrados
                            </p>
                        </div>
                    </div>
                </div>
                <div class="p-6 space-y-3">
                    {#each statusConfig as item}
                        {@const count = metrics.statusCounts[item.key]}
                        {@const percentage = pct(count, metrics.totalPersonnel)}
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <div class="flex items-center gap-2">
                                    <div
                                        class="w-2.5 h-2.5 rounded-full {item.color}"
                                    ></div>
                                    <span
                                        class="text-[12px] font-bold text-slate-700"
                                        >{item.label}</span
                                    >
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <span
                                        class="text-[12px] font-black text-slate-900 tabular-nums"
                                        >{count}</span
                                    >
                                    <span
                                        class="text-[10px] font-bold {item.textColor} {item.bgLight} px-1.5 py-0.5 rounded"
                                        >{percentage}%</span
                                    >
                                </div>
                            </div>
                            <div
                                class="w-full h-2 bg-slate-100 rounded-full overflow-hidden"
                            >
                                <div
                                    class="{item.color} h-full rounded-full transition-all duration-700 ease-out"
                                    style="width: {percentage}%"
                                ></div>
                            </div>
                        </div>
                    {/each}
                </div>
            </Card>

            <!-- Card Coverage + Stock -->
            <Card
                class="p-0 overflow-hidden border border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-md rounded-[22px]"
            >
                <div class="px-6 pt-5 pb-3 border-b border-slate-100/60">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-amber-50 text-amber-600 rounded-xl">
                            <Shield size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2
                                class="text-[13px] font-extrabold text-slate-900 uppercase tracking-wider"
                            >
                                Cobertura Tarjetas
                            </h2>
                            <p class="text-[11px] text-slate-400 font-medium">
                                {metrics.cardCoverage.operativos} operativos
                            </p>
                        </div>
                    </div>
                </div>
                <div class="p-6 space-y-5">
                    <!-- P2000 -->
                    <div>
                        <div class="flex items-center justify-between mb-1.5">
                            <span
                                class="text-[12px] font-extrabold text-amber-700 flex items-center gap-1.5"
                                ><CreditCard size={14} /> P2000</span
                            >
                            <span
                                class="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg"
                                >{pct(
                                    metrics.cardCoverage.conP2000,
                                    metrics.cardCoverage.operativos,
                                )}%</span
                            >
                        </div>
                        <div
                            class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-1.5"
                        >
                            <div
                                class="bg-amber-500 h-full rounded-full transition-all duration-700"
                                style="width: {pct(
                                    metrics.cardCoverage.conP2000,
                                    metrics.cardCoverage.operativos,
                                )}%"
                            ></div>
                        </div>
                        <div class="flex justify-between text-[10px] font-bold">
                            <span class="text-emerald-600"
                                >✓ {metrics.cardCoverage.conP2000}</span
                            >
                            <span
                                class={metrics.cardCoverage.sinP2000 > 0
                                    ? "text-rose-500"
                                    : "text-emerald-600"}
                                >{metrics.cardCoverage.sinP2000 > 0 ? "✗" : "✓"}
                                {metrics.cardCoverage.sinP2000} sin tarjeta</span
                            >
                        </div>
                    </div>
                    <!-- KONE -->
                    <div>
                        <div class="flex items-center justify-between mb-1.5">
                            <span
                                class="text-[12px] font-extrabold text-blue-700 flex items-center gap-1.5"
                                ><CreditCard size={14} /> KONE</span
                            >
                            <span
                                class="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg"
                                >{pct(
                                    metrics.cardCoverage.conKone,
                                    metrics.cardCoverage.operativos,
                                )}%</span
                            >
                        </div>
                        <div
                            class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-1.5"
                        >
                            <div
                                class="bg-blue-500 h-full rounded-full transition-all duration-700"
                                style="width: {pct(
                                    metrics.cardCoverage.conKone,
                                    metrics.cardCoverage.operativos,
                                )}%"
                            ></div>
                        </div>
                        <div class="flex justify-between text-[10px] font-bold">
                            <span class="text-emerald-600"
                                >✓ {metrics.cardCoverage.conKone}</span
                            >
                            <span
                                class={metrics.cardCoverage.sinKone > 0
                                    ? "text-rose-500"
                                    : "text-emerald-600"}
                                >{metrics.cardCoverage.sinKone > 0 ? "✗" : "✓"}
                                {metrics.cardCoverage.sinKone} sin tarjeta</span
                            >
                        </div>
                    </div>
                    <!-- Stock inline -->
                    <div class="pt-4 border-t border-slate-100/60">
                        <div class="grid grid-cols-2 gap-3">
                            <div
                                class="bg-blue-50/60 rounded-xl p-3 text-center"
                            >
                                <div
                                    class="text-[10px] font-extrabold text-blue-400 uppercase tracking-wider mb-0.5"
                                >
                                    Stock KONE
                                </div>
                                <div
                                    class="text-xl font-black text-blue-700 tabular-nums"
                                >
                                    {koneStock}
                                </div>
                            </div>
                            <div
                                class="bg-amber-50/60 rounded-xl p-3 text-center"
                            >
                                <div
                                    class="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider mb-0.5"
                                >
                                    Stock P2000
                                </div>
                                <div
                                    class="text-xl font-black text-amber-700 tabular-nums"
                                >
                                    {p2000Stock}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <!-- Data Quality -->
            <Card
                class="p-0 overflow-hidden border border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-md rounded-[22px]"
            >
                <div class="px-6 pt-5 pb-3 border-b border-slate-100/60">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-rose-50 text-rose-600 rounded-xl">
                            <AlertTriangle size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2
                                class="text-[13px] font-extrabold text-slate-900 uppercase tracking-wider"
                            >
                                Calidad de Datos
                            </h2>
                            <p class="text-[11px] text-slate-400 font-medium">
                                Campos incompletos
                            </p>
                        </div>
                    </div>
                </div>
                <div class="p-6 space-y-3">
                    {#each qualityItems as item}
                        {@const completePct =
                            100 - pct(item.missing, metrics.dataQuality.total)}
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <span
                                    class="text-[12px] font-bold text-slate-700 flex items-center gap-1.5"
                                >
                                    <span class="text-sm">{item.icon}</span>
                                    {item.label}
                                </span>
                                {#if item.missing === 0}
                                    <Badge
                                        variant="emerald"
                                        class="text-[9px] font-extrabold px-1.5 py-0.5"
                                        >100%</Badge
                                    >
                                {:else}
                                    <span
                                        class="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded"
                                        >{item.missing} sin dato</span
                                    >
                                {/if}
                            </div>
                            <div
                                class="w-full h-2 bg-slate-100 rounded-full overflow-hidden"
                            >
                                <div
                                    class="{completePct >= 90
                                        ? 'bg-emerald-500'
                                        : completePct >= 70
                                          ? 'bg-amber-500'
                                          : 'bg-rose-500'} h-full rounded-full transition-all duration-700"
                                    style="width: {completePct}%"
                                ></div>
                            </div>
                        </div>
                    {/each}
                    <div
                        class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between"
                    >
                        <div class="flex items-center gap-2">
                            <TrendingUp size={14} class="text-slate-400" />
                            <span
                                class="text-[12px] font-extrabold text-slate-700"
                                >Completitud</span
                            >
                        </div>
                        <span
                            class="text-xl font-black tabular-nums {overallPct >=
                            90
                                ? 'text-emerald-600'
                                : overallPct >= 70
                                  ? 'text-amber-600'
                                  : 'text-rose-600'}">{overallPct}%</span
                        >
                    </div>
                </div>
            </Card>
        </div>

        <!-- Row 2: Dependencies (2/3) + Buildings (1/3) -->
        <div class="grid lg:grid-cols-3 gap-6">
            <!-- Dependencies -->
            <Card
                class="lg:col-span-2 p-0 overflow-hidden border border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-md rounded-[22px]"
            >
                <div class="px-6 pt-5 pb-3 border-b border-slate-100/60">
                    <div class="flex items-center gap-3">
                        <div
                            class="p-2 bg-violet-50 text-violet-600 rounded-xl"
                        >
                            <Building2 size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2
                                class="text-[13px] font-extrabold text-slate-900 uppercase tracking-wider"
                            >
                                Dependencias
                            </h2>
                            <p class="text-[11px] text-slate-400 font-medium">
                                {metrics.topDependencies.length} registradas
                            </p>
                        </div>
                    </div>
                </div>
                <div
                    class="divide-y divide-slate-100/60 max-h-[420px] overflow-y-auto"
                >
                    {#each metrics.topDependencies as dep, i}
                        {@const barWidth = pct(
                            dep.total,
                            metrics.totalPersonnel,
                        )}
                        {@const activePct = pct(dep.activos, dep.total)}
                        <div
                            class="px-6 py-3 hover:bg-blue-50/30 transition-all duration-200 relative"
                        >
                            <div
                                class="absolute inset-y-0 left-0 bg-violet-50/40 transition-all duration-700"
                                style="width: {barWidth}%"
                            ></div>
                            <div
                                class="relative flex items-center justify-between"
                            >
                                <div class="flex items-center gap-2.5 min-w-0">
                                    <span
                                        class="text-[10px] font-black text-violet-400 tabular-nums w-5"
                                        >#{i + 1}</span
                                    >
                                    <span
                                        class="text-[12px] font-bold text-slate-800 truncate"
                                        >{dep.name}</span
                                    >
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <Badge
                                        variant="slate"
                                        class="text-[9px] font-extrabold px-1.5 py-0.5"
                                        >{dep.total}</Badge
                                    >
                                    <Badge
                                        variant={activePct >= 80
                                            ? "emerald"
                                            : activePct >= 50
                                              ? "amber"
                                              : "rose"}
                                        class="text-[9px] font-extrabold px-1.5 py-0.5"
                                        >{activePct}% op.</Badge
                                    >
                                </div>
                            </div>
                        </div>
                    {:else}
                        <div
                            class="p-8 text-center text-slate-400 italic text-sm"
                        >
                            Sin datos.
                        </div>
                    {/each}
                </div>
            </Card>

            <!-- Buildings -->
            <Card
                class="p-0 overflow-hidden border border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-md rounded-[22px]"
            >
                <div class="px-6 pt-5 pb-3 border-b border-slate-100/60">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-cyan-50 text-cyan-600 rounded-xl">
                            <Building2 size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2
                                class="text-[13px] font-extrabold text-slate-900 uppercase tracking-wider"
                            >
                                Edificios
                            </h2>
                            <p class="text-[11px] text-slate-400 font-medium">
                                {metrics.topBuildings.length} registrados
                            </p>
                        </div>
                    </div>
                </div>
                <div
                    class="divide-y divide-slate-100/60 max-h-[420px] overflow-y-auto"
                >
                    {#each metrics.topBuildings as bldg, i}
                        {@const barWidth = pct(
                            bldg.total,
                            metrics.totalPersonnel,
                        )}
                        <div
                            class="px-6 py-3 hover:bg-cyan-50/30 transition-all duration-200 relative"
                        >
                            <div
                                class="absolute inset-y-0 left-0 bg-cyan-50/40 transition-all duration-700"
                                style="width: {barWidth}%"
                            ></div>
                            <div
                                class="relative flex items-center justify-between"
                            >
                                <div class="flex items-center gap-2.5 min-w-0">
                                    <span
                                        class="text-[10px] font-black text-cyan-400 tabular-nums w-5"
                                        >#{i + 1}</span
                                    >
                                    <span
                                        class="text-[12px] font-bold text-slate-800 truncate"
                                        >{bldg.name}</span
                                    >
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <Badge
                                        variant="slate"
                                        class="text-[9px] font-extrabold px-1.5 py-0.5"
                                        >{bldg.total}</Badge
                                    >
                                    <span
                                        class="text-[10px] font-bold text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded"
                                        >{barWidth}%</span
                                    >
                                </div>
                            </div>
                        </div>
                    {:else}
                        <div
                            class="p-8 text-center text-slate-400 italic text-sm"
                        >
                            Sin datos.
                        </div>
                    {/each}
                </div>
            </Card>
        </div>
    {:else}
        <Card
            class="p-12 text-center border border-slate-200/50 bg-white/50 backdrop-blur-md rounded-[22px]"
        >
            <div class="text-slate-400 italic">Cargando métricas...</div>
        </Card>
    {/if}
</div>
