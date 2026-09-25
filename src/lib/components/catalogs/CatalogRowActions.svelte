<script lang="ts">
    import { Edit2, Trash2, GripVertical } from 'lucide-svelte';
    import IconButton from '../IconButton.svelte';

    type Props = {
        /** Muestra las acciones de edición/borrado. @default true */
        canEdit?: boolean;
        showDrag?: boolean;
        editLabel?: string;
        deleteLabel?: string;
        onEdit: () => void;
        onDelete: () => void;
    };

    let {
        canEdit = true,
        showDrag = true,
        editLabel = 'Editar',
        deleteLabel = 'Eliminar',
        onEdit,
        onDelete,
    }: Props = $props();
</script>

<div class="flex justify-end gap-1">
    {#if showDrag}
        <span
            class="flex items-center justify-center h-9 w-9 text-slate-300 group-hover:text-slate-400 cursor-grab transition-colors"
            title="Arrastrar para reordenar"
            aria-hidden="true"
        >
            <GripVertical size={16} />
        </span>
    {/if}
    {#if canEdit}
        <IconButton icon={Edit2} label={editLabel} tone="blue" size="sm" onclick={onEdit} />
        <IconButton icon={Trash2} label={deleteLabel} tone="rose" size="sm" onclick={onDelete} />
    {/if}
</div>
