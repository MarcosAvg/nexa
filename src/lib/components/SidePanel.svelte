<script lang="ts">
    import { type Snippet } from "svelte";
    import { fly, fade } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { X } from "lucide-svelte";

    type Props = {
        isOpen: boolean;
        title: string;
        subtitle?: string;
        children?: Snippet;
        footer?: Snippet;
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
    <!-- Backdrop -->
    <button
        type="button"
        class="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm cursor-default"
        onclick={close}
        aria-label="Cerrar panel"
        transition:fade={{ duration: 200 }}
    ></button>

    <!-- Side Panel -->
    <div
        class="fixed top-0 bottom-0 right-0 z-50 w-full max-w-lg flex flex-col bg-white shadow-[-8px_0_30px_-10px_rgba(0,0,0,0.15)] border-l border-slate-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sidepanel-title"
        transition:fly={{ x: 400, duration: 300, easing: cubicOut }}
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
