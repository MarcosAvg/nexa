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
        findDuplicateFolios,
        getDuplicateFoliosSummary,
        type KoneUsageMatchResult,
        type DuplicateFolioInfo,
    } from "../../utils/xlsxKoneUsage";
    import { exportKoneUsageToExcel } from "../../utils/xlsxExport";

    type Props = {
        isOpen: boolean;
    };

    let { isOpen = $bindable() }: Props = $props();

    let step = $state<"idle" | "parsing" | "matching" | "results">("idle");
    let matchResult = $state<KoneUsageMatchResult | null>(null);
    let rawEntries = $state<any[]>([]);
    let duplicates = $state<DuplicateFolioInfo[]>([]);
    let showDuplicates = $state(false);
    let isExporting = $state(false);
    let usageThreshold = $state(10);
    let creationLimitDate = $state<string>("");
    let inactivityLimitDate = $state<string>("");
    let fileInput = $state<HTMLInputElement>();
    let selectedDependency = $state<string>('');

    function reset() {
        step = "idle";
        matchResult = null;
        rawEntries = [];
        duplicates = [];
        showDuplicates = false;
        isExporting = false;
        selectedDependency = '';
    }

    function closeModal() {
        reset();
        isOpen = false;
    }

    async function handleFileChange(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        if (!creationLimitDate || !inactivityLimitDate) {
            toast.error(
                "Por favor seleccione ambas fechas límite para el análisis.",
            );
            if (input) input.value = "";
            return;
        }

        step = "parsing";
        try {
            const entries = await parseKoneUsageFile(
                file,
                creationLimitDate,
                inactivityLimitDate,
            );

            if (entries.length === 0) {
                toast.error("No se encontraron datos en el archivo.");
                step = "idle";
                return;
            }

            // Detect duplicates
            const foundDuplicates = findDuplicateFolios(entries);
            rawEntries = entries;
            duplicates = foundDuplicates;

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
        if (!filteredResult) return;

        isExporting = true;
        try {
            await exportKoneUsageToExcel(filteredResult, usageThreshold, selectedDependency || undefined);
            toast.success("Exportación completada");
        } catch (err) {
            console.error("Export Error:", err);
            toast.error("Error al exportar los datos");
        } finally {
            isExporting = false;
        }
    }

    // Derived unique dependencies from matched results
    let availableDependencies = $derived.by(() => {
        if (!matchResult) return [];
        const deps = new Set(matchResult.matched.map(m => m.person.dependency || 'Sin Dependencia'));
        return Array.from(deps).sort();
    });

    // Filtered match result based on selected dependency
    let filteredResult = $derived.by(() => {
        if (!matchResult) return null;
        if (!selectedDependency) return matchResult;

        const filteredMatched = matchResult.matched.filter(
            m => (m.person.dependency || 'Sin Dependencia') === selectedDependency
        );
        return {
            matched: filteredMatched,
            unmatched: matchResult.unmatched,
            totalImported: matchResult.totalImported,
        };
    });

    // Derived stats (uses filtered data)
    let stats = $derived.by(() => {
        if (!filteredResult) return null;
        const totalUsos = filteredResult.matched.reduce(
            (sum, m) => sum + m.conteo,
            0,
        );
        const promedio =
            filteredResult.matched.length > 0
                ? (totalUsos / filteredResult.matched.length).toFixed(1)
                : "0";
        return {
            totalImported: filteredResult.totalImported,
            found: filteredResult.matched.length,
            notFound: filteredResult.unmatched.length,
            pctMatch:
                filteredResult.totalImported > 0
                    ? (
                          (filteredResult.matched.length /
                              filteredResult.totalImported) *
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
                class="flex flex-col items-center justify-center gap-4 py-8 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50"
            >
                <div
                    class="grid grid-cols-1 md:grid-cols-2 gap-4 w-full px-8 pb-2"
                >
                    <div
                        class="text-left bg-white p-3 rounded-lg border border-slate-200 shadow-sm"
                    >
                        <label
                            class="block text-xs font-bold text-slate-700 mb-1"
                            >Inactividad (Fecha Límite)</label
                        >
                        <input
                            type="date"
                            bind:value={inactivityLimitDate}
                            class="w-full h-9 px-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 text-sm outline-none bg-slate-50"
                        />
                        <p
                            class="text-[10px] text-slate-500 mt-1.5 leading-tight"
                        >
                            Días de inactividad respecto al último registro de
                            uso.
                        </p>
                    </div>
                    <div
                        class="text-left bg-white p-3 rounded-lg border border-slate-200 shadow-sm"
                    >
                        <label
                            class="block text-xs font-bold text-slate-700 mb-1"
                            >Cortesía (Límite Creación)</label
                        >
                        <input
                            type="date"
                            bind:value={creationLimitDate}
                            class="w-full h-9 px-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 text-sm outline-none bg-slate-50"
                        />
                        <p
                            class="text-[10px] text-slate-500 mt-1.5 leading-tight"
                        >
                            Ignorar tarjetas creadas/modificadas después de esta
                            fecha.
                        </p>
                    </div>
                </div>

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
                    onclick={() => {
                        if (!creationLimitDate || !inactivityLimitDate) {
                            toast.error(
                                "Seleccione ambas fechas límite antes de subir el archivo.",
                            );
                            return;
                        }
                        fileInput?.click();
                    }}
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

            <!-- Duplicates warning -->
            {#if duplicates.length > 0}
                <div class="p-4 rounded-xl bg-amber-50 border border-amber-200">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2">
                            <AlertTriangle size={16} class="text-amber-600" />
                            <p class="text-xs font-bold text-amber-700 uppercase tracking-wider">
                                Folios Duplicados Detectados
                            </p>
                        </div>
                        <Badge variant="amber" class="font-mono">
                            {duplicates.length} folios
                        </Badge>
                    </div>
                    <p class="text-[11px] text-amber-600 mb-3">
                        Se encontraron {duplicates.reduce((sum, dup) => sum + dup.occurrences - 1, 0)} filas duplicadas. 
                        Los conteos fueron sumados automáticamente.
                    </p>
                    <div class="flex items-center gap-3">
                        <Button
                            variant="soft-slate"
                            size="sm"
                            onclick={() => showDuplicates = !showDuplicates}
                        >
                            {showDuplicates ? 'Ocultar' : 'Ver'} detalles
                        </Button>
                        <div class="text-[10px] text-amber-500">
                            Total filas: {rawEntries.length} → Folios únicos: {stats.totalImported}
                        </div>
                    </div>
                    
                    {#if showDuplicates}
                        <div class="mt-3 max-h-48 overflow-y-auto border border-amber-200 rounded-lg bg-amber-25/50 p-3">
                            {#each duplicates as dup}
                                <div class="mb-3 pb-3 border-b border-amber-200 last:border-0">
                                    <div class="flex items-center justify-between mb-1">
                                        <span class="font-mono text-xs font-bold text-amber-800">
                                            Folio: {dup.folio}
                                        </span>
                                        <span class="text-xs text-amber-600">
                                            {dup.occurrences} veces → {dup.totalConteo} usos totales
                                        </span>
                                    </div>
                                    <div class="grid grid-cols-2 gap-1 text-[10px] text-amber-700">
                                        {#each dup.rows as row, i}
                                            <div class="flex justify-between">
                                                <span>Fila {i + 1}:</span>
                                                <span>conteo={row.conteo}, inactividad={row.diasInactividad || 'N/A'}</span>
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/if}

            <!-- Dependency Filter -->
            {#if availableDependencies.length > 1}
                <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div class="flex items-center justify-between mb-3">
                        <p
                            class="text-xs font-bold text-slate-700 uppercase tracking-wider"
                        >
                            Filtrar por dependencia
                        </p>
                        {#if selectedDependency}
                            <button
                                class="text-[10px] font-medium text-sky-600 hover:text-sky-800 transition-colors"
                                onclick={() => selectedDependency = ''}
                            >
                                Mostrar todas
                            </button>
                        {/if}
                    </div>
                    <select
                        bind:value={selectedDependency}
                        class="w-full h-9 px-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 text-sm outline-none bg-white cursor-pointer"
                    >
                        <option value="">Todas las dependencias</option>
                        {#each availableDependencies as dep}
                            <option value={dep}>{dep}</option>
                        {/each}
                    </select>
                </div>
            {/if}

            <!-- Threshold -->
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div class="flex items-center justify-between mb-3">
                    <p
                        class="text-xs font-bold text-slate-700 uppercase tracking-wider"
                    >
                        Umbral de bajo uso
                    </p>
                    <Badge variant="blue" class="font-mono"
                        >{usageThreshold}</Badge
                    >
                </div>
                <p class="text-[11px] text-slate-400 mb-3">
                    Define la cantidad de usos para generar la hoja de personal
                    con bajo uso.
                </p>
                <div class="flex items-center gap-3">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        bind:value={usageThreshold}
                        class="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                    <input
                        type="number"
                        min="0"
                        bind:value={usageThreshold}
                        class="w-16 h-8 text-center text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                </div>
            </div>

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
