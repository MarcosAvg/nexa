<script lang="ts">
    import Sidebar from './Sidebar.svelte';
    import BottomNav from './BottomNav.svelte';
    import { uiState, pullRefresh } from '../stores';
    import { type Snippet, type Component } from 'svelte';
    import { Loader2 } from 'lucide-svelte';

    type SidebarItem = {
        label: string;
        href: string;
        icon?: any;
    };

    /**
     * DashboardLayout — Layout principal de la app: Sidebar + main + BottomNav.
     *
     * @example
     * <DashboardLayout sidebarItems={items} user={user} onLogout={handleLogout}>
     *     <Router {routes} />
     * </DashboardLayout>
     */
    type Props = {
        /** Items de navegación del sidebar. */
        sidebarItems: { label: string; href: string; icon?: any }[];
        /** Usuario actual (nombre, email, avatar). */
        user?: { name: string; email: string; avatar?: string };
        /** Título opcional del header. */
        headerTitle?: Snippet;
        /** Contenido principal (router outlet). */
        children?: Snippet;
        /** Handler de cierre de sesión. */
        onLogout?: () => void;
    };

    let { sidebarItems, user, headerTitle, children, onLogout }: Props = $props();

    // ─── Pull to refresh (móvil) ────────────────────────────────────────
    let mainEl = $state<HTMLElement | null>(null);
    let pullDistance = $state(0);
    let touching = false;
    let startY = 0;

    function onTouchStart(e: TouchEvent) {
        if (pullRefresh.isRefreshing) return;
        const el = mainEl;
        if (!el || el.scrollTop > 0 || e.touches.length !== 1) return;
        touching = true;
        startY = e.touches[0].clientY;
    }

    function onTouchMove(e: TouchEvent) {
        if (!touching) return;
        const el = mainEl;
        if (!el || e.touches.length !== 1) return;
        const dy = e.touches[0].clientY - startY;
        pullDistance = dy > 0 && el.scrollTop <= 0 ? Math.min(90, dy * 0.5) : 0;
    }

    async function onTouchEnd() {
        if (!touching) return;
        touching = false;
        const shouldRefresh = pullDistance >= 55;
        pullDistance = 0;
        if (shouldRefresh) await pullRefresh.trigger();
    }
</script>

<div
    class="flex h-dvh overflow-hidden bg-[#f8fafc] bg-radial-[at_top_right,_var(--tw-gradient-stops)] from-blue-50/20 via-slate-50 to-slate-50"
>
    <Sidebar items={sidebarItems} {user} {onLogout} />

    <div
        class="flex flex-1 flex-col overflow-hidden transition-all duration-300 {uiState.isSidebarCondensed
            ? 'lg:pl-20'
            : 'lg:pl-72'}"
    >
        <!-- Área segura WCO/notch para móvil -->
        <div
            class="lg:hidden flex-shrink-0"
            style="height: max(env(titlebar-area-height, 0px), env(safe-area-inset-top, 0px)); -webkit-app-region: drag;"
        ></div>

        <!-- Región de arrastre para escritorio (invisible pero funcional para WCO) -->
        <div
            class="hidden lg:block sticky top-0 z-40 w-full flex-shrink-0"
            style="height: env(titlebar-area-height, 0px); -webkit-app-region: drag;"
        ></div>

        <main
            id="main"
            bind:this={mainEl}
            tabindex="-1"
            class="flex-1 overflow-y-auto px-4 pt-0 pb-[calc(6rem_+_env(safe-area-inset-bottom,0px))] lg:p-10 lg:pb-10 focus:outline-none"
            ontouchstart={onTouchStart}
            ontouchmove={onTouchMove}
            ontouchend={onTouchEnd}
            ontouchcancel={onTouchEnd}
        >
            <!-- Indicador de pull-to-refresh (móvil) -->
            <div
                class="lg:hidden flex items-center justify-center overflow-hidden text-slate-400 transition-[height] duration-150"
                style="height: {pullRefresh.isRefreshing ? 36 : pullDistance}px;"
            >
                <Loader2
                    size={18}
                    class={pullRefresh.isRefreshing ? 'animate-spin' : ''}
                    style="opacity: {pullDistance > 10 || pullRefresh.isRefreshing
                        ? 1
                        : 0}; transform: rotate({Math.min(360, pullDistance * 4)}deg);"
                />
            </div>
            <div class="mx-auto max-w-[1600px] space-y-8">
                {@render children?.()}
            </div>
        </main>
    </div>

    <!-- Navegación inferior para móvil -->
    <BottomNav items={sidebarItems} />
</div>
