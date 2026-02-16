<script lang="ts">
    type Props = {
        label: string;
        options: string[];
        value: string;
        onchange?: (value: string) => void;
    };

    let { label, options, value = $bindable(), onchange }: Props = $props();
</script>

<div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
    <span
        class="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap pl-1"
    >
        {label}
    </span>
    <div
        class="flex flex-nowrap overflow-x-auto gap-1.5 p-1.5 bg-slate-50/50 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-inner no-scrollbar"
    >
        {#each options as option}
            <button
                type="button"
                class="px-4 py-1.5 text-xs font-extrabold rounded-xl transition-all duration-300 active:scale-95 select-none whitespace-nowrap
                    {value === option
                    ? 'bg-slate-900 text-white shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/30'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'}"
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

<style>
    /* Hide scrollbar for Chrome, Safari and Opera */
    .no-scrollbar::-webkit-scrollbar {
        display: none;
    }
    /* Hide scrollbar for IE, Edge and Firefox */
    .no-scrollbar {
        -ms-overflow-style: none; /* IE and Edge */
        scrollbar-width: none; /* Firefox */
    }
</style>
