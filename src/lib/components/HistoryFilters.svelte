<script lang="ts">
    import { Search, Filter, Calendar } from "lucide-svelte";
    import Select from "./Select.svelte";

    /**
     * HistoryFilters — Filtros para la vista de Historial.
     *
     * @example
     * <HistoryFilters
     *     bind:personName bind:cardType bind:cardFolio
     *     bind:action bind:startDate bind:endDate
     * />
     */
    type Props = {
        /** Nombre de persona a buscar. */
        personName: string;
        /** Tipo de tarjeta (Todos, P2000, KONE). */
        cardType: string;
        /** Folio de tarjeta. */
        cardFolio: string;
        /** Acción en el historial (ACTION_NAMES). */
        action: string;
        /** Fecha inicio (YYYY-MM-DD). */
        startDate: string;
        /** Fecha fin (YYYY-MM-DD). */
        endDate: string;
    };

    let {
        personName = $bindable(),
        cardType = $bindable(),
        cardFolio = $bindable(),
        action = $bindable(),
        startDate = $bindable(),
        endDate = $bindable(),
    }: Props = $props();

    import { FILTERED_ACTIONS } from "../constants/history";
</script>

<div class="flex flex-col lg:flex-row gap-4 w-full flex-wrap">
    <!-- Input de persona -->
    <div class="flex-1 min-w-[180px]">
        <label
            for="filter-person"
            class="block text-xs font-semibold text-slate-500 mb-1 ml-1"
        >Persona</label>
        <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} class="text-slate-400" />
            </div>
            <input
                type="text"
                id="filter-person"
                bind:value={personName}
                placeholder="Buscar por nombre..."
                class="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
        </div>
    </div>

    <!-- Tipo de Tarjeta Select -->
    <div class="w-full lg:w-44">
        <label
            for="filter-type"
            class="block text-xs font-semibold text-slate-500 mb-1 ml-1"
        >Tipo de Tarjeta</label>
        <Select id="filter-type" bind:value={cardType} placeholder="">
            <option value="Todos">Todos</option>
            <option value="P2000">P2000</option>
            <option value="KONE">KONE</option>
        </Select>
    </div>

    <!-- Input de folio -->
    <div class="w-full lg:w-44">
        <label
            for="filter-folio"
            class="block text-xs font-semibold text-slate-500 mb-1 ml-1"
        >Folio</label>
        <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter size={14} class="text-slate-400" />
            </div>
            <input
                type="text"
                id="filter-folio"
                bind:value={cardFolio}
                placeholder="Ej. P2K-001"
                class="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
        </div>
    </div>

    <!-- Select de acción -->
    <div class="w-full lg:w-52">
        <label
            for="filter-action"
            class="block text-xs font-semibold text-slate-500 mb-1 ml-1"
        >Acción</label>
        <Select id="filter-action" bind:value={action} placeholder="">
            <option value="Todas">Todas</option>
            {#each FILTERED_ACTIONS as [key, label]}
                <option value={key}>{label}</option>
            {/each}
        </Select>
    </div>

    <!-- Rango de fechas -->
    <div class="flex gap-3 items-end flex-wrap lg:flex-nowrap">
        <div class="w-full lg:w-44">
            <label
                for="filter-start-date"
                class="block text-xs font-semibold text-slate-500 mb-1 ml-1"
            >Desde</label>
            <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar size={14} class="text-slate-400" />
                </div>
                <input
                    type="date"
                    id="filter-start-date"
                    bind:value={startDate}
                    class="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
            </div>
        </div>
        <div class="w-full lg:w-44">
            <label
                for="filter-end-date"
                class="block text-xs font-semibold text-slate-500 mb-1 ml-1"
            >Hasta</label>
            <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar size={14} class="text-slate-400" />
                </div>
                <input
                    type="date"
                    id="filter-end-date"
                    bind:value={endDate}
                    min={startDate || undefined}
                    class="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
            </div>
        </div>
    </div>
</div>
