<script lang="ts">
    import { type Snippet } from "svelte";
    import { fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { X } from "lucide-svelte";

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

    let {
        isOpen = $bindable(),
        title,
        subtitle,
        children,
        footer,
        onclose,
    }: Props = $props();

    function close() {
        isOpen = false;
        onclose?.();
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") close();
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
    <!-- Side Panel / Bottom Sheet -->
    <div
        class="fixed z-50 flex flex-col bg-white shadow-2xl transition-all duration-300
               bottom-0 left-0 right-0 w-full h-[85vh] rounded-t-[32px] border-t border-slate-200
               sm:top-0 sm:bottom-0 sm:right-0 sm:left-auto sm:w-full sm:max-w-lg sm:h-full sm:rounded-none sm:border-l"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sidepanel-title"
        transition:fly={{
            y: window.innerWidth < 640 ? 600 : 0,
            x: window.innerWidth >= 640 ? 400 : 0,
            duration: 400,
            easing: cubicOut,
        }}
    >
        <!-- Header -->
        <header
            class="flex items-start justify-between gap-4 p-6 border-b border-slate-100 bg-slate-50/50"
        >
            <div>
                <h2
                    id="sidepanel-title"
                    class="text-lg font-bold text-slate-900"
                >
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
        <div class="flex-1 overflow-y-auto p-6">
            {@render children?.()}
        </div>

        <!-- Footer -->
        {#if footer}
            <footer
                class="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50"
            >
                {@render footer()}
            </footer>
        {/if}
    </div>
{/if}
