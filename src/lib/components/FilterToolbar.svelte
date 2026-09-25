<script lang="ts">
    import { type Snippet } from 'svelte';
    import { SlidersHorizontal, ChevronDown, ChevronUp, X, RotateCcw } from 'lucide-svelte';
    import { slide } from 'svelte/transition';

    /**
     * FilterToolbar — Barra de filtros con primarios visibles, resto en
     * "Más filtros" y chips de filtros activos con limpieza individual/total.
     *
     * Evita que la zona de filtros crezca sin medida al añadir filtros:
     * cada vista declara qué va en `primary` y qué en `overflow`.
     *
     * @example
     * <FilterToolbar chips={activeChips} onClearAll={clearFilters}>
     *     {#snippet primary()}<FilterSelect ... />{/snippet}
     *     {#snippet overflow()}<FilterSelect ... />{/snippet}
     * </FilterToolbar>
     */
    export type ActiveFilterChip = {
        /** Etiqueta del filtro (ej. "Edificio"). */
        label: string;
        /** Valor activo legible (ej. "Torre Administrativa"). */
        value: string;
        /** Limpia solo este filtro. */
        onClear: () => void;
    };

    type Props = {
        /** Filtros siempre visibles (primarios + buscador). */
        primary?: Snippet;
        /** Filtros secundarios tras "Más filtros". Omitir si no hay. */
        overflow?: Snippet;
        /** Chips de filtros activos. */
        chips?: ActiveFilterChip[];
        /** Limpia todos los filtros. */
        onClearAll?: () => void;
        /** Etiqueta del botón de overflow. @default "Más filtros" */
        overflowLabel?: string;
    };

    let { primary, overflow, chips = [], onClearAll, overflowLabel = 'Más filtros' }: Props = $props();

    let showMore = $state(false);
</script>

<div class="flex flex-col gap-3 w-full">
    <!-- Fila 1: primarios + acciones -->
    <div class="flex flex-col xl:flex-row flex-wrap gap-4 items-stretch xl:items-center w-full">
        {#if primary}
            {@render primary()}
        {/if}

        {#if overflow}
            <button
                type="button"
                class="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 shrink-0 {showMore
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'}"
                onclick={() => (showMore = !showMore)}
                aria-expanded={showMore}
            >
                <SlidersHorizontal size={14} strokeWidth={2.5} />
                {overflowLabel}
                {#if chips.length > 0}
                    <span
                        class="min-w-5 h-5 px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center {showMore
                            ? 'bg-white text-slate-900'
                            : 'bg-slate-900 text-white'}"
                    >
                        {chips.length}
                    </span>
                {/if}
                {#if showMore}
                    <ChevronUp size={14} />
                {:else}
                    <ChevronDown size={14} />
                {/if}
            </button>
        {/if}

        {#if chips.length > 0 && onClearAll}
            <button
                type="button"
                class="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all active:scale-95 shrink-0"
                onclick={onClearAll}
                title="Limpiar todos los filtros"
            >
                <RotateCcw size={14} />
                Limpiar
            </button>
        {/if}
    </div>

    <!-- Chips de filtros activos -->
    {#if chips.length > 0}
        <div class="flex flex-wrap gap-1.5">
            {#each chips as chip (chip.label)}
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold hover:bg-blue-100 transition-colors"
                    onclick={chip.onClear}
                    title="Quitar filtro {chip.label}"
                >
                    <span class="text-blue-400 font-extrabold uppercase tracking-wider text-[9px]"
                        >{chip.label}:</span
                    >
                    <span class="max-w-40 truncate">{chip.value}</span>
                    <X size={12} strokeWidth={3} />
                </button>
            {/each}
        </div>
    {/if}

    <!-- Panel overflow -->
    {#if overflow && showMore}
        <div
            class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/60"
            transition:slide={{ duration: 250 }}
        >
            {@render overflow()}
        </div>
    {/if}
</div>
