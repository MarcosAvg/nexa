<script lang="ts">
    import { type Snippet, type Component } from "svelte";
    import { FilterX } from "lucide-svelte";

    type Props = {
        icon?: Component;
        iconBgClass?: string;
        title: string;
        titleFiltered?: string;
        description: string;
        descriptionFiltered?: string;
        hasFilters?: boolean;
        onClearFilters?: () => void;
        children?: Snippet;
    };

    let {
        icon: Icon,
        iconBgClass = "from-slate-100 to-slate-200",
        title,
        titleFiltered,
        description,
        descriptionFiltered,
        hasFilters = false,
        onClearFilters,
        children,
    }: Props = $props();

    let displayTitle = $derived(hasFilters ? (titleFiltered ?? title) : title);
    let displayDescription = $derived(hasFilters ? (descriptionFiltered ?? description) : description);
</script>

<div class="flex flex-col items-center justify-center py-20 px-8">
    {#if Icon}
        <div class="w-20 h-20 rounded-[28px] bg-gradient-to-br {iconBgClass} flex items-center justify-center mb-6 shadow-inner">
            <Icon size={40} strokeWidth={1.5} />
        </div>
    {/if}

    <h3 class="text-xl font-black text-slate-900 tracking-tight mb-2">
        {displayTitle}
    </h3>

    <p class="text-sm font-medium text-slate-400 text-center max-w-sm mb-8">
        {displayDescription}
    </p>

    {#if hasFilters && onClearFilters}
        <button
            type="button"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-100 text-slate-700 text-[13px] font-extrabold hover:bg-slate-200 transition-all active:scale-95"
            onclick={onClearFilters}
        >
            <FilterX size={16} strokeWidth={2.5} />
            Limpiar filtros
        </button>
    {:else if children}
        {@render children()}
    {/if}
</div>
