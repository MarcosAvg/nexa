<script lang="ts" generics="T extends string">
    type Props = {
        tabs: { id: T; label: string }[];
        active: T;
        onSelect: (id: T) => void;
        variant?: "underline" | "pill";
        className?: string;
    };

    let {
        tabs,
        active,
        onSelect,
        variant = "underline",
        className = "",
    }: Props = $props();
</script>

<div
    class="flex items-center gap-2 {variant === 'underline' ? 'border-b border-slate-200' : 'overflow-x-auto pb-1'} {className}"
>
    {#each tabs as tab}
        <button
            class="whitespace-nowrap text-sm font-bold transition-colors {variant === 'underline'
                ? 'px-6 py-3 border-b-2 -mb-px '
                : 'px-5 py-2.5 rounded-2xl text-[13px] font-extrabold active:scale-95 '}{variant === 'underline'
                ? active === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                : active === tab.id
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800'}"
            onclick={() => onSelect(tab.id)}
        >
            {tab.label}
        </button>
    {/each}
</div>
