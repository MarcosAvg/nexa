<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import Badge from "../Badge.svelte";
    import { ticketService } from "../../services/tickets";
    import { personnelService } from "../../services/personnel";
    import { toast } from "svelte-sonner";
    import { handleError, exportConflictReportToExcel } from "../../utils";
    import type { ConflictReportInput } from "../../utils";
    import {
        FileSpreadsheet,
        CheckCircle2,
        AlertCircle,
        ChevronDown,
        ChevronRight,
        Upload,
        User,
        CreditCard,
        Loader2,
        Search,
        ArrowLeft,
        ArrowRight,
        AlertTriangle,
    } from "lucide-svelte";
    import {
        parseTemplateFile,
        SHEET_TO_TICKET_TYPE,
        FIELD_LABELS,
        type ImportParseResult,
        type ParsedSheet,
        type ParsedRow,
    } from "../../utils";
    import type { Person } from "../../types";
    import {
        analyzeAltaConflicts,
        analyzeModificacionConflicts,
    } from "../../utils/matchAnalysis";
    import type {
        AltaConflictAnalysis,
        ModificacionConflictAnalysis,
        AltaCardConflict,
    } from "../../utils/matchAnalysis";

    /**
     * ImportPreviewModal — Modal de importación de personal vía Excel.
     *
     * Guía al usuario a través de 3 pasos: idle (selección de archivo),
     * parsed (vista previa de datos parseados) y review (revisión final).
     *
     * @example
     * <ImportPreviewModal bind:isOpen onComplete={refreshData} />
     */
    let {
        /** Controla la visibilidad del modal (two-way bindable). */
        isOpen = $bindable(false),
        /** Callback al completar la importación. */
        onComplete,
    }: {
        isOpen: boolean;
        onComplete?: () => void;
    } = $props();

    // ── State ──────────────────────────────────────────
    type Step = "idle" | "parsed" | "review" | "importing" | "done";

    let step = $state<Step>("idle");
    let parseResult = $state<ImportParseResult | null>(null);
    let isParsing = $state(false);
    let isImporting = $state(false);
    let importResult = $state<{ created: number; errors: any[] } | null>(null);

    /** Which sheet accordions are expanded */
    let expandedSheets = $state<Set<string>>(new Set());

    /** Which rows are selected for import (key is 'sheetKey-rowNumber') */
    let selectedRows = $state<Set<string>>(new Set());

    let fileInput = $state<HTMLInputElement>();

    // ── Review state ──────────────────────────────────
    let isReviewing = $state(false);
    /** Map<rowKey, Person[]> — matches for each row */
    let matchResults = $state<Map<string, Person[]>>(new Map());
    /** Which rows are expanded in the review step */
    let expandedReviewRows = $state<Set<string>>(new Set());

    /** Conflict analyses for ALTAS rows */
    let altaAnalyses = $state<Map<string, AltaConflictAnalysis>>(new Map());
    /** Conflict analyses for MODIFICACIONES rows */
    let modAnalyses = $state<Map<string, ModificacionConflictAnalysis>>(new Map());

    // ── Review tab state ────────────────────────────────
    let reviewTab = $state<'conflict' | 'ok'>('conflict');
    let reviewSheetTab = $state<string>('altas');

    function rowMatchesTab(sheetKey: string, row: ParsedRow, tab: string): boolean {
        const rk = `${sheetKey}-${row.rowNumber}`;
        if (sheetKey === 'altas') {
            const ana = altaAnalyses.get(rk);
            const hasConflict = ana ? ana.hasConflicts : false;
            return tab === 'conflict' ? hasConflict : !hasConflict;
        }
        if (sheetKey === 'modificaciones') {
            const ana = modAnalyses.get(rk);
            const hasChange = ana ? ana.hasChanges : false;
            // Invertido: cambios → OK (proceder), sin cambios → conflicto (innecesaria)
            return tab === 'conflict' ? !hasChange : hasChange;
        }
        // Other types (baja, reposicion, reporte_falla):
        // persona no encontrada → conflicto, encontrada → ok
        const matches = matchResults.get(rk) ?? [];
        const hasMatch = matches.length > 0;
        return tab === 'conflict' ? !hasMatch : hasMatch;
    }

    // ── Helpers ────────────────────────────────────────

    function reset() {
        step = "idle";
        parseResult = null;
        importResult = null;
        expandedSheets = new Set();
        matchResults = new Map();
        expandedReviewRows = new Set();
        altaAnalyses = new Map();
        modAnalyses = new Map();
    }

    function closeModal() {
        reset();
        isOpen = false;
    }

    function toggleSheet(key: string) {
        const next = new Set(expandedSheets);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        expandedSheets = next;
    }

    // ── File Handling ──────────────────────────────────

    async function handleFileChange(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        isParsing = true;
        try {
            const result = await parseTemplateFile(file);
            if (!result.hasAnyData) {
                toast.warning("El archivo no contiene datos en ninguna hoja.");
                return;
            }
            parseResult = result;
            step = "parsed";                // Inicializar selección con todas las filas válidas
            const initialSelected = new Set<string>();
            result.sheets.forEach((sheet) => {
                sheet.rows.forEach((row) => {
                    if (row.isValid) {
                        initialSelected.add(`${sheet.key}-${row.rowNumber}`);
                    }
                });
            });
            selectedRows = initialSelected;
        } catch (err) {
            handleError(err, "Leer Plantilla Excel");
        } finally {
            isParsing = false;
            input.value = "";
        }
    }

    // ── Review step ───────────────────────────────────

    async function startReview() {
        if (!parseResult) return;
        isReviewing = true;
        step = "review";

        const newMatches = new Map<string, Person[]>();
        // Desduplicar por par de nombres para evitar llamadas API redundantes
        const nameCache = new Map<string, Person[]>();

        const selectedRowsList: { sheet: ParsedSheet; row: ParsedRow }[] = [];
        parseResult.sheets.forEach((sheet) => {
            sheet.rows.forEach((row) => {
                const rowKey = `${sheet.key}-${row.rowNumber}`;
                if (row.isValid && selectedRows.has(rowKey)) {
                    selectedRowsList.push({ sheet, row });
                }
            });
        });

        for (const { sheet, row } of selectedRowsList) {
            const rowKey = `${sheet.key}-${row.rowNumber}`;
            const nameKey = `${(row.fields.apellidos ?? "").toLowerCase().trim()}|${(row.fields.nombres ?? "").toLowerCase().trim()}`;

            if (nameCache.has(nameKey)) {
                newMatches.set(rowKey, nameCache.get(nameKey)!);
            } else {
                try {
                    const results = await personnelService.searchByName(
                        row.fields.apellidos ?? "",
                        row.fields.nombres ?? "",
                    );
                    nameCache.set(nameKey, results);
                    newMatches.set(rowKey, results);
                } catch {
                    newMatches.set(rowKey, []);
                }
            }
        }

        matchResults = newMatches;

        // ── Computar análisis de conflictos para ALTAS y MODIFICACIONES ──
        const newAltaAnalyses = new Map<string, AltaConflictAnalysis>();
        const newModAnalyses = new Map<string, ModificacionConflictAnalysis>();

        for (const sheet of parseResult.sheets) {
            for (const row of sheet.rows) {
                if (!row.isValid) continue;
                const rk = `${sheet.key}-${row.rowNumber}`;
                if (!selectedRows.has(rk)) continue;
                const matches = newMatches.get(rk) ?? [];
                if (matches.length === 0) continue;
                const person = matches[0];

                if (sheet.key === "altas") {
                    newAltaAnalyses.set(
                        rk,
                        analyzeAltaConflicts(rk, person, row.fields),
                    );
                } else if (sheet.key === "modificaciones") {
                    newModAnalyses.set(
                        rk,
                        analyzeModificacionConflicts(rk, person, row.fields),
                    );
                }
            }
        }

        altaAnalyses = newAltaAnalyses;
        modAnalyses = newModAnalyses;

        // Expandir todas las filas automáticamente
        expandedReviewRows = new Set(newMatches.keys());
        isReviewing = false;
    }

    function toggleReviewRow(key: string) {
        const next = new Set(expandedReviewRows);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        expandedReviewRows = next;
    }

    // ── Per-type helpers ──────────────────────────────

    /** For Altas: which card types are requested */
    function getRequestedCards(fields: Record<string, string>): string[] {
        const types: string[] = [];
        const yes = ["sí", "si"];
        if (yes.includes((fields.p2000_req ?? "").toLowerCase()))
            types.push("P2000");
        if (yes.includes((fields.kone_req ?? "").toLowerCase()))
            types.push("KONE");
        return types;
    }

    /** For Reposición: which card types to replace */
    function getReposicionCards(
        fields: Record<string, string>,
    ): { type: string; folio: string }[] {
        const cards: { type: string; folio: string }[] = [];
        const yes = ["sí", "si"];
        if (yes.includes((fields.reponer_p2000 ?? "").toLowerCase())) {
            cards.push({ type: "P2000", folio: fields.folio_p2000 ?? "" });
        }
        if (yes.includes((fields.reponer_kone ?? "").toLowerCase())) {
            cards.push({ type: "KONE", folio: fields.folio_kone ?? "" });
        }
        return cards;
    }

    /** For Modificación: extract non-empty changes */
    function getModificationChanges(
        fields: Record<string, string>,
    ): { label: string; value: string }[] {
        const changes: { label: string; value: string }[] = [];
        const map: [string, string][] = [
            ["nuevo_apellido", "Nuevo Apellido"],
            ["nuevo_nombre", "Nuevo Nombre"],
            ["nueva_dep", "Nueva Dependencia"],
            ["nuevo_edificio", "Nuevo Edificio"],
            ["nuevo_piso", "Nuevo Piso Base"],
            ["nueva_area", "Nueva Área"],
            ["nuevo_puesto", "Nuevo Puesto"],
            ["hora_entrada", "Hora Entrada"],
            ["hora_salida", "Hora Salida"],
        ];
        for (const [field, label] of map) {
            if (fields[field]) changes.push({ label, value: fields[field] });
        }
        if (fields.accion_p2000) {
            changes.push({
                label: "Acción P2000",
                value: `${fields.accion_p2000}: ${fields.pisos_p2000 || "N/A"}`,
            });
        }
        if (fields.accion_kone) {
            changes.push({
                label: "Acción KONE",
                value: `${fields.accion_kone}: ${fields.pisos_kone || "N/A"}`,
            });
        }
        if (fields.accion_acc) {
            const accesses =
                [fields.acceso1, fields.acceso2, fields.acceso3]
                    .filter(Boolean)
                    .join(", ") || "N/A";
            changes.push({
                label: "Acción Acc. Esp.",
                value: `${fields.accion_acc}: ${accesses}`,
            });
        }
        return changes;
    }

    /** Get active cards count for a person */
    function getActiveCards(person: Person): any[] {
        return ((person as any).cards ?? []).filter(
            (c: any) => c.status === "active",
        );
    }

    // ── Resolution Helpers ────────────────────────────

    /**
     * Construye un ticket definition a partir de una hoja/fila.
     * fieldsOverride permite modificar campos antes de crear el ticket.
     */
    function buildTicketDef(
        sheetKey: string,
        row: ParsedRow,
        fieldsOverride?: Record<string, string>,
    ) {
        const fields = fieldsOverride ?? row.fields;
        const type = SHEET_TO_TICKET_TYPE[sheetKey] ?? sheetKey;
        let priority = "media";
        if (fields.urgencia) {
            const urg = fields.urgencia.toLowerCase();
            if (urg.includes("alta") || urg.includes("urgente"))
                priority = "alta";
            else if (urg.includes("baja")) priority = "baja";
        }
        return {
            type,
            title: buildTicketTitle(sheetKey, { ...row, fields }),
            description: buildTicketDescription({ ...row, fields }),
            priority,
            payload: fields,
        };
    }

    /**
     * Aplica las resoluciones del análisis de ALTAS y devuelve
     * uno o más tickets a crear (p.ej. alta + reposiciones adicionales).
     */
    function applyAltaResolutions(
        row: ParsedRow,
        analysis: AltaConflictAnalysis,
    ): any[] {
        const modifiedFields = { ...row.fields };
        const extraTickets: any[] = [];

        for (const conflict of analysis.conflicts) {
            if (!conflict.requested) continue;

            if (
                conflict.resolution === "skip_card" ||
                conflict.resolution === "convert_to_reposicion"
            ) {
                // Remover esta tarjeta del payload de alta
                if (conflict.cardType === "P2000") {
                    delete modifiedFields.p2000_req;
                    delete modifiedFields.pisos_p2000;
                } else {
                    delete modifiedFields.kone_req;
                    delete modifiedFields.pisos_kone;
                }

                // Si es conversión a reposición, crear ticket adicional
                if (conflict.resolution === "convert_to_reposicion") {
                    const lowerType = conflict.cardType.toLowerCase();
                    extraTickets.push({
                        type: "Reposición",
                        title: `Reposición ${conflict.cardType} — ${row.fields.apellidos}, ${row.fields.nombres}`,
                        description: `Reposición automática desde importación de Altas (${conflict.cardType} existente: ${conflict.existingFolio || "N/A"})`,
                        priority: "media",
                        payload: {
                            ...row.fields,
                            [`reponer_${lowerType}`]: "sí",
                            [`folio_${lowerType}`]:
                                conflict.existingFolio || "",
                            origen:
                                "Conversión desde Alta (matching inteligente)",
                        },
                    });
                }
            }
            // "proceed" → mantener como está en modifiedFields
        }

        // Verificar si aún quedan tarjetas solicitadas
        const stillWantsP2000 = ["sí", "si"].includes(
            (modifiedFields.p2000_req ?? "").toLowerCase(),
        );
        const stillWantsKONE = ["sí", "si"].includes(
            (modifiedFields.kone_req ?? "").toLowerCase(),
        );

        if (stillWantsP2000 || stillWantsKONE) {
            extraTickets.unshift(buildTicketDef("altas", row, modifiedFields));
        }

        return extraTickets;
    }

    // ── Import ─────────────────────────────────────────

    function buildTicketTitle(sheetKey: string, row: ParsedRow): string {
        const name = [row.fields.apellidos, row.fields.nombres]
            .filter(Boolean)
            .join(", ");
        const dep = row.fields.dependencia || "";
        return dep ? `${name} (${dep})` : name;
    }

    function buildTicketDescription(row: ParsedRow): string {
        return Object.entries(row.fields)
            .filter(([k, v]) => v && k !== "nombres" && k !== "apellidos")
            .map(([k, v]) => `${FIELD_LABELS[k] ?? k}: ${v}`)
            .join("\n");
    }

    function toggleRow(sheetKey: string, rowNumber: number) {
        const key = `${sheetKey}-${rowNumber}`;
        const next = new Set(selectedRows);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        selectedRows = next;
    }

    function toggleSheetSelection(sheet: ParsedSheet) {
        const rowKeys = sheet.rows
            .filter((r) => r.isValid)
            .map((r) => `${sheet.key}-${r.rowNumber}`);
        const allSelected = rowKeys.every((k) => selectedRows.has(k));

        const next = new Set(selectedRows);
        if (allSelected) {
            rowKeys.forEach((k) => next.delete(k));
        } else {
            rowKeys.forEach((k) => next.add(k));
        }
        selectedRows = next;
    }

    let totalSelected = $derived(selectedRows.size);

    async function handleImport() {
        if (!parseResult) return;

        isImporting = true;
        step = "importing";

        // ── Construir lista de tickets aplicando resoluciones ──
        const tickets: any[] = [];

        for (const sheet of parseResult.sheets) {
            for (const row of sheet.rows) {
                if (!row.isValid) continue;
                const rowKey = `${sheet.key}-${row.rowNumber}`;
                if (!selectedRows.has(rowKey)) continue;

                if (sheet.key === "altas" && altaAnalyses.has(rowKey)) {
                    const analysis = altaAnalyses.get(rowKey)!;
                    const result = applyAltaResolutions(row, analysis);
                    tickets.push(...result);
                } else if (
                    sheet.key === "modificaciones" &&
                    modAnalyses.has(rowKey)
                ) {
                    const analysis = modAnalyses.get(rowKey)!;
                    if (analysis.resolution === "reject") continue;
                    tickets.push(buildTicketDef(sheet.key, row));
                } else {
                    tickets.push(buildTicketDef(sheet.key, row));
                }
            }
        }

        try {
            const result = await ticketService.createBatch(tickets);
            importResult = result;
            step = "done";

            if (result.created > 0) {
                toast.success(
                    `${result.created} ticket(s) creados correctamente.`,
                );
                onComplete?.();
            }
            if (result.errors.length > 0) {
                toast.error(
                    `${result.errors.length} ticket(s) no pudieron crearse.`,
                );
            }
        } catch (err) {
            handleError(err, "Importar Tickets");
            step = "review";
        } finally {
            isImporting = false;
        }
    }

    // ── Export Report ──────────────────────────────────

    let isExportingReport = $state(false);

    async function handleExportReport() {
        if (!parseResult) return;
        isExportingReport = true;
        try {
            const input: ConflictReportInput = {
                parseResult,
                altaAnalyses,
                modAnalyses,
                matchResults,
                selectedRows,
                totalSelected,
            };
            await exportConflictReportToExcel(input);
            toast.success("Reporte exportado correctamente");
        } catch (err) {
            handleError(err, "Exportar Reporte de Conflictos");
        } finally {
            isExportingReport = false;
        }
    }

    // ── Badge helpers ──────────────────────────────────

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

    const CARD_TYPE_COLORS: Record<string, string> = {
        P2000: "bg-amber-100 text-amber-700 border-amber-200",
        KONE: "bg-blue-100 text-blue-700 border-blue-200",
    };

