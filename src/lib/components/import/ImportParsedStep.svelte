<!--
 * ImportParsedStep.svelte
 *
 * Paso de revisión de datos parseados.
 * Muestra las filas encontradas en la plantilla agrupadas
 * por hoja (altas, modificaciones, bajas, etc.) y permite
 * seleccionar/deseleccionar filas para importar.
 -->
<script lang="ts">
    import Badge from "../Badge.svelte";
    import { ChevronDown, ChevronRight, AlertCircle } from "lucide-svelte";
    import type { ImportParseResult, ParsedSheet } from "../../utils";

    let {
        parseResult,
        selectedRows,
        expandedSheets,
        onToggleSheet,
        onToggleRow,
        onToggleSheetSelection,
    }: {
        parseResult: ImportParseResult | null;
        selectedRows: Set<string>;
        expandedSheets: Set<string>;
        onToggleSheet: (key: string) => void;
        onToggleRow: (sheetKey: string, rowNumber: number) => void;
        onToggleSheetSelection: (sheet: ParsedSheet) => void;
    } = $props();

    let totalSelected = $derived(selectedRows.size);

    const SHEET_COLORS: Record<
        string,
        "emerald" | "amber" | "rose" | "blue" | "violet" | "slate"
    > = {
        altas: "emerald",
        modificaciones: "amber",
        baja_persona: "rose",
        reposicion: "blue",
        reporte_falla: "violet",
    };
</script>

{#if parseResult}                    <!-- Resumen -->
    <div class="grid grid-cols-3 gap-3 text-center">
        <div class="rounded-lg p-3 bg-slate-50 border border-slate-200">
            <p class="text-2xl font-bold text-slate-800">
                {parseResult.sheets.reduce(
                    (s, sh) => s + sh.rows.length,
                    0,
                )}
            </p>
            <p class="text-xs text-slate-500 mt-0.5">Filas encontradas</p>
        </div>
        <div class="rounded-lg p-3 bg-emerald-50 border border-emerald-200">
            <p class="text-2xl font-bold text-emerald-700">
                {totalSelected}
            </p>
            <p class="text-xs text-emerald-600 mt-0.5">Seleccionados</p>
        </div>
        <div
            class="rounded-lg p-3 {parseResult.totalInvalid > 0
                ? 'bg-rose-50 border-rose-200'
                : 'bg-slate-50 border-slate-200'} border"
        >
            <p
                class="text-2xl font-bold {parseResult.totalInvalid > 0
                    ? 'text-rose-600'
                    : 'text-slate-400'}"
            >
                {parseResult.totalInvalid}
            </p>
            <p
                class="text-xs {parseResult.totalInvalid > 0
                    ? 'text-rose-500'
                    : 'text-slate-400'} mt-0.5"
            >
                Con errores (se omitirán)
            </p>
        </div>
    </div>                        <!-- Desglose por hoja -->
    <div class="space-y-2">
        {#each parseResult.sheets as sheet}
            {@const isExpanded = expandedSheets.has(sheet.key)}
            <div class="rounded-lg border border-slate-200 overflow-hidden">                            <!-- Encabezado -->
                <div
                    class="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200/50"
                >
                    <input
                        type="checkbox"
                        class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={sheet.rows
                            .filter((r) => r.isValid)
                            .every((r) =>
                                selectedRows.has(
                                    `${sheet.key}-${r.rowNumber}`,
                                ),
                            )}
                        indeterminate={sheet.rows
                            .filter((r) => r.isValid)
                            .some((r) =>
                                selectedRows.has(
                                    `${sheet.key}-${r.rowNumber}`,
                                ),
                            ) &&
                            !sheet.rows
                                .filter((r) => r.isValid)
                                .every((r) =>
                                    selectedRows.has(
                                        `${sheet.key}-${r.rowNumber}`,
                                    ),
                                )}
                        onchange={() => onToggleSheetSelection(sheet)}
                        disabled={sheet.rows.filter((r) => r.isValid).length === 0}
                    />
                    <button
                        class="flex-1 flex items-center justify-between gap-3 text-left"
                        onclick={() => onToggleSheet(sheet.key)}
                    >
                        <div class="flex items-center gap-2">
                            <Badge
                                variant={SHEET_COLORS[sheet.key] ?? "slate"}
                            >
                                {sheet.label}
                            </Badge>
                            <span class="text-xs text-slate-500"
                                >{sheet.rows.length} fila(s)</span
                            >
                        </div>
                        <div class="flex items-center gap-2">
                            {#if sheet.invalidCount > 0}
                                <span
                                    class="text-xs text-rose-500 font-medium"
                                    >{sheet.invalidCount} con error</span
                                >
                            {/if}
                            {#if isExpanded}
                                <ChevronDown size={14} class="text-slate-400" />
                            {:else}
                                <ChevronRight size={14} class="text-slate-400" />
                            {/if}
                        </div>
                    </button>
                </div>                        <!-- Detalle de filas (expandible) -->
                {#if isExpanded}
                    <div class="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                        {#each sheet.rows as row}
                            <div
                                class="flex items-start gap-3 px-4 py-2.5 {row.isValid
                                    ? ''
                                    : 'bg-rose-50/50'}"
                            >
                                {#if row.isValid}
                                    <input
                                        type="checkbox"
                                        class="mt-1 w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        checked={selectedRows.has(
                                            `${sheet.key}-${row.rowNumber}`,
                                        )}
                                        onchange={() =>
                                            onToggleRow(sheet.key, row.rowNumber)}
                                    />
                                {:else}
                                    <AlertCircle
                                        size={14}
                                        class="text-rose-500 mt-0.5 shrink-0"
                                    />
                                {/if}
                                <div class="min-w-0">
                                    <p class="text-xs font-medium text-slate-700 truncate">
                                        {[row.fields.apellidos, row.fields.nombres]
                                            .filter(Boolean)
                                            .join(", ") || `Fila ${row.rowNumber}`}
                                        {#if row.fields.dependencia}
                                            <span class="text-slate-400">
                                                — {row.fields.dependencia}
                                            </span>
                                        {/if}
                                    </p>
                                    {#if !row.isValid}
                                        <p class="text-[10px] text-rose-500 mt-0.5">
                                            Faltan: {row.missingRequired.join(", ")}
                                        </p>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}
    </div>

    {#if parseResult.totalInvalid > 0}
        <p class="text-xs text-rose-500 flex items-center gap-1.5">
            <AlertCircle size={12} />
            Las filas con errores no serán importadas. Corrígelas en la plantilla y vuelve a subirla.
        </p>
    {/if}
{/if}
