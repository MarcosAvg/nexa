<script lang="ts">
    import { type Snippet } from 'svelte';
    import { X } from 'lucide-svelte';
    import { slide } from 'svelte/transition';
    import { overlayHistory } from '../utils';

    /**
     * BottomSheet — Hoja inferior reutilizable para móvil (filtros, acciones…).
     * Se cierra con el botón atrás (historial), backdrop o la X.
     */
    type Props = {
        isOpen?: boolean;
        title: string;
        onclose?: () => void;
        children?: Snippet;
        footer?: Snippet;
    };

    let { isOpen = $bindable(false), title, onclose, children, footer }: Props = $props();

    const overlayId = Symbol('bottom-sheet');

    function close() {
        isOpen = false;
        onclose?.();
    }

    $effect(() => {
        if (!isOpen) return;
        overlayHistory.push(overlayId, close);
        return () => overlayHistory.close(overlayId);
    });
</script>

{#if isOpen}
    <div class="lg:hidden">
        <button
            type="button"
            class="fixed inset-0 z-[55] bg-slate-900/50 backdrop-blur-sm"
            onclick={close}
            aria-label="Cerrar"
        ></button>
        <div
            class="fixed z-[60] bottom-0 inset-x-0 max-h-[88dvh] flex flex-col bg-white rounded-t-[28px] border-t border-slate-200 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            transition:slide={{ duration: 250 }}
        >
            <div class="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 shrink-0"></div>
            <div class="flex items-center justify-between px-5 pt-2 pb-3 shrink-0">
                <h3 class="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                    {title}
                </h3>
                <button
                    type="button"
                    onclick={close}
                    class="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
                    aria-label="Cerrar"
                >
                    <X size={20} strokeWidth={2.5} />
                </button>
            </div>
            <div
                class="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] overflow-y-auto overscroll-contain"
            >
                {@render children?.()}
            </div>
            {#if footer}
                <div
                    class="px-4 py-3 border-t border-slate-100 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
                >
                    {@render footer()}
                </div>
            {/if}
        </div>
    </div>
{/if}
