<script lang="ts">
    type Props = {
        label: string;
        options: string[];
        value: string;
        onchange?: (value: string) => void;
    };

    let { label, options, value = $bindable(), onchange }: Props = $props();
</script>

<div class="flex flex-col sm:flex-row sm:items-center gap-2">
    <span
        class="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap"
    >
        {label}
    </span>
    <div
        class="flex flex-wrap gap-1.5 p-1 bg-slate-50 rounded-lg border border-slate-100"
    >
        {#each options as option}
            <button
                type="button"
                class="px-3 py-1.5 text-xs font-bold rounded-md transition-all
                    {value === option
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'}"
                onclick={() => {
                    value = option;
                    onchange?.(option);
                }}
            >
                {option}
            </button>
        {/each}
    </div>
</div>
