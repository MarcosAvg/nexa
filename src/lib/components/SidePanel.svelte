<script lang="ts">
    import { type Snippet, tick } from 'svelte';
    import { fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { X } from 'lucide-svelte';
    import { mediaState } from '../stores';
    import { scrollLock, overlayStack, overlayHistory } from '../utils';

    /**
     * SidePanel — Panel lateral deslizante (bottom sheet en móvil, side panel en desktop).
     *
     * @example
     * <SidePanel bind:isOpen title="Detalles" subtitle="Nombre" onclose={handleClose}>
     *     <!-- contenido -->
     * </SidePanel>
     */
    type Props = {
        /** Controla la visibilidad (two-way bindable). */
        isOpen: boolean;
        /** Título del panel. */
        title: string;
        /** Subtítulo del panel. */
        subtitle?: string;
        /** Contenido del panel. */
        children?: Snippet;
        /** Footer con botones de acción. */
        footer?: Snippet;
        /** Callback al cerrar el panel. */
        onclose?: () => void;
    };

    let { isOpen = $bindable(), title, subtitle, children, footer, onclose }: Props = $props();

    const titleId = `sidepanel-title-${Math.random().toString(36).slice(2, 9)}`;
    const overlayId = Symbol('sidepanel');

    let panelEl = $state<HTMLDivElement | null>(null);
    let previouslyFocused: HTMLElement | null = null;

    function close() {
        isOpen = false;
        onclose?.();
    }

    function getFocusable(): HTMLElement[] {
        if (!panelEl) return [];
        return Array.from(
            panelEl.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
        );
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            if (isOpen && overlayStack.isTop(overlayId)) {
                e.stopPropagation();
                close();
            }
            return;
        }

        if (e.key === 'Tab' && isOpen) {
            const focusable = getFocusable();
            if (focusable.length === 0) {
                e.preventDefault();
                panelEl?.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    // Foco, trap y scroll lock mientras el panel está abierto.
    $effect(() => {
        if (!isOpen) return;
        overlayStack.push(overlayId);
        overlayHistory.push(overlayId, close);
        previouslyFocused = document.activeElement as HTMLElement | null;
        scrollLock.lock();
        tick().then(() => {
            const focusable = getFocusable();
            (focusable[0] ?? panelEl)?.focus();
        });
        return () => {
            overlayStack.pop(overlayId);
            overlayHistory.close(overlayId);
            scrollLock.unlock();
            if (previouslyFocused?.isConnected) previouslyFocused.focus();
            previouslyFocused = null;
        };
    });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
    <!-- Side Panel / Bottom Sheet -->
    <div
        bind:this={panelEl}
        class="fixed z-[60] flex flex-col bg-white shadow-2xl transition-all duration-300 focus-visible:outline-none
               bottom-0 left-0 right-0 w-full h-auto max-h-[85dvh] rounded-t-[32px] border-t border-slate-200
               sm:top-0 sm:bottom-0 sm:right-0 sm:left-auto sm:w-full sm:max-w-lg sm:h-full sm:max-h-none sm:rounded-none sm:border-l"
        role="dialog"
        tabindex="-1"
        aria-modal="true"
        aria-labelledby={titleId}
        transition:fly={{
            y: mediaState.isMobile.matches ? 600 : 0,
            x: mediaState.isMobile.matches ? 0 : 400,
            duration: 400,
            easing: cubicOut,
        }}
    >
        <!-- Indicador de arrastre superior para móvil -->
        <div class="sm:hidden w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-0.5 flex-shrink-0"></div>

        <!-- Header -->
        <header
            class="flex items-start justify-between gap-4 p-4 lg:p-6 shrink-0 border-b border-slate-100 bg-slate-50/50"
        >
            <div>
                <h2 id={titleId} class="text-lg font-bold text-slate-900">
                    {title}
                </h2>
                {#if subtitle}
                    <p class="mt-0.5 text-sm text-slate-500">{subtitle}</p>
                {/if}
            </div>
            <button
                type="button"
                class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                onclick={close}
                aria-label="Cerrar panel"
            >
                <X size={20} />
            </button>
        </header>

        <!-- Body -->
        <div class="flex-1 min-h-0 overflow-y-auto p-4 lg:p-6">
            {@render children?.()}
        </div>

        <!-- Footer -->
        {#if footer}
            <footer
                class="flex items-center justify-end gap-3 p-4 lg:p-6 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-slate-100 bg-slate-50/50"
            >
                {@render footer()}
            </footer>
        {/if}
    </div>
{/if}
