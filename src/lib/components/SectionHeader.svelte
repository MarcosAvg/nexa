<script lang="ts">
    import { type Snippet } from 'svelte';
    import { Search, Filter, MoreVertical } from 'lucide-svelte';
    import { uiState } from '../stores';
    import BottomSheet from './BottomSheet.svelte';

    /**
     * SectionHeader — Cabecera de vista unificada.
     *
     * En móvil (<lg) es una barra sticky edge-to-edge con título único y una
     * toolbar de iconos (buscar/filtros/acciones); filtros y acciones se abren
     * en bottom sheets. En desktop (lg+) mantiene el estilo de card con los
     * filtros y acciones inline.
     */
    type Props = {
        /** Título de la sección. */
        title: string;
        /** Snippet de filtros. */
        filters?: Snippet;
        /** Snippet de botones de acción. */
        actions?: Snippet;
        /** Contenido opcional renderizado junto al título (desktop). */
        titleExtra?: Snippet;
        /** Handler de búsqueda (por defecto abre el buscador global). */
        onSearch?: () => void;
        /** Número de filtros activos (indicador en móvil). */
        filtersCount?: number;
        /** Limpia todos los filtros. */
        onClearFilters?: () => void;
    };

    let { title, filters, actions, titleExtra, onSearch, filtersCount = 0, onClearFilters }: Props = $props();

    let showFilters = $state(false);
    let showActions = $state(false);

    const iconBtn = 'flex items-center justify-center h-9 w-9 rounded-xl transition-all active:scale-95';

    function handleSearch() {
        if (onSearch) onSearch();
        else uiState.openCommandPalette();
    }

    function toggleFilters() {
        showFilters = !showFilters;
        if (showFilters) showActions = false;
    }

    function toggleActions() {
        showActions = !showActions;
        if (showActions) showFilters = false;
    }
</script>

<div
    class="relative z-30 bg-white sticky top-0 border-b border-slate-200 shadow-sm
           -mx-4 px-4 py-2.5
           lg:static lg:mx-0 lg:bg-white/80 lg:backdrop-blur-md lg:p-7 lg:rounded-2xl lg:border lg:border-slate-200/50 lg:shadow-sm lg:transition-all lg:duration-300 lg:hover:shadow-md"
>
    <div class="flex flex-col gap-4 lg:gap-6">
        <!-- Fila de título + toolbar -->
        <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-3 min-w-0">
                <h2 class="text-base lg:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
                    {title}
                </h2>
                {#if titleExtra}
                    <div class="hidden md:block shrink-0">
                        {@render titleExtra()}
                    </div>
                {/if}
            </div>

            <!-- Toolbar móvil -->
            <div class="flex items-center gap-1 lg:hidden shrink-0">
                <button
                    type="button"
                    class="{iconBtn} text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    onclick={handleSearch}
                    aria-label="Buscar"
                >
                    <Search size={20} strokeWidth={2.5} />
                </button>

                {#if filters}
                    <button
                        type="button"
                        class="{iconBtn} {showFilters
                            ? 'bg-slate-900 text-white shadow-lg'
                            : 'bg-slate-100 text-slate-600'}"
                        onclick={toggleFilters}
                        aria-label="Filtros"
                        aria-expanded={showFilters}
                    >
                        <span class="relative">
                            <Filter size={18} strokeWidth={2.5} />
                            {#if filtersCount > 0 && !showFilters}
                                <span
                                    class="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-extrabold flex items-center justify-center"
                                    >{filtersCount}</span
                                >
                            {/if}
                        </span>
                    </button>
                {/if}

                {#if actions}
                    <button
                        type="button"
                        class="{iconBtn} {showActions
                            ? 'bg-slate-900 text-white shadow-lg'
                            : 'bg-slate-100 text-slate-600'}"
                        onclick={toggleActions}
                        aria-label="Acciones"
                        aria-expanded={showActions}
                    >
                        <MoreVertical size={18} strokeWidth={2.5} />
                    </button>
                {/if}
            </div>

            <!-- Acciones desktop -->
            {#if actions}
                <div class="hidden lg:flex items-center gap-3 shrink-0">
                    {@render actions()}
                </div>
            {/if}
        </div>

        <!-- titleExtra en móvil -->
        {#if titleExtra}
            <div class="md:hidden -mt-1">
                {@render titleExtra()}
            </div>
        {/if}

        <!-- Indicador de filtros activos (móvil) -->
        {#if filtersCount > 0 && onClearFilters}
            <button
                type="button"
                class="lg:hidden self-start flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold active:scale-95 transition-all"
                onclick={onClearFilters}
            >
                <Filter size={12} strokeWidth={2.5} />
                {filtersCount} filtro{filtersCount !== 1 ? 's' : ''} · Limpiar
            </button>
        {/if}

        <!-- Filtros desktop (inline) -->
        {#if filters}
            <div
                class="hidden lg:flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-4 sm:gap-5 pt-4 sm:pt-5 border-t border-slate-100/60 md:pt-0 md:border-t-0"
            >
                {@render filters()}
            </div>
        {/if}
    </div>
</div>

<!-- Sheets móviles -->
{#if filters}
    <BottomSheet bind:isOpen={showFilters} title="Filtros">
        <div class="flex flex-col gap-4">{@render filters()}</div>
    </BottomSheet>
{/if}

{#if actions}
    <BottomSheet bind:isOpen={showActions} title="Acciones">
        <div class="flex flex-col gap-2.5 [&>*]:w-full [&>*]:justify-center">
            {@render actions()}
        </div>
    </BottomSheet>
{/if}
