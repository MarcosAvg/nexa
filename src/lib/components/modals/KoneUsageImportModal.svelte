<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import Badge from "../Badge.svelte";
    import { toast } from "svelte-sonner";
    import {
        Upload,
        FileSpreadsheet,
        Download,
        CheckCircle2,
        XCircle,
        Loader2,
        AlertTriangle,
    } from "lucide-svelte";
    import {
        parseKoneUsageFile,
        matchKoneUsageToPersonnel,
        type KoneUsageMatchResult,
    } from "../../utils/xlsxKoneUsage";
    import { exportKoneUsageToExcel } from "../../utils/xlsxExport";

    type Props = {
        isOpen: boolean;
    };

    let { isOpen = $bindable() }: Props = $props();

    let step = $state<"idle" | "parsing" | "matching" | "results">("idle");
    let matchResult = $state<KoneUsageMatchResult | null>(null);
    let isExporting = $state(false);
    let fileInput = $state<HTMLInputElement>();

    function reset() {
        step = "idle";
        matchResult = null;
        isExporting = false;
    }

    function closeModal() {
        reset();
        isOpen = false;
    }

    async function handleFileChange(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        step = "parsing";
        try {
            const entries = await parseKoneUsageFile(file);

            if (entries.length === 0) {
                toast.error("No se encontraron datos en el archivo.");
                step = "idle";
                return;
            }

            step = "matching";
            const result = await matchKoneUsageToPersonnel(entries);
            matchResult = result;
            step = "results";
        } catch (err: any) {
            console.error("Import Error:", err);
            toast.error(err.message || "Error al procesar el archivo.");
            step = "idle";
        }

        // Reset file input for re-upload
        if (input) input.value = "";
    }

    async function handleExport() {
        if (!matchResult || matchResult.matched.length === 0) return;

        isExporting = true;
        try {
            await exportKoneUsageToExcel(matchResult.matched);
            toast.success("Exportación completada");
        } catch (err) {
            console.error("Export Error:", err);
            toast.error("Error al exportar los datos");
        } finally {
            isExporting = false;
        }
    }

    // Derived stats
    let stats = $derived.by(() => {
        if (!matchResult) return null;
        const totalUsos = matchResult.matched.reduce(
            (sum, m) => sum + m.conteo,
            0,
        );
        const promedio =
            matchResult.matched.length > 0
                ? (totalUsos / matchResult.matched.length).toFixed(1)
                : "0";
        return {
            totalImported: matchResult.totalImported,
            found: matchResult.matched.length,
            notFound: matchResult.unmatched.length,
            pctMatch:
                matchResult.totalImported > 0
                    ? (
                          (matchResult.matched.length /
                              matchResult.totalImported) *
                          100
                      ).toFixed(1)
                    : "0",
            totalUsos,
            promedio,
        };
    });
</script>

<Modal
    bind:isOpen
    title="Importar Conteo de Uso KONE"
    description="Suba un archivo Excel con columnas Folio y Conteo para cruzar con el directorio de personal."
    size="lg"
    onclose={closeModal}
