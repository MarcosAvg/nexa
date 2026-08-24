<script lang="ts">
    type Props = {
        icon: any;
        label: string;
        className?: string;
        iconColorClass?: string;
    };

    let {
        icon: Icon,
        label,
        className = "bg-slate-100 text-slate-700",
        iconColorClass,
    }: Props = $props();
</script>

<div class="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl {className}">
    <Icon size={16} strokeWidth={2.5} class={iconColorClass} />
    <span class="text-[13px] font-extrabold">{label}</span>
</div>
