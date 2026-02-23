<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import Badge from "../Badge.svelte";
    import { ticketService } from "../../services/tickets";
    import { toast } from "svelte-sonner";
    import {
        FileSpreadsheet,
        CheckCircle2,
        AlertCircle,
        ChevronDown,
        ChevronRight,
        Upload,
    } from "lucide-svelte";
    import {
        parseTemplateFile,
        SHEET_TO_TICKET_TYPE,
        FIELD_LABELS,
        type ImportParseResult,
        type ParsedSheet,
        type ParsedRow,
    } from "../../utils/xlsxImporter";

    let {
        isOpen = $bindable(false),
        onComplete,
    }: {
        isOpen: boolean;
        onComplete?: () => void;
    } = $props();

    // ── State ──────────────────────────────────────────
    type Step = "idle" | "parsed" | "importing" | "done";

    let step = $state<Step>("idle");
    let parseResult = $state<ImportParseResult | null>(null);
    let isParsing = $state(false);
    let isImporting = $state(false);
    let importResult = $state<{ created: number; errors: any[] } | null>(null);

    /** Which sheet accordions are expanded */
    let expandedSheets = $state<Set<string>>(new Set());

    let fileInput = $state<HTMLInputElement>();

    // ── Helpers ────────────────────────────────────────

    function reset() {
        step = "idle";
        parseResult = null;
        importResult = null;
        expandedSheets = new Set();
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

    // ── Import ─────────────────────────────────────────

    function buildTicketTitle(sheetKey: string, row: ParsedRow): string {
        const name = [row.fields.apellidos, row.fields.nombres]
            .filter(Boolean)
            .join(", ");
        const dep = row.fields.dependencia || "";
        const base =
            SHEET_TO_TICKET_TYPE[
                sheetKey as keyof typeof SHEET_TO_TICKET_TYPE
            ] ?? sheetKey;
        return dep ? `${base} — ${name} (${dep})` : `${base} — ${name}`;
    }

    function buildTicketDescription(row: ParsedRow): string {
        return Object.entries(row.fields)
            .filter(([, v]) => v)
            .map(([k, v]) => `${FIELD_LABELS[k] ?? k}: ${v}`)
            .join("\n");
    }

    async function handleImport() {
        if (!parseResult) return;

        isImporting = true;
        step = "importing";

        // Only import valid rows
        const tickets = parseResult.sheets.flatMap((sheet) =>
            sheet.rows
                .filter((r) => r.isValid)
                .map((r) => ({
                    type: SHEET_TO_TICKET_TYPE[sheet.key] ?? sheet.key,
                    title: buildTicketTitle(sheet.key, r),
                    description: buildTicketDescription(r),
                    priority: "media",
                    payload: r.fields,
                })),
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
            step = "parsed";
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
</script>

<Modal
    bind:isOpen
    title="Importar Plantilla Excel"
    description="Suba la plantilla completada para crear tickets automáticamente."
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

        <!-- ── STEP: PARSED / IMPORTING ── -->
        {#if step === "parsed" || step === "importing"}
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
                            {parseResult.totalValid}
                        </p>
                        <p class="text-xs text-emerald-600 mt-0.5">
                            Listas para importar
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
                        {@const color = SHEET_COLORS[sheet.key] ?? "slate"}
                        {@const isExpanded = expandedSheets.has(sheet.key)}
                        <div
                            class="rounded-lg border border-slate-200 overflow-hidden"
                        >
                            <!-- Header -->
                            <button
                                class="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
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
                                                <CheckCircle2
                                                    size={14}
                                                    class="text-emerald-500 mt-0.5 shrink-0"
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
                        disabled={(parseResult?.totalValid ?? 0) === 0}
                        onclick={handleImport}
                    >
                        <Upload size={16} class="mr-2" />
                        Importar {parseResult?.totalValid} ticket(s)
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
