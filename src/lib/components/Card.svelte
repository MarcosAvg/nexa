<script lang="ts">
    import { type Snippet } from "svelte";
    import { twMerge } from "tailwind-merge";

    /**
     * Card — Contenedor con sombra, hover y backdrop blur.
     *
     * @example
     * <Card class="overflow-hidden p-6">
     *     <p>Contenido</p>
     * </Card>
     */
    type Props = {
        /** Clases CSS adicionales (usa twMerge). */
        class?: string;
        /** Contenido interno. */
        children?: Snippet;
        /** Atributos nativos de <div>. */
        [key: string]: any;
    };

    let { class: className = "", children, ...rest }: Props = $props();

    const baseStyles =
        "rounded-2xl border border-slate-200/50 bg-white/90 backdrop-blur-sm text-slate-950 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300/50";

    let computedClass = $derived(twMerge(baseStyles, className));
</script>

<div class={computedClass} {...rest}>
    {@render children?.()}
</div>
