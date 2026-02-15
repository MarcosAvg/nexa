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
    class="fixed inset-y-0 left-0 z-50 flex h-full w-66 flex-col bg-slate-950 text-slate-300 transition-transform duration-300 ease-in-out lg:translate-x-0 {uiState.isSidebarOpen
        ? 'translate-x-0'
        : '-translate-x-full'} border-r border-slate-800/40 shadow-2xl"
>
    <!-- Header/Logo Area -->
    <div class="flex h-20 items-center flex-shrink-0 px-7 mb-2">
        <Logo showText={true} class="text-white scale-110 origin-left" />
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 custom-scrollbar">
        <div class="px-3 mb-4">
            <p
                class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500/80"
            >
                Menú Principal
            </p>
        </div>

        {#each items as item}
            <a
                href={item.href}
                use:link
                use:active={{
                    className:
                        "bg-blue-600/10 text-blue-400 ring-1 ring-blue-500/20 active-nav-item",
                }}
                class="group relative flex items-center gap-3.5 rounded-xl px-4 py-3 text-[13.5px] font-medium transition-all duration-300 text-slate-400/90 hover:bg-slate-900/60 hover:text-white"
                onclick={() => {
                    if (window.innerWidth < 1024) {
                        uiState.toggleSidebar();
                    }
                }}
            >
                <!-- Active Accent (Left) -->
                <div
                    class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full transition-all duration-300 scale-y-0 group-[.active-nav-item]:scale-y-100 opacity-0 group-[.active-nav-item]:opacity-100 shadow-[0_0_12px_rgba(59,130,246,0.5)]"
                ></div>

                {#if item.icon}
                    <div
                        class="text-slate-500 group-hover:text-white group-[.active-nav-item]:text-blue-400 transition-colors duration-300"
                    >
                        <item.icon size={19} strokeWidth={2.2} />
                    </div>
                {/if}
                <span class="relative">
                    {item.label}
                </span>
            </a>
        {/each}
    </nav>

    <!-- Footer / User Profile -->
    {#if user}
        <div class="mt-auto p-4">
            <div
                class="flex items-center gap-3.5 rounded-2xl bg-slate-900/30 p-4 border border-slate-800/40 backdrop-blur-sm shadow-inner group transition-all duration-300 hover:border-slate-700/60"
            >
                <div
                    class="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-bold overflow-hidden border-2 border-slate-800 ring-1 ring-white/5 shadow-lg group-hover:ring-blue-500/30 transition-all duration-300"
                >
                    {#if user.avatar}
                        <img
                            src={user.avatar}
                            alt={user.name}
                            class="h-full w-full object-cover"
                        />
                    {:else}
                        <span class="text-sm tracking-tight"
                            >{user.name.charAt(0).toUpperCase()}</span
                        >
                    {/if}
                </div>

                <div class="flex flex-col min-w-0 flex-1">
                    <span
                        class="truncate text-[13px] font-bold text-slate-100 tracking-tight"
                        >{user.name}</span
                    >
                    <span
                        class="truncate text-[11px] font-medium text-slate-500"
                        >{user.email}</span
                    >
                </div>

                {#if onLogout}
                    <button
                        onclick={onLogout}
                        class="p-2.5 text-slate-500 hover:text-white hover:bg-rose-500/10 hover:border hover:border-rose-500/20 rounded-xl transition-all duration-300 group/logout"
                        title="Cerrar sesión"
                    >
                        <LogOut
                            size={18}
                            class="group-hover/logout:scale-110 transition-transform"
                        />
                    </button>
                {/if}
            </div>

            <p
                class="text-[10px] text-center text-slate-600 mt-4 px-2 tracking-wide font-medium"
            >
                Nexa Access Control &copy; 2024
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
