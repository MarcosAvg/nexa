<script lang="ts">
    import Combobox from './Combobox.svelte';
    import type { CatalogItem } from '../types';

    /**
     * CatalogSelect — Select genérico para catálogos del sistema, con buscador.
     *
     * @example
     * <CatalogSelect catalog={catalogState.dependencies} bind:value={dep} />
     */
    type Props = {
        /** Array de items del catálogo a renderizar como opciones. */
        catalog: CatalogItem[];
        /** Valor seleccionado (two-way bindable). */
        value: string;
        /** Texto placeholder. @default "Seleccionar..." */
        placeholder?: string;
        /** Deshabilitar el select. */
        disabled?: boolean;
        /** Clases CSS adicionales. */
        class?: string;
        /** ID para asociar con `<label for>`. */
        id?: string;
        /** Callback al cambiar la selección. */
        onchange?: (value: string) => void;
    };

    let {
        catalog,
        value = $bindable(),
        placeholder = 'Seleccionar...',
        disabled = false,
        class: className = '',
        id,
        onchange,
    }: Props = $props();

    let options = $derived(catalog.map((item) => item.name));

    function handleChange(next: string | number) {
        value = String(next);
        onchange?.(String(next));
    }
</script>

<Combobox {id} {value} {options} {placeholder} {disabled} class={className} onchange={handleChange} inline />
