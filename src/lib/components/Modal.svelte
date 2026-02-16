<script lang="ts">
    import { type Snippet } from "svelte";
    import { X } from "lucide-svelte";

    type Props = {
        isOpen: boolean;
        title: string;
        description?: string;
        size?: "sm" | "md" | "lg" | "xl" | "full";
        children?: Snippet;
        footer?: Snippet;
        onclose?: () => void;
    };

    let {
        isOpen = $bindable(),
        title,
        description,
        size = "md",
        children,
        footer,
        onclose,
    }: Props = $props();

    const sizeClasses = {
        sm: "max-w-sm",
        md: "max-w-lg",
        lg: "max-w-2xl",
        xl: "max-w-4xl",
        full: "max-w-[90vw]",
    };

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
    <!-- Backdrop -->
    <button
        type="button"
        class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[6px] transition-all duration-300 cursor-default"
        onclick={close}
        aria-label="Cerrar"
    ></button>

    <!-- Modal Container -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
    >
        <div
            class="pointer-events-auto w-full {sizeClasses[
                size
            ]} max-h-[95vh] flex flex-col bg-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-200/50 overflow-hidden ring-1 ring-black/5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <!-- Header -->
            <div
                class="flex items-start justify-between gap-4 p-8 pb-6 bg-slate-50/30 backdrop-blur-sm"
            >
                <div>
                    <h2
                        id="modal-title"
                        class="text-xl font-bold text-slate-900 tracking-tight"
                    >
                        {title}
                    </h2>
                    {#if description}
                        <p class="mt-1.5 text-sm text-slate-500 font-medium">
                            {description}
                        </p>
                    {/if}
                </div>
                <button
                    type="button"
                    class="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100/80 active:scale-95 transition-all duration-200"
                    onclick={close}
                    aria-label="Cerrar modal"
                >
                    <X size={20} strokeWidth={2.5} />
                </button>
            </div>

            <!-- Body -->
            <div class="flex-1 overflow-y-auto p-6">
                {@render children?.()}
            </div>

            <!-- Footer -->
            {#if footer}
                <div
                    class="flex items-center justify-end gap-3 p-8 pt-6 border-t border-slate-100 bg-slate-50/40 backdrop-blur-sm"
                >
                    {@render footer()}
                </div>
            {/if}
        </div>
    </div>
{/if}
