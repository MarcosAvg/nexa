<script lang="ts">
    import Input from "./Input.svelte";
    import Button from "./Button.svelte";
    import { appState } from "../state.svelte";
    import { type Snippet } from "svelte";

    type Props = {
        children?: Snippet; // For title
        actions?: Snippet; // For extra actions
    };

    let { children, actions }: Props = $props();
</script>

<header
    class="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/60 bg-white/80 px-6 backdrop-blur-md transition-all"
>
    <div class="flex items-center gap-4">
        <!-- Mobile toggle button -->
        <button
            class="text-slate-500 hover:text-slate-700 lg:hidden transition-colors"
            onclick={() => appState.toggleSidebar()}
            aria-label="Toggle sidebar"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="lucide lucide-menu"
                ><line x1="4" x2="20" y1="12" y2="12" /><line
                    x1="4"
                    x2="20"
                    y1="6"
                    y2="6"
                /><line x1="4" x2="20" y1="18" y2="18" /></svg
            >
        </button>

        <h1 class="text-xl font-semibold text-slate-800 tracking-tight">
            {@render children?.()}
        </h1>
    </div>

    <div class="flex items-center gap-4">
        <div class="hidden w-64 sm:block">
            <Input
                placeholder="Search..."
                class="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
            />
        </div>

        {#if actions}
            {@render actions()}
        {/if}
    </div>
</header>
