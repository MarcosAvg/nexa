<script lang="ts">
    import { personnelState, ticketState, userState, historyState } from '../stores';
    import { pullRefresh } from '../stores';
    import {
        Card,
        Badge,
        Button,
        Input,
        Tabs,
        EmptyState,
        SectionHeader,
        Collapsible,
        DataList,
        BottomSheet,
    } from '../components';
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
        TrendingUp,
        Calendar,
        Inbox,
    } from 'lucide-svelte';
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { mediaTypeBarClasses, mediaTypeStockClasses } from '../utils/mediaTypeAppearance';
    import { timeAgo, fullName } from '../utils/format';
    import { DASHBOARD_EXCLUDED_TICKET_TYPES } from '../constants/tickets';
    import { PERSONNEL_STATUS_META } from '../constants/status';

    onMount(() => {
        personnelState.refreshDashboardStats();
        personnelState.refreshDashboardMetrics();
        personnelState.refreshDashboardGrowth();
    });
    // Las métricas se actualizan automáticamente vía Realtime:
    // PersonnelState.initRealtime() refresca dashboardStats y dashboardMetrics
    // en cada cambio detectado en la tabla personnel.

    // Navegación desde los contadores: pre-aplican el filtro en el store de destino.
    function goPersonnel(status: string) {
        personnelState.filters.status = status && status !== 'Todos' ? [status] : [];
        personnelState.filters.search = '';
        push('/personal');
    }
    function goTickets(section: 'General' | 'Responsivas', type: string = 'Todos') {
        ticketState.filters.section = section;
        ticketState.filters.type = type && type !== 'Todos' ? [type] : [];
        ticketState.filters.search = '';
        push('/tickets');
    }

    let pendingItems = $derived(ticketState.pendingItems);
    let currentUser = $derived(userState.currentUser);

    // Tiquets operativos: excluye Firmas Responsiva y Programaciones del conteo principal.
    let operationalTickets = $derived(
        pendingItems.filter((t) => !DASHBOARD_EXCLUDED_TICKET_TYPES.includes(t.type as any)),
    );

    // Tarjetas KPI
    let activePersonnelCount = $derived(personnelState.dashboardStats.activePersonnel);
    let mediaStock = $derived(personnelState.dashboardStats.stock);
    let pendingSignaturesCount = $derived(pendingItems.filter((t) => t.type === 'Firma Responsiva').length);
    let pendingProgrammingCount = $derived(pendingItems.filter((t) => t.type === 'Programación').length);

    // Métricas
    let metrics = $derived(personnelState.dashboardMetrics);
    let metricsLoading = $derived(personnelState.metricsLoading);

    // Crecimiento de personal
    let growth = $derived(personnelState.growth);
    let growthTab = $state<'edificio' | 'dependencia' | 'piso'>('edificio');
    let showGrowthSheet = $state(false);

    // Pull-to-refresh del dashboard.
    $effect(() =>
        pullRefresh.register(async () => {
            await Promise.all([
                personnelState.refreshDashboardStats(),
                personnelState.refreshDashboardMetrics(),
                personnelState.refreshDashboardGrowth(),
            ]);
        }),
    );

    // Filas aplanadas de "personas por piso" para el DataList móvil.
    let buildingFloorRows = $derived(
        metrics.buildingFloors.flatMap((b) => b.floors.map((f) => ({ ...f, buildingName: b.name }))),
    );

    function growthSign(p: number | null): string {
        if (p == null || p === 0) return '0';
        return p > 0 ? `+${p}` : `${p}`;
    }
    function growthPct(p: number | null): string {
        if (p == null) return '—';
        return `${p.toFixed(1)}%`;
    }
    function growthVariant(
        p: number | null,
    ): 'slate' | 'blue' | 'violet' | 'amber' | 'orange' | 'emerald' | 'rose' {
        if (p == null || p === 0) return 'slate';
        if (p < 0) return 'rose';
        if (p < 5) return 'blue';
        if (p < 15) return 'violet';
        if (p < 35) return 'amber';
        if (p < 75) return 'orange';
        return 'emerald';
    }
    function applyGrowthRange() {
        personnelState.refreshDashboardGrowth();
    }
    function resetGrowthToCreation() {
        personnelState.growthStartDate = '';
        personnelState.refreshDashboardGrowth();
    }

    // Tickets: desglose por prioridad + urgentes (solo operativos)
    let ticketsByPriority = $derived.by(() => {
        const map = { Alta: 0, Media: 0, Baja: 0 };
        for (const t of operationalTickets) {
            const p = String(t.priority || '').toLowerCase();
            if (p === 'alta') map.Alta++;
            else if (p === 'media') map.Media++;
            else if (p === 'baja') map.Baja++;
        }
        return map;
    });
    let ticketPriorityList = $derived([
        { label: 'Alta', count: ticketsByPriority.Alta },
        { label: 'Media', count: ticketsByPriority.Media },
        { label: 'Baja', count: ticketsByPriority.Baja },
    ]);
    let urgentTickets = $derived(
        operationalTickets.filter((t) => String(t.priority || '').toLowerCase() === 'alta').slice(0, 6),
    );

    // Actividad reciente (feed precargado en el boot)
    let activityFeed = $derived((historyState.pagination.items || []).slice(0, 8));

    // Saludo según hora del día
    function greeting(): string {
        const h = new Date().getHours();
        if (h < 12) return 'Buenos días';
        if (h < 19) return 'Buenas tardes';
        return 'Buenas noches';
    }

    // Utilidades
    function pct(n: number, total: number) {
        return total > 0 ? Math.round((n / total) * 100) : 0;
    }

    const statusConfig = PERSONNEL_STATUS_META;

    function actionMeta(action: string, _entity: string) {
        const a = (action || '').toLowerCase();
        if (a.includes('create') || a.includes('alta'))
            return { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: 'plus' };
        if (a.includes('delete') || a.includes('baja'))
            return { color: 'text-rose-600', bg: 'bg-rose-50', icon: 'minus' };
        if (a.includes('assign') || a.includes('replac') || a.includes('reposic'))
            return { color: 'text-violet-600', bg: 'bg-violet-50', icon: 'swap' };
        if (a.includes('sign')) return { color: 'text-sky-600', bg: 'bg-sky-50', icon: 'pen' };
        return { color: 'text-slate-600', bg: 'bg-slate-50', icon: 'dot' };
    }

    let qualityItems = $derived([
        { label: 'Correo Electrónico', missing: metrics.dataQuality.sinEmail, icon: '✉' },
        { label: 'Días Laborales', missing: metrics.dataQuality.sinSchedule, icon: '🕐' },
        { label: 'Puesto', missing: metrics.dataQuality.sinPosition, icon: '💼' },
        { label: 'Área / Función', missing: metrics.dataQuality.sinArea, icon: '🏷' },
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
        const { default: Chart } = await import('chart.js/auto');
        return Chart;
    }

    async function renderStateDonut() {
        if (!stateCanvas) return;
        if (chartState) {
            chartState.destroy();
            chartState = null;
        }
        const data = statusConfig
            .map((s) => ({
                label: s.label,
                value: metrics.statusCounts[s.key as keyof typeof metrics.statusCounts] ?? 0,
                hex: s.hex,
            }))
            .filter((d) => d.value > 0);
        if (data.length === 0) return;
        const Chart = await importChart();
        chartState = new Chart(stateCanvas, {
            type: 'doughnut',
            data: {
                labels: data.map((d) => d.label),
                datasets: [
                    {
                        data: data.map((d) => d.value),
                        backgroundColor: data.map((d) => d.hex),
                        borderColor: '#fff',
                        borderWidth: 2,
                        hoverOffset: 6,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx: any) =>
                                ` ${ctx.label}: ${ctx.parsed} (${pct(ctx.parsed, metrics.totalPersonnel)}%)`,
                        },
                    },
                },
            },
        });
    }

    async function renderQualityRing() {
        if (!qualityCanvas) return;
        if (chartQuality) {
            chartQuality.destroy();
            chartQuality = null;
        }
        if (!qualityCanvas) return;
        const Chart = await importChart();
        chartQuality = new Chart(qualityCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Completo', 'Incompleto'],
                datasets: [
                    {
                        data: [Math.max(0, totalFields - totalMissing), totalMissing],
                        backgroundColor: [
                            overallPct >= 90 ? '#10b981' : overallPct >= 70 ? '#f59e0b' : '#f43f5e',
                            '#e2e8f0',
                        ],
                        borderWidth: 0,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '78%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: true },
                },
            },
        });
    }
