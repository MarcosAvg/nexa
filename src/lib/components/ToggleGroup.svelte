<script lang="ts">
    type Props = {
        label: string;
        options: string[];
        value: string[];
        onchange?: (value: string[]) => void;
    };

    let { label, options, value = $bindable([]), onchange }: Props = $props();

    function toggle(option: string) {
        if (value.includes(option)) {
            value = value.filter((v) => v !== option);
        } else {
            value = [...value, option];
        }
        onchange?.(value);
    }
</script>

<div class="space-y-2">
    <span
        class="text-xs font-bold text-slate-500 uppercase tracking-widest block"
    >
        {label}
    </span>
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
