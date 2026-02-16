<script lang="ts">
    import Sidebar from "./Sidebar.svelte";
    import Header from "./Header.svelte";
    import { uiState } from "../stores";
    import { type Snippet, type Component } from "svelte";

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
        <Header>
            {#if headerTitle}
                {@render headerTitle()}
            {:else}
                <span class="tracking-tight">{uiState.activePage}</span>
            {/if}
        </Header>

        <main class="flex-1 overflow-y-auto p-6 lg:p-10">
            <div class="mx-auto max-w-[1600px] h-full space-y-8">
                {@render children?.()}
            </div>
        </main>
    </div>
</div>
