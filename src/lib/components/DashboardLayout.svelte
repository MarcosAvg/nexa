<script lang="ts">
    import Sidebar from "./Sidebar.svelte";
    import { uiState } from "../stores";
    import { type Snippet, type Component } from "svelte";
    import { Menu } from "lucide-svelte";

    type SidebarItem = {
        label: string;
        href: string;
        icon?: any;
    };

    type Props = {
        sidebarItems: { label: string; href: string; icon?: any }[];
        user?: { name: string; email: string; avatar?: string };
        headerTitle?: Snippet;
        children?: Snippet;
        onLogout?: () => void;
    };

    let { sidebarItems, user, headerTitle, children, onLogout }: Props =
        $props();
</script>

<div
    class="flex h-screen overflow-hidden bg-[#f8fafc] bg-radial-[at_top_right,_var(--tw-gradient-stops)] from-blue-50/20 via-slate-50 to-slate-50"
>
    <Sidebar items={sidebarItems} {user} {onLogout} />

    <div
        class="flex flex-1 flex-col overflow-hidden transition-all duration-500 lg:pl-72"
    >
        <!-- Mobile toggle button (Visible only on mobile/tablet) -->
        <div
            class="lg:hidden sticky top-0 z-30 flex items-center h-14 px-4 bg-white/40 backdrop-blur-xl border-b border-slate-200/40"
        >
            <button
                class="flex items-center justify-center h-10 w-10 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all duration-300 active:scale-90"
                onclick={() => uiState.toggleSidebar()}
                aria-label="Toggle sidebar"
            >
                <Menu size={22} strokeWidth={2.5} />
            </button>
            <span
                class="ml-4 text-sm font-extrabold text-slate-900 tracking-tight"
                >{uiState.activePage}</span
            >
        </div>

        <main class="flex-1 overflow-y-auto p-6 lg:p-10">
            <div class="mx-auto max-w-[1600px] h-full space-y-8">
                {@render children?.()}
            </div>
        </main>
    </div>
</div>
