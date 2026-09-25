<script lang="ts">
    import { type Snippet, tick } from 'svelte';
    import { X } from 'lucide-svelte';
    import { scrollLock, overlayStack, overlayHistory } from '../utils';
    import { mediaState } from '../stores';

    /**
     * Modal — Modal genérico con footer, tamaños y cierre con Escape/backdrop.
     *
     * @example
     * <Modal bind:isOpen title="Editar" size="xl" onclose={reset}>
     *     <!-- contenido -->
     *     {#snippet footer()}
     *         <Button onclick={close}>Cancelar</Button>
     *     {/snippet}
     * </Modal>
     */
    type Props = {
        /** Controla la visibilidad del modal (two-way bindable). */
        isOpen: boolean;
        /** Título del modal (aria-labelledby). */
        title: string;
        /** Subtítulo/descripción del modal. */
        description?: string;
        /** Tamaño/ancho máximo del modal. @default "md" */
        size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
        /** En móvil ocupa toda la pantalla (ideal para formularios grandes). */
        mobileFullScreen?: boolean;
        /** Muestra el botón de cerrar (X). @default true */
        showClose?: boolean;
        /** Clase de z-index personalizada. @default "z-[60]" */
        zIndex?: string;
        /** Contenido del cuerpo del modal. */
        children?: Snippet;
        /** Contenido del pie del modal (botones de acción). */
        footer?: Snippet;
        /** Callback al cerrar el modal. */
        onclose?: () => void;
    };

    let {
        isOpen = $bindable(),
        title,
        description,
        size = 'md',
        mobileFullScreen = false,
        showClose = true,
        zIndex = 'z-[60]',
        children,
        footer,
        onclose,
    }: Props = $props();

    // Pantalla completa: `size="full"` siempre, o en móvil si `mobileFullScreen`.
    let fullScreen = $derived(size === 'full' || (mobileFullScreen && mediaState.isMobile.matches));

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        full: 'max-w-full w-full h-full rounded-none',
    };

    // Id único por instancia para evitar colisiones con modales anidados.
    const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;
    const overlayId = Symbol('modal');

    let dialogEl = $state<HTMLDivElement | null>(null);
    let previouslyFocused: HTMLElement | null = null;

    function close() {
        isOpen = false;
        onclose?.();
    }

    function getFocusable(): HTMLElement[] {
        if (!dialogEl) return [];
        return Array.from(
            dialogEl.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
        );
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            // Solo el overlay superior responde a Escape.
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
                dialogEl?.focus();
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

    // Foco, trap y scroll lock mientras el modal está abierto.
    $effect(() => {
        if (!isOpen) return;
        overlayStack.push(overlayId);
        overlayHistory.push(overlayId, close);
        previouslyFocused = document.activeElement as HTMLElement | null;
        scrollLock.lock();
        tick().then(() => {
            const focusable = getFocusable();
            (focusable[0] ?? dialogEl)?.focus();
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
    <!-- Fondo -->
    <button
        type="button"
        class="fixed inset-0 {zIndex} bg-slate-900/40 backdrop-blur-[6px] transition-all duration-300 cursor-default"
        onclick={close}
        aria-label="Cerrar"
    ></button>

    <!-- Contenedor del modal -->
    <div
        class="fixed inset-0 {zIndex} flex items-center justify-center sm:items-center {fullScreen
            ? 'p-0 items-stretch'
            : 'p-4 max-sm:p-0 max-sm:items-end'} pointer-events-none"
    >
        <div
            bind:this={dialogEl}
            class="pointer-events-auto w-full {fullScreen
                ? 'max-w-full h-dvh rounded-none'
                : sizeClasses[size] +
                  ' max-h-[95dvh] max-sm:max-h-[90dvh] rounded-overlay max-sm:rounded-t-[32px] max-sm:rounded-b-none'} flex flex-col bg-white shadow-overlay border border-slate-200/50 overflow-hidden ring-1 ring-black/5 transition-all duration-300 focus-visible:outline-none"
            role="dialog"
            tabindex="-1"
            aria-modal="true"
            aria-labelledby={titleId}
        >
            <!-- Indicador de arrastre superior para móvil -->
            {#if !fullScreen}
                <div
                    class="sm:hidden w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 mb-1 flex-shrink-0"
                ></div>
            {/if}

            <!-- Encabezado -->
            {#if size !== 'full'}
                <div
                    class="flex items-start justify-between gap-4 p-8 pb-6 max-sm:p-6 {fullScreen
                        ? 'max-sm:pt-[max(1rem,env(safe-area-inset-top,0px))]'
                        : 'max-sm:pt-2'} bg-slate-50/30 backdrop-blur-sm flex-shrink-0"
                >
                    <div>
                        <h2 id={titleId} class="text-xl font-bold text-slate-900 tracking-tight">
                            {title}
                        </h2>
                        {#if description}
                            <p class="mt-1.5 text-sm text-slate-500 font-medium">
                                {description}
                            </p>
                        {/if}
                    </div>
                    {#if showClose}
                        <button
                            type="button"
                            class="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100/80 active:scale-95 transition-all duration-200"
                            onclick={close}
                            aria-label="Cerrar modal"
                        >
                            <X size={20} strokeWidth={2.5} />
                        </button>
                    {/if}
                </div>
            {/if}

            <!-- Cuerpo -->
            <div class="flex-1 overflow-y-auto {size === 'full' ? 'p-0' : 'p-6'}">
                {@render children?.()}
            </div>

            <!-- Pie -->
            {#if footer && size !== 'full'}
                <div
                    class="flex items-center justify-end gap-3 p-8 pt-6 max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] border-t border-slate-100 bg-slate-50/40 backdrop-blur-sm"
                >
                    {@render footer()}
                </div>
            {/if}
        </div>
    </div>
{/if}
