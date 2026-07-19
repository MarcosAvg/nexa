<script lang="ts">
    import CatalogSelect from "./CatalogSelect.svelte";
    import { catalogState } from "../stores";

    /**
     * ScheduleSelect — Select de horarios conectado al store global.
     *
     * @example
     * <ScheduleSelect bind:value={scheduleId} />
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

    let schedules = $derived(catalogState.schedules);
</script>

<CatalogSelect
    catalog={schedules}
    {value}
    {placeholder}
    {disabled}
    class={className}
    {id}
    {onchange}
/>
