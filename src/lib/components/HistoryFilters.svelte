<script lang="ts">
    import { Search, Filter, Calendar } from 'lucide-svelte';
    import FilterSelect from './FilterSelect.svelte';
    import { catalogState } from '../stores';

    /**
     * HistoryFilters — Filtros para la vista de Historial.
     *
     * @example
     * <HistoryFilters
     *     bind:personName bind:cardTypes bind:cardFolio
     *     bind:actions bind:startDate bind:endDate
     * />
     */
    type Props = {
        /** Nombre de persona a buscar. */
        personName: string;
        /** Tipos de tarjeta seleccionados (KONE, P2000, ...). */
        cardTypes: string[];
        /** Folio de tarjeta. */
        cardFolio: string;
        /** Acciones seleccionadas en el historial (ACTION_NAMES). */
        actions: string[];
        /** Fecha inicio (YYYY-MM-DD). */
        startDate: string;
        /** Fecha fin (YYYY-MM-DD). */
        endDate: string;
    };

    let {
        personName = $bindable(),
        cardTypes = $bindable([]),
        cardFolio = $bindable(),
        actions = $bindable([]),
        startDate = $bindable(),
        endDate = $bindable(),
    }: Props = $props();

    import { FILTERED_ACTIONS } from '../constants/history';

    let mediaTypeNames = $derived(catalogState.activeMediaTypeNames());
    let actionOptions = $derived(FILTERED_ACTIONS.map(([value, label]) => ({ value, label })));
</script>

<div class="flex flex-col lg:flex-row gap-4 w-full flex-wrap">
    <!-- Input de persona -->
    <div class="flex-1 min-w-[180px]">
        <label for="filter-person" class="block text-xs font-semibold text-slate-500 mb-1 ml-1">Persona</label
        >
        <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} class="text-slate-400" />
            </div>
            <input
                type="text"
                id="filter-person"
                bind:value={personName}
                placeholder="Buscar por nombre..."
                class="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
            />
        </div>
    </div>

    <!-- Tipo de Tarjeta -->
    <div class="w-full lg:w-52">
        <FilterSelect
            label="Tipo de Tarjeta"
            multiple
            options={mediaTypeNames}
            placeholder="Todos"
            bind:values={cardTypes}
        />
    </div>

    <!-- Input de folio -->
    <div class="w-full lg:w-44">
        <label for="filter-folio" class="block text-xs font-semibold text-slate-500 mb-1 ml-1">Folio</label>
        <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter size={14} class="text-slate-400" />
            </div>
            <input
                type="text"
                id="filter-folio"
                bind:value={cardFolio}
                placeholder="Ej. P2K-001"
                class="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
            />
        </div>
    </div>

    <!-- Select de acción -->
    <div class="w-full lg:w-56">
        <FilterSelect
            label="Acción"
            multiple
            options={actionOptions}
            placeholder="Todas"
            bind:values={actions}
        />
    </div>

    <!-- Rango de fechas -->
    <div class="flex gap-3 items-end flex-wrap lg:flex-nowrap">
        <div class="w-full lg:w-44">
            <label for="filter-start-date" class="block text-xs font-semibold text-slate-500 mb-1 ml-1"
                >Desde</label
            >
            <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar size={14} class="text-slate-400" />
                </div>
                <input
                    type="date"
                    id="filter-start-date"
                    bind:value={startDate}
                    class="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
                />
            </div>
        </div>
        <div class="w-full lg:w-44">
            <label for="filter-end-date" class="block text-xs font-semibold text-slate-500 mb-1 ml-1"
                >Hasta</label
            >
            <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar size={14} class="text-slate-400" />
                </div>
                <input
                    type="date"
                    id="filter-end-date"
                    bind:value={endDate}
                    min={startDate || undefined}
                    class="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
                />
            </div>
        </div>
    </div>
</div>
