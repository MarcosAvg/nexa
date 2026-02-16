<script lang="ts">
    import { uiState } from "../stores";
    import { type Snippet } from "svelte";
    import { Menu } from "lucide-svelte";

    type Props = {
        children?: Snippet; // For title
        actions?: Snippet; // For extra actions
    };

    let { children, actions }: Props = $props();
</script>

<header
    class="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-slate-200/40 bg-white/40 px-8 backdrop-blur-xl transition-all"
>
    <div class="flex items-center gap-4">
        <!-- Mobile toggle button -->
        <button
            class="flex items-center justify-center h-10 w-10 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl lg:hidden transition-all duration-300 active:scale-90"
            onclick={() => uiState.toggleSidebar()}
            aria-label="Toggle sidebar"
        >
            <Menu size={22} strokeWidth={2.5} />
        </button>

        <h1 class="text-[17px] font-extrabold text-slate-900 tracking-tight">
            {@render children?.()}
        </h1>
    </div>

    <div class="flex items-center gap-4">
        {#if actions}
            {@render actions()}
        {/if}
    </div>
</header>
