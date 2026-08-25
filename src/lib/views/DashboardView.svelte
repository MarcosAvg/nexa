<script lang="ts">
    import {
        personnelState,
        ticketState,
        userState,
        historyState,
    } from "../stores";
    import { Card, Badge, Button } from "../components";
    import {
        CreditCard,
        FileSignature,
        Users,
        FileText,
        Building2,
        Shield,
        AlertTriangle,
        Activity,
        Zap,
        ChevronRight,
        Cpu,
        BarChart3,
    } from "lucide-svelte";
    import { onMount } from "svelte";
    import {
        mediaTypeVariant,
        mediaTypeBarClasses,
        mediaTypeStockClasses,
    } from "../utils/mediaTypeAppearance";
    import { timeAgo, fullName } from "../utils/format";

    onMount(() => {
        personnelState.refreshDashboardStats();
        personnelState.refreshDashboardMetrics();
    });
    // Las métricas se actualizan automáticamente vía Realtime:
    // PersonnelState.initRealtime() refresca dashboardStats y dashboardMetrics
    // en cada cambio detectado en la tabla personnel.

    let pendingItems = $derived(ticketState.pendingItems);
    let currentUser = $derived(userState.currentUser);

    // Tarjetas KPI
    let activePersonnelCount = $derived(personnelState.dashboardStats.activePersonnel);
    let mediaStock = $derived(personnelState.dashboardStats.stock);
    let pendingSignaturesCount = $derived(
        pendingItems.filter((t) => t.type === "Firma Responsiva").length,
    );
    let pendingProgrammingCount = $derived(
        pendingItems.filter((t) => t.type === "Programación").length,
    );

    // Métricas
    let metrics = $derived(personnelState.dashboardMetrics);
    let metricsLoading = $derived(personnelState.metricsLoading);

    // Tickets: desglose por prioridad + urgentes
    let ticketsByPriority = $derived.by(() => {
        const map = { Alta: 0, Media: 0, Baja: 0 };
        for (const t of pendingItems) {
            const p = String(t.priority || "").toLowerCase();
            if (p === "alta") map.Alta++;
            else if (p === "media") map.Media++;
            else if (p === "baja") map.Baja++;
        }
        return map;
    });
    let ticketPriorityList = $derived([
        { label: "Alta", count: ticketsByPriority.Alta },
        { label: "Media", count: ticketsByPriority.Media },
        { label: "Baja", count: ticketsByPriority.Baja },
    ]);
    let urgentTickets = $derived(
        pendingItems
            .filter((t) => String(t.priority || "").toLowerCase() === "alta")
            .slice(0, 6),
    );

    // Actividad reciente (feed precargado en el boot)
    let activityFeed = $derived((historyState.pagination.items || []).slice(0, 8));

    // Saludo según hora del día
    function greeting(): string {
        const h = new Date().getHours();
        if (h < 12) return "Buenos días";
        if (h < 19) return "Buenas tardes";
        return "Buenas noches";
    }

    // Utilidades
    function pct(n: number, total: number) {
        return total > 0 ? Math.round((n / total) * 100) : 0;
    }

    const statusConfig = [
        { key: "activo", label: "Activo/a", color: "bg-emerald-500", hex: "#10b981", textColor: "text-emerald-700", bgLight: "bg-emerald-50" },
        { key: "parcial", label: "Parcial", color: "bg-amber-500", hex: "#f59e0b", textColor: "text-amber-700", bgLight: "bg-amber-50" },
        { key: "inactivo", label: "Sin Acceso", color: "bg-slate-400", hex: "#94a3b8", textColor: "text-slate-600", bgLight: "bg-slate-50" },
        { key: "bloqueado", label: "Bloqueado/a", color: "bg-rose-500", hex: "#f43f5e", textColor: "text-rose-700", bgLight: "bg-rose-50" },
        { key: "baja", label: "Baja", color: "bg-slate-300", hex: "#cbd5e1", textColor: "text-slate-500", bgLight: "bg-slate-50/50" },
    ];

    function actionMeta(action: string, entity: string) {
        const a = (action || "").toLowerCase();
        if (a.includes("create") || a.includes("alta")) return { color: "text-emerald-600", bg: "bg-emerald-50", icon: "plus" };
        if (a.includes("delete") || a.includes("baja")) return { color: "text-rose-600", bg: "bg-rose-50", icon: "minus" };
        if (a.includes("assign") || a.includes("replac") || a.includes("reposic")) return { color: "text-violet-600", bg: "bg-violet-50", icon: "swap" };
        if (a.includes("sign")) return { color: "text-sky-600", bg: "bg-sky-50", icon: "pen" };
        return { color: "text-slate-600", bg: "bg-slate-50", icon: "dot" };
    }

    let qualityItems = $derived([
        { label: "Correo Electrónico", missing: metrics.dataQuality.sinEmail, icon: "✉" },
        { label: "Días Laborales", missing: metrics.dataQuality.sinSchedule, icon: "🕐" },
        { label: "Puesto", missing: metrics.dataQuality.sinPosition, icon: "💼" },
        { label: "Área / Función", missing: metrics.dataQuality.sinArea, icon: "🏷" },
    ]);

    let totalFields = $derived(metrics.dataQuality.total * 4);
    let totalMissing = $derived(
        metrics.dataQuality.sinEmail +
            metrics.dataQuality.sinSchedule +
            metrics.dataQuality.sinPosition +
            metrics.dataQuality.sinArea,
    );
    let overallPct = $derived(pct(totalFields - totalMissing, totalFields));

    // ── Chart.js (instancias) ──
    let stateCanvas = $state<HTMLCanvasElement | null>(null);
    let qualityCanvas = $state<HTMLCanvasElement | null>(null);
    let chartState: any = null;
    let chartQuality: any = null;

    $effect(() => {
        if (!metricsLoading && stateCanvas && metrics.totalPersonnel > 0) {
            renderStateDonut();
            renderQualityRing();
        }
    });

    async function importChart() {
        const { default: Chart } = await import("chart.js/auto");
        return Chart;
    }

    async function renderStateDonut() {
        if (!stateCanvas) return;
        if (chartState) { chartState.destroy(); chartState = null; }
        const data = statusConfig
            .map((s) => ({ label: s.label, value: metrics.statusCounts[s.key as keyof typeof metrics.statusCounts] ?? 0, hex: s.hex }))
            .filter((d) => d.value > 0);
        if (data.length === 0) return;
        const Chart = await importChart();
        chartState = new Chart(stateCanvas, {
            type: "doughnut",
            data: {
                labels: data.map((d) => d.label),
                datasets: [{
                    data: data.map((d) => d.value),
                    backgroundColor: data.map((d) => d.hex),
                    borderColor: "#fff",
                    borderWidth: 2,
                    hoverOffset: 6,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "70%",
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: { label: (ctx: any) => ` ${ctx.label}: ${ctx.parsed} (${pct(ctx.parsed, metrics.totalPersonnel)}%)` },
                    },
                },
            },
        });
    }

    async function renderQualityRing() {
        if (!qualityCanvas) return;
        if (chartQuality) { chartQuality.destroy(); chartQuality = null; }
        if (!qualityCanvas) return;
        const Chart = await importChart();
        chartQuality = new Chart(qualityCanvas, {
            type: "doughnut",
            data: {
                labels: ["Completo", "Incompleto"],
                datasets: [{
                    data: [Math.max(0, totalFields - totalMissing), totalMissing],
                    backgroundColor: [overallPct >= 90 ? "#10b981" : overallPct >= 70 ? "#f59e0b" : "#f43f5e", "#e2e8f0"],
                    borderWidth: 0,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "78%",
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: true },
                },
            },
        });
    }
