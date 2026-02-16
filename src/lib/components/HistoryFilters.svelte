<script lang="ts">
    import { Search, Filter, Calendar } from "lucide-svelte";
    import Select from "./Select.svelte";

    type Props = {
        personName: string;
        cardType: string;
        cardFolio: string;
        action: string;
    };

    let {
        personName = $bindable(),
        cardType = $bindable(),
        cardFolio = $bindable(),
        action = $bindable(),
    }: Props = $props();
</script>

<div class="flex flex-col md:flex-row gap-4 w-full">
    <!-- Persona Input -->
    <div class="flex-1 min-w-[200px] relative">
        <label
            for="filter-person"
            class="block text-xs font-semibold text-slate-500 mb-1 ml-1"
            >Persona</label
        >
        <div class="relative">
            <div
                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
            >
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
    <div class="w-full md:w-48">
        <label
            for="filter-type"
            class="block text-xs font-semibold text-slate-500 mb-1 ml-1"
            >Tipo de Tarjeta</label
        >
        <Select id="filter-type" bind:value={cardType} placeholder="">
            <option value="Todos">Todos</option>
            <option value="P2000">P2000</option>
            <option value="KONE">KONE</option>
        </Select>
    </div>

    <!-- Folio Input -->
    <div class="w-full md:w-48">
        <label
            for="filter-folio"
            class="block text-xs font-semibold text-slate-500 mb-1 ml-1"
            >Folio</label
        >
        <div class="relative">
            <div
                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
            >
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

    <!-- Accion Select -->
    <div class="w-full md:w-56">
        <label
            for="filter-action"
            class="block text-xs font-semibold text-slate-500 mb-1 ml-1"
            >Acción</label
        >
        <Select id="filter-action" bind:value={action} placeholder="">
            <option value="Todas">Todas</option>
            <option value="Registro">Registro</option>
            <option value="Actualización">Actualización</option>
            <option value="Cambio de Estado">Cambio de Estado</option>
            <option value="Asignación">Asignación</option>
            <option value="Desvinculación">Desvinculación</option>
            <option value="Firma">Firma</option>
            <option value="Bloqueo">Bloqueo</option>
            <option value="Eliminación">Eliminación</option>
            <option value="Ticket">Ticket</option>
            <option value="Modificación">Modificación</option>
        </Select>
    </div>
</div>
