<script lang="ts">
    import { link } from "svelte-spa-router";
    import active from "svelte-spa-router/active";
    import { uiState } from "../stores/ui.svelte"; // Correct path to store
    import Logo from "./Logo.svelte";
    import { LogOut } from "lucide-svelte";

    type Props = {
        items: { label: string; href: string; icon?: any }[];
        user?: { name: string; email: string; avatar?: string };
        onLogout?: () => void;
    };

    let { items, user, onLogout }: Props = $props();
</script>

<aside
    class="fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col bg-slate-950 text-slate-300 transition-transform duration-300 ease-in-out lg:translate-x-0 {uiState.isSidebarOpen
        ? 'translate-x-0'
        : '-translate-x-full'} border-r border-white/5 shadow-[20px_0_50px_rgba(0,0,0,0.3)]"
>
    <!-- Background Decor -->
    <div
        class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_50%)] pointer-events-none"
    ></div>

    <!-- Header/Logo Area -->
    <div class="flex h-24 items-center flex-shrink-0 px-8 mb-4 relative">
        <Logo showText={true} class="scale-110 origin-left" />
    </div>

    <!-- Navigation -->
    <nav
        class="flex-1 overflow-y-auto px-5 py-2 space-y-2 custom-scrollbar relative"
    >
        <div class="px-4 mb-5 flex items-center gap-3">
            <p
                class="text-[10px] font-extrabold uppercase tracking-[0.25em] text-slate-500/70"
            >
                Menú Principal
            </p>
            <div class="h-px flex-1 bg-slate-800/40"></div>
        </div>

        {#each items as item}
            <a
                href={item.href}
                use:link
                use:active={{
                    className:
                        "bg-white/[0.03] text-white ring-1 ring-white/10 active-nav-item shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]",
                }}
                class="group relative flex items-center gap-4 rounded-2xl px-5 py-3.5 text-[13.5px] font-extrabold transition-all duration-300 text-slate-400 hover:bg-white/[0.02] hover:text-white tracking-tight"
                onclick={() => {
                    if (window.innerWidth < 1024) {
                        uiState.toggleSidebar();
                    }
                }}
            >
                <!-- Active Accent Glow (Left) -->
                <div
                    class="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-blue-500 rounded-r-full transition-all duration-500 scale-y-0 group-[.active-nav-item]:scale-y-100 opacity-0 group-[.active-nav-item]:opacity-100 shadow-[0_0_20px_rgba(59,130,246,0.8)]"
                ></div>

                {#if item.icon}
                    <div
                        class="text-slate-500 group-hover:text-slate-200 group-[.active-nav-item]:text-blue-400 transition-all duration-300 group-[.active-nav-item]:scale-110"
                    >
                        <item.icon size={20} strokeWidth={2.4} />
                    </div>
                {/if}
                <span
                    class="relative group-[.active-nav-item]:translate-x-0.5 transition-transform duration-300"
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
            </a>
        {/each}
    </nav>

    <!-- Footer / User Profile -->
    {#if user}
        <div class="mt-auto p-5 relative border-t border-white/5">
            <div
                class="flex items-center gap-3.5 rounded-[22px] bg-gradient-to-b from-slate-900/50 to-slate-950/50 p-4 border border-white/5 backdrop-blur-md shadow-2xl group transition-all duration-300 hover:border-blue-500/30 hover:shadow-blue-500/5"
            >
                <div
                    class="h-11 w-11 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-extrabold overflow-hidden border-2 border-slate-800 ring-2 ring-white/5 shadow-xl group-hover:scale-105 transition-all duration-300"
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

                <div class="flex flex-col min-w-0 flex-1">
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
                        class="p-2.5 text-slate-500 hover:text-white hover:bg-rose-500/20 rounded-xl transition-all duration-300 group/logout border border-transparent hover:border-rose-500/30"
                        title="Cerrar sesión"
                    >
                        <LogOut
                            size={19}
                            strokeWidth={2.5}
                            class="group-hover/logout:scale-110 group-hover/logout:rotate-12 transition-all"
                        />
                    </button>
                {/if}
            </div>

            <p
                class="text-[10px] text-center text-slate-600 mt-5 px-2 tracking-[0.1em] font-extrabold uppercase opacity-60"
            >
                Nexa Access &copy; 2024
            </p>
        </div>
    {/if}
</aside>

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
