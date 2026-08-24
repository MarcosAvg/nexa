<script lang="ts">
    import Modal from "./Modal.svelte";
    import Button from "./Button.svelte";
    import Input from "./Input.svelte";
    import { Trash2 } from "lucide-svelte";

    type Props = {
        isOpen: boolean;
        title?: string;
        description?: string;
        targetName: string;
        confirmText?: string;
        onConfirm: () => void | Promise<void>;
        onCancel?: () => void;
    };

    let {
        isOpen = $bindable(false),
        title = "Eliminar",
        description,
        targetName,
        confirmText = "Eliminar",
        onConfirm,
        onCancel,
    }: Props = $props();

    let deleteConfirmation = $state("");

    $effect(() => {
        if (isOpen) deleteConfirmation = "";
    });
</script>

<Modal bind:isOpen title={title} description={description ?? `Estás a punto de eliminar "${targetName}". Esta acción es irreversible.`} size="sm">
    <div class="space-y-4">
        <div class="p-4 bg-rose-50 rounded-xl border border-rose-100">
            <div class="flex gap-3">
                <div class="mt-0.5 text-rose-600"><Trash2 size={20} /></div>
                <div>
                    <h4 class="text-sm font-bold text-rose-900">Confirmación requerida</h4>
                    <p class="text-sm text-rose-800 mt-1">Para confirmar, escribe <strong>{targetName}</strong> en el campo de abajo.</p>
                </div>
            </div>
        </div>
        <div>
            <label for="typed-delete-confirm" class="block text-sm font-medium text-slate-700 mb-1">Confirmación</label>
            <Input id="typed-delete-confirm" placeholder={targetName} bind:value={deleteConfirmation} class="border-rose-300 focus:ring-rose-500" />
        </div>
    </div>
    {#snippet footer()}
        <Button variant="secondary" onclick={() => { onCancel?.(); isOpen = false; }}>Cancelar</Button>
        <Button variant="danger" onclick={onConfirm} disabled={deleteConfirmation !== targetName}>{confirmText}</Button>
    {/snippet}
</Modal>
