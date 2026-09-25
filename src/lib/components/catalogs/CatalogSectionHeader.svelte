<script lang="ts">
    import Button from '../Button.svelte';
    import { Plus } from 'lucide-svelte';

    type Props = {
        title: string;
        subtitle?: string;
        actionLabel?: string;
        icon?: any;
        canEdit?: boolean;
        onNew?: () => void;
    };

    let { title, subtitle, actionLabel, icon: Icon = Plus, canEdit = false, onNew }: Props = $props();
</script>

<div class="flex justify-between items-center gap-3 mb-4 lg:mb-8">
    <div class="min-w-0">
        <h3 class="text-lg lg:text-xl font-black text-slate-900 tracking-tight truncate">
            {title}
        </h3>
        {#if subtitle}
            <p class="text-xs lg:text-sm font-medium text-slate-500 mt-0.5">{subtitle}</p>
        {/if}
    </div>
    {#if canEdit && onNew}
        <Button
            variant="primary"
            size="sm"
            class="h-10 px-4 lg:px-5 rounded-xl shadow-lg shadow-blue-500/10 shrink-0"
            onclick={onNew}
            aria-label={actionLabel}
        >
            <Icon size={18} strokeWidth={3} class="mr-2" />
            <span class="hidden sm:inline">{actionLabel}</span>
        </Button>
    {/if}
</div>