>
    <div class="space-y-5">
        <!-- ── STEP: IDLE ── -->
        {#if step === "idle"}
            <div
                class="flex flex-col items-center justify-center gap-4 py-10 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50"
            >
                <div
                    class="w-16 h-16 rounded-2xl bg-sky-50 flex items-center justify-center"
                >
                    <Upload size={28} class="text-sky-500" />
                </div>
                <div class="text-center">
                    <p class="text-sm font-bold text-slate-700">
                        Seleccione el archivo de conteo
                    </p>
                    <p class="text-xs text-slate-400 mt-1">
                        El archivo debe contener columnas <strong>Folio</strong>
                        y <strong>Conteo</strong> (.xlsx)
                    </p>
                </div>
                <Button
                    variant="soft-blue"
                    class="h-10 px-6"
                    onclick={() => fileInput?.click()}
                >
                    <FileSpreadsheet size={16} class="mr-2" />
                    Seleccionar Archivo
                </Button>
                <input
                    type="file"
                    accept=".xlsx"
                    class="hidden"
                    bind:this={fileInput}
                    onchange={handleFileChange}
                />
            </div>
        {/if}

        <!-- ── STEP: PARSING / MATCHING ── -->
        {#if step === "parsing" || step === "matching"}
            <div
                class="flex flex-col items-center justify-center gap-4 py-14 rounded-xl bg-slate-50"
            >
                <div class="animate-spin">
                    <Loader2 size={32} class="text-sky-500" />
                </div>
                <div class="text-center">
                    <p class="text-sm font-bold text-slate-700">
                        {step === "parsing"
                            ? "Leyendo archivo..."
                            : "Buscando coincidencias en la base de datos..."}
                    </p>
                    <p class="text-xs text-slate-400 mt-1">
                        Esto puede tardar unos segundos
                    </p>
                </div>
            </div>
        {/if}

        <!-- ── STEP: RESULTS ── -->
        {#if step === "results" && stats}
            <!-- KPI Cards -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div
                    class="rounded-xl p-4 bg-slate-50 border border-slate-200 text-center"
                >
                    <p class="text-2xl font-bold text-slate-800">
                        {stats.totalImported}
                    </p>
                    <p class="text-xs font-medium text-slate-400 mt-1">
                        Folios importados
                    </p>
                </div>
                <div
                    class="rounded-xl p-4 bg-emerald-50 border border-emerald-200 text-center"
                >
                    <p class="text-2xl font-bold text-emerald-600">
                        {stats.found}
                    </p>
                    <p class="text-xs font-medium text-emerald-500 mt-1">
                        Encontrados
                    </p>
                </div>
                <div
                    class="rounded-xl p-4 {stats.notFound > 0
                        ? 'bg-rose-50 border-rose-200'
                        : 'bg-slate-50 border-slate-200'} border text-center"
                >
                    <p
                        class="text-2xl font-bold {stats.notFound > 0
                            ? 'text-rose-600'
                            : 'text-slate-400'}"
                    >
                        {stats.notFound}
                    </p>
                    <p
                        class="text-xs font-medium {stats.notFound > 0
                            ? 'text-rose-500'
                            : 'text-slate-400'} mt-1"
                    >
                        No encontrados
                    </p>
                </div>
                <div
                    class="rounded-xl p-4 bg-sky-50 border border-sky-200 text-center"
                >
                    <p class="text-2xl font-bold text-sky-600">
                        {stats.pctMatch}%
                    </p>
                    <p class="text-xs font-medium text-sky-500 mt-1">
                        Coincidencia
                    </p>
                </div>
            </div>

            <!-- Usage summary -->
            <div
                class="flex items-center gap-4 p-4 rounded-xl bg-sky-50/50 border border-sky-100"
            >
                <div class="flex-1 text-center">
                    <p class="text-lg font-bold text-sky-700">
                        {stats.totalUsos.toLocaleString()}
                    </p>
                    <p class="text-[11px] font-medium text-sky-500">
                        Total de usos
                    </p>
                </div>
                <div
                    class="w-px h-8 bg-sky-200"
                    role="separator"
                    aria-hidden="true"
                ></div>
                <div class="flex-1 text-center">
                    <p class="text-lg font-bold text-sky-700">
                        {stats.promedio}
                    </p>
                    <p class="text-[11px] font-medium text-sky-500">
                        Promedio por persona
                    </p>
                </div>
            </div>

            <!-- Unmatched folios (if any) -->
            {#if matchResult && matchResult.unmatched.length > 0}
                <div
                    class="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden"
                >
                    <div
                        class="flex items-center gap-2 px-4 py-3 bg-amber-100/50"
                    >
                        <AlertTriangle
                            size={16}
                            class="text-amber-600 shrink-0"
                        />
                        <p class="text-xs font-bold text-amber-800">
                            Folios no encontrados ({matchResult.unmatched
                                .length})
                        </p>
                    </div>
                    <div class="max-h-40 overflow-y-auto px-4 py-2">
                        <div class="flex flex-wrap gap-1.5">
                            {#each matchResult.unmatched as entry}
                                <Badge variant="amber" class="text-[11px]">
                                    {entry.folio}
                                    <span class="opacity-60 ml-1"
                                        >({entry.conteo})</span
                                    >
                                </Badge>
                            {/each}
                        </div>
                    </div>
                </div>
            {/if}

            <!-- Success message -->
            {#if stats.found > 0}
                <div
                    class="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200"
                >
                    <CheckCircle2
                        size={20}
                        class="text-emerald-500 shrink-0 mt-0.5"
                    />
                    <div>
                        <p class="text-sm font-bold text-emerald-800">
                            ¡Listo para exportar!
                        </p>
                        <p class="text-xs text-emerald-600 mt-0.5">
                            Se generará un directorio de personal con {stats.found}
                            registros incluyendo el conteo de uso de tarjetas KONE
                            y métricas estadísticas.
                        </p>
                    </div>
                </div>
            {:else}
                <div
                    class="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200"
                >
                    <XCircle size={20} class="text-rose-500 shrink-0 mt-0.5" />
                    <div>
                        <p class="text-sm font-bold text-rose-800">
                            Sin coincidencias
                        </p>
                        <p class="text-xs text-rose-600 mt-0.5">
                            Ninguno de los folios importados coincide con
                            tarjetas KONE asignadas en el sistema.
                        </p>
                    </div>
                </div>
            {/if}
        {/if}
    </div>

    {#snippet footer()}
        {#if step === "results"}
            <Button
                variant="soft-blue"
                class="h-10 px-5"
                onclick={() => {
                    reset();
                }}
            >
                Importar otro archivo
            </Button>
            {#if stats && stats.found > 0}
                <Button
                    variant="primary"
                    class="h-10 px-6 flex items-center gap-2 shadow-lg shadow-blue-500/20"
                    onclick={handleExport}
                    disabled={isExporting}
                >
                    {#if isExporting}
                        <Loader2 size={16} class="animate-spin" />
                        Exportando...
                    {:else}
                        <Download size={16} />
                        Descargar Directorio con Conteo
                    {/if}
                </Button>
            {/if}
        {:else if step === "idle"}
            <Button variant="soft-blue" class="h-10 px-5" onclick={closeModal}>
                Cancelar
            </Button>
        {/if}
    {/snippet}
</Modal>
