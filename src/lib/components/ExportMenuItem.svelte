<script lang="ts">
    type Props = {
        icon: any;
        label: string;
        iconBgClass?: string;
        iconColorClass?: string;
        disabled?: boolean;
        onclick: () => void;
    };

    let {
        icon: Icon,
        label,
        iconBgClass = "bg-emerald-50",
        iconColorClass = "text-emerald-600",
        disabled = false,
        onclick,
    }: Props = $props();
</script>

<button
    class="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
    {disabled}
    {onclick}
>
    <span class="w-8 h-8 rounded-lg {iconBgClass} flex items-center justify-center {iconColorClass}">
        <Icon size={16} />
    </span>
    {label}
</button>
