<script lang="ts">
    import { type Snippet } from 'svelte';
    import { twMerge } from 'tailwind-merge';

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
        /** Hace la tarjeta operable por teclado (role=button, tabindex, Enter/Space). */
        interactive?: boolean;
        /** Handler de click (requerido para `interactive`). */
        onclick?: (e: MouseEvent | KeyboardEvent) => void;
        /** Atributos nativos de <div>. */
        [key: string]: any;
    };

    let { class: className = '', children, interactive = false, onclick, ...rest }: Props = $props();

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onclick?.(e);
        }
    }

    const baseStyles =
        'rounded-card border border-slate-200/50 bg-white/90 backdrop-blur-sm text-slate-950 shadow-sm transition-all duration-300';
    let computedClass = $derived(
        twMerge(
            baseStyles,
            interactive
                ? 'cursor-pointer hover:shadow-card hover:border-slate-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2'
                : 'hover:shadow-card hover:border-slate-300/50',
            className,
        ),
    );
</script>

{#if interactive}
    <div class={computedClass} {...rest} role="button" tabindex="0" {onclick} onkeydown={handleKeydown}>
        {@render children?.()}
    </div>
{:else}
    <div class={computedClass} {...rest}>
        {@render children?.()}
    </div>
{/if}
