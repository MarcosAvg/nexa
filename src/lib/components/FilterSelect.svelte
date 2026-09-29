<script lang="ts">
    import Combobox from './Combobox.svelte';

    /**
     * FilterSelect — Select compacto con label para filtros de vista.
     *
     * Usa `Combobox` (con buscador) para permitir buscar dentro de la lista.
     *
     * @example
     * <FilterSelect label="Dependencia" options={deps} bind:value={depFilter} />
     */
    type Props = {
        /** Label del filtro. */
        label: string;
        /** Opciones del select. */
        options: (string | { value: string | number; label: string })[];
        /** Valor seleccionado (two-way bindable). */
        value: string;
        /** Texto placeholder. @default "Seleccionar..." */
        placeholder?: string;
        /** Deshabilitar el filtro. @default false */
        disabled?: boolean;
        /** Callback al cambiar selección. */
        onchange?: (value: string) => void;
    };

    let {
        label,
        options,
        value = $bindable(),
        placeholder = 'Seleccionar...',
        disabled = false,
        onchange,
    }: Props = $props();

    const selectId = $derived(`filter-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);

    function handleChange(next: string | number) {
        value = String(next);
        onchange?.(String(next));
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
            {value}
            {options}
            {placeholder}
            {disabled}
            class="h-11 font-bold bg-slate-50/50 backdrop-blur-sm border-slate-200/50 text-[13px] rounded-2xl"
            onchange={handleChange}
        />
    </div>
</div>