function cardStatusBadge(status: string): { text: string; color: "emerald" | "rose" | "slate" } {
    if (status === "active") return { text: "Activa", color: "emerald" };
    if (status === "blocked") return { text: "Bloqueada", color: "rose" };
    return { text: status, color: "slate" };
}
</script>

<Modal
    bind:isOpen
    title="Importar Plantilla Excel"
    description="Suba la plantilla completada para crear tickets automáticamente."
    size={step === "review" ? "xl" : "lg"}
    onclose={closeModal}
>
    <div class="space-y-5">
        <!-- ── STEP: IDLE ── -->
        {#if step === "idle"}
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
                    onclick={() => fileInput?.click()}
                >
                    <Upload size={16} class="mr-2" />
                    {isParsing ? "Leyendo archivo…" : "Seleccionar archivo"}
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

        <!-- ── STEP: PARSED ── -->
        {#if step === "parsed"}
            {#if parseResult}                    <!-- Resumen -->
                <div class="grid grid-cols-3 gap-3 text-center">
                    <div
                        class="rounded-lg p-3 bg-slate-50 border border-slate-200"
                    >
                        <p class="text-2xl font-bold text-slate-800">
                            {parseResult.sheets.reduce(
                                (s, sh) => s + sh.rows.length,
                                0,
                            )}
                        </p>
                        <p class="text-xs text-slate-500 mt-0.5">
                            Filas encontradas
                        </p>
                    </div>
                    <div
                        class="rounded-lg p-3 bg-emerald-50 border border-emerald-200"
                    >
                        <p class="text-2xl font-bold text-emerald-700">
                            {totalSelected}
                        </p>
                        <p class="text-xs text-emerald-600 mt-0.5">
                            Seleccionados
                        </p>
                    </div>
                    <div
                        class="rounded-lg p-3 {parseResult.totalInvalid > 0
                            ? 'bg-rose-50 border-rose-200'
                            : 'bg-slate-50 border-slate-200'} border"
                    >
                        <p
                            class="text-2xl font-bold {parseResult.totalInvalid >
                            0
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
                        <div
                            class="rounded-lg border border-slate-200 overflow-hidden"
                        >
                            <!-- Encabezado -->
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
                                    onchange={() => toggleSheetSelection(sheet)}
                                    disabled={sheet.rows.filter(
                                        (r) => r.isValid,
                                    ).length === 0}
                                />
                                <button
                                    class="flex-1 flex items-center justify-between gap-3 text-left"
                                    onclick={() => toggleSheet(sheet.key)}
                                >
                                    <div class="flex items-center gap-2">
                                        <Badge
                                            variant={SHEET_COLORS[sheet.key] ??
                                                "slate"}>{sheet.label}</Badge
                                        >
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
                                            <ChevronDown
                                                size={14}
                                                class="text-slate-400"
                                            />
                                        {:else}
                                            <ChevronRight
                                                size={14}
                                                class="text-slate-400"
                                            />
                                        {/if}
                                    </div>
                                </button>
                            </div>

                            <!-- Detalle de filas (expandible) -->
                            {#if isExpanded}
                                <div
                                    class="divide-y divide-slate-100 max-h-48 overflow-y-auto"
                                >
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
                                                        toggleRow(
                                                            sheet.key,
                                                            row.rowNumber,
                                                        )}
                                                />
                                            {:else}
                                                <AlertCircle
                                                    size={14}
                                                    class="text-rose-500 mt-0.5 shrink-0"
                                                />
                                            {/if}
                                            <div class="min-w-0">
                                                <p
                                                    class="text-xs font-medium text-slate-700 truncate"
                                                >
                                                    {[
                                                        row.fields.apellidos,
                                                        row.fields.nombres,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(", ") ||
                                                        `Fila ${row.rowNumber}`}
                                                    {#if row.fields.dependencia}
                                                        <span
                                                            class="text-slate-400"
                                                        >
                                                            — {row.fields
                                                                .dependencia}</span
                                                        >
                                                    {/if}
                                                </p>
                                                {#if !row.isValid}
                                                    <p
                                                        class="text-[10px] text-rose-500 mt-0.5"
                                                    >
                                                        Faltan: {row.missingRequired.join(
                                                            ", ",
                                                        )}
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
                        Las filas con errores no serán importadas. Corrígelas en
                        la plantilla y vuelve a subirla.
                    </p>
                {/if}
            {/if}
        {/if}

        <!-- ── STEP: REVIEW ── -->
        {#if step === "review"}
            {#if isReviewing}
                <div class="flex flex-col items-center gap-4 py-12">
                    <div
                        class="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600"
                    >
                        <Loader2 size={28} class="animate-spin" />
                    </div>
                    <div class="text-center">
                        <p class="text-sm font-semibold text-slate-700">
                            Buscando coincidencias…
                        </p>
                        <p class="text-xs text-slate-400 mt-1">
                            Validando {totalSelected} persona(s) contra la base de
                            datos.
                        </p>
                    </div>
                </div>
            {:else if parseResult}                        <!-- Barra de resumen de revisión -->
                {@const totalMatched = [...matchResults.values()].filter(
                    (v) => v.length > 0,
                ).length}
                {@const totalNoMatch = [...matchResults.values()].filter(
                    (v) => v.length === 0,
                ).length}
                {@const totalConflicts = [...altaAnalyses.values()].filter(
                    (a) => a.hasConflicts,
                ).length}
                <div class="flex items-center gap-3 text-xs flex-wrap">
                    <div
                        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium"
                    >
                        <CheckCircle2 size={12} />
                        {totalMatched} con coincidencia
                    </div>
                    <div
                        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-medium"
                    >
                        <AlertTriangle size={12} />
                        {totalNoMatch} sin coincidencia
                    </div>
                    {#if totalConflicts > 0}
                        <div
                            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium"
                        >
                            <AlertCircle size={12} />
                            {totalConflicts} con conflicto
                        </div>
                    {/if}
                    <div
                        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 font-medium"
                    >
                        {totalSelected} total
                    </div>
                </div>

                            <!-- Tabs por tipo de solicitud -->
                            {@const sheetTabs = [
                                { key: 'altas', label: 'ALTAS' },
                                { key: 'modificaciones', label: 'MODIFICACIONES' },
                                { key: 'baja_persona', label: 'BAJA' },
                                { key: 'reposicion', label: 'REPOSICIÓN' },
                                { key: 'reporte_falla', label: 'REPORTE FALLA' },
                            ]}
                            <div class="flex gap-1.5 flex-wrap pb-2 px-1">
                                {#each sheetTabs as tab}
                                    {@const tabCount = parseResult.sheets.find(s => s.key === tab.key)?.rows.filter(r => r.isValid && selectedRows.has(`${tab.key}-${r.rowNumber}`)).length ?? 0}
                                    {#if tabCount > 0}
                                        <button
                                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors {reviewSheetTab === tab.key ? 'bg-blue-100 text-blue-800 border border-blue-300 shadow-sm' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}"
                                            onclick={() => reviewSheetTab = tab.key}
                                        >
                                            {tab.label}
                                            <span class="text-[10px] opacity-70">({tabCount})</span>
                                        </button>
                                    {/if}
                                {/each}
                            </div>

                            <!-- Sub-filtro: Con Conflicto / Sin Conflicto -->
                            {@const currentSheet = parseResult.sheets.find(s => s.key === reviewSheetTab)}
                            {@const sheetConflictCount = currentSheet?.rows.filter(r => r.isValid && selectedRows.has(`${reviewSheetTab}-${r.rowNumber}`) && rowMatchesTab(reviewSheetTab, r, 'conflict')).length ?? 0}
                            {@const sheetOkCount = currentSheet?.rows.filter(r => r.isValid && selectedRows.has(`${reviewSheetTab}-${r.rowNumber}`) && rowMatchesTab(reviewSheetTab, r, 'ok')).length ?? 0}
                            {#if sheetConflictCount > 0 || sheetOkCount > 0}
                                <div class="flex gap-2 px-1 pb-2">
                                    <button
                                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors {reviewTab === 'conflict' ? 'bg-rose-100 text-rose-800 border border-rose-300 shadow-sm' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}"
                                        onclick={() => reviewTab = 'conflict'}
                                    >
                                        <AlertCircle size={13} />
                                        Con Conflicto ({sheetConflictCount})
                                    </button>
                                    <button
                                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors {reviewTab === 'ok' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}"
                                        onclick={() => reviewTab = 'ok'}
                                    >
                                        <CheckCircle2 size={13} />
                                        Sin Conflicto ({sheetOkCount})
                                    </button>
                                </div>
                            {/if}

                            <!-- Filas de revisión por tipo seleccionado -->
                            <div class="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                                {#if currentSheet}
                                    {@const sheetRows = currentSheet.rows.filter(
                                        (r) =>
                                            r.isValid &&
                                            selectedRows.has(`${reviewSheetTab}-${r.rowNumber}`) &&
                                            rowMatchesTab(reviewSheetTab, r, reviewTab),
                                    )}
                                    {#if sheetRows.length > 0}
                                        <div class="space-y-2">
                                    {#each sheetRows as row}
                                        {@const rowKey = `${reviewSheetTab}-${row.rowNumber}`}
                                        {@const matches =
                                            matchResults.get(rowKey) ?? []}
                                        {@const isExpanded =
                                            expandedReviewRows.has(rowKey)}
                                        {@const topMatch =
                                            matches.length > 0
                                                ? matches[0]
                                                : null}
                                        <div
                                            class="rounded-xl border border-slate-200 overflow-hidden bg-white"
                                        >
                                            <!-- Encabezado de fila -->
                                            <button
                                                class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50/50 transition-colors"
                                                onclick={() =>
                                                    toggleReviewRow(rowKey)}
                                            >
                                                <div
                                                    class="flex items-center gap-3 min-w-0"
                                                >
                                                    {#if matches.length > 0}
                                                        <div
                                                            class="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0"
                                                        >
                                                            <CheckCircle2
                                                                size={13}
                                                            />
                                                        </div>
                                                    {:else if reviewSheetTab === "altas"}
                                                        <div
                                                            class="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0"
                                                        >
                                                            <CheckCircle2
                                                                size={13}
                                                            />
                                                        </div>
                                                    {:else}
                                                        <div
                                                            class="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0"
                                                        >
                                                            <AlertTriangle
                                                                size={13}
                                                            />
                                                        </div>
                                                    {/if}
                                                    <div class="min-w-0">
                                                        <p
                                                            class="text-sm font-semibold text-slate-800 truncate"
                                                        >
                                                            {[
                                                                row.fields
                                                                    .apellidos,
                                                                row.fields
                                                                    .nombres,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(", ")}
                                                        </p>
                                                        <p
                                                            class="text-[10px] text-slate-400 truncate"
                                                        >
                                                            {row.fields
                                                                .dependencia ??
                                                                ""}
                                                            {#if matches.length > 0}
                                                                · <span
                                                                    class="text-emerald-600 font-medium"
                                                                    >{matches.length}
                                                                    coincidencia(s)</span
                                                                >
                                                            {:else if reviewSheetTab === "altas"}
                                                                · <span
                                                                    class="text-emerald-600 font-medium"
                                                                    >Persona nueva
                                                                    — Sin
                                                                    conflictos</span
                                                                >
                                                            {:else}
                                                                · <span
                                                                    class="text-amber-600 font-medium"
                                                                    >Persona
                                                                    nueva / no
                                                                    encontrada</span
                                                                >
                                                            {/if}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div
                                                    class="shrink-0 text-slate-400"
                                                >
                                                    {#if isExpanded}
                                                        <ChevronDown
                                                            size={14}
                                                        />
                                                    {:else}
                                                        <ChevronRight
                                                            size={14}
                                                        />
                                                    {/if}
                                                </div>
                                            </button>

                                            <!-- Detalle expandido -->
                                            {#if isExpanded}
                                                <div
                                                    class="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3"
                                                >
                                                    <!-- ── TYPE: ALTAS (SMART) ── -->
                                                    {#if reviewSheetTab === "altas" && altaAnalyses.has(rowKey)}
                                                        {@const analysis =
                                                            altaAnalyses.get(
                                                                rowKey,
                                                            )!}
                                                        <div
                                                            class="space-y-3"
                                                        >
                                                            <!-- Tabla comparativa -->
                                                            <div
                                                                class="rounded-lg border border-slate-200 overflow-hidden"
                                                            >
                                                                <div
                                                                    class="grid grid-cols-[1fr_1fr_1fr_auto] gap-px bg-slate-200 text-[10px]"
                                                                >
                                                                    <div
                                                                        class="bg-slate-50 px-3 py-2 font-bold text-slate-500 uppercase tracking-wider"
                                                                    >
                                                                        Tarjeta
                                                                    </div>
                                                                    <div
                                                                        class="bg-slate-50 px-3 py-2 font-bold text-slate-500 uppercase tracking-wider text-center"
                                                                    >
                                                                        Solicitado
                                                                    </div>
                                                                    <div
                                                                        class="bg-slate-50 px-3 py-2 font-bold text-slate-500 uppercase tracking-wider text-center"
                                                                    >
                                                                        Tiene
                                                                    </div>
                                                                    <div
                                                                        class="bg-slate-50 px-3 py-2 font-bold text-slate-500 uppercase tracking-wider text-center"
                                                                    >
                                                                        Estado
                                                                    </div>

                                                                    {#each analysis.conflicts as conflict}
                                                                        <div
                                                                            class="bg-white px-3 py-2.5 font-semibold text-slate-700"
                                                                        >
                                                                            {conflict.cardType}
                                                                        </div>
                                                                        <div
                                                                            class="bg-white px-3 py-2.5 text-center"
                                                                        >
                                                                            {#if conflict.requested}
                                                                                <span
                                                                                    class="inline-flex items-center gap-1 text-xs font-bold text-green-600"
                                                                                >
                                                                                    <CheckCircle2
                                                                                        size={11}
                                                                                    />
                                                                                    Sí
                                                                                </span>
                                                                            {:else}
                                                                                <span
                                                                                    class="text-xs text-slate-400"
                                                                                >
                                                                                    —
                                                                                </span>
                                                                            {/if}
                                                                        </div>
                                                                        <div
                                                                            class="bg-white px-3 py-2.5 text-center"
                                                                        >
                                                                            {#if conflict.hasCard}
                                                                                <span
                                                                                    class="inline-flex items-center gap-1 text-xs font-medium"
                                                                                >
                                                                                    <CreditCard
                                                                                        size={10}
                                                                                        class="text-slate-400"
                                                                                    />
                                                                                    {conflict.existingFolio}
                                                                                </span>
                                                                            {:else}
                                                                                <span
                                                                                    class="text-xs text-slate-400"
                                                                                >
                                                                                    —
                                                                                </span>
                                                                            {/if}
                                                                        </div>
                                                                        <div
                                                                            class="bg-white px-3 py-2.5 text-center"
                                                                        >
                                                                            {#if conflict.conflict}
                                                                                <span
                                                                                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold"
                                                                                >
                                                                                    <AlertTriangle
                                                                                        size={10}
                                                                                    />
                                                                                    Conflicto
                                                                                </span>
                                                                            {:else}
                                                                                <span
                                                                                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold"
                                                                                >
                                                                                    <CheckCircle2
                                                                                        size={10}
                                                                                    />
                                                                                    OK
                                                                                </span>
                                                                            {/if}
                                                                        </div>
                                                                    {/each}
                                                                </div>
                                                            </div>

                                                            <!-- Pisos solicitados -->
                                                            {#each analysis.conflicts as conflict}
                                                                {#if conflict.requested && conflict.requestedFloors}
                                                                    <p
                                                                        class="text-[10px] text-slate-500"
                                                                    >
                                                                        <span
                                                                            class="font-semibold"
                                                                            >Pisos
                                                                            {conflict.cardType}:</span
                                                                        >
                                                                        {conflict.requestedFloors}
                                                                    </p>
                                                                {/if}
                                                            {/each}

                                                            <!-- Acciones por conflicto -->
                                                            {#if analysis.hasConflicts}
                                                                {#each analysis.conflicts as conflict}
                                                                    {#if conflict.conflict}
                                                                        <div
                                                                            class="rounded-lg border border-amber-200 bg-amber-50/80 p-3 space-y-2"
                                                                        >
                                                                            <div
                                                                                class="flex items-center gap-2 text-xs font-bold text-amber-800"
                                                                            >
                                                                                <AlertTriangle
                                                                                    size={14}
                                                                                />
                                                                                Conflicto:
                                                                                {conflict.description}
                                                                            </div>
                                                                            <div
                                                                                class="space-y-1.5"
                                                                            >
                                                                                <p
                                                                                    class="text-[10px] font-medium text-amber-700"
                                                                                >
                                                                                    Acción
                                                                                    para
                                                                                    {conflict.cardType}:
                                                                                </p>
                                                                                <label
                                                                                    class="flex items-center gap-2 p-2 rounded-lg bg-white border border-amber-200 cursor-pointer hover:bg-amber-50 transition-colors"
                                                                                >
                                                                                    <input
                                                                                        type="radio"
                                                                                        name="alta-resolve-{rowKey}-{conflict.cardType}"
                                                                                        checked={conflict.resolution ===
                                                                                            "skip_card"}
                                                                                        onchange={() => {
                                                                                            conflict.resolution =
                                                                                                "skip_card";
                                                                                        }}
                                                                                        class="w-3.5 h-3.5 text-amber-600 focus:ring-amber-500"
                                                                                    />
                                                                                    <div
                                                                                        class="flex-1 min-w-0"
                                                                                    >
                                                                                        <p
                                                                                            class="text-xs font-semibold text-slate-800"
                                                                                        >
                                                                                            Omitir
                                                                                            esta
                                                                                            tarjeta
                                                                                        </p>
                                                                                        <p
                                                                                            class="text-[10px] text-slate-500"
                                                                                        >
                                                                                            Dar
                                                                                            alta
                                                                                            solo
                                                                                            de
                                                                                            la(s)
                                                                                            otra(s)
                                                                                            tarjeta(s)
                                                                                        </p>
                                                                                    </div>
                                                                                </label>
                                                                                <label
                                                                                    class="flex items-center gap-2 p-2 rounded-lg bg-white border border-amber-200 cursor-pointer hover:bg-amber-50 transition-colors"
                                                                                >
                                                                                    <input
                                                                                        type="radio"
                                                                                        name="alta-resolve-{rowKey}-{conflict.cardType}"
                                                                                        checked={conflict.resolution ===
                                                                                            "convert_to_reposicion"}
                                                                                        onchange={() => {
                                                                                            conflict.resolution =
                                                                                                "convert_to_reposicion";
                                                                                        }}
                                                                                        class="w-3.5 h-3.5 text-amber-600 focus:ring-amber-500"
                                                                                    />
                                                                                    <div
                                                                                        class="flex-1 min-w-0"
                                                                                    >
                                                                                        <p
                                                                                            class="text-xs font-semibold text-slate-800"
                                                                                        >
                                                                                            Convertir
                                                                                            a
                                                                                            Reposición
                                                                                        </p>
                                                                                        <p
                                                                                            class="text-[10px] text-slate-500"
                                                                                        >
                                                                                            Crear
                                                                                            ticket
                                                                                            de
                                                                                            reposición
                                                                                            para
                                                                                            {conflict.cardType}
                                                                                        </p>
                                                                                    </div>
                                                                                </label>
                                                                                <label
                                                                                    class="flex items-center gap-2 p-2 rounded-lg bg-white border border-amber-200 cursor-pointer hover:bg-amber-50 transition-colors"
                                                                                >
                                                                                    <input
                                                                                        type="radio"
                                                                                        name="alta-resolve-{rowKey}-{conflict.cardType}"
                                                                                        checked={conflict.resolution ===
                                                                                            "proceed"}
                                                                                        onchange={() => {
                                                                                            conflict.resolution =
                                                                                                "proceed";
                                                                                        }}
                                                                                        class="w-3.5 h-3.5 text-amber-600 focus:ring-amber-500"
                                                                                    />
                                                                                    <div
                                                                                        class="flex-1 min-w-0"
                                                                                    >
                                                                                        <p
                                                                                            class="text-xs font-semibold text-slate-800"
                                                                                        >
                                                                                            Proceder
                                                                                            igual
                                                                                        </p>
                                                                                        <p
                                                                                            class="text-[10px] text-slate-500"
                                                                                        >
                                                                                            Crear
                                                                                            alta
                                                                                            duplicada
                                                                                            (no
                                                                                            recomendado)
                                                                                        </p>
                                                                                    </div>
                                                                                </label>
                                                                            </div>
                                                                        </div>
                                                                    {/if}
                                                                {/each}
                                                            {:else}
                                                                <div
                                                                    class="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700"
                                                                >
                                                                    <CheckCircle2
                                                                        size={14}
                                                                        class="shrink-0"
                                                                    />
                                                                    <span
                                                                        >Sin
                                                                        conflictos
                                                                        — la
                                                                        persona
                                                                        no
                                                                        tiene
                                                                        tarjetas
                                                                        activas
                                                                        de
                                                                        los
                                                                        tipos
                                                                        solicitados.</span
                                                                    >
                                                                </div>
                                                            {/if}
                                                        </div>

                                                        <!-- ── TYPE: MODIFICACIONES (SMART) ── -->
                                                    {:else if reviewSheetTab === "modificaciones" && modAnalyses.has(rowKey)}
                                                        {@const analysis =
                                                            modAnalyses.get(
                                                                rowKey,
                                                            )!}
                                                        <div
                                                            class="space-y-3"
                                                        >
                                                            <!-- Tabla de cambios -->
                                                            <div
                                                                class="rounded-lg border border-amber-200 overflow-hidden"
                                                            >
                                                                <div
                                                                    class="grid grid-cols-[1fr_1fr_1fr_auto] gap-px bg-amber-200 text-[10px]"
                                                                >
                                                                    <div
                                                                        class="bg-amber-50 px-3 py-2 font-bold text-amber-700 uppercase tracking-wider"
                                                                    >
                                                                        Campo
                                                                    </div>
                                                                    <div
                                                                        class="bg-amber-50 px-3 py-2 font-bold text-amber-700 uppercase tracking-wider text-center"
                                                                    >
                                                                        Actual
                                                                    </div>
                                                                    <div
                                                                        class="bg-amber-50 px-3 py-2 font-bold text-amber-700 uppercase tracking-wider text-center"
                                                                    >
                                                                        Nuevo
                                                                    </div>
                                                                    <div
                                                                        class="bg-amber-50 px-3 py-2"
                                                                    ></div>

                                                                    {#each analysis.changes as change}
                                                                        <div
                                                                            class="bg-white px-3 py-2 font-medium text-slate-700"
                                                                        >
                                                                            {change.label}
                                                                        </div>
                                                                        <div
                                                                            class="bg-white px-3 py-2 text-center text-slate-500"
                                                                        >
                                                                            {change.currentValue}
                                                                        </div>
                                                                        <div
                                                                            class="bg-white px-3 py-2 text-center font-medium"
                                                                        >
                                                                            {#if change.changed}
                                                                                <span
                                                                                    class="text-amber-700"
                                                                                >
                                                                                    {change.newValue}
                                                                                </span>
                                                                            {:else}
                                                                                <span
                                                                                    class="text-slate-400"
                                                                                >
                                                                                    {change.newValue}
                                                                                </span>
                                                                            {/if}
                                                                        </div>
                                                                        <div
                                                                            class="bg-white px-3 py-2 flex items-center justify-center"
                                                                        >
                                                                            {#if change.changed}
                                                                                <span
                                                                                    class="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"
                                                                                >
                                                                                    <ArrowRight
                                                                                        size={10}
                                                                                    />
                                                                                    Cambio
                                                                                </span>
                                                                            {:else}
                                                                                <span
                                                                                    class="text-[10px] text-slate-400"
                                                                                >
                                                                                    =
                                                                                </span>
                                                                            {/if}
                                                                        </div>
                                                                    {/each}
                                                                </div>
                                                            </div>

                                                            <!-- Cambios de pisos/accesos -->
                                                            {#if analysis.floorChanges}
                                                                {#if analysis.floorChanges.p2000}
                                                                    {@const fc =
                                                                        analysis
                                                                            .floorChanges
                                                                            .p2000}
                                                                    {#if fc.added.length > 0 || fc.removed.length > 0}
                                                                        <div
                                                                            class="rounded-lg bg-amber-50/50 border border-amber-100 p-3 space-y-1.5"
                                                                        >
                                                                            <p
                                                                                class="text-[10px] font-bold text-amber-700 uppercase tracking-widest flex items-center gap-1.5"
                                                                            >
                                                                                P2000
                                                                                —
                                                                                Cambio
                                                                                de
                                                                                Pisos
                                                                            </p>
                                                                            {#if fc.added.length > 0}
                                                                                <p
                                                                                    class="text-[11px] text-emerald-600 flex items-center gap-1"
                                                                                >
                                                                                    <span
                                                                                        class="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-[9px] font-bold"
                                                                                    >
                                                                                        +
                                                                                    </span>
                                                                                    Se
                                                                                    añadirán:
                                                                                    {fc.added.join(
                                                                                        ", ",
                                                                                    )}
                                                                                </p>
                                                                            {/if}
                                                                            {#if fc.removed.length > 0}
                                                                                <p
                                                                                    class="text-[11px] text-rose-600 flex items-center gap-1"
                                                                                >
                                                                                    <span
                                                                                        class="w-4 h-4 rounded-full bg-rose-100 flex items-center justify-center text-[9px] font-bold"
                                                                                    >
                                                                                        −
                                                                                    </span>
                                                                                    Se
                                                                                    quitarán:
                                                                                    {fc.removed.join(
                                                                                        ", ",
                                                                                    )}
                                                                                </p>
                                                                            {/if}
                                                                        </div>
                                                                    {/if}
                                                                {/if}

                                                                {#if analysis.floorChanges.kone}
                                                                    {@const fc =
                                                                        analysis
                                                                            .floorChanges
                                                                            .kone}
                                                                    {#if fc.added.length > 0 || fc.removed.length > 0}
                                                                        <div
                                                                            class="rounded-lg bg-amber-50/50 border border-amber-100 p-3 space-y-1.5"
                                                                        >
                                                                            <p
                                                                                class="text-[10px] font-bold text-amber-700 uppercase tracking-widest flex items-center gap-1.5"
                                                                            >
                                                                                KONE
                                                                                —
                                                                                Cambio
                                                                                de
                                                                                Pisos
                                                                            </p>
                                                                            {#if fc.added.length > 0}
                                                                                <p
                                                                                    class="text-[11px] text-emerald-600 flex items-center gap-1"
                                                                                >
                                                                                    <span
                                                                                        class="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-[9px] font-bold"
                                                                                    >
                                                                                        +
                                                                                    </span>
                                                                                    Se
                                                                                    añadirán:
                                                                                    {fc.added.join(
                                                                                        ", ",
                                                                                    )}
                                                                                </p>
                                                                            {/if}
                                                                            {#if fc.removed.length > 0}
                                                                                <p
                                                                                    class="text-[11px] text-rose-600 flex items-center gap-1"
                                                                                >
                                                                                    <span
                                                                                        class="w-4 h-4 rounded-full bg-rose-100 flex items-center justify-center text-[9px] font-bold"
                                                                                    >
                                                                                        −
                                                                                    </span>
                                                                                    Se
                                                                                    quitarán:
                                                                                    {fc.removed.join(
                                                                                        ", ",
                                                                                    )}
                                                                                </p>
                                                                            {/if}
                                                                        </div>
                                                                    {/if}
                                                                {/if}

                                                                {#if analysis.floorChanges.accesses}
                                                                    {@const fc =
                                                                        analysis
                                                                            .floorChanges
                                                                            .accesses}
                                                                    {#if fc.added.length > 0 || fc.removed.length > 0}
                                                                        <div
                                                                            class="rounded-lg bg-amber-50/50 border border-amber-100 p-3 space-y-1.5"
                                                                        >
                                                                            <p
                                                                                class="text-[10px] font-bold text-amber-700 uppercase tracking-widest flex items-center gap-1.5"
                                                                            >
                                                                                Accesos
                                                                                Especiales
                                                                            </p>
                                                                            {#if fc.added.length > 0}
                                                                                <p
                                                                                    class="text-[11px] text-emerald-600 flex items-center gap-1"
                                                                                >
                                                                                    <span
                                                                                        class="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-[9px] font-bold"
                                                                                    >
                                                                                        +
                                                                                    </span>
                                                                                    Se
                                                                                    añadirán:
                                                                                    {fc.added.join(
                                                                                        ", ",
                                                                                    )}
                                                                                </p>
                                                                            {/if}
                                                                            {#if fc.removed.length > 0}
                                                                                <p
                                                                                    class="text-[11px] text-rose-600 flex items-center gap-1"
                                                                                >
                                                                                    <span
                                                                                        class="w-4 h-4 rounded-full bg-rose-100 flex items-center justify-center text-[9px] font-bold"
                                                                                    >
                                                                                        −
                                                                                    </span>
                                                                                    Se
                                                                                    quitarán:
                                                                                    {fc.removed.join(
                                                                                        ", ",
                                                                                    )}
                                                                                </p>
                                                                            {/if}
                                                                        </div>
                                                                    {/if}
                                                                {/if}
                                                            {/if}

                                                            <!-- Acción global -->
                                                            <div
                                                                class="flex items-center gap-2 p-3 rounded-lg border bg-white"
                                                            >
                                                                <span
                                                                    class="text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                                                                    >Acción:</span
                                                                >
                                                                <label
                                                                    class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 cursor-pointer hover:bg-emerald-100 transition-colors"
                                                                >
                                                                    <input
                                                                        type="radio"
                                                                        name="mod-resolve-{rowKey}"
                                                                        checked={analysis.resolution ===
                                                                            "apply" ||
                                                                            analysis.resolution ===
                                                                                null}
                                                                        onchange={() => {
                                                                            analysis.resolution =
                                                                                "apply";
                                                                        }}
                                                                        class="w-3 h-3 text-emerald-600 focus:ring-emerald-500"
                                                                    />
                                                                    <span
                                                                        class="text-xs font-semibold text-emerald-700"
                                                                        >Crear
                                                                        Ticket
                                                                        de
                                                                        Modificación</span
                                                                    >
                                                                </label>
                                                                <label
                                                                    class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 cursor-pointer hover:bg-rose-100 transition-colors"
                                                                >
                                                                    <input
                                                                        type="radio"
                                                                        name="mod-resolve-{rowKey}"
                                                                        checked={analysis.resolution ===
                                                                            "reject"}
                                                                        onchange={() => {
                                                                            analysis.resolution =
                                                                                "reject";
                                                                        }}
                                                                        class="w-3 h-3 text-rose-600 focus:ring-rose-500"
                                                                    />
                                                                    <span
                                                                        class="text-xs font-semibold text-rose-700"
                                                                        >Rechazar
                                                                        y
                                                                        omitir</span
                                                                    >
                                                                </label>
                                                            </div>
                                                        </div>

                                                        <!-- ── TYPE: ALTAS (NUEVA / SIN CONFLICTOS) ── -->
                                                    {:else if reviewSheetTab === "altas"}
                                                        {@const requestedCards =
                                                            getRequestedCards(
                                                                row.fields,
                                                            )}
                                                        <div
                                                            class="rounded-lg bg-emerald-50 border border-emerald-200 p-4 space-y-3"
                                                        >
                                                            <div
                                                                class="flex items-center gap-2"
                                                            >
                                                                <div
                                                                    class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0"
                                                                >
                                                                    <CheckCircle2
                                                                        size={18}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <p
                                                                        class="text-sm font-bold text-emerald-800"
                                                                    >
                                                                        Persona
                                                                        nueva
                                                                    </p>
                                                                    <p
                                                                        class="text-[10px] text-emerald-600"
                                                                    >
                                                                        No se
                                                                        encontró
                                                                        en el
                                                                        sistema —
                                                                        el alta
                                                                        puede
                                                                        continuar
                                                                        sin
                                                                        conflictos.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            {#if requestedCards.length > 0}
                                                                <div
                                                                    class="flex flex-wrap items-center gap-2"
                                                                >
                                                                    <span
                                                                        class="text-[10px] font-bold text-emerald-700 uppercase tracking-widest"
                                                                        >Solicita:</span
                                                                    >
                                                                    {#each requestedCards as type}
                                                                        <span
                                                                            class="text-[10px] font-bold px-2 py-0.5 rounded border {CARD_TYPE_COLORS[
                                                                                type
                                                                            ] ??
                                                                                'bg-slate-100 text-slate-600 border-slate-200'}"
                                                                            >{type}</span
                                                                        >
                                                                    {/each}
                                                                </div>
                                                        {/if}
                                                        </div>

                                                        <!-- ── TYPE: MODIFICACIONES (OLD) ── -->
                                                    {:else if reviewSheetTab === "modificaciones"}
                                                        {@const changes =
                                                            getModificationChanges(
                                                                row.fields,
                                                            )}
                                                        {#if changes.length > 0}
                                                            <div
                                                                class="rounded-lg bg-amber-50 border border-amber-100 p-3"
                                                            >
                                                                <p
                                                                    class="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-2"
                                                                >
                                                                    Cambios
                                                                    solicitados
                                                                </p>
                                                                <div
                                                                    class="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]"
                                                                >
                                                                    {#each changes as change}
                                                                        <div
                                                                            class="text-slate-500"
                                                                        >
                                                                            {change.label}
                                                                        </div>
                                                                        <div
                                                                            class="text-amber-800 font-medium truncate"
                                                                        >
                                                                            {change.value}
                                                                        </div>
                                                                    {/each}
                                                                </div>
                                                            </div>
                                                        {:else}
                                                            <p
                                                                class="text-[10px] text-slate-400 italic"
                                                            >
                                                                Sin cambios
                                                                específicos
                                                                detectados en
                                                                los campos.
                                                            </p>
                                                        {/if}

                                                        <!-- ── TYPE: BAJA ── -->
                                                    {:else if reviewSheetTab === "baja_persona"}
                                                        <div
                                                            class="rounded-lg bg-rose-50 border border-rose-100 p-3 space-y-1"
                                                        >
                                                            {#if row.fields.tipo_baja}
                                                                <p
                                                                    class="text-xs text-rose-700"
                                                                >
                                                                    <span
                                                                        class="font-semibold"
                                                                        >Tipo:</span
                                                                    >
                                                                    {row.fields
                                                                        .tipo_baja}
                                                                </p>
                                                            {/if}
                                                            {#if row.fields.motivo}
                                                                <p
                                                                    class="text-xs text-rose-700"
                                                                >
                                                                    <span
                                                                        class="font-semibold"
                                                                        >Motivo:</span
                                                                    >
                                                                    {row.fields
                                                                        .motivo}
                                                                </p>
                                                            {/if}
                                                        </div>

                                                        <!-- ── TYPE: REPOSICIÓN ── -->
                                                    {:else if reviewSheetTab === "reposicion"}
                                                        {@const repoCards =
                                                            getReposicionCards(
                                                                row.fields,
                                                            )}
                                                        {#if repoCards.length > 0}
                                                            <div
                                                                class="rounded-lg bg-blue-50 border border-blue-100 p-3"
                                                            >
                                                                <p
                                                                    class="text-[10px] font-bold text-blue-700 uppercase tracking-widest mb-2"
                                                                >
                                                                    Tarjetas a
                                                                    reponer
                                                                </p>
                                                                <div
                                                                    class="space-y-1"
                                                                >
                                                                    {#each repoCards as rc}
                                                                        <div
                                                                            class="flex items-center gap-2 text-xs"
                                                                        >
                                                                            <span
                                                                                class="font-bold px-1.5 py-0.5 rounded {CARD_TYPE_COLORS[
                                                                                    rc
                                                                                        .type
                                                                                ] ??
                                                                                    'bg-slate-100'} text-[10px]"
                                                                                >{rc.type}</span
                                                                            >
                                                                            <span
                                                                                class="text-slate-600"
                                                                                >Folio:
                                                                                {rc.folio ||
                                                                                    "—"}</span
                                                                            >
                                                                        </div>
                                                                    {/each}
                                                                </div>
                                                            </div>
                                                        {/if}
                                                        {#if row.fields.motivo}
                                                            <p
                                                                class="text-[10px] text-slate-500"
                                                            >
                                                                <span
                                                                    class="font-semibold"
                                                                    >Motivo:</span
                                                                >
                                                                {row.fields
                                                                    .motivo}
                                                            </p>
                                                        {/if}

                                                        <!-- ── TYPE: REPORTE DE FALLA ── -->
                                                    {:else if reviewSheetTab === "reporte_falla"}
                                                        <div
                                                            class="rounded-lg bg-violet-50 border border-violet-100 p-3 space-y-1"
                                                        >
                                                            {#if row.fields.tipo_tarjeta}
                                                                <p
                                                                    class="text-xs text-violet-700"
                                                                >
                                                                    <span
                                                                        class="font-semibold"
                                                                        >Tarjeta:</span
                                                                    >
                                                                    {row.fields
                                                                        .tipo_tarjeta}
                                                                    {row.fields
                                                                        .folio
                                                                        ? `(${row.fields.folio})`
                                                                        : ""}
                                                                </p>
                                                            {/if}
                                                            {#if row.fields.descripcion}
                                                                <p
                                                                    class="text-xs text-violet-700"
                                                                >
                                                                    <span
                                                                        class="font-semibold"
                                                                        >Problema:</span
                                                                    >
                                                                    {row.fields
                                                                        .descripcion}
                                                                </p>
                                                            {/if}
                                                            {#if row.fields.ubicacion}
                                                                <p
                                                                    class="text-xs text-violet-700"
                                                                >
                                                                    <span
                                                                        class="font-semibold"
                                                                        >Ubicación:</span
                                                                    >
                                                                    {row.fields
                                                                        .ubicacion}
                                                                </p>
                                                            {/if}
                                                            {#if row.fields.urgencia}
                                                                <p
                                                                    class="text-xs text-violet-700"
                                                                >
                                                                    <span
                                                                        class="font-semibold"
                                                                        >Urgencia:</span
                                                                    >
                                                                    {row.fields
                                                                        .urgencia}
                                                                </p>
                                                            {/if}
                                                        </div>
                                                    {/if}                                                    <!-- ── MATCH RESULTS (only for types WITHOUT smart analysis) ── -->
                                                    {#if !(reviewSheetTab === "altas") && !(reviewSheetTab === "modificaciones" && modAnalyses.has(rowKey))}
                                                        {#if matches.length > 0}
                                                            <div
                                                                class="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3"
                                                            >
                                                                <p
                                                                    class="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-2 flex items-center gap-1.5"
                                                                >
                                                                    <User
                                                                        size={11}
                                                                    />
                                                                    {matches.length ===
                                                                    1
                                                                        ? "Coincidencia encontrada"
                                                                        : `${matches.length} coincidencias`}
                                                                </p>
                                                                <div
                                                                    class="space-y-2"
                                                                >
                                                                    {#each matches.slice(0, 3) as person}
                                                                        {@const activeCards =
                                                                            getActiveCards(
                                                                                person,
                                                                            )}
                                                                        <div
                                                                            class="p-2.5 rounded-lg bg-white border border-emerald-100"
                                                                        >
                                                                            <div
                                                                                class="flex items-center gap-2.5 mb-1.5"
                                                                            >
                                                                                <div
                                                                                    class="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0"
                                                                                >
                                                                                    <User
                                                                                        size={13}
                                                                                    />
                                                                                </div>
                                                                                <div
                                                                                    class="min-w-0"
                                                                                >
                                                                                    <p
                                                                                        class="text-xs font-bold text-slate-800 truncate"
                                                                                    >
                                                                                        {person.last_name},
                                                                                        {person.first_name}
                                                                                    </p>
                                                                                    <p
                                                                                        class="text-[10px] text-slate-400 truncate"
                                                                                    >
                                                                                        {person.dependency}
                                                                                        ·
                                                                                        {person.building}{person.employee_no
                                                                                            ? ` · #${person.employee_no}`
                                                                                            : ""}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                            <!-- Visualización de tarjetas -->
                                                                            {#if activeCards.length > 0}
                                                                                <div
                                                                                    class="flex flex-wrap gap-1.5 mt-1.5 ml-9"
                                                                                >
                                                                                    {#each activeCards as card}
                                                                                        {@const statusInfo =
                                                                                            cardStatusBadge(
                                                                                                card.status,
                                                                                            )}
                                                                                        <div
                                                                                            class="flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded text-[10px] font-medium text-slate-600"
                                                                                        >
                                                                                            <CreditCard
                                                                                                size={9}
                                                                                                class="text-slate-400"
                                                                                            />
                                                                                            <span
                                                                                                class="font-bold"
                                                                                                >{card.type}:</span
                                                                                            >
                                                                                            <span
                                                                                                >{card.folio}</span
                                                                                            >
                                                                                            <Badge
                                                                                                variant={statusInfo.color}
                                                                                                class="scale-[0.75] origin-left"
                                                                                                >{statusInfo.text}</Badge
                                                                                            >
                                                                                        </div>
                                                                                    {/each}
                                                                                </div>
                                                                            {:else}
                                                                                <p
                                                                                    class="text-[10px] text-slate-400 italic ml-9 flex items-center gap-1"
                                                                                >
                                                                                    <CreditCard
                                                                                        size={9}
                                                                                    />
                                                                                    Sin
                                                                                    tarjetas
                                                                                    activas
                                                                                </p>
                                                                            {/if}

                                                                            <!-- Contexto específico por tipo en persona coincidente -->
                                                                            {#if reviewSheetTab === "baja_persona" && activeCards.length > 0}
                                                                                <p
                                                                                    class="text-[10px] text-rose-500 font-medium mt-1.5 ml-9"
                                                                                >
                                                                                    ⚠
                                                                                    Se
                                                                                    desactivarán
                                                                                    {activeCards.length}
                                                                                    tarjeta(s)
                                                                                    con
                                                                                    la
                                                                                    baja.
                                                                                </p>
                                                                            {/if}

                                                                            {#if reviewSheetTab === "reposicion"}
                                                                                {@const repoCards =
                                                                                    getReposicionCards(
                                                                                        row.fields,
                                                                                    )}
                                                                                {#each repoCards as rc}
                                                                                    {@const existingCard =
                                                                                        activeCards.find(
                                                                                            (
                                                                                                c,
                                                                                            ) =>
                                                                                                c.type ===
                                                                                                rc.type,
                                                                                        )}
                                                                                    {#if existingCard}
                                                                                        {#if rc.folio && rc.folio !== existingCard.folio}
                                                                                            <p
                                                                                                class="text-[10px] text-amber-600 font-medium mt-1 ml-9 flex items-center gap-1"
                                                                                            >
                                                                                                <AlertTriangle
                                                                                                    size={10}
                                                                                                />
                                                                                                Folio
                                                                                                en
                                                                                                plantilla
                                                                                                ({rc.folio})
                                                                                                ≠
                                                                                                folio
                                                                                                asignado
                                                                                                ({existingCard.folio})
                                                                                            </p>
                                                                                        {:else}
                                                                                            <p
                                                                                                class="text-[10px] text-emerald-600 font-medium mt-1 ml-9 flex items-center gap-1"
                                                                                            >
                                                                                                <CheckCircle2
                                                                                                    size={10}
                                                                                                />
                                                                                                Folio
                                                                                                {rc.type}
                                                                                                coincide.
                                                                                            </p>
                                                                                        {/if}
                                                                                    {:else}
                                                                                        <p
                                                                                            class="text-[10px] text-amber-600 font-medium mt-1 ml-9 flex items-center gap-1"
                                                                                        >
                                                                                            <AlertTriangle
                                                                                                size={10}
                                                                                            />
                                                                                            No
                                                                                            tiene
                                                                                            tarjeta
                                                                                            {rc.type}
                                                                                            activa.
                                                                                        </p>
                                                                                    {/if}
                                                                                {/each}
                                                                            {/if}

                                                                            {#if reviewSheetTab === "reporte_falla" && row.fields.folio}
                                                                                {@const reportCard =
                                                                                    activeCards.find(
                                                                                        (
                                                                                            c,
                                                                                        ) =>
                                                                                            c.folio ===
                                                                                            row
                                                                                                .fields
                                                                                                .folio,
                                                                                    )}
                                                                                {#if reportCard}
                                                                                    <p
                                                                                        class="text-[10px] text-emerald-600 font-medium mt-1 ml-9 flex items-center gap-1"
                                                                                    >
                                                                                        <CheckCircle2
                                                                                            size={10}
                                                                                        />
                                                                                        Tarjeta
                                                                                        {reportCard.type}
                                                                                        ({reportCard.folio})
                                                                                        encontrada.
                                                                                    </p>
                                                                                {:else}
                                                                                    <p
                                                                                        class="text-[10px] text-amber-600 font-medium mt-1 ml-9 flex items-center gap-1"
                                                                                    >
                                                                                        <AlertTriangle
                                                                                            size={10}
                                                                                        />
                                                                                        Folio
                                                                                        "{row
                                                                                            .fields
                                                                                            .folio}"
                                                                                        no
                                                                                        coincide
                                                                                        con
                                                                                        ninguna
                                                                                        tarjeta
                                                                                        activa.
                                                                                    </p>
                                                                                {/if}
                                                                            {/if}
                                                                        </div>
                                                                    {/each}
                                                                    {#if matches.length > 3}
                                                                        <p
                                                                            class="text-[10px] text-emerald-600 italic mt-1"
                                                                        >
                                                                            …y {matches.length -
                                                                                3} más
                                                                        </p>
                                                                    {/if}
                                                                </div>
                                                            </div>
                                                        {:else}
                                                            <div
                                                                class="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700"
                                                            >
                                                                <AlertTriangle
                                                                    size={13}
                                                                    class="shrink-0"
                                                                />
                                                                <span
                                                                    >No se encontró
                                                                    a "<strong
                                                                        >{row.fields
                                                                            .apellidos},
                                                                        {row.fields
                                                                            .nombres}</strong
                                                                    >" en la base de
                                                                    datos.
                                                                    {#if reviewSheetTab === "altas"}
                                                                        Se creará
                                                                        como persona
                                                                        nueva al
                                                                        procesar el
                                                                        ticket.
                                                                    {:else}
                                                                        Será
                                                                        necesario
                                                                        vincular
                                                                        manualmente
                                                                        al procesar
                                                                        el ticket.
                                                                    {/if}
                                                                </span>
                                                            </div>
                                                        {/if}
                                                    {/if}
                                                </div>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                        {/if}
                            {/if}
                </div>
            {/if}
        {/if}

        <!-- ── STEP: IMPORTING ── -->
        {#if step === "importing"}
            <div class="flex flex-col items-center gap-4 py-12">
                <div
                    class="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600"
                >
                    <Loader2 size={28} class="animate-spin" />
                </div>
                <div class="text-center">
                    <p class="text-sm font-semibold text-slate-700">
                        Importando tickets…
                    </p>
                    <p class="text-xs text-slate-400 mt-1">
                        Creando {totalSelected} ticket(s).
                    </p>
                </div>
            </div>
        {/if}

        <!-- ── STEP: DONE ── -->
        {#if step === "done" && importResult}
            <div class="flex flex-col items-center gap-3 py-8">
                <div
                    class="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"
                >
                    <CheckCircle2 size={32} />
                </div>
                <p class="text-base font-bold text-slate-800">
                    Importación completada
                </p>
                <p class="text-sm text-slate-500">
                    Se crearon <span class="font-bold text-emerald-600"
                        >{importResult.created}</span
                    > ticket(s) correctamente.
                </p>
                {#if importResult.errors.length > 0}
                    <p class="text-xs text-rose-500">
                        {importResult.errors.length} no pudieron crearse.
                    </p>
                {/if}
            </div>
        {/if}
    </div>

    {#snippet footer()}
        <div class="flex items-center justify-between w-full">
            <Button
                variant="ghost"
                class="text-slate-400 hover:text-slate-600"
                onclick={closeModal}
            >
                {step === "done" ? "Cerrar" : "Cancelar"}
            </Button>

            {#if step === "idle"}
                <!-- empty: only the upload button inside the dropzone -->
            {:else if step === "parsed"}
                <div class="flex items-center gap-3">
                    <Button variant="outline" onclick={reset}>
                        Cambiar archivo
                    </Button>
                    <Button
                        variant="primary"
                        disabled={totalSelected === 0}
                        onclick={startReview}
                    >
                        <Search size={16} class="mr-2" />
                        Revisar personas ({totalSelected})
                    </Button>
                </div>
            {:else if step === "review"}
                <div class="flex items-center justify-between w-full">
                    <Button
                        variant="outline"
                        class="border-slate-200 text-slate-500 hover:text-slate-700"
                        loading={isExportingReport}
                        disabled={totalSelected === 0 || isReviewing}
                        onclick={handleExportReport}
                    >
                        <FileSpreadsheet size={14} class="mr-1.5" />
                        Exportar Reporte
                    </Button>
                    <div class="flex items-center gap-3">
                        <Button
                            variant="outline"
                            onclick={() => {
                                step = "parsed";
                                matchResults = new Map();
                                expandedReviewRows = new Set();
                                altaAnalyses = new Map();
                                modAnalyses = new Map();
                            }}
                        >
                            <ArrowLeft size={14} class="mr-1.5" />
                            Volver
                        </Button>
                        <Button
                            variant="primary"
                            disabled={totalSelected === 0 || isReviewing}
                            onclick={handleImport}
                        >
                            <Upload size={16} class="mr-2" />
                            Importar {totalSelected} ticket(s)
                        </Button>
                    </div>
                </div>
            {:else if step === "importing"}
                <Button variant="primary" loading={true}>Importando…</Button>
            {:else if step === "done"}
                <Button variant="primary" onclick={closeModal}>Listo</Button>
            {/if}
        </div>
    {/snippet}
</Modal>
