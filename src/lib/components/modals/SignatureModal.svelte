<script lang="ts">
    import Modal from '../Modal.svelte';
    import SignaturePad from '../SignaturePad.svelte';

    /**
     * SignatureModal — Modal para firmar documentos con SignaturePad.
     *
     * @example
     * <SignatureModal bind:isOpen onSave={handleSave} onClose={handleClose} />
     */
    type Props = {
        /** Controla la visibilidad (two-way bindable). */
        isOpen: boolean;
        /** Callback con la firma en base64. */
        onSave: (signature: string) => Promise<void>;
        /** Callback al cerrar sin guardar. */
        onClose: () => void;
        /** Muestra spinner de carga. */
        loading?: boolean;
    };

    let { isOpen = $bindable(), onSave, onClose, loading = false }: Props = $props();

    function handleClose() {
        isOpen = false;
        onClose();
    }
</script>

<Modal bind:isOpen title="Firmar Responsiva" size="xl" onclose={handleClose}>
    <div class="flex flex-col items-center justify-center p-2 sm:p-4 gap-3 max-h-[78vh]">
        <p class="text-sm text-slate-500 text-center">
            Por favor, firme en el recuadro a continuación. Su firma será sellada digitalmente en el
            documento.
        </p>
        <div
            class="w-full flex-1 min-h-0 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-inner flex flex-col"
        >
            <SignaturePad {onSave} onCancel={handleClose} {loading} />
        </div>
    </div>
</Modal>
