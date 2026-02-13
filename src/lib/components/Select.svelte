<script lang="ts">
    import { ChevronDown } from "lucide-svelte";

    type Props = {
        value: string | number;
        placeholder?: string;
        options?: { value: string | number; label: string }[] | any[];
        disabled?: boolean;
        class?: string;
        id?: string;
        onchange?: (e: Event) => void;
        children?: import("svelte").Snippet;
    };

    let {
        value = $bindable(),
        placeholder = "Seleccionar...",
        options = [],
        disabled = false,
        class: className = "",
        id,
        onchange,
        children,
    }: Props = $props();
</script>

<div
    class="relative w-full {className.includes('h-') ? '' : 'h-10'} {className}"
>
    <select
        {id}
        bind:value
        {disabled}
        class="w-full h-full px-3 pr-10 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700
               focus:outline-none focus:border-slate-900 appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        {onchange}
    >
        {#if placeholder}
            <option value="">{placeholder}</option>
        {/if}

        {#if children}
            {@render children()}
        {:else}
            {#each options as opt}
                {#if typeof opt === "string" || typeof opt === "number"}
                    <option value={opt}>{opt}</option>
                {:else}
                    <option value={opt.value}>{opt.label}</option>
                {/if}
            {/each}
        {/if}
    </select>

    <div
        class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"
    >
        <ChevronDown size={16} />
    </div>
</div>
