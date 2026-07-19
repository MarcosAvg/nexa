<script lang="ts">
    import { type Snippet } from "svelte";

    /**
     * FormSection — Sección de formulario con fieldset + legend.
     *
     * @example
     * <FormSection title="Datos Personales" disabled={!canEdit}>
     *     <Input bind:value={name} />
     * </FormSection>
     */
    type Props = {
        /** Título de la sección (renderizado como <legend>). */
        title: string;
        /** Deshabilita todos los controles hijos automáticamente. */
        disabled?: boolean;
        /** Contenido del fieldset. */
        children?: Snippet;
    };

    let {
        title,
        disabled = false,
        children,
    }: Props = $props();
</script>

<fieldset
    class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
    {disabled}
>
    <legend
        class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest"
    >
        {title}
    </legend>
    {@render children?.()}
</fieldset>
