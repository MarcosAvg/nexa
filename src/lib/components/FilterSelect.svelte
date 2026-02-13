<script lang="ts">
    import Select from "./Select.svelte";

    type Props = {
        label: string;
        options: string[];
        value: string;
        placeholder?: string;
        onchange?: (value: string) => void;
    };

    let {
        label,
        options,
        value = $bindable(),
        placeholder = "Seleccionar...",
        onchange,
    }: Props = $props();
</script>

<div
    class="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto sm:flex-1"
>
    <span
        class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap"
    >
        {label}
    </span>
    <div class="flex-1">
        <Select
            bind:value
            {placeholder}
            class="h-9 font-bold bg-slate-50/50 focus:bg-white text-xs"
            onchange={() => onchange?.(value)}
        >
            {#each options as option}
                <option value={option}>{option}</option>
            {/each}
        </Select>
    </div>
</div>
