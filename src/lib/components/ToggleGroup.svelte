<script lang="ts">
    type Props = {
        label: string;
        options: string[];
        value: string[];
        onchange?: (value: string[]) => void;
        showSelectAll?: boolean;
    };

    let {
        label,
        options,
        value = $bindable([]),
        onchange,
        showSelectAll = false,
    }: Props = $props();

    let isAllSelected = $derived(
        options.length > 0 && value.length === options.length,
    );

    function toggle(option: string) {
        if (value.includes(option)) {
            value = value.filter((v) => v !== option);
        } else {
            value = [...value, option];
        }
        onchange?.(value);
    }

    function toggleAll() {
        if (isAllSelected) {
            value = [];
        } else {
            value = [...options];
        }
        onchange?.(value);
    }
</script>

<div class="space-y-2">
    <div class="flex items-center justify-between">
        <span
            class="text-xs font-bold text-slate-500 uppercase tracking-widest block"
        >
            {label}
        </span>
        {#if showSelectAll && options.length > 0}
            <button
                type="button"
                class="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                onclick={toggleAll}
            >
                {isAllSelected ? "Ninguno" : "Todos"}
            </button>
        {/if}
    </div>
    <div class="flex flex-wrap gap-2">
        {#each options as option}
            <button
                type="button"
                class="px-3 py-1.5 text-xs font-bold rounded-lg border transition-all
                    {value.includes(option)
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}"
                onclick={() => toggle(option)}
            >
                {option}
            </button>
        {/each}
    </div>
</div>
