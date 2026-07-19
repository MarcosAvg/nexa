<!--
 * ImportIdleStep.svelte
 *
 * Paso inicial del flujo de importación.
 * Muestra la interfaz para seleccionar el archivo Excel
 * con la plantilla de solicitudes completada.
 -->
<script lang="ts">
    import Button from "../Button.svelte";
    import { FileSpreadsheet, Upload } from "lucide-svelte";

    let {
        isParsing = false,
        onFileSelect,
    }: {
        isParsing: boolean;
        onFileSelect: () => void;
    } = $props();
</script>

<div
    class="flex flex-col items-center justify-center gap-4 py-10 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50"
>
    <div
        class="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600"
    >
        <FileSpreadsheet size={28} />
    </div>
    <div class="text-center">
        <p class="text-sm font-semibold text-slate-700">
            Selecciona la plantilla completada
        </p>
        <p class="text-xs text-slate-400 mt-1">
            Solo archivos <span class="font-mono">.xlsx</span>
        </p>
    </div>
    <Button
        variant="primary"
        loading={isParsing}
        onclick={onFileSelect}
    >
        <Upload size={16} class="mr-2" />
        {isParsing ? "Leyendo archivo…" : "Seleccionar archivo"}
    </Button>
</div>
