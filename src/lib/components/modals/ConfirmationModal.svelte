<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import { AlertTriangle, Info } from "lucide-svelte";

    let {
        isOpen = $bindable(false),
        title = "¿Estás seguro?",
        description = "Esta acción no se puede deshacer.",
        confirmText = "Confirmar",
        cancelText = "Cancelar",
        variant = "danger", // danger, warning, info
        onConfirm,
        onCancel = () => {},
    } = $props();

    let isSubmitting = $state(false);

    async function handleConfirm() {
        isSubmitting = true;
        try {
            await onConfirm?.();
            isOpen = false;
        } finally {
            isSubmitting = false;
        }
    }

    function handleCancel() {
        onCancel?.();
        isOpen = false;
    }
</script>

<Modal bind:isOpen {title} size="sm" onclose={handleCancel}>
    <div class="flex flex-col gap-4">
        <div class="flex items-start gap-4">
            <div
                class="p-3 rounded-full shrink-0 {variant === 'danger'
                    ? 'bg-rose-100 text-rose-600'
                    : variant === 'warning'
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-blue-100 text-blue-600'}"
            >
                {#if variant === "info"}
                    <Info size={24} />
                {:else}
                    <AlertTriangle size={24} />
                {/if}
            </div>
            <div class="space-y-1">
                <p class="text-sm text-slate-500">
                    {description}
                </p>
            </div>
        </div>
    </div>

    {#snippet footer()}
        <Button variant="ghost" onclick={handleCancel} disabled={isSubmitting}>
            {cancelText}
        </Button>
        <Button
            variant={variant === "danger"
                ? "danger"
                : variant === "warning"
                  ? "amber"
                  : "primary"}
            onclick={handleConfirm}
            loading={isSubmitting}
        >
            {confirmText}
        </Button>
    {/snippet}
</Modal>
