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

<div
    class="bg-white/80 backdrop-blur-md p-6 lg:p-7 rounded-[22px] border border-slate-200/50 shadow-sm transition-all duration-300 hover:shadow-md"
>
    <div class="flex flex-col gap-6">
        <!-- Title row with search and actions -->
        <div class="flex items-center justify-between gap-4">
            <h2
                class="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight truncate"
            >
                {title}
            </h2>
            <div class="flex items-center gap-3 shrink-0">
                <!-- Mobile search button -->
                {#if onSearch}
                    <button
                        type="button"
                        class="md:hidden p-2.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 active:scale-95 transition-all duration-200"
                        onclick={onSearch}
                        aria-label="Buscar"
                    >
                        <Search size={22} strokeWidth={2.5} />
                    </button>
                {/if}
                {#if actions}
                    <div class="flex items-center gap-2">
                        {@render actions()}
                    </div>
                {/if}
            </div>
        </div>

        <!-- Filters -->
        {#if filters}
            <div
                class="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-5 pt-5 border-t border-slate-100/60 md:pt-0 md:border-t-0"
            >
                {@render filters()}
            </div>
        {/if}
    </div>
</div>
