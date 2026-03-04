<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import Badge from "../Badge.svelte";
    import { ticketService } from "../../services/tickets";
    import { personnelService } from "../../services/personnel";
    import { toast } from "svelte-sonner";
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
        AlertTriangle,
    } from "lucide-svelte";
    import {
        parseTemplateFile,
        SHEET_TO_TICKET_TYPE,
        FIELD_LABELS,
        type ImportParseResult,
        type ParsedSheet,
        type ParsedRow,
    } from "../../utils/xlsxImporter";
    import type { Person } from "../../types";

    let {
        isOpen = $bindable(false),
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

    // ── Helpers ────────────────────────────────────────

    function reset() {
        step = "idle";
        parseResult = null;
        importResult = null;
        expandedSheets = new Set();
        matchResults = new Map();
        expandedReviewRows = new Set();
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
            step = "parsed";

            // Initialize selections with all valid rows
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
            console.error(err);
            toast.error(
                "No se pudo leer el archivo. Asegúrate de usar la plantilla correcta.",
            );
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
        // Deduplicate by name pair to avoid redundant API calls
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
        // Auto-expand all rows
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

        const tickets = parseResult.sheets.flatMap((sheet) =>
            sheet.rows
                .filter(
                    (r) =>
                        r.isValid &&
                        selectedRows.has(`${sheet.key}-${r.rowNumber}`),
                )
                .map((r) => {
                    const type = SHEET_TO_TICKET_TYPE[sheet.key] ?? sheet.key;
                    let priority = "media";

                    if (r.fields.urgencia) {
                        const urg = r.fields.urgencia.toLowerCase();
                        if (urg.includes("alta") || urg.includes("urgente"))
                            priority = "alta";
                        else if (urg.includes("baja")) priority = "baja";
                    }

                    return {
                        type,
                        title: buildTicketTitle(sheet.key, r),
                        description: buildTicketDescription(r),
                        priority,
                        payload: r.fields,
                    };
                }),
        );

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
            console.error(err);
            toast.error("Error al importar. Intente de nuevo.");
            step = "review";
        } finally {
            isImporting = false;
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

    function cardStatusBadge(status: string): { text: string; color: string } {
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
            {#if parseResult}
                <!-- Summary -->
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
                </div>

                <!-- Per-sheet breakdown -->
                <div class="space-y-2">
                    {#each parseResult.sheets as sheet}
                        {@const isExpanded = expandedSheets.has(sheet.key)}
                        <div
                            class="rounded-lg border border-slate-200 overflow-hidden"
                        >
                            <!-- Header -->
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

                            <!-- Rows detail (expandable) -->
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
            {:else if parseResult}
                <!-- Review summary bar -->
                {@const totalMatched = [...matchResults.values()].filter(
                    (v) => v.length > 0,
                ).length}
                {@const totalNoMatch = [...matchResults.values()].filter(
                    (v) => v.length === 0,
                ).length}
                <div class="flex items-center gap-3 text-xs">
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
                    <div
                        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 font-medium"
                    >
                        {totalSelected} total
                    </div>
                </div>

                <!-- Review rows by sheet -->
                <div class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                    {#each parseResult.sheets as sheet}
                        {@const sheetRows = sheet.rows.filter(
                            (r) =>
                                r.isValid &&
                                selectedRows.has(`${sheet.key}-${r.rowNumber}`),
                        )}
                        {#if sheetRows.length > 0}
                            <div>
                                <div class="flex items-center gap-2 mb-2">
                                    <Badge
                                        variant={SHEET_COLORS[sheet.key] ??
                                            "slate"}>{sheet.label}</Badge
                                    >
                                    <span
                                        class="text-[10px] text-slate-400 font-medium"
                                        >{sheetRows.length} fila(s)</span
                                    >
                                </div>
                                <div class="space-y-2">
                                    {#each sheetRows as row}
                                        {@const rowKey = `${sheet.key}-${row.rowNumber}`}
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
                                            <!-- Row header -->
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

                                            <!-- Expanded detail -->
                                            {#if isExpanded}
                                                <div
                                                    class="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3"
                                                >
                                                    <!-- ── TYPE: ALTAS ── -->
                                                    {#if sheet.key === "altas"}
                                                        {@const requestedCards =
                                                            getRequestedCards(
                                                                row.fields,
                                                            )}
                                                        {#if requestedCards.length > 0}
                                                            <div
                                                                class="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100"
                                                            >
                                                                <span
                                                                    class="text-[10px] font-bold text-blue-600 uppercase tracking-widest"
                                                                    >Solicita:</span
                                                                >
                                                                <div
                                                                    class="flex gap-1.5"
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
                                                            </div>
                                                        {/if}
                                                        {#if row.fields.pisos_p2000}
                                                            <p
                                                                class="text-[10px] text-slate-500"
                                                            >
                                                                <span
                                                                    class="font-semibold"
                                                                    >Pisos
                                                                    P2000:</span
                                                                >
                                                                {row.fields
                                                                    .pisos_p2000}
                                                            </p>
                                                        {/if}
                                                        {#if row.fields.pisos_kone}
                                                            <p
                                                                class="text-[10px] text-slate-500"
                                                            >
                                                                <span
                                                                    class="font-semibold"
                                                                    >Pisos KONE:</span
                                                                >
                                                                {row.fields
                                                                    .pisos_kone}
                                                            </p>
                                                        {/if}

                                                        <!-- ── TYPE: MODIFICACIONES ── -->
                                                    {:else if sheet.key === "modificaciones"}
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
                                                    {:else if sheet.key === "baja_persona"}
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
                                                    {:else if sheet.key === "reposicion"}
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
                                                    {:else if sheet.key === "reporte_falla"}
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
                                                    {/if}

                                                    <!-- ── MATCH RESULTS (all types) ── -->
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
                                                                        <!-- Cards display -->
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

                                                                        <!-- Type-specific context on matched person -->
                                                                        {#if sheet.key === "baja_persona" && activeCards.length > 0}
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

                                                                        {#if sheet.key === "reposicion"}
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

                                                                        {#if sheet.key === "reporte_falla" && row.fields.folio}
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
                                                                {#if sheet.key === "altas"}
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
                                                </div>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    {/each}
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
                <div class="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onclick={() => {
                            step = "parsed";
                            matchResults = new Map();
                            expandedReviewRows = new Set();
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
            {:else if step === "importing"}
                <Button variant="primary" loading={true}>Importando…</Button>
            {:else if step === "done"}
                <Button variant="primary" onclick={closeModal}>Listo</Button>
            {/if}
        </div>
    {/snippet}
</Modal>
