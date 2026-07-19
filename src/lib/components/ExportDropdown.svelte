<script lang="ts">
    import { type Snippet } from "svelte";
    import { fade } from "svelte/transition";
    import Button from "./Button.svelte";
    import { ChevronDown } from "lucide-svelte";

    type Props = {
        /** Icono del botón trigger */
        icon: any;
        /** Texto del botón trigger */
        label: string;
        /** Grupo(s) de items del menú */
        items: Snippet;
        /** Clases adicionales para el botón trigger */
        class?: string;
        /** Deshabilitar el botón trigger */
        disabled?: boolean;
        /** Ancho del menú desplegable (ej: "w-56", "w-64") */
        menuWidth?: string;
    };

    let {
        icon: Icon,
        label,
        items,
        class: className = "",
        disabled = false,
        menuWidth = "w-56",
    }: Props = $props();

    let container: HTMLDivElement | undefined = $state();
    let isOpen = $state(false);

    function toggle() {
        isOpen = !isOpen;
    }

    function close() {
        isOpen = false;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") close();
    }

    function handleWindowClick(e: MouseEvent) {
        if (isOpen && container && !container.contains(e.target as Node)) {
            close();
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} onclick={handleWindowClick} />

<div bind:this={container} class="relative">
    <Button
        variant="soft-emerald"
        onclick={toggle}
        class="flex items-center gap-2 h-10 px-4 {className}"
        {disabled}
    >
        <Icon size={16} />

        {label}

        <ChevronDown
            size={14}
            class="ml-1 opacity-50 transition-transform {isOpen ? 'rotate-180' : ''}"
        />
    </Button>

    {#if isOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div
            class="absolute right-0 top-full mt-2 {menuWidth} bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 z-50 py-1.5 overflow-hidden"
            transition:fade={{ duration: 150 }}
        >
            {@render items()}
        </div>
    {/if}
</div>
