<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import { enlaceService } from "../../services/enlaces";
    import { toast } from "svelte-sonner";
    import { Save } from "lucide-svelte";
    import type { Enlace } from "../../types";

    type Props = {
        isOpen: boolean;
        enlace: Enlace | null;
        onComplete: () => void;
    };

    let { isOpen = $bindable(), enlace = null, onComplete }: Props = $props();

    let extension = $state("");
    let isSubmitting = $state(false);

    $effect(() => {
        if (isOpen && enlace) {
            extension = enlace.extension || "";
        }
    });

    function reset() {
        extension = "";
        isOpen = false;
    }

    async function handleSave() {
        if (!enlace || isSubmitting) return;

        isSubmitting = true;
        try {
            const name =
                `${enlace.personnel?.first_name} ${enlace.personnel?.last_name}`.trim();
            await enlaceService.update(enlace.id, extension.trim(), name);
            toast.success("Enlace Actualizado", {
                description: "Se ha modificado la extensión correctamente.",
            });
            onComplete();
            reset();
        } catch (error: any) {
            toast.error("Error", {
                description:
                    error.message || "No se pudo actualizar el enlace.",
            });
        } finally {
            isSubmitting = false;
        }
    }
</script>

<Modal
    bind:isOpen
    title="Editar Extensión"
    description={enlace
        ? `Modificando extensión para ${enlace.personnel?.first_name || ""} ${enlace.personnel?.last_name || ""}`
        : ""}
    size="sm"
    onclose={reset}
>
    <div class="space-y-4">
        <div class="space-y-1">
            <span
                class="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1"
                >Nueva Extensión Telefónica</span
            >
            <Input
                type="text"
                id="edit-enlace-ext"
                name="edit-enlace-ext"
                placeholder="Ej. 1234"
                bind:value={extension}
                class="w-full"
            />
        </div>
    </div>

    {#snippet footer()}
        <Button variant="ghost" onclick={reset}>Cancelar</Button>
        <Button variant="primary" onclick={handleSave} loading={isSubmitting}>
            <Save size={16} class="mr-2" />
            Guardar
        </Button>
    {/snippet}
</Modal>
