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

<div class="flex h-screen overflow-hidden bg-slate-50">
    <Sidebar items={sidebarItems} {user} {onLogout} />

    <div
        class="flex flex-1 flex-col overflow-hidden transition-all duration-300 lg:pl-64"
    >
        <Header>
            {#if headerTitle}
                {@render headerTitle()}
            {:else}
                {uiState.activePage}
            {/if}
        </Header>

        <main class="flex-1 overflow-y-auto p-6">
            {@render children?.()}
        </main>
    </div>
</div>
