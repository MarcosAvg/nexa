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
    class="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto sm:flex-1"
>
    <span
        class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap pl-1"
    >
        {label}
    </span>
    <div class="flex-1">
        <Select
            bind:value
            {placeholder}
            class="h-11 font-bold bg-slate-50/50 backdrop-blur-sm border-slate-200/50 text-[13px] rounded-2xl"
            onchange={() => onchange?.(value)}
        >
            {#each options as option}
                <option value={option}>{option}</option>
            {/each}
        </Select>
    </div>
</div>
