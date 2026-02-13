<script lang="ts">
    import { appState } from "../state.svelte";
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
    class="fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col bg-slate-950 text-slate-300 transition-transform duration-300 ease-in-out lg:translate-x-0 {appState.isSidebarOpen
        ? 'translate-x-0'
        : '-translate-x-full'} shadow-xl"
>
    <div
        class="flex h-16 items-center flex-shrink-0 px-6 border-b border-slate-800/50"
    >
        <Logo showText={true} class="text-white" />
    </div>

    <nav class="flex-1 overflow-y-auto p-4 space-y-1">
        {#each items as item}
            <a
                href={item.href}
                class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 {appState.activePage ===
                item.label
                    ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-800'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-white'}"
                onclick={(e) => {
                    e.preventDefault();
                    appState.setActivePage(item.label);
                    // On mobile, close sidebar after selection
                    if (window.innerWidth < 1024) {
                        appState.toggleSidebar();
                    }
                }}
            >
                {#if item.icon}
                    <item.icon size={18} />
                {/if}
                {item.label}
            </a>
        {/each}
    </nav>

    {#if user}
        <div class="mt-auto border-t border-slate-800/50 p-4">
            <div
                class="flex items-center gap-3 rounded-lg bg-slate-900/40 p-3 ring-1 ring-slate-800"
            >
                <div
                    class="h-9 w-9 flex-shrink-0 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-medium overflow-hidden border border-slate-700"
                >
                    {#if user.avatar}
                        <img
                            src={user.avatar}
                            alt={user.name}
                            class="h-full w-full object-cover"
                        />
                    {:else}
                        {user.name.charAt(0)}
                    {/if}
                </div>
                <div class="flex flex-col min-w-0 flex-1">
                    <span class="truncate text-sm font-semibold text-white"
                        >{user.name}</span
                    >
                    <span class="truncate text-xs text-slate-500"
                        >{user.email}</span
                    >
                </div>
                {#if onLogout}
                    <button
                        onclick={onLogout}
                        class="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Cerrar sesión"
                    >
                        <LogOut size={18} />
                    </button>
                {/if}
            </div>
        </div>
    {/if}
</aside>

<!-- Mobile overlay -->
{#if appState.isSidebarOpen}
    <div
        class="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
        onclick={() => appState.toggleSidebar()}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === "Escape" && appState.toggleSidebar()}
    ></div>
{/if}
