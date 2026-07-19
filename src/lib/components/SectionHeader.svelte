<script lang="ts">
    import { type Snippet } from "svelte";
    import { Search, Filter, ChevronDown, ChevronUp, MoreVertical } from "lucide-svelte";
    import { slide } from "svelte/transition";

    type Props = {
        title: string;
        filters?: Snippet;
        actions?: Snippet;
        onSearch?: () => void;
    };

    let {
        /** Título de la sección. */
        title,
        /** Snippet de filtros (se colapsan en móvil). */
        filters,
        /** Snippet de botones de acción. */
        actions,
        /** Handler de búsqueda (deprecado, usa filters en su lugar). */
        onSearch,
    }: Props = $props();
    let showFilters = $state(false);
    let showActions = $state(false);
</script>

<div
    class="relative z-30 bg-white/80 backdrop-blur-md p-5 lg:p-7 rounded-[22px] border border-slate-200/50 shadow-sm transition-all duration-300 hover:shadow-md"
>
    <div class="flex flex-col gap-4 sm:gap-6">
        <!-- Fila de título con búsqueda y acciones -->
        <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
            <div class="flex items-center justify-between gap-4 min-w-0 flex-1">
                <h2
                    class="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight truncate"
                >
                    {title}
                </h2>

                <div class="flex items-center gap-2">
                    <!-- Alternar acciones en móvil -->
                    {#if actions}
                        <button
                            type="button"
                            class="sm:hidden flex items-center justify-center p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 active:scale-95 transition-all duration-200
                                   {showActions ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-600'}"
                            onclick={() => {
                                showActions = !showActions;
                                if (showActions) showFilters = false;
                            }}
                            aria-label="Acciones"
                        >
                            <MoreVertical size={16} strokeWidth={2.5} />
                        </button>
                    {/if}

                    <!-- Alternar filtros en móvil (visible solo en móvil) -->
                    {#if filters}
                        <button
                            type="button"
                            class="sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider
                                   {showFilters
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'bg-slate-100 text-slate-600'}"
                            onclick={() => {
                                showFilters = !showFilters;
                                if (showFilters) showActions = false;
                            }}
                        >
                            <Filter size={14} strokeWidth={2.5} />
                            Filtros
                            {#if showFilters}
                                <ChevronUp size={14} />
                            {:else}
                                <ChevronDown size={14} />
                            {/if}
                        </button>
                    {/if}

                    <!-- Botón de búsqueda en móvil (visible solo en móvil) -->
                    {#if onSearch}
                        <button
                            type="button"
                            class="sm:hidden p-2.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 active:scale-95 transition-all duration-200"
                            onclick={onSearch}
                            aria-label="Buscar"
                        >
                            <Search size={22} strokeWidth={2.5} />
                        </button>
                    {/if}
                </div>
            </div>

            <!-- Acciones: ocultas en móvil, visibles desde sm: hacia arriba -->
            {#if actions}
                <div
                    class="hidden sm:flex items-center gap-2 sm:gap-3 shrink-0"
                >
                    {@render actions()}
                </div>
            {/if}
        </div>            <!-- Contenedor de acciones plegable en móvil -->
        {#if actions && showActions}
            <div
                class="sm:hidden pt-4 pb-2 border-t border-slate-150/60"
                transition:slide={{ duration: 250 }}
            >
                <div class="flex flex-col gap-2.5 [&>*]:w-full [&>*]:justify-center">
                    {@render actions()}
                </div>
            </div>
        {/if}            <!-- Filtros (plegables en móvil) -->
        {#if filters}
            <div
                class="sm:block {showFilters ? 'block' : 'hidden'} sm:pt-0 pt-2"
                transition:slide={{ duration: 300 }}
            >
                <div
                    class="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-4 sm:gap-5 pt-4 sm:pt-5 border-t border-slate-100/60 md:pt-0 md:border-t-0"
                >
                    {@render filters()}
                </div>
            </div>
        {/if}
    </div>
</div>
