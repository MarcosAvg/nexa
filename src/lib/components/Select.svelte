<script lang="ts">
    import { ChevronDown } from "lucide-svelte";

    /**
     * Select — Selector desplegable con snippet de opciones o prop `options`.
     *
     * @example
     * <Select bind:value={dep}>
     *     {#each deps as d}
     *         <option value={d.name}>{d.name}</option>
     *     {/each}
     * </Select>
     * <Select bind:value={priority} options={["Baja", "Media", "Alta"]} />
     */
    type Props = {
        /** Valor seleccionado (two-way bindable). */
        value: string | number;
        /** Texto placeholder de la opción vacía. @default "Seleccionar..." */
        placeholder?: string;
        /** Array de opciones: strings ú objetos { value, label }. */
        options?: { value: string | number; label: string }[] | any[];
        /** Deshabilitar el select. */
        disabled?: boolean;
        /** Clases CSS adicionales. */
        class?: string;
        /** ID para asociar con <label for>. */
        id?: string;
        onchange?: (e: Event) => void;
        /** Snippet de <option> personalizadas (sobrescribe `options`). */
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
        class="w-full h-full px-4 pr-10 rounded-xl border border-slate-200 bg-white/50 backdrop-blur-sm text-[14px] font-medium text-slate-700
               focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
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
