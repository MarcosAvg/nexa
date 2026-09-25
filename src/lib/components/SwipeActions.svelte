<script lang="ts">
    import { type Snippet } from 'svelte';
    import { MoreHorizontal } from 'lucide-svelte';
    import { swipe, haptic } from '../utils';

    /**
     * SwipeActions — revela acciones de fila al deslizar a la izquierda (móvil).
     *
     * Incluye un botón "⋯" como alternativa accesible (sin gesto).
     */
    type Action = {
        label: string;
        tone?: 'blue' | 'amber' | 'emerald' | 'rose' | 'indigo' | 'slate';
        onAction: () => void;
    };

    type Props = {
        actions: Action[];
        /** Posición del botón "⋯". @default 'top' */
        buttonPosition?: 'top' | 'bottom';
        /** Esquinas redondeadas (desactivar dentro de listas). @default true */
        rounded?: boolean;
        /** Muestra el botón "⋯" (alternativa accesible al gesto). @default true */
        showButton?: boolean;
        children?: Snippet;
    };

    let {
        actions = [],
        buttonPosition = 'top',
        rounded = true,
        showButton = true,
        children,
    }: Props = $props();

    let open = $state(false);

    const toneClass: Record<string, string> = {
        blue: 'bg-blue-600 text-white',
        amber: 'bg-amber-500 text-white',
        emerald: 'bg-emerald-600 text-white',
        rose: 'bg-rose-600 text-white',
        indigo: 'bg-indigo-600 text-white',
        slate: 'bg-slate-600 text-white',
    };

    const actionWidth = 84;

    function run(action: Action) {
        haptic('medium');
        open = false;
        action.onAction();
    }
</script>

<div class="relative overflow-hidden {rounded ? 'rounded-2xl' : ''}">
    <!-- Acciones detrás (a la derecha) -->
    <div class="absolute inset-y-0 right-0 flex">
        {#each actions as action (action.label)}
            <button
                type="button"
                class="flex flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide {toneClass[
                    action.tone ?? 'slate'
                ]}"
                style="width: {actionWidth}px;"
                onclick={() => run(action)}
                aria-label={action.label}
            >
                {action.label}
            </button>
        {/each}
    </div>

    <!-- Contenido desplazable (fondo opaco para ocultar las acciones) -->
    <div
        class="relative bg-white transition-transform duration-200 ease-out"
        style="transform: translateX({open ? -actionWidth * actions.length : 0}px);"
        use:swipe={{
            onSwipeLeft: () => (open = true),
            onSwipeRight: () => (open = false),
        }}
    >
        {@render children?.()}

        {#if actions.length > 0 && showButton}
            <button
                type="button"
                class="absolute {buttonPosition === 'top'
                    ? 'top-3'
                    : 'bottom-3'} right-3 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 border border-slate-200 text-slate-500 shadow-sm"
                onclick={() => (open = !open)}
                aria-label="Más acciones"
                aria-expanded={open}
            >
                <MoreHorizontal size={16} strokeWidth={2.5} />
            </button>
        {/if}
    </div>
</div>
