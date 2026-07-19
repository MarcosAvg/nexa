<script lang="ts">
    import Select from "./Select.svelte";
    import type { CatalogItem } from "../types";

    /**
     * CatalogSelect — Select genérico para catálogos del sistema.
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
        /** ID para asociar con <label for>. */
        id?: string;
        onchange?: (e: Event) => void;
    };

    let {
        catalog,
        value = $bindable(),
        placeholder = "Seleccionar...",
        disabled = false,
        class: className = "",
        id,
        onchange,
    }: Props = $props();
</script>

<Select
    {value}
    {placeholder}
    {disabled}
    class={className}
    {id}
    {onchange}
>
    {#each catalog as item}
        <option value={item.name}>{item.name}</option>
    {/each}
</Select>