</script>

<div class="space-y-8">
    <!-- ── HERO ── -->
    <section class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
            <div class="flex items-center gap-2.5">
                <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">
                    {greeting()}!
                </h1>
                {#if currentUser?.name}
                    <span class="text-3xl font-extrabold text-sky-600 tracking-tight">
                        {currentUser.name.split(" ")[0]}
                    </span>
                {/if}
            </div>
            <p class="text-[15px] font-medium text-slate-500 mt-1">
                {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" } )} · Resumen operativo de personal y accesos.
            </p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
            {#if userState.isAdmin}
                <Badge variant="violet" class="text-[10px] font-extrabold px-2.5 py-1 uppercase tracking-wider">Administrador</Badge>
            {:else if userState.isOperator}
                <Badge variant="blue" class="text-[10px] font-extrabold px-2.5 py-1 uppercase tracking-wider">Operador</Badge>
            {:else}
                <Badge variant="slate" class="text-[10px] font-extrabold px-2.5 py-1 uppercase tracking-wider">Consulta</Badge>
            {/if}
            <Badge variant={pendingItems.length > 0 ? "amber" : "emerald"} class="text-[10px] font-extrabold px-2.5 py-1 uppercase tracking-wider">
                {pendingItems.length} pendientes
            </Badge>
        </div>
    </section>

    <!-- ── KPIs ── -->
    <section class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card class="p-5 relative overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 bg-white/50 backdrop-blur-md border border-slate-200/50 transition-all duration-300">
            <div class="flex items-center gap-3.5">
                <div class="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <Users size={22} strokeWidth={2} />
                </div>
                <div>
                    <div class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.14em] mb-0.5">Personal Activo</div>
                    <div class="text-2xl font-black text-slate-900 tabular-nums">{activePersonnelCount}</div>
                </div>
            </div>
            <div class="absolute -right-4 -bottom-4 text-emerald-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"><Users size={96} /></div>
        </Card>

        <Card class="p-5 relative overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 bg-white/50 backdrop-blur-md border border-slate-200/50 transition-all duration-300">
            <div class="flex items-center gap-3.5">
                <div class="p-3 bg-sky-50 text-sky-600 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <Shield size={22} strokeWidth={2} />
                </div>
                <div>
                    <div class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.14em] mb-0.5">Operativos</div>
                    <div class="text-2xl font-black text-slate-900 tabular-nums">{metrics.operativos}</div>
                </div>
            </div>
            <div class="absolute -right-4 -bottom-4 text-sky-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"><Shield size={96} /></div>
        </Card>

        <Card class="p-5 relative overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 bg-white/50 backdrop-blur-md border border-slate-200/50 transition-all duration-300">
            <div class="flex items-center gap-3.5">
                <div class="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <FileText size={22} strokeWidth={2} />
                </div>
                <div>
                    <div class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.14em] mb-0.5">Tickets Pendientes</div>
                    <div class="text-2xl font-black text-slate-900 tabular-nums">{pendingItems.length}</div>
                </div>
            </div>
            <div class="mt-2 flex items-center gap-1.5">
                {#each ticketPriorityList as item}
                    <Badge variant={item.label === "Alta" ? "rose" : item.label === "Media" ? "amber" : "slate"} class="text-[9px] font-extrabold px-1.5 py-0.5 hidden sm:inline-flex">{item.label} {item.count}</Badge>
                {/each}
            </div>
            <div class="absolute -right-4 -bottom-4 text-amber-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"><FileText size={96} /></div>
        </Card>

        <Card class="p-5 relative overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 bg-white/50 backdrop-blur-md border border-slate-200/50 transition-all duration-300">
            <div class="flex items-center gap-3.5">
                <div class="p-3 bg-violet-50 text-violet-600 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <FileSignature size={22} strokeWidth={2} />
                </div>
                <div>
                    <div class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.14em] mb-0.5">Firmas Pendientes</div>
                    <div class="text-2xl font-black text-slate-900 tabular-nums">{pendingSignaturesCount}</div>
                </div>
            </div>
            <div class="absolute -right-4 -bottom-4 text-violet-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"><FileSignature size={96} /></div>
        </Card>

        <Card class="p-5 relative overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 bg-white/50 backdrop-blur-md border border-slate-200/50 transition-all duration-300">
            <div class="flex items-center gap-3.5">
                <div class="p-3 bg-cyan-50 text-cyan-600 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <Cpu size={22} strokeWidth={2} />
                </div>
                <div>
                    <div class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.14em] mb-0.5">Programación</div>
                    <div class="text-2xl font-black text-slate-900 tabular-nums">{pendingProgrammingCount}</div>
                </div>
            </div>
            <div class="absolute -right-4 -bottom-4 text-cyan-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"><Cpu size={96} /></div>
        </Card>
    </section>

    {#if metricsLoading}
        <section class="grid lg:grid-cols-3 gap-6">
            {#each [1, 2, 3] as _}
                <Card class="p-8 border border-slate-200/50 bg-white/50 backdrop-blur-md rounded-2xl">
                    <div class="animate-pulse space-y-4">
                        <div class="h-5 bg-slate-200 rounded w-1/3"></div>
                        <div class="h-4 bg-slate-100 rounded w-full"></div>
                        <div class="h-4 bg-slate-100 rounded w-3/4"></div>
                        <div class="h-4 bg-slate-100 rounded w-1/2"></div>
                    </div>
                </Card>
            {/each}
        </section>
    {:else if metrics.totalPersonnel > 0}
        <!-- ── FILA A: Estados + Cobertura + Calidad ── -->
        <section class="grid lg:grid-cols-3 gap-6">
            <!-- Donut de estados -->
            <Card class="p-0 overflow-hidden border border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-md rounded-2xl">
                <div class="px-6 pt-5 pb-3 border-b border-slate-100/60">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-blue-50 text-blue-600 rounded-xl"><BarChart3 size={18} strokeWidth={2.5} /></div>
                        <div>
                            <h2 class="text-[13px] font-extrabold text-slate-900 uppercase tracking-wider">Por Estado</h2>
                            <p class="text-[11px] text-slate-400 font-medium">{metrics.totalPersonnel} registrados</p>
                        </div>
                    </div>
                </div>
                <div class="p-6">
                <div class="relative h-44 w-44 mx-auto">
                    <canvas bind:this={stateCanvas}></canvas>
                </div>
                    <div class="mt-5 grid grid-cols-2 gap-2">
                        {#each statusConfig as item}
                            {@const count = metrics.statusCounts[item.key as keyof typeof metrics.statusCounts]}
                            {@const percentage = pct(count, metrics.totalPersonnel)}
                            {#if count > 0}
                                <div class="flex items-center justify-between gap-2">
                                    <div class="flex items-center gap-1.5 min-w-0">
                                        <div class="w-2.5 h-2.5 rounded-full {item.color} shrink-0"></div>
                                        <span class="text-[11px] font-bold text-slate-600 truncate">{item.label}</span>
                                    </div>
                                    <span class="text-[11px] font-black text-slate-800 tabular-nums shrink-0">{count} ({percentage}%)</span>
                                </div>
                            {/if}
                        {/each}
                    </div>
                </div>
            </Card>

            <!-- Cobertura tarjetas + stock -->
            <Card class="p-0 overflow-hidden border border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-md rounded-2xl">
                <div class="px-6 pt-5 pb-3 border-b border-slate-100/60">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-amber-50 text-amber-600 rounded-xl"><Shield size={18} strokeWidth={2.5} /></div>
                        <div>
                            <h2 class="text-[13px] font-extrabold text-slate-900 uppercase tracking-wider">Cobertura Tarjetas</h2>
                            <p class="text-[11px] text-slate-400 font-medium">{metrics.operativos} operativos</p>
                        </div>
                    </div>
                </div>
                <div class="p-6 space-y-5">
                    {#each metrics.cardCoverage as cov}
                        {@const cls = mediaTypeBarClasses(cov.name)}
                        <div>
                            <div class="flex items-center justify-between mb-1.5">
                                <span class="text-[12px] font-extrabold {cls.text} flex items-center gap-1.5"><CreditCard size={14} /> {cov.name}</span>
                                <span class="text-[10px] font-bold {cls.badge} px-2 py-0.5 rounded-lg">{pct(cov.con, metrics.operativos)}%</span>
                            </div>
                            <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                                <div class="{cls.bar} h-full rounded-full transition-all duration-700" style="width: {pct(cov.con, metrics.operativos)}%"></div>
                            </div>
                            <div class="flex justify-between text-[10px] font-bold">
                                <span class="text-emerald-600">✓ {cov.con}</span>
                                <span class={cov.sin > 0 ? "text-rose-500" : "text-emerald-600"}>{cov.sin > 0 ? "✗" : "✓"} {cov.sin} sin tarjeta</span>
                            </div>
                        </div>
                    {/each}
                    <div class="pt-4 border-t border-slate-100/60">
                        <div class="grid gap-3 {mediaStock.length === 3 ? 'grid-cols-3' : mediaStock.length === 4 ? 'grid-cols-4' : 'grid-cols-2'}">
                            {#each mediaStock as s}
                                {@const cls = mediaTypeStockClasses(s.name)}
                                <div class="{cls.wrap} rounded-xl p-3 text-center">
                                    <div class="text-[10px] font-extrabold {cls.label} uppercase tracking-wider mb-0.5">Stock {s.name}</div>
                                    <div class="text-xl font-black {cls.value} tabular-nums">{s.stock}</div>
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            </Card>

            <!-- Calidad de datos -->
            <Card class="p-0 overflow-hidden border border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-md rounded-2xl">
                <div class="px-6 pt-5 pb-3 border-b border-slate-100/60">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-rose-50 text-rose-600 rounded-xl"><AlertTriangle size={18} strokeWidth={2.5} /></div>
                        <div>
                            <h2 class="text-[13px] font-extrabold text-slate-900 uppercase tracking-wider">Calidad de Datos</h2>
                            <p class="text-[11px] text-slate-400 font-medium">Campos incompletos</p>
                        </div>
                    </div>
                </div>
                <div class="p-6 space-y-4">
                    <div class="flex items-center gap-4">
                        <div class="relative h-24 w-24 shrink-0">
                            <canvas bind:this={qualityCanvas}></canvas>
                        </div>
                        <div>
                            <div class="text-3xl font-black tabular-nums {overallPct >= 90 ? 'text-emerald-600' : overallPct >= 70 ? 'text-amber-600' : 'text-rose-600'}">{overallPct}%</div>
                            <div class="text-[11px] font-bold text-slate-400 mt-0.5">Completitud</div>
                        </div>
                    </div>
                    <div class="space-y-2.5">
                        {#each qualityItems as item}
                            {@const completePct = 100 - pct(item.missing, metrics.dataQuality.total)}
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-[12px] font-bold text-slate-700 flex items-center gap-1.5"><span class="text-sm">{item.icon}</span> {item.label}</span>
                                {#if item.missing === 0}
                                    <Badge variant="emerald" class="text-[9px] font-extrabold px-1.5 py-0.5">100%</Badge>
                                {:else}
                                    <span class="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{item.missing} sin dato</span>
                                {/if}
                            </div>
                            <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div class="{completePct >= 90 ? 'bg-emerald-500' : completePct >= 70 ? 'bg-amber-500' : 'bg-rose-500'} h-full rounded-full transition-all duration-700" style="width: {completePct}%"></div>
                            </div>
                        {/each}
                    </div>
                </div>
            </Card>
        </section>

        <!-- ── FILA B: Dependencias + Edificios ── -->
        <section class="grid lg:grid-cols-3 gap-6">
            <Card class="lg:col-span-2 p-0 overflow-hidden border border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-md rounded-2xl">
                <div class="px-6 pt-5 pb-3 border-b border-slate-100/60">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-violet-50 text-violet-600 rounded-xl"><Building2 size={18} strokeWidth={2.5} /></div>
                        <div>
                            <h2 class="text-[13px] font-extrabold text-slate-900 uppercase tracking-wider">Dependencias</h2>
                            <p class="text-[11px] text-slate-400 font-medium">{metrics.topDependencies.length} registradas</p>
                        </div>
                    </div>
                </div>
                <div class="divide-y divide-slate-100/60 max-h-[420px] overflow-y-auto">
                    {#each metrics.topDependencies as dep, i}
                        {@const barWidth = pct(dep.total, metrics.totalPersonnel)}
                        {@const activePct = pct(dep.activos, dep.total)}
                        <div class="px-6 py-3 hover:bg-blue-50/30 transition-all duration-200 relative">
                            <div class="absolute inset-y-0 left-0 bg-violet-50/40 transition-all duration-700" style="width: {barWidth}%"></div>
                            <div class="relative flex items-center justify-between">
                                <div class="flex items-center gap-2.5 min-w-0">
                                    <span class="text-[10px] font-black text-violet-400 tabular-nums w-5">#{i + 1}</span>
                                    <span class="text-[12px] font-bold text-slate-800 truncate">{dep.name}</span>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <Badge variant="slate" class="text-[9px] font-extrabold px-1.5 py-0.5">{dep.total}</Badge>
                                    <Badge variant={activePct >= 80 ? "emerald" : activePct >= 50 ? "amber" : "rose"} class="text-[9px] font-extrabold px-1.5 py-0.5">{activePct}% op.</Badge>
                                </div>
                            </div>
                        </div>
                    {:else}
                        <div class="p-8 text-center text-slate-400 italic text-sm">Sin datos.</div>
                    {/each}
                </div>
            </Card>

            <Card class="p-0 overflow-hidden border border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-md rounded-2xl">
                <div class="px-6 pt-5 pb-3 border-b border-slate-100/60">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-cyan-50 text-cyan-600 rounded-xl"><Building2 size={18} strokeWidth={2.5} /></div>
                        <div>
                            <h2 class="text-[13px] font-extrabold text-slate-900 uppercase tracking-wider">Edificios</h2>
                            <p class="text-[11px] text-slate-400 font-medium">{metrics.topBuildings.length} registrados</p>
                        </div>
                    </div>
                </div>
                <div class="divide-y divide-slate-100/60 max-h-[420px] overflow-y-auto">
                    {#each metrics.topBuildings as bldg, i}
                        {@const barWidth = pct(bldg.total, metrics.totalPersonnel)}
                        <div class="px-6 py-3 hover:bg-cyan-50/30 transition-all duration-200 relative">
                            <div class="absolute inset-y-0 left-0 bg-cyan-50/40 transition-all duration-700" style="width: {barWidth}%"></div>
                            <div class="relative flex items-center justify-between">
                                <div class="flex items-center gap-2.5 min-w-0">
                                    <span class="text-[10px] font-black text-cyan-400 tabular-nums w-5">#{i + 1}</span>
                                    <span class="text-[12px] font-bold text-slate-800 truncate">{bldg.name}</span>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <Badge variant="slate" class="text-[9px] font-extrabold px-1.5 py-0.5">{bldg.total}</Badge>
                                    <span class="text-[10px] font-bold text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded">{barWidth}%</span>
                                </div>
                            </div>
                        </div>
                    {:else}
                        <div class="p-8 text-center text-slate-400 italic text-sm">Sin datos.</div>
                    {/each}
                </div>
            </Card>
        </section>

        <!-- ── FILA C: Actividad reciente + Tickets urgentes ── -->
        <section class="grid lg:grid-cols-3 gap-6">
            <Card class="lg:col-span-2 p-0 overflow-hidden border border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-md rounded-2xl">
                <div class="px-6 pt-5 pb-3 border-b border-slate-100/60">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-slate-50 text-slate-600 rounded-xl"><Activity size={18} strokeWidth={2.5} /></div>
                        <div>
                            <h2 class="text-[13px] font-extrabold text-slate-900 uppercase tracking-wider">Actividad Reciente</h2>
                            <p class="text-[11px] text-slate-400 font-medium">Últimos eventos del sistema</p>
                        </div>
                    </div>
                </div>
                <div class="divide-y divide-slate-100/60">
                    {#each activityFeed as evt}
                        {@const meta = actionMeta(evt.action, evt.entity_type)}
                        <div class="px-6 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
                            <div class="w-8 h-8 rounded-lg {meta.bg} flex items-center justify-center shrink-0">
                                <span class="text-[11px] font-black {meta.color} uppercase">{meta.icon === "plus" ? "+" : meta.icon === "minus" ? "−" : meta.icon === "swap" ? "↔" : meta.icon === "pen" ? "✎" : "•"}</span>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-[12px] font-bold text-slate-700 truncate">
                                    {evt.entity_name || evt.entity_type}
                                </p>
                                <p class="text-[10px] font-medium text-slate-400 truncate">
                                    {evt.action.replace(/_/g, " ")} · {evt.performed_by_name || "Sistema"}
                                </p>
                            </div>
                            <span class="text-[10px] font-medium text-slate-400 shrink-0">{timeAgo(evt.timestamp)}</span>
                        </div>
                    {:else}
                        <div class="p-8 text-center text-slate-400 italic text-sm">Sin actividad reciente.</div>
                    {/each}
                </div>
            </Card>

            <Card class="p-0 overflow-hidden border border-slate-200/50 shadow-sm bg-white/50 backdrop-blur-md rounded-2xl">
                <div class="px-6 pt-5 pb-3 border-b border-slate-100/60">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-rose-50 text-rose-600 rounded-xl"><Zap size={18} strokeWidth={2.5} /></div>
                        <div>
                            <h2 class="text-[13px] font-extrabold text-slate-900 uppercase tracking-wider">Tickets Prioritarios</h2>
                            <p class="text-[11px] text-slate-400 font-medium">Urgencia alta</p>
                        </div>
                    </div>
                </div>
                <div class="divide-y divide-slate-100/60 max-h-[360px] overflow-y-auto">
                    {#each urgentTickets as tk}
                        <div class="px-6 py-3 flex items-center gap-3 hover:bg-rose-50/30 transition-colors">
                            <div class="flex-1 min-w-0">
                                <p class="text-[12px] font-bold text-slate-800 truncate">{tk.title || tk.type}</p>
                                <p class="text-[10px] font-medium text-slate-400 truncate">
                                    {#if tk.personName || tk.personnel}
                                        {tk.personName || fullName(tk.personnel?.first_name, tk.personnel?.last_name)}
                                    {:else}
                                        {tk.cardFolio || tk.type}
                                    {/if}
                                </p>
                            </div>
                            <span class="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded uppercase shrink-0">{tk.type}</span>
                        </div>
                    {:else}
                        <div class="p-8 text-center text-slate-400 italic text-sm">Sin tickets prioritarios.</div>
                    {/each}
                </div>
                {#if pendingItems.length > 0}
                    <a href="/tickets" class="flex items-center justify-center gap-1 py-3 text-[11px] font-bold text-sky-600 hover:text-sky-800 transition-colors border-t border-slate-100/60">
                        Ver todos los tickets <ChevronRight size={13} />
                    </a>
                {/if}
            </Card>
        </section>
    {:else}
        <Card class="p-12 text-center border border-slate-200/50 bg-white/50 backdrop-blur-md rounded-2xl">
            <div class="text-slate-400 italic">Cargando métricas...</div>
        </Card>
    {/if}
</div>
