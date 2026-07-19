<script lang="ts">
    import CatalogSelect from "./CatalogSelect.svelte";
    import { catalogState } from "../stores";

    /**
     * DependencySelect — Select de dependencias conectado al store global.
     *
     * @example
     * <DependencySelect bind:value={dependencyId} />
     */
    type Props = {
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
        value = $bindable(),
        placeholder = "Seleccionar...",
        disabled = false,
        class: className = "",
        id,
        onchange,
    }: Props = $props();

    let dependencies = $derived(catalogState.dependencies);
</script>

<CatalogSelect
    catalog={dependencies}
    {value}
    {placeholder}
    {disabled}
    class={className}
    {id}
    {onchange}
/>
