<!--
 * ImportReviewStep.svelte
 *
 * Paso de revisión final antes de importar.
 * Muestra los resultados de la búsqueda de coincidencias
 * para cada fila seleccionada, agrupados por hoja.
 * Incluye estado de carga durante la búsqueda.
 -->
<script lang="ts">
    import Badge from "../Badge.svelte";
    import ImportReviewRow from "./ImportReviewRow.svelte";
    import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-svelte";
    import type { ImportParseResult, ParsedSheet, ParsedRow } from "../../utils";
    import type { Person } from "../../types";

    let {
        parseResult,
        selectedRows,
        matchResults,
        expandedReviewRows,
        totalSelected,
        isReviewing,
        onToggleReviewRow,
    }: {
        parseResult: ImportParseResult | null;
        selectedRows: Set<string>;
        matchResults: Map<string, Person[]>;
        expandedReviewRows: Set<string>;
        totalSelected: number;
        isReviewing: boolean;
        onToggleReviewRow: (key: string) => void;
    } = $props();

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

{#if isReviewing}
    <div class="flex flex-col items-center gap-4 py-12">
        <div class="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
            <Loader2 size={28} class="animate-spin" />
        </div>
        <div class="text-center">
            <p class="text-sm font-semibold text-slate-700">Buscando coincidencias…</p>
            <p class="text-xs text-slate-400 mt-1">Validando {totalSelected} persona(s) contra la base de datos.</p>
        </div>
    </div>
{:else if parseResult}                        <!-- Barra de resumen de revisión -->
    {@const totalMatched = [...matchResults.values()].filter((v) => v.length > 0).length}
    {@const totalNoMatch = [...matchResults.values()].filter((v) => v.length === 0).length}
    <div class="flex items-center gap-3 text-xs">
        <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
            <CheckCircle2 size={12} />
            {totalMatched} con coincidencia
        </div>
        <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-medium">
            <AlertTriangle size={12} />
            {totalNoMatch} sin coincidencia
        </div>
        <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 font-medium">
            {totalSelected} total
        </div>
    </div>                            <!-- Filas de revisión por hoja -->
    <div class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {#each parseResult.sheets as sheet}
            {@const sheetRows = sheet.rows.filter(
                (r) => r.isValid && selectedRows.has(`${sheet.key}-${r.rowNumber}`),
            )}
            {#if sheetRows.length > 0}
                <div>
                    <div class="flex items-center gap-2 mb-2">
                        <Badge variant={SHEET_COLORS[sheet.key] ?? "slate"}>
                            {sheet.label}
                        </Badge>
                        <span class="text-[10px] text-slate-400 font-medium">
                            {sheetRows.length} fila(s)
                        </span>
                    </div>
                    <div class="space-y-2">
                        {#each sheetRows as row}
                            {@const rowKey = `${sheet.key}-${row.rowNumber}`}
                            {@const matches = matchResults.get(rowKey) ?? []}
                            {@const isExpanded = expandedReviewRows.has(rowKey)}
                            <ImportReviewRow
                                {row}
                                sheetKey={sheet.key}
                                {matches}
                                {isExpanded}
                                onToggle={() => onToggleReviewRow(rowKey)}
                            />
                        {/each}
                    </div>
                </div>
            {/if}
        {/each}
    </div>
{/if}
