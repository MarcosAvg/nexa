<script lang="ts">
    import Combobox from './Combobox.svelte';

    /**
     * FilterSelect — Select compacto con label para filtros de vista.
     *
     * Usa `Combobox` (con buscador) para permitir buscar dentro de la lista.
     * Soporta selección simple (`bind:value`) y múltiple (`multiple` + `bind:values`).
     *
     * @example
     * <FilterSelect label="Dependencia" options={deps} bind:value={depFilter} />
     * <FilterSelect label="Tipo" multiple options={types} bind:values={typeFilters} />
     */
    type Props = {
        /** Label del filtro. */
        label: string;
        /** Opciones del select. */
        options: (string | { value: string | number; label: string })[];
        /** Activa la selección múltiple. @default false */
        multiple?: boolean;
        /** Valor seleccionado en modo simple (two-way bindable). */
        value?: string;
        /** Valores seleccionados en modo múltiple (two-way bindable). */
        values?: string[];
        /** Texto placeholder. @default "Seleccionar..." */
        placeholder?: string;
        /** Deshabilitar el filtro. @default false */
        disabled?: boolean;
        /** Callback al cambiar selección (modo simple). */
        onchange?: (value: string) => void;
        /** Callback al cambiar selección (modo múltiple). */
        onchangeMulti?: (values: string[]) => void;
    };

    let {
        label,
        options,
        multiple = false,
        value = $bindable(),
        values = $bindable([]),
        placeholder = 'Seleccionar...',
        disabled = false,
        onchange,
        onchangeMulti,
    }: Props = $props();

    const selectId = $derived(`filter-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);

    function handleChange(next: string | number) {
        value = String(next);
        onchange?.(String(next));
    }

    function handleChangeMulti(next: (string | number)[]) {
        const arr = next.map(String);
        values = arr;
        onchangeMulti?.(arr);
    }
</script>

<div class="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto sm:flex-1">
    <label
        for={selectId}
        class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap pl-1"
    >
        {label}
    </label>
    <div class="flex-1">
        <Combobox
            id={selectId}
            {multiple}
            {value}
            {values}
            {options}
            {placeholder}
            {disabled}
            class="h-11 font-bold bg-slate-50/50 backdrop-blur-sm border-slate-200/50 text-[13px] rounded-2xl"
            onchange={handleChange}
            onchangeMulti={handleChangeMulti}
        />
    </div>
</div>
