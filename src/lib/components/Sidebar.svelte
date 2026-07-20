<script lang="ts">
    import { link } from "svelte-spa-router";
    import active from "svelte-spa-router/active";
    import { uiState } from "../stores/ui.svelte"; // Ruta correcta al store
    import { userState } from "../stores";
    import { versionState } from "../stores/version.svelte";
    import Modal from "./Modal.svelte";
    import Logo from "./Logo.svelte";
    import { LogOut, ChevronLeft, ChevronRight, Wrench, RefreshCcw, CheckCircle2, RotateCcw } from "lucide-svelte";

    /**
     * Sidebar — Navegación lateral con modo expandido/condensado.
     *
     * @example
     * <Sidebar items={navItems} user={currentUser} onLogout={handleLogout} />
     */
    type Props = {
        /** Items de navegación (label, href, icon). */
        items: { label: string; href: string; icon?: any }[];
        /** Usuario actual (nombre, email, avatar). */
        user?: { name: string; email: string; avatar?: string };
        /** Handler de cierre de sesión. */
        onLogout?: () => void;
    };

    let { items, user, onLogout }: Props = $props();

    let isUpdateModalOpen = $state(false);

    // Abrir el modal automáticamente cuando se detecte una actualización,
    // a menos que el usuario ya haya descartado esta versión específica.
    $effect(() => {
        if (versionState.isUpdateAvailable && !versionState.dismissedBuildTime) {
            isUpdateModalOpen = true;
        }
    });
</script>

<aside
    class="fixed inset-y-0 left-0 z-50 flex h-full {uiState.isSidebarCondensed ? 'w-20' : 'w-72'} flex-col bg-slate-950 text-slate-300 transition-all duration-300 ease-in-out lg:translate-x-0 {uiState.isSidebarOpen
        ? 'translate-x-0'
        : '-translate-x-full'} border-r border-white/5"
