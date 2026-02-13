<script lang="ts">
    import { type Snippet } from "svelte";
    import { Search } from "lucide-svelte";

    type Props = {
        title: string;
        filters?: Snippet;
        actions?: Snippet;
        onSearch?: () => void;
    };

    let { title, filters, actions, onSearch }: Props = $props();
</script>

<div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
    <div class="flex flex-col gap-4">
        <!-- Title row with search and actions -->
        <div class="flex items-center justify-between gap-3">
            <h2 class="text-lg md:text-xl font-bold text-slate-900 truncate">
                {title}
            </h2>
            <div class="flex items-center gap-2 shrink-0">
                <!-- Mobile search button -->
                {#if onSearch}
                    <button
                        type="button"
                        class="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        onclick={onSearch}
                        aria-label="Buscar"
                    >
                        <Search size={20} />
                    </button>
                {/if}
                {#if actions}
                    {@render actions()}
                {/if}
            </div>
        </div>

        <!-- Filters -->
        {#if filters}
            <div
                class="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 pt-3 border-t border-slate-100 md:pt-0 md:border-t-0"
            >
                {@render filters()}
            </div>
        {/if}
    </div>
</div>
