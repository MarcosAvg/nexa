<script lang="ts">
    import { type Snippet } from "svelte";
    import Button from "./Button.svelte";

    type Props = {
        isOpen: boolean;
        title: string;
        description?: string;
        children?: Snippet;
        footer?: Snippet;
        onClose?: () => void;
    };

    let {
        isOpen = $bindable(false),
        title,
        description,
        children,
        footer,
        onClose,
    }: Props = $props();

    function close() {
        isOpen = false;
        onClose?.();
    }
</script>

{#if isOpen}
    <!-- Overlay -->
    <div
        class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onclick={close}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === "Escape" && close()}
        aria-label="Close drawer"
    ></div>

    <!-- Panel -->
    <div
        class="fixed inset-y-0 right-0 z-50 w-full max-w-sm transform bg-white shadow-xl transition-transform duration-300 ease-in-out sm:max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
    >
        <div class="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
            <!-- Header -->
            <div class="px-4 py-6 sm:px-6">
                <div class="flex items-start justify-between">
                    <div>
                        <h2
                            class="text-xl font-semibold text-slate-900 tracking-tight"
                            id="drawer-title"
                        >
                            {title}
                        </h2>
                        {#if description}
                            <p class="mt-1 text-sm text-slate-500">
                                {description}
                            </p>
                        {/if}
                    </div>
                    <div class="ml-3 flex h-7 items-center">
                        <button
                            type="button"
                            class="relative rounded-md bg-white text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors"
                            onclick={close}
                        >
                            <span class="absolute -inset-2.5"></span>
                            <span class="sr-only">Close panel</span>
                            <svg
                                class="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="1.5"
                                stroke="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Body -->
            <div class="relative flex-1 px-4 py-6 sm:px-6">
                {@render children?.()}
            </div>

            <!-- Footer -->
            {#if footer}
                <div
                    class="flex flex-shrink-0 justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50"
                >
                    {@render footer()}
                </div>
            {/if}
        </div>
    </div>
{/if}