>
    <!-- Background Decor -->
    <div
        class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_50%)] pointer-events-none"
    ></div>

    <!-- Header/Logo Area -->
    <div
        class="flex h-24 items-center flex-shrink-0 {uiState.isSidebarCondensed ? 'justify-center px-0' : 'px-8 justify-between'} mb-4 relative transition-all duration-300"
        style="padding-top: env(titlebar-area-height, 0px); -webkit-app-region: drag;"
    >
        <div style="-webkit-app-region: no-drag;" class="flex items-center gap-2">
            <Logo showText={!uiState.isSidebarCondensed} class="{uiState.isSidebarCondensed ? 'scale-125' : 'scale-110 origin-left'} transition-all" />
        </div>
        
        <div style="-webkit-app-region: no-drag;">
            <button
                class="hidden lg:flex items-center justify-center {uiState.isSidebarCondensed ? 'absolute -right-3 top-10 h-6 w-6 bg-slate-800 border border-slate-700 rounded-full z-50 text-slate-400 hover:text-white hover:bg-slate-700' : 'p-2 text-slate-500 hover:text-white rounded-lg hover:bg-white/5'} transition-all duration-300"
                onclick={() => uiState.toggleSidebarCondensed()}
                title={uiState.isSidebarCondensed ? 'Expandir menú' : 'Colapsar menú'}
            >
                {#if uiState.isSidebarCondensed}
                    <ChevronRight size={14} strokeWidth={3} />
                {:else}
                    <ChevronLeft size={20} strokeWidth={2.5} />
                {/if}
            </button>
        </div>
    </div>

    <!-- Navigation -->
    <nav
        class="flex-1 overflow-y-auto px-5 py-2 space-y-2 custom-scrollbar relative"
    >
        {#if !uiState.isSidebarCondensed}
            <div class="px-4 mb-5 flex items-center gap-3 transition-opacity duration-300">
                <p class="text-[10px] font-extrabold uppercase tracking-[0.25em] text-slate-500/70 whitespace-nowrap">
                    Menú Principal
                </p>
                <div class="h-px flex-1 bg-slate-800/40"></div>
            </div>
        {/if}

        {#each items as item}
            <a
                href={item.href}
                use:link
                use:active={{
                    className:
                        "bg-white/[0.03] text-white ring-1 ring-white/10 active-nav-item shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]",
                }}
                class="group relative flex items-center gap-4 rounded-2xl {uiState.isSidebarCondensed ? 'px-0 justify-center w-12 mx-auto' : 'px-5'} py-3.5 text-[13.5px] font-extrabold transition-all duration-300 text-slate-400 hover:bg-white/[0.02] hover:text-white tracking-tight"
                title={uiState.isSidebarCondensed ? item.label : undefined}
                onclick={() => {
                    if (window.innerWidth < 1024) {
                        uiState.toggleSidebar();
                    }
                }}
            >
                <!-- Active Accent Glow (Left) -->
                <div
                    class="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-blue-500 {uiState.isSidebarCondensed ? 'rounded-full -ml-3' : 'rounded-r-full'} transition-all duration-500 scale-y-0 group-[.active-nav-item]:scale-y-100 opacity-0 group-[.active-nav-item]:opacity-100 shadow-[0_0_20px_rgba(59,130,246,0.8)]"
                ></div>

                {#if item.icon}
                    <div
                        class="text-slate-500 group-hover:text-slate-200 group-[.active-nav-item]:text-blue-400 transition-all duration-300 group-[.active-nav-item]:scale-110"
                    >
                        <item.icon size={22} strokeWidth={2.4} />
                    </div>
                {/if}
                
                {#if !uiState.isSidebarCondensed}
                    <span
                        class="relative group-[.active-nav-item]:translate-x-0.5 transition-transform duration-300 whitespace-nowrap"
                    >
                        {item.label}
                    </span>

                    <!-- Active Indicator Dot (Right) -->
                    <div
                        class="ml-auto opacity-0 group-[.active-nav-item]:opacity-100 transition-opacity"
                    >
                        <div
                            class="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                        ></div>
                    </div>
                {/if}
            </a>
        {/each}
    </nav>

    <!-- Footer / User Profile -->
    {#if user}
        <div class="mt-auto {uiState.isSidebarCondensed ? 'p-3' : 'p-5'} relative border-t border-white/5 transition-all duration-300">
            {#if userState.profile?.role === "admin"}
                <button
                    onclick={() => uiState.toggleDirectEditMode()}
                    class="w-full flex items-center {uiState.isSidebarCondensed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 mb-3 rounded-xl transition-all duration-300 border {uiState.isDirectEditMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[inset_0_0_12px_rgba(245,158,11,0.2)]' : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'}"
                    title={uiState.isSidebarCondensed ? (uiState.isDirectEditMode ? 'Modo Edición Directa: ACTIVO' : 'Modo Edición Directa: INACTIVO') : undefined}
                >
                    <Wrench size={16} strokeWidth={2.5} class="{uiState.isDirectEditMode ? 'animate-pulse' : ''}" />
                    {#if !uiState.isSidebarCondensed}
                        <span class="text-[11px] font-extrabold tracking-wider uppercase">Editor Directo</span>
                        <div class="ml-auto flex items-center justify-center">
                            <div class="w-8 h-4 rounded-full transition-colors duration-300 relative {uiState.isDirectEditMode ? 'bg-amber-500' : 'bg-slate-700'}">
                                <div class="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-300 {uiState.isDirectEditMode ? 'translate-x-[18px]' : 'translate-x-[2px]'}"></div>
                            </div>
                        </div>
                    {/if}
                </button>
            {/if}
            <div
                class="flex items-center {uiState.isSidebarCondensed ? 'justify-center p-2' : 'gap-3.5 p-4'} rounded-[22px] bg-gradient-to-b from-slate-900/50 to-slate-950/50 border border-white/5 backdrop-blur-md shadow-2xl group transition-all duration-300 hover:border-blue-500/30 hover:shadow-blue-500/5"
            >
                <div
                    class="h-11 w-11 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-extrabold overflow-hidden border-2 border-slate-800 ring-2 ring-white/5 shadow-xl group-hover:scale-105 transition-all duration-300"
                    title={uiState.isSidebarCondensed ? `${user.name}\n${user.email}` : undefined}
                >
                    {#if user.avatar}
                        <img
                            src={user.avatar}
                            alt={user.name}
                            class="h-full w-full object-cover"
                        />
                    {:else}
                        <span class="text-sm tracking-tighter"
                            >{user.name.charAt(0).toUpperCase()}</span
                        >
                    {/if}
                </div>

                {#if !uiState.isSidebarCondensed}
                    <div class="flex flex-col min-w-0 flex-1 transition-opacity duration-300">
                        <span
                            class="truncate text-[13.5px] font-extrabold text-white tracking-tight"
                            >{user.name}</span
                        >
                        <span
                            class="truncate text-[11px] font-bold text-slate-500 tracking-tight"
                            >{user.email}</span
                        >
                    </div>

                    {#if onLogout}
                        <button
                            onclick={onLogout}
                            class="p-2.5 text-slate-500 hover:text-white hover:bg-rose-500/20 rounded-xl transition-all duration-300 group/logout border border-transparent hover:border-rose-500/30 shrink-0"
                            title="Cerrar sesión"
                        >
                            <LogOut
                                size={19}
                                strokeWidth={2.5}
                                class="group-hover/logout:scale-110 group-hover/logout:rotate-12 transition-all"
                            />
                        </button>
                    {/if}
                {/if}
            </div>

            {#if !uiState.isSidebarCondensed}
                <div class="mt-5 space-y-2">
                    {#if versionState.hasChecked}
                        {#if versionState.isUpdateAvailable}
                            <button
                                class="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-extrabold tracking-wide hover:bg-emerald-500/20 transition-all animate-pulse group"
                                onclick={() => isUpdateModalOpen = true}
                                title="Nueva versión disponible"
                            >
                                <RefreshCcw size={13} strokeWidth={2.5} class="group-hover:rotate-180 transition-transform duration-500" />
                                <span>Actualización disponible</span>
                            </button>
                        {:else}
                            <div
                                class="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-emerald-400/70 text-[11px] font-extrabold tracking-wide"
                            >
                                <CheckCircle2 size={12} strokeWidth={2.5} />
                                <span>Al día</span>
                                {#if versionState.formattedBuildTime}
                                    <span class="text-[9px] font-medium text-emerald-400/40 ml-auto">{versionState.formattedBuildTime}</span>
                                {/if}
                            </div>
                        {/if}
                    {:else}
                        <div
                            class="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800/30 border border-slate-700/30 text-slate-500 text-[11px] font-extrabold tracking-wide"
                        >
                            <div class="w-3 h-3 rounded-full border-2 border-slate-500 border-t-transparent animate-spin"></div>
                            <span>Verificando...</span>
                        </div>
                    {/if}
                    <p
                        class="text-[10px] text-center text-slate-600 px-2 tracking-[0.1em] font-extrabold uppercase opacity-60 whitespace-nowrap transition-opacity duration-300"
                    >
                        Nexa Access &copy; 2026
                    </p>
                </div>
            {/if}
        </div>
    {/if}
</aside>

<!-- Modal de actualización -->
{#if !uiState.isSidebarCondensed}
    <Modal
        bind:isOpen={isUpdateModalOpen}
        title="Nueva versión disponible"
        description="Se ha detectado una versión más reciente de Nexa Access. Recarga la aplicación para obtener los últimos cambios."
        size="sm"
    >
        <div class="flex flex-col items-center text-center gap-4 py-2">
            <div class="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <RefreshCcw size={28} strokeWidth={2} class="text-emerald-600" />
            </div>
            <div class="space-y-1">
                <p class="text-sm text-slate-600">
                    Versión actual:
                    <span class="font-bold text-slate-800">{versionState.formattedBuildTime ?? '—'}</span>
                </p>
                <p class="text-sm text-slate-500">
                    La recarga tomará solo unos segundos.
                </p>
            </div>
        </div>
        {#snippet footer()}
            <button
                class="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all active:scale-95"
                onclick={() => {
                    versionState.dismissUpdate();
                    isUpdateModalOpen = false;
                }}
            >
                Después
            </button>
            <button
                class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/20"
                onclick={() => versionState.refreshPage()}
            >
                <RotateCcw size={16} strokeWidth={2.5} />
                Recargar ahora
            </button>
        {/snippet}
    </Modal>
{/if}

<!-- Mobile overlay -->
{#if uiState.isSidebarOpen}
    <div
        class="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
        onclick={() => uiState.toggleSidebar()}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === "Escape" && uiState.toggleSidebar()}
    ></div>
{/if}

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #1e293b;
        border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #334155;
    }
</style>
