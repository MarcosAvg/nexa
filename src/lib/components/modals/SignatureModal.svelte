<script lang="ts">
    import Modal from "../Modal.svelte";
    import SignaturePad from "../SignaturePad.svelte";

    type Props = {
        isOpen: boolean;
        onSave: (signature: string) => Promise<void>;
        onClose: () => void;
        loading?: boolean;
    };

    let {
        isOpen = $bindable(),
        onSave,
        onClose,
        loading = false,
    }: Props = $props();

    function handleClose() {
        isOpen = false;
        onClose();
    }
</script>

<Modal bind:isOpen title="Firmar Responsiva" size="lg" onclose={handleClose}>
    <div class="flex flex-col items-center justify-center p-4">
        <p class="mb-4 text-sm text-slate-500 text-center">
            Por favor, firme en el recuadro a continuación. Su firma será
            sellada digitalmente en el documento.
        </p>
        <div
            class="w-full bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-inner"
        >
            <SignaturePad {onSave} onCancel={handleClose} {loading} />
        </div>
    </div>
</Modal>
