<script lang="ts">
    import CatalogSelect from "./CatalogSelect.svelte";
    import { catalogState } from "../stores";

    /**
     * BuildingSelect — Select de edificios conectado al store global.
     *
     * @example
     * <BuildingSelect bind:value={buildingId} />
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

    let buildings = $derived(catalogState.buildings);
</script>

<CatalogSelect
    catalog={buildings}
    {value}
    {placeholder}
    {disabled}
    class={className}
    {id}
    {onchange}
/>