</script>

{#snippet dashEmpty(label: string)}
    <div class="flex flex-col items-center justify-center gap-2 py-9 text-center">
        <Inbox size={22} class="text-slate-300" strokeWidth={1.8} />
        <p class="text-xs font-medium text-slate-400">{label}</p>
    </div>
{/snippet}

<div class="flex flex-col gap-4">
    <!-- Cabecera unificada (móvil con buscador; hero solo en desktop) -->
    <SectionHeader title="Dashboard" />

    <!-- ── HERO (desktop) ── -->
    <section class="hidden lg:flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="min-w-0">
            <div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {greeting()}!
                </h1>
                {#if currentUser?.name}
                    <span class="text-2xl sm:text-3xl font-extrabold text-sky-600 tracking-tight break-words">
                        {currentUser.name.split(' ')[0]}
                    </span>
                {/if}
            </div>
            <p class="text-[15px] font-medium text-slate-500 mt-1">
                {new Date().toLocaleDateString('es-MX', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                })} · Resumen operativo de personal y accesos.
            </p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
            {#if userState.isAdmin}
                <Badge
                    variant="violet"
                    class="text-[10px] font-extrabold px-2.5 py-1 uppercase tracking-wider"
                    >Administrador</Badge
                >
            {:else if userState.isOperator}
                <Badge variant="blue" class="text-[10px] font-extrabold px-2.5 py-1 uppercase tracking-wider"
                    >Operador</Badge
                >
            {:else}
                <Badge variant="slate" class="text-[10px] font-extrabold px-2.5 py-1 uppercase tracking-wider"
                    >Consulta</Badge
                >
            {/if}
            <Badge
                variant={operationalTickets.length > 0 ? 'amber' : 'emerald'}
                class="text-[10px] font-extrabold px-2.5 py-1 uppercase tracking-wider"
            >
                {operationalTickets.length} pendientes
            </Badge>
        </div>
    </section>

    <!-- ── KPIs ── -->
    <section class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 lg:gap-4">
        <Card
            class="p-4 lg:p-5 relative overflow-hidden group bg-white/50 backdrop-blur-md border border-slate-200/50 transition-all duration-300"
            interactive
            onclick={() => goPersonnel('Activo/a')}
        >
            <div class="flex items-center gap-3">
                <div
                    class="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform duration-300 shrink-0"
                >
                    <Users size={18} strokeWidth={2} />
                </div>
                <div class="min-w-0">
                    <div
                        class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.12em] mb-0.5 truncate"
                    >
                        Personal Activo
                    </div>
                    <div class="text-xl lg:text-2xl font-black text-slate-900 tabular-nums">
                        {activePersonnelCount}
                    </div>
                </div>
            </div>
            <div class="hidden lg:block mt-2 text-[10px] font-medium text-slate-400">
                Incluye: Activo/a, Parcial y Media de otro edificio
            </div>
            <div
                class="hidden lg:block absolute -right-4 -bottom-4 text-emerald-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"
            >
                <Users size={96} />
            </div>
        </Card>

        <Card
            class="p-4 lg:p-5 relative overflow-hidden group bg-white/50 backdrop-blur-md border border-slate-200/50 transition-all duration-300"
            interactive
            onclick={() => goPersonnel('No Activos')}
        >
            <div class="flex items-center gap-3">
                <div
                    class="p-2.5 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 transition-transform duration-300 shrink-0"
                >
                    <Shield size={18} strokeWidth={2} />
                </div>
                <div class="min-w-0">
                    <div
                        class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.12em] mb-0.5 truncate"
                    >
                        No Activos
                    </div>
                    <div class="text-xl lg:text-2xl font-black text-slate-900 tabular-nums">
                        {metrics.noActivos}
                    </div>
                </div>
            </div>
            <div class="hidden lg:block mt-2 text-[10px] font-medium text-slate-400">
                Sin acceso utilizable
            </div>
            <div
                class="hidden lg:block absolute -right-4 -bottom-4 text-rose-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"
            >
                <Shield size={96} />
            </div>
        </Card>

        <Card
            class="p-4 lg:p-5 relative overflow-hidden group bg-white/50 backdrop-blur-md border border-slate-200/50 transition-all duration-300"
            interactive
            onclick={() => goTickets('General')}
        >
            <div class="flex items-center gap-3">
                <div
                    class="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform duration-300 shrink-0"
                >
                    <FileText size={18} strokeWidth={2} />
                </div>
                <div class="min-w-0">
                    <div
                        class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.12em] mb-0.5 truncate"
                    >
                        Tickets Pendientes
                    </div>
                    <div class="text-xl lg:text-2xl font-black text-slate-900 tabular-nums">
                        {operationalTickets.length}
                    </div>
                </div>
            </div>
            <div class="mt-2 flex items-center gap-1.5">
                {#each ticketPriorityList as item}
                    <Badge
                        variant={item.label === 'Alta' ? 'rose' : item.label === 'Media' ? 'amber' : 'slate'}
                        class="text-[9px] font-extrabold px-1.5 py-0.5 hidden xl:inline-flex"
                        >{item.label} {item.count}</Badge
                    >
                {/each}
            </div>
            <div
                class="hidden lg:block absolute -right-4 -bottom-4 text-amber-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"
            >
                <FileText size={96} />
            </div>
        </Card>

        <Card
            class="p-4 lg:p-5 relative overflow-hidden group bg-white/50 backdrop-blur-md border border-slate-200/50 transition-all duration-300"
            interactive
            onclick={() => goTickets('Responsivas')}
        >
            <div class="flex items-center gap-3">
                <div
                    class="p-2.5 bg-violet-50 text-violet-600 rounded-xl group-hover:scale-110 transition-transform duration-300 shrink-0"
                >
                    <FileSignature size={18} strokeWidth={2} />
                </div>
                <div class="min-w-0">
                    <div
                        class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.12em] mb-0.5 truncate"
                    >
                        Firmas Pendientes
                    </div>
                    <div class="text-xl lg:text-2xl font-black text-slate-900 tabular-nums">
                        {pendingSignaturesCount}
                    </div>
                </div>
            </div>
            <div
                class="hidden lg:block absolute -right-4 -bottom-4 text-violet-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"
            >
                <FileSignature size={96} />
            </div>
        </Card>

        <Card
            class="p-4 lg:p-5 relative overflow-hidden group bg-white/50 backdrop-blur-md border border-slate-200/50 transition-all duration-300"
            interactive
            onclick={() => goTickets('General', 'Programación')}
        >
            <div class="flex items-center gap-3">
                <div
                    class="p-2.5 bg-cyan-50 text-cyan-600 rounded-xl group-hover:scale-110 transition-transform duration-300 shrink-0"
                >
                    <Cpu size={18} strokeWidth={2} />
                </div>
                <div class="min-w-0">
                    <div
                        class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.12em] mb-0.5 truncate"
                    >
                        Programación
                    </div>
                    <div class="text-xl lg:text-2xl font-black text-slate-900 tabular-nums">
                        {pendingProgrammingCount}
                    </div>
                </div>
            </div>
            <div
                class="hidden lg:block absolute -right-4 -bottom-4 text-cyan-500/5 rotate-12 group-hover:rotate-0 transition-transform duration-500"
            >
                <Cpu size={96} />
            </div>
        </Card>
    </section>

    {#if metricsLoading}
        <section class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {#each [1, 2, 3] as _}
                <Card class="p-6 border border-slate-200/50 bg-white/50 backdrop-blur-md rounded-2xl">
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
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <!-- Tickets prioritarios (móvil: 2 · desktop: 8) -->
            <Collapsible
                title="Tickets Prioritarios"
                subtitle="Urgencia alta"
                icon={Zap}
                iconBgClass="bg-rose-50 text-rose-600"
                defaultOpen
                class="max-lg:order-2 lg:order-8 lg:col-span-1"
            >
                <DataList items={urgentTickets} key={(t: any) => t.id} onOpen={() => goTickets('General')}>
                    {#snippet title(t: any)}
                        <span>{t.title || t.type}</span>
                    {/snippet}
                    {#snippet subtitle(t: any)}
                        <span>
                            {t.personName ||
                                fullName(t.personnel?.first_name, t.personnel?.last_name) ||
                                t.cardFolio ||
                                t.type}
                        </span>
                    {/snippet}
                    {#snippet trailing(t: any)}
                        <span
                            class="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded uppercase"
                            >{t.type}</span
                        >
                    {/snippet}
                </DataList>

                <div class="hidden lg:block divide-y divide-slate-100/60 max-h-[360px] overflow-y-auto">
                    {#each urgentTickets as tk}
                        <div class="px-6 py-3 flex items-center gap-3 hover:bg-rose-50/30 transition-colors">
                            <div class="flex-1 min-w-0">
                                <p class="text-[12px] font-bold text-slate-800 truncate">
                                    {tk.title || tk.type}
                                </p>
                                <p class="text-[10px] font-medium text-slate-400 truncate">
                                    {#if tk.personName || tk.personnel}
                                        {tk.personName ||
                                            fullName(tk.personnel?.first_name, tk.personnel?.last_name)}
                                    {:else}
                                        {tk.cardFolio || tk.type}
                                    {/if}
                                </p>
                            </div>
                            <span
                                class="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded uppercase shrink-0"
                                >{tk.type}</span
                            >
                        </div>
                    {:else}
                        {@render dashEmpty('Sin tickets prioritarios')}
                    {/each}
                </div>
                {#if operationalTickets.length > 0}
                    <a
                        href="/tickets"
                        class="flex items-center justify-center gap-1 py-3 text-[11px] font-bold text-sky-600 hover:text-sky-800 transition-colors border-t border-slate-100/60"
                    >
                        Ver todos los tickets <ChevronRight size={13} />
                    </a>
                {/if}
            </Collapsible>

            <!-- Actividad (móvil: 9 · desktop: 7) -->
            <Collapsible
                title="Actividad Reciente"
                subtitle="Últimos eventos del sistema"
                icon={Activity}
                class="max-lg:order-9 lg:order-7 lg:col-span-2"
            >
                <DataList items={activityFeed} key={(e: any) => e.id}>
                    {#snippet leading(e: any)}
                        {@const meta = actionMeta(e.action, e.entity_type)}
                        <div class="w-8 h-8 rounded-lg {meta.bg} flex items-center justify-center">
                            <span class="text-[11px] font-black {meta.color} uppercase">
                                {meta.icon === 'plus'
                                    ? '+'
                                    : meta.icon === 'minus'
                                      ? '−'
                                      : meta.icon === 'swap'
                                        ? '↔'
                                        : meta.icon === 'pen'
                                          ? '✎'
                                          : '•'}
                            </span>
                        </div>
                    {/snippet}
                    {#snippet title(e: any)}
                        <span>{e.entity_name || e.entity_type}</span>
                    {/snippet}
                    {#snippet subtitle(e: any)}
                        <span>{e.action.replace(/_/g, ' ')} · {e.performed_by_name || 'Sistema'}</span>
                    {/snippet}
                    {#snippet trailing(e: any)}
                        <span class="text-[10px] font-medium text-slate-400">{timeAgo(e.timestamp)}</span>
                    {/snippet}
                </DataList>

                <div class="hidden lg:block divide-y divide-slate-100/60">
                    {#each activityFeed as evt}
                        {@const meta = actionMeta(evt.action, evt.entity_type)}
                        <div class="px-6 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
                            <div
                                class="w-8 h-8 rounded-lg {meta.bg} flex items-center justify-center shrink-0"
                            >
                                <span class="text-[11px] font-black {meta.color} uppercase"
                                    >{meta.icon === 'plus'
                                        ? '+'
                                        : meta.icon === 'minus'
                                          ? '−'
                                          : meta.icon === 'swap'
                                            ? '↔'
                                            : meta.icon === 'pen'
                                              ? '✎'
                                              : '•'}</span
                                >
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-[12px] font-bold text-slate-700 truncate">
                                    {evt.entity_name || evt.entity_type}
                                </p>
                                <p class="text-[10px] font-medium text-slate-400 truncate">
                                    {evt.action.replace(/_/g, ' ')} · {evt.performed_by_name || 'Sistema'}
                                </p>
                            </div>
                            <span class="text-[10px] font-medium text-slate-400 shrink-0"
                                >{timeAgo(evt.timestamp)}</span
                            >
                        </div>
                    {:else}
                        {@render dashEmpty('Sin actividad reciente')}
                    {/each}
                </div>
            </Collapsible>

            <!-- Estados (móvil: 3 · desktop: 1) -->
            <Collapsible
                title="Por Estado"
                subtitle="{metrics.totalPersonnel} registrados"
                icon={BarChart3}
                iconBgClass="bg-blue-50 text-blue-600"
                class="max-lg:order-3 lg:order-1 lg:col-span-1"
                onToggle={(o) => {
                    if (o)
                        requestAnimationFrame(() => {
                            chartState?.resize();
                            chartQuality?.resize();
                        });
                }}
            >
                <div class="p-4 lg:p-6">
                    <div class="relative h-36 w-36 sm:h-44 sm:w-44 mx-auto">
                        <canvas bind:this={stateCanvas}></canvas>
                    </div>
                    <div class="mt-5 grid grid-cols-2 gap-2">
                        {#each statusConfig as item}
                            {@const count =
                                metrics.statusCounts[item.key as keyof typeof metrics.statusCounts]}
                            {@const percentage = pct(count, metrics.totalPersonnel)}
                            {#if count > 0}
                                <div class="flex items-center justify-between gap-2">
                                    <div class="flex items-center gap-1.5 min-w-0">
                                        <div class="w-2.5 h-2.5 rounded-full {item.dot} shrink-0"></div>
                                        <span class="text-[11px] font-bold text-slate-600 truncate"
                                            >{item.label}</span
                                        >
                                    </div>
                                    <span class="text-[11px] font-black text-slate-800 tabular-nums shrink-0"
                                        >{count} ({percentage}%)</span
                                    >
                                </div>
                            {/if}
                        {/each}
                    </div>
                </div>
            </Collapsible>

            <!-- Cobertura (móvil: 4 · desktop: 2) -->
            <Collapsible
                title="Cobertura Tarjetas"
                subtitle="{metrics.operativos} operativos"
                icon={Shield}
                iconBgClass="bg-amber-50 text-amber-600"
                class="max-lg:order-4 lg:order-2 lg:col-span-1"
            >
                <div class="p-4 lg:p-6 space-y-5">
                    {#each metrics.cardCoverage as cov}
                        {@const cls = mediaTypeBarClasses(cov.name)}
                        <div>
                            <div class="flex items-center justify-between mb-1.5">
                                <span class="text-[12px] font-extrabold {cls.text} flex items-center gap-1.5"
                                    ><CreditCard size={14} /> {cov.name}</span
                                >
                                <span class="text-[10px] font-bold {cls.badge} px-2 py-0.5 rounded-lg"
                                    >{pct(cov.con, metrics.operativos)}%</span
                                >
                            </div>
                            <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                                <div
                                    class="{cls.bar} h-full rounded-full transition-all duration-700"
                                    style="width: {pct(cov.con, metrics.operativos)}%"
                                ></div>
                            </div>
                            <div class="flex justify-between text-[10px] font-bold">
                                <span class="text-emerald-600">✓ {cov.con}</span>
                                <span class={cov.sin > 0 ? 'text-rose-500' : 'text-emerald-600'}
                                    >{cov.sin > 0 ? '✗' : '✓'} {cov.sin} sin tarjeta</span
                                >
                            </div>
                        </div>
                    {/each}
                    <div class="pt-4 border-t border-slate-100/60">
                        <div class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                            {#each mediaStock as s}
                                {@const cls = mediaTypeStockClasses(s.name)}
                                <div class="{cls.wrap} rounded-xl p-3 text-center min-w-0">
                                    <div
                                        class="text-[10px] font-extrabold {cls.label} uppercase tracking-wider mb-0.5 truncate"
                                    >
                                        Stock {s.name}
                                    </div>
                                    <div class="text-xl font-black {cls.value} tabular-nums">{s.stock}</div>
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            </Collapsible>

            <!-- Calidad (móvil: 5 · desktop: 3) -->
            <Collapsible
                title="Calidad de Datos"
                subtitle="Campos incompletos"
                icon={AlertTriangle}
                iconBgClass="bg-rose-50 text-rose-600"
                class="max-lg:order-5 lg:order-3 lg:col-span-1"
                onToggle={(o) => {
                    if (o) requestAnimationFrame(() => chartQuality?.resize());
                }}
            >
                <div class="p-4 lg:p-6 space-y-4">
                    <div class="flex items-center gap-4">
                        <div class="relative h-20 w-20 shrink-0">
                            <canvas bind:this={qualityCanvas}></canvas>
                        </div>
                        <div>
                            <div
                                class="text-3xl font-black tabular-nums {overallPct >= 90
                                    ? 'text-emerald-600'
                                    : overallPct >= 70
                                      ? 'text-amber-600'
                                      : 'text-rose-600'}"
                            >
                                {overallPct}%
                            </div>
                            <div class="text-[11px] font-bold text-slate-400 mt-0.5">Completitud</div>
                        </div>
                    </div>
                    <div class="space-y-2.5">
                        {#each qualityItems as item}
                            {@const completePct = 100 - pct(item.missing, metrics.dataQuality.total)}
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-[12px] font-bold text-slate-700 flex items-center gap-1.5"
                                    ><span class="text-sm">{item.icon}</span> {item.label}</span
                                >
                                {#if item.missing === 0}
                                    <Badge variant="emerald" class="text-[9px] font-extrabold px-1.5 py-0.5"
                                        >100%</Badge
                                    >
                                {:else}
                                    <span
                                        class="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded"
                                        >{item.missing} sin dato</span
                                    >
                                {/if}
                            </div>
                            <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    class="{completePct >= 90
                                        ? 'bg-emerald-500'
                                        : completePct >= 70
                                          ? 'bg-amber-500'
                                          : 'bg-rose-500'} h-full rounded-full transition-all duration-700"
                                    style="width: {completePct}%"
                                ></div>
                            </div>
                        {/each}
                    </div>
                </div>
            </Collapsible>

            <!-- Crecimiento (móvil: 6 · desktop: 6) -->
            <Collapsible
                title="Crecimiento de Personal"
                subtitle="Incremento de plantilla por rango de fechas"
                icon={TrendingUp}
                iconBgClass="bg-emerald-50 text-emerald-600"
                class="max-lg:order-6 lg:order-6 lg:col-span-3"
                headerBorder={false}
            >
                {#snippet headerActions()}
                    <div class="hidden lg:flex items-end gap-2 flex-wrap">
                        <div class="w-40">
                            <label
                                for="growth-start"
                                class="flex items-center gap-1 text-[11px] font-bold text-slate-500 mb-1 ml-1"
                                ><Calendar size={12} /> Desde</label
                            >
                            <Input
                                id="growth-start"
                                type="date"
                                bind:value={personnelState.growthStartDate}
                                min={growth.minCreatedAt ?? undefined}
                                onchange={applyGrowthRange}
                                class="h-9"
                            />
                        </div>
                        <div class="w-40">
                            <label
                                for="growth-end"
                                class="flex items-center gap-1 text-[11px] font-bold text-slate-500 mb-1 ml-1"
                                ><Calendar size={12} /> Hasta</label
                            >
                            <Input
                                id="growth-end"
                                type="date"
                                bind:value={personnelState.growthEndDate}
                                min={personnelState.growthStartDate || undefined}
                                onchange={applyGrowthRange}
                                class="h-9"
                            />
                        </div>
                        <Button variant="soft-slate" size="sm" onclick={resetGrowthToCreation}
                            >Desde creación</Button
                        >
                    </div>
                    <button
                        type="button"
                        class="lg:hidden flex items-center gap-1.5 px-3 h-9 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-bold active:scale-95 transition-all"
                        onclick={() => (showGrowthSheet = true)}
                    >
                        <Calendar size={14} /> Rango de fechas
                    </button>
                {/snippet}

                <div
                    class="px-4 lg:px-6 py-4 flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-slate-100/60"
                >
                    <div>
                        <div
                            class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.14em] mb-0.5"
                        >
                            Total de personal
                        </div>
                        <div class="text-3xl font-black text-slate-900 tabular-nums">
                            {growth.totals.final}
                            <span class="text-sm font-bold text-slate-400"
                                >de {growth.totals.initial} inicial</span
                            >
                        </div>
                    </div>
                    <Badge
                        variant={growthVariant(growth.totals.percent)}
                        class="text-[11px] font-extrabold px-2.5 py-1"
                    >
                        {growthSign(growth.totals.increment)} · {growthPct(growth.totals.percent)}
                    </Badge>
                </div>

                <div class="px-4 lg:px-6 pt-4">
                    <Tabs
                        variant="pill"
                        tabs={[
                            { id: 'edificio', label: 'Edificio' },
                            { id: 'dependencia', label: 'Dependencia' },
                            { id: 'piso', label: 'Piso' },
                        ]}
                        active={growthTab}
                        onSelect={(id) => (growthTab = id)}
                    />
                </div>

                <!-- Móvil: DataList por pestaña -->
                {#if growthTab === 'edificio'}
                    <DataList items={growth.byBuilding} key={(b: any) => b.name}>
                        {#snippet title(b: any)}<span>{b.name}</span>{/snippet}
                        {#snippet subtitle(b: any)}
                            <span class="tabular-nums">{b.initial} → {b.final}</span>
                        {/snippet}
                        {#snippet trailing(b: any)}
                            <Badge
                                variant={growthVariant(b.percent)}
                                class="text-[9px] font-extrabold px-1.5 py-0.5"
                                >{growthSign(b.increment)} · {growthPct(b.percent)}</Badge
                            >
                        {/snippet}
                    </DataList>
                {:else if growthTab === 'dependencia'}
                    <DataList items={growth.byDependency} key={(d: any) => d.name}>
                        {#snippet title(d: any)}<span>{d.name}</span>{/snippet}
                        {#snippet subtitle(d: any)}
                            <span class="tabular-nums">{d.initial} → {d.final}</span>
                        {/snippet}
                        {#snippet trailing(d: any)}
                            <Badge
                                variant={growthVariant(d.percent)}
                                class="text-[9px] font-extrabold px-1.5 py-0.5"
                                >{growthSign(d.increment)} · {growthPct(d.percent)}</Badge
                            >
                        {/snippet}
                    </DataList>
                {:else}
                    <DataList items={growth.byFloor} key={(f: any) => `${f.buildingId}-${f.label}`}>
                        {#snippet title(f: any)}<span>{f.label}</span>{/snippet}
                        {#snippet subtitle(f: any)}<span>{f.buildingName}</span>{/snippet}
                        {#snippet trailing(f: any)}
                            <Badge
                                variant={growthVariant(f.percent)}
                                class="text-[9px] font-extrabold px-1.5 py-0.5"
                                >{growthSign(f.increment)} · {growthPct(f.percent)}</Badge
                            >
                        {/snippet}
                    </DataList>
                {/if}

                <!-- Desktop: listas -->
                <div class="hidden lg:block divide-y divide-slate-100/60 max-h-[400px] overflow-y-auto">
                    {#if growthTab === 'edificio'}
                        {#each growth.byBuilding as bldg}
                            <div class="px-6 py-3 flex items-center justify-between gap-3">
                                <span class="text-[12px] font-bold text-slate-700 truncate">{bldg.name}</span>
                                <div class="flex items-center gap-2 shrink-0">
                                    <span class="text-[10px] font-bold text-slate-400 tabular-nums"
                                        >{bldg.initial} → {bldg.final}</span
                                    >
                                    <Badge
                                        variant={growthVariant(bldg.percent)}
                                        class="text-[9px] font-extrabold px-1.5 py-0.5"
                                        >{growthSign(bldg.increment)} · {growthPct(bldg.percent)}</Badge
                                    >
                                </div>
                            </div>
                        {:else}
                            {@render dashEmpty('Sin datos')}
                        {/each}
                    {:else if growthTab === 'dependencia'}
                        {#each growth.byDependency as dep}
                            <div class="px-6 py-3 flex items-center justify-between gap-3">
                                <span class="text-[12px] font-bold text-slate-700 truncate">{dep.name}</span>
                                <div class="flex items-center gap-2 shrink-0">
                                    <span class="text-[10px] font-bold text-slate-400 tabular-nums"
                                        >{dep.initial} → {dep.final}</span
                                    >
                                    <Badge
                                        variant={growthVariant(dep.percent)}
                                        class="text-[9px] font-extrabold px-1.5 py-0.5"
                                        >{growthSign(dep.increment)} · {growthPct(dep.percent)}</Badge
                                    >
                                </div>
                            </div>
                        {:else}
                            {@render dashEmpty('Sin datos')}
                        {/each}
                    {:else}
                        {#each growth.byFloor as floor, i}
                            {#if i === 0 || growth.byFloor[i - 1].buildingId !== floor.buildingId}
                                <div class="px-6 pt-3 pb-1 flex items-center gap-2">
                                    <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0"></span>
                                    <span class="text-[11px] font-extrabold text-slate-600"
                                        >{floor.buildingName}</span
                                    >
                                </div>
                            {/if}
                            <div class="px-6 py-3 flex items-center justify-between gap-3">
                                <span class="text-[12px] font-bold text-slate-600 truncate pl-4"
                                    >{floor.label}</span
                                >
                                <div class="flex items-center gap-2 shrink-0">
                                    <span class="text-[10px] font-bold text-slate-400 tabular-nums"
                                        >{floor.initial} → {floor.final}</span
                                    >
                                    <Badge
                                        variant={growthVariant(floor.percent)}
                                        class="text-[9px] font-extrabold px-1.5 py-0.5"
                                        >{growthSign(floor.increment)} · {growthPct(floor.percent)}</Badge
                                    >
                                </div>
                            </div>
                        {:else}
                            {@render dashEmpty('Sin datos')}
                        {/each}
                    {/if}
                </div>
            </Collapsible>

            <!-- Dependencias (móvil: 7 · desktop: 4) -->
            <Collapsible
                title="Dependencias"
                subtitle="{metrics.topDependencies.length} registradas"
                icon={Building2}
                iconBgClass="bg-violet-50 text-violet-600"
                class="max-lg:order-7 lg:order-4 lg:col-span-1"
            >
                <DataList items={metrics.topDependencies} key={(d: any) => d.name}>
                    {#snippet title(d: any)}<span>{d.name}</span>{/snippet}
                    {#snippet subtitle(d: any)}
                        <span>{pct(d.activos, d.total)}% operativos</span>
                    {/snippet}
                    {#snippet trailing(d: any)}
                        <Badge variant="slate" class="text-[9px] font-extrabold px-1.5 py-0.5"
                            >{d.total}</Badge
                        >
                    {/snippet}
                </DataList>

                <div class="hidden lg:block divide-y divide-slate-100/60 max-h-[420px] overflow-y-auto">
                    {#each metrics.topDependencies as dep, i}
                        {@const barWidth = pct(dep.total, metrics.totalPersonnel)}
                        {@const activePct = pct(dep.activos, dep.total)}
                        <div class="px-6 py-3 hover:bg-blue-50/30 transition-all duration-200 relative">
                            <div
                                class="absolute inset-y-0 left-0 bg-violet-50/40 transition-all duration-700"
                                style="width: {barWidth}%"
                            ></div>
                            <div class="relative flex items-center justify-between">
                                <div class="flex items-center gap-2.5 min-w-0">
                                    <span class="text-[10px] font-black text-violet-400 tabular-nums w-5"
                                        >{i + 1}</span
                                    >
                                    <span class="text-[12px] font-bold text-slate-800 truncate"
                                        >{dep.name}</span
                                    >
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <Badge variant="slate" class="text-[9px] font-extrabold px-1.5 py-0.5"
                                        >{dep.total}</Badge
                                    >
                                    <Badge
                                        variant={activePct >= 80
                                            ? 'emerald'
                                            : activePct >= 50
                                              ? 'amber'
                                              : 'rose'}
                                        class="text-[9px] font-extrabold px-1.5 py-0.5"
                                        >{activePct}% op.</Badge
                                    >
                                </div>
                            </div>
                        </div>
                    {:else}
                        {@render dashEmpty('Sin datos')}
                    {/each}
                </div>
            </Collapsible>

            <!-- Personas por Piso (móvil: 8 · desktop: 5) -->
            <Collapsible
                title="Personas por Piso"
                subtitle="Radicación: edificio + piso base"
                icon={Building2}
                iconBgClass="bg-cyan-50 text-cyan-600"
                class="max-lg:order-8 lg:order-5 lg:col-span-2"
            >
                <DataList items={buildingFloorRows} key={(f: any) => `${f.buildingName}-${f.label}`}>
                    {#snippet title(f: any)}<span>{f.label}</span>{/snippet}
                    {#snippet subtitle(f: any)}<span>{f.buildingName}</span>{/snippet}
                    {#snippet trailing(f: any)}
                        <span class="text-[11px] font-black text-slate-700 tabular-nums">{f.people}</span>
                    {/snippet}
                </DataList>

                <div class="hidden lg:block divide-y divide-slate-100/60 max-h-[420px] overflow-y-auto">
                    {#each metrics.buildingFloors as bldg}
                        {@const bldgTotal = bldg.floors.reduce((s, f) => s + f.people, 0)}
                        <div class="px-6 py-4 relative">
                            <div class="flex items-center justify-between mb-2">
                                <span
                                    class="text-[12px] font-extrabold text-slate-800 flex items-center gap-2"
                                >
                                    <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0"></span>
                                    {bldg.name}
                                </span>
                                <Badge variant="slate" class="text-[10px] font-extrabold px-2 py-0.5"
                                    >{bldgTotal} personas</Badge
                                >
                            </div>
                            <div class="space-y-1.5">
                                {#each bldg.floors as floor}
                                    {@const pisoBarWidth = bldgTotal > 0 ? pct(floor.people, bldgTotal) : 0}
                                    {@const pisoPct = bldgTotal > 0 ? pct(floor.people, bldgTotal) : 0}
                                    <div class="flex items-center gap-2 sm:gap-3">
                                        <span
                                            class="text-[11px] font-bold text-slate-600 w-16 sm:w-24 shrink-0 truncate"
                                            >{floor.label}</span
                                        >
                                        <div
                                            class="flex-1 min-w-0 h-2 bg-slate-100 rounded-full overflow-hidden"
                                        >
                                            <div
                                                class="bg-cyan-500 h-full rounded-full transition-all duration-700"
                                                style="width: {pisoBarWidth}%"
                                            ></div>
                                        </div>
                                        <span
                                            class="text-[10px] font-black text-slate-700 tabular-nums w-8 shrink-0 text-right"
                                            >{floor.people}</span
                                        >
                                        <span
                                            class="text-[9px] font-bold text-cyan-600 tabular-nums w-10 shrink-0 text-right"
                                            >{pisoPct}%</span
                                        >
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {:else}
                        {@render dashEmpty('Sin datos')}
                    {/each}
                </div>
            </Collapsible>
        </div>
    {:else}
        <Card class="p-2 border border-slate-200/50 bg-white/50 backdrop-blur-md rounded-2xl">
            <EmptyState
                icon={Users}
                title="Sin personal registrado"
                description="Registra a la primera persona para ver las métricas del dashboard."
            >
                <Button variant="primary" onclick={() => push('/personal')}>Ir a Personal</Button>
            </EmptyState>
        </Card>
    {/if}

    <!-- Filtros de crecimiento (móvil) -->
    <BottomSheet bind:isOpen={showGrowthSheet} title="Rango de fechas">
        <div class="flex flex-col gap-4">
            <div>
                <label
                    for="growth-start-m"
                    class="flex items-center gap-1 text-[11px] font-bold text-slate-500 mb-1"
                    ><Calendar size={12} /> Desde</label
                >
                <Input
                    id="growth-start-m"
                    type="date"
                    bind:value={personnelState.growthStartDate}
                    min={growth.minCreatedAt ?? undefined}
                    onchange={applyGrowthRange}
                />
            </div>
            <div>
                <label
                    for="growth-end-m"
                    class="flex items-center gap-1 text-[11px] font-bold text-slate-500 mb-1"
                    ><Calendar size={12} /> Hasta</label
                >
                <Input
                    id="growth-end-m"
                    type="date"
                    bind:value={personnelState.growthEndDate}
                    min={personnelState.growthStartDate || undefined}
                    onchange={applyGrowthRange}
                />
            </div>
            <Button variant="soft-slate" class="w-full" onclick={resetGrowthToCreation}>Desde creación</Button
            >
        </div>
    </BottomSheet>
</div>
