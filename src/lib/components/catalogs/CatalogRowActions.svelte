<script lang="ts">
    import { Edit2, Trash2, GripVertical } from "lucide-svelte";

    type Props = {
        canEdit?: boolean;
        showDrag?: boolean;
        editLabel?: string;
        deleteLabel?: string;
        onEdit: () => void;
        onDelete: () => void;
    };

    let {
        canEdit = false,
        showDrag = true,
        editLabel = "Editar",
        deleteLabel = "Eliminar",
        onEdit,
        onDelete,
    }: Props = $props();
</script>

<div class="flex justify-end gap-1">
    {#if showDrag}
        <span class="p-1.5 text-slate-300 group-hover:text-slate-400 cursor-grab transition-colors" title="Arrastrar para reordenar" aria-hidden="true">
            <GripVertical size={16} />
        </span>
    {/if}
    <button class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" onclick={onEdit} title={editLabel} aria-label={editLabel}>
        <Edit2 size={16} />
    </button>
    <button class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" onclick={onDelete} title={deleteLabel} aria-label={deleteLabel}>
        <Trash2 size={16} />
    </button>
</div>
