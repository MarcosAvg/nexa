<script lang="ts">
    import { type Snippet } from "svelte";

    /**
     * FormField — Campo de formulario con label, slot y mensaje de error.
     *
     * @example
     * <FormField label="Nombre" for="nombre" error={errors.nombre}>
     *     <Input id="nombre" bind:value={nombre} />
     * </FormField>
     */
    type Props = {
        /** Texto del label. */
        label: string;
        /** ID del input asociado (for del label). */
        for?: string;
        /** Mensaje de error (oculto si vacío). */
        error?: string;
        /** Contenido del campo (Input, Select, etc.). */
        children?: Snippet;
    };

    let {
        label,
        for: htmlFor,
        error,
        children,
    }: Props = $props();
</script>

<div class="space-y-1.5">
    {#if label}
        <label
            for={htmlFor || undefined}
            class="text-xs font-bold text-slate-600 block"
        >
            {label}
        </label>
    {/if}
    {@render children?.()}
    {#if error}
        <p class="text-[10px] text-red-500 font-medium">{error}</p>
    {/if}
</div>
