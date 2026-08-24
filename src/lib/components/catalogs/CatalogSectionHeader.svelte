<script lang="ts">
    import Button from "../Button.svelte";
    import { Plus } from "lucide-svelte";

    type Props = {
        title: string;
        subtitle?: string;
        actionLabel?: string;
        icon?: any;
        canEdit?: boolean;
        onNew?: () => void;
    };

    let {
        title,
        subtitle,
        actionLabel,
        icon: Icon = Plus,
        canEdit = false,
        onNew,
    }: Props = $props();
</script>

<div class="flex justify-between items-center mb-8">
    <div>
        <h3 class="text-xl font-black text-slate-900 tracking-tight">{title}</h3>
        {#if subtitle}
            <p class="text-sm font-medium text-slate-500 mt-0.5">{subtitle}</p>
        {/if}
    </div>
    {#if canEdit && onNew}
        <Button variant="primary" size="sm" class="h-10 px-5 rounded-xl shadow-lg shadow-blue-500/10" onclick={onNew}>
            <Icon size={18} strokeWidth={3} class="mr-2" /> {actionLabel}
        </Button>
    {/if}
</div>
