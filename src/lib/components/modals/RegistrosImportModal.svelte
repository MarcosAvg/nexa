<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import Badge from "../Badge.svelte";
    import LinkedPersonSummary from "../LinkedPersonSummary.svelte";
    import { personnelService } from "../../services/personnel";
    import { ticketService } from "../../services/tickets";
    import { catalogState } from "../../stores";
    import { toast } from "svelte-sonner";
    import {
        handleError,
        parseTemplateFile,
        FIELD_LABELS,
        parseFloors,
        type ImportParseResult,
        type ParsedSheet,
        type ParsedRow,
    } from "../../utils";
    import { activeMediaTypes, type MediaInfo } from "../../utils/mediaContract";
    import { wantsCard, analyzeAltaConflicts } from "../../utils/matchAnalysis";
    import { resolveFloorList } from "../../utils/floorMatch";
    import type { Person } from "../../types";
    import {
        FileSpreadsheet,
        Upload,
        CheckCircle2,
        AlertCircle,
        AlertTriangle,
        Loader2,
        ChevronDown,
        ChevronRight,
        Ticket,
        UserPlus,
    } from "lucide-svelte";

    /**
     * RegistrosImportModal — Importación masiva de registros de personal (hoja ALTAS).
     *
     * - Filas CON folio (o sin tarjetas solicitadas): alta directa en modo legacy
     *   (responsiva legacy, sin tickets).
     * - Filas SIN folio (pero que solicitan tarjeta): generan un ticket de "Alta de Persona".
     */
    let {
        isOpen = $bindable(false),
        onComplete,
    }: {
        isOpen: boolean;
        onComplete?: () => void;
    } = $props();

    type Step = "idle" | "parsed" | "review" | "importing" | "done";

    let step = $state<Step>("idle");
    let parseResult = $state<ImportParseResult | null>(null);
    let isParsing = $state(false);
    let mediaTypes = $derived(catalogState.mediaTypes);
    let fileInput = $state<HTMLInputElement>();

    let selectedRows = $state<Set<string>>(new Set());
    let expandedSheets = $state<Set<string>>(new Set());

    let isReviewing = $state(false);
    let isImporting = $state(false);
    let matchResults = $state<Map<string, Person[]>>(new Map());
    let validationErrors = $state<Map<string, string[]>>(new Map());
    let rowActions = $state<Map<string, "link" | "create" | "skip">>(new Map());
    let cardActions = $state<Map<string, "omitir" | "reponer">>(new Map());
    let selectedLinkedPersons = $state<Map<string, string>>(new Map());
    let expandedLinkedCandidates = $state<Set<string>>(new Set());

    let importResult = $state<{
        directos: number;
        tickets: number;
        errores: { rowNumber: number; message: string }[];
    } | null>(null);

    let altasSheet = $derived(parseResult?.sheets.find((s) => s.key === "altas") ?? null);

    // ── Helpers de clasificación ──────────────────────────
    function requestedMedia(fields: Record<string, string>): MediaInfo[] {
        return activeMediaTypes(mediaTypes).filter((m) => wantsCard(fields, m));
    }

    function hasFolio(fields: Record<string, string>): boolean {
        return requestedMedia(fields).some((m) => (fields[`${m.key}_folio`] ?? "").trim().length > 0);
    }

    /** Alta directa si tiene folio, o si no solicita ninguna tarjeta. */
    function isDirect(fields: Record<string, string>): boolean {
        const req = requestedMedia(fields);
        return hasFolio(fields) || req.length === 0;
    }

    function foliosOf(fields: Record<string, string>): { type: string; folio: string }[] {
        return requestedMedia(fields)
            .filter((m) => (fields[`${m.key}_folio`] ?? "").trim().length > 0)
            .map((m) => ({ type: m.name, folio: (fields[`${m.key}_folio`] ?? "").trim() }));
    }

    // ── Acciones por fila y por tarjeta ────────────────────
    function defaultAction(rowKey: string, fields: Record<string, string>): "link" | "create" | "skip" {
        const dups = matchResults.get(rowKey) ?? [];
        if (dups.length === 0) return "create";
        return hasFolio(fields) ? "link" : "skip";
    }

    function getRowAction(rowKey: string, fields: Record<string, string>): "link" | "create" | "skip" {
        return rowActions.get(rowKey) ?? defaultAction(rowKey, fields);
    }

    function setRowAction(rowKey: string, action: "link" | "create" | "skip") {
        const next = new Map(rowActions);
        next.set(rowKey, action);
        rowActions = next;
    }

    function getCardAction(key: string): "omitir" | "reponer" {
        return cardActions.get(key) ?? "omitir";
    }

    function setCardAction(key: string, action: "omitir" | "reponer") {
        const next = new Map(cardActions);
        next.set(key, action);
        cardActions = next;
    }

    function getSelectedLinkedPerson(rowKey: string, candidates: Person[]): Person | null {
        if (candidates.length === 0) return null;
        const selectedId = selectedLinkedPersons.get(rowKey);
        return candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0];
    }

    function setSelectedLinkedPerson(rowKey: string, personId: string) {
        const nextSelected = new Map(selectedLinkedPersons);
        nextSelected.set(rowKey, personId);
        selectedLinkedPersons = nextSelected;

        const nextCardActions = new Map(cardActions);
        for (const key of nextCardActions.keys()) {
            if (key.startsWith(`${rowKey}:`)) nextCardActions.delete(key);
        }
        cardActions = nextCardActions;
    }

    function toggleLinkedCandidate(candidateKey: string) {
        const next = new Set(expandedLinkedCandidates);
        if (next.has(candidateKey)) next.delete(candidateKey);
        else next.add(candidateKey);
        expandedLinkedCandidates = next;
    }

    function selectedConflicts(rowKey: string, row: ParsedRow, person: Person | null) {
        if (!person) return [];
        return analyzeAltaConflicts(rowKey, person, row.fields, mediaTypes).conflicts.filter(
            (conflict) => conflict.requested && conflict.hasCard,
        );
    }

    // ── Reset / cierre ────────────────────────────────────
    function reset() {
        step = "idle";
        parseResult = null;
        importResult = null;
        selectedRows = new Set();
        expandedSheets = new Set();
        matchResults = new Map();
        validationErrors = new Map();
        rowActions = new Map();
        cardActions = new Map();
        selectedLinkedPersons = new Map();
        expandedLinkedCandidates = new Set();
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

    function toggleRow(sheetKey: string, rowNumber: number) {
        const key = `${sheetKey}-${rowNumber}`;
        const next = new Set(selectedRows);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        selectedRows = next;
    }

    function toggleSheetSelection(sheet: ParsedSheet) {
        const keys = sheet.rows.filter((r) => r.isValid).map((r) => `${sheet.key}-${r.rowNumber}`);
        const allSelected = keys.every((k) => selectedRows.has(k));
        const next = new Set(selectedRows);
        if (allSelected) keys.forEach((k) => next.delete(k));
        else keys.forEach((k) => next.add(k));
        selectedRows = next;
    }

    let totalSelected = $derived(selectedRows.size);

    // ── Manejo de archivo ─────────────────────────────────
    async function handleFileChange(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        isParsing = true;
        try {
            const result = await parseTemplateFile(file, mediaTypes);
            if (!result.hasAnyData) {
                toast.warning("El archivo no contiene datos en ninguna hoja.");
                return;
            }
            if (!result.sheets.some((s) => s.key === "altas")) {
                toast.warning("El archivo no contiene la hoja de ALTAS.");
                return;
            }
            parseResult = result;
            step = "parsed";

            const initial = new Set<string>();
            result.sheets.forEach((sheet) => {
                sheet.rows.forEach((row) => {
                    if (row.isValid && sheet.key === "altas") initial.add(`${sheet.key}-${row.rowNumber}`);
                });
            });
            selectedRows = initial;
        } catch (err) {
            handleError(err, "Leer Plantilla Excel");
        } finally {
            isParsing = false;
            input.value = "";
        }
    }

    // ── Validación contra catálogo (bloqueante) ───────────
    function catalogHasName(catalog: { name?: string }[], value: string | null | undefined): boolean {
        if (!value) return false;
        const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return catalog.some((c) => norm(c.name ?? "") === norm(value));
    }

    function validateRow(fields: Record<string, string>): string[] {
        const problems: string[] = [];
        const cat = catalogState;
        if (fields.dependencia && !catalogHasName(cat.dependencies, fields.dependencia)) {
            problems.push(`Dependencia "${fields.dependencia}"`);
        }
        if (fields.edificio && !catalogHasName(cat.buildings, fields.edificio)) {
            problems.push(`Edificio "${fields.edificio}"`);
        }
        if (fields.horario && !catalogHasName(cat.schedules, fields.horario)) {
            problems.push(`Horario "${fields.horario}"`);
        }
        if (fields.edificio && catalogHasName(cat.buildings, fields.edificio)) {
            const b = cat.buildings.find((x) => x.name === fields.edificio);
            const canonical = (b?.floors || []) as string[];
            if (fields.piso_base) {
                const { unresolved: badBase } = resolveFloorList([fields.piso_base], canonical);
                if (badBase.length) problems.push(`Piso base "${fields.piso_base}" no existe en ${fields.edificio}`);
            }
            for (const m of activeMediaTypes(cat.mediaTypes)) {
                if (!m.has_floors) continue;
                const raw = parseFloors(fields[`pisos_${m.key}`]);
                if (raw.length === 0) continue;
                const { unresolved } = resolveFloorList(raw, canonical);
                if (unresolved.length) problems.push(`Pisos ${m.name}: ${unresolved.join(", ")}`);
            }
        }
        return problems;
    }

    // ── Revisión ──────────────────────────────────────────
    async function startReview() {
        if (!altasSheet) return;
        isReviewing = true;
        step = "review";

        const newMatches = new Map<string, Person[]>();
        const nameCache = new Map<string, Person[]>();

        for (const row of altasSheet.rows) {
            if (!row.isValid) continue;
            const rowKey = `altas-${row.rowNumber}`;
            if (!selectedRows.has(rowKey)) continue;
            const nameKey = `${(row.fields.apellidos ?? "").toLowerCase().trim()}|${(row.fields.nombres ?? "").toLowerCase().trim()}`;
            if (nameCache.has(nameKey)) {
                newMatches.set(rowKey, nameCache.get(nameKey)!);
                continue;
            }
            try {
                const results = await personnelService.searchByName(row.fields.apellidos ?? "", row.fields.nombres ?? "");
                nameCache.set(nameKey, results);
                newMatches.set(rowKey, results);
            } catch {
                newMatches.set(rowKey, []);
            }
        }
        matchResults = newMatches;

        const newErrors = new Map<string, string[]>();
        for (const row of altasSheet.rows) {
            if (!row.isValid) continue;
            const rowKey = `altas-${row.rowNumber}`;
            if (!selectedRows.has(rowKey)) continue;
            const problems = validateRow(row.fields);
            if (problems.length) newErrors.set(rowKey, problems);
        }
        validationErrors = newErrors;

        isReviewing = false;
    }

    // ── Construcción de tickets ───────────────────────────
    function buildTicketTitle(row: ParsedRow): string {
        const name = [row.fields.apellidos, row.fields.nombres].filter(Boolean).join(", ");
        const dep = row.fields.dependencia || "";
        return dep ? `${name} (${dep})` : name;
    }

    function buildTicketDescription(row: ParsedRow): string {
        return Object.entries(row.fields)
            .filter(([k, v]) => v && k !== "nombres" && k !== "apellidos")
            .map(([k, v]) => `${FIELD_LABELS[k] ?? k}: ${v}`)
            .join("\n");
    }

    // ── Importar ──────────────────────────────────────────
    async function handleImport() {
        if (!altasSheet) return;

        const blockedRows = [...validationErrors.entries()].filter(([rk]) => selectedRows.has(rk));
        if (blockedRows.length > 0) {
            toast.error("No se pueden importar las filas seleccionadas", {
                description: `${blockedRows.length} fila(s) tienen datos que no coinciden con el catálogo. Corrígelas y vuelve a intentarlo.`,
            });
            return;
        }

        isImporting = true;
        step = "importing";

        const errores: { rowNumber: number; message: string }[] = [];
        const ticketDefs: { type: string; title: string; description: string; priority: string; payload: Record<string, string>; person_id: string | null }[] = [];
        let directos = 0;
        let tickets = 0;

        for (const row of altasSheet.rows) {
            if (!row.isValid) continue;
            const rowKey = `altas-${row.rowNumber}`;
            if (!selectedRows.has(rowKey)) continue;
            if (validationErrors.has(rowKey)) continue;

            if (!isDirect(row.fields)) {
                ticketDefs.push({
                    type: "Alta de Persona",
                    title: buildTicketTitle(row),
                    description: buildTicketDescription(row),
                    priority: "media",
                    payload: row.fields,
                    person_id: null,
                });
                continue;
            }

            const action = getRowAction(rowKey, row.fields);
            if (action === "skip") continue;

            try {
                if (action === "create") {
                    await personnelService.importDirectLegacy(row.fields);
                    directos++;
                    continue;
                }

                // Vincular a la candidata seleccionada.
                const dups = matchResults.get(rowKey) ?? [];
                const person = getSelectedLinkedPerson(rowKey, dups);
                if (!person?.id) throw new Error("No se encontró la persona para vincular");

                const conflicts = selectedConflicts(rowKey, row, person);
                const excludeKeys = new Set(conflicts.map((c) => c.mediaKey));

                // Asignar folios no conflictivos a la persona existente.
                await personnelService.linkLegacyToExisting(person.id, row.fields, [...excludeKeys]);

                // Conflictos marcados "reponer" → ticket de Reposición.
                for (const c of conflicts) {
                    if (getCardAction(`${rowKey}:${c.mediaKey}`) === "reponer") {
                        ticketDefs.push({
                            type: "Reposición",
                            title: `Reposición ${c.mediaName} — ${row.fields.apellidos}, ${row.fields.nombres}`,
                            description: `Reposición automática desde importación de registros (${c.mediaName} existente: ${c.existingFolio || "N/A"})`,
                            priority: "media",
                            payload: {
                                ...row.fields,
                                [`reponer_${c.mediaKey}`]: "sí",
                                [`folio_${c.mediaKey}`]: c.existingFolio || "",
                                origen: "Importación de registros",
                            },
                            person_id: person.id,
                        });
                    }
                }

                directos++;
            } catch (e) {
                errores.push({ rowNumber: row.rowNumber, message: e instanceof Error ? e.message : "Error desconocido" });
            }
        }

        if (ticketDefs.length > 0) {
            const res = await ticketService.createBatch(ticketDefs);
            tickets = res.created;
            res.errors.forEach((e) => errores.push({ rowNumber: 0, message: `Ticket ${e.index + 1}: ${e.message}` }));
        }

        importResult = { directos, tickets, errores };
        isImporting = false;
        step = "done";

        if (directos + tickets > 0) {
            toast.success(`${directos} registro(s) directo(s) y ${tickets} ticket(s) creados.`);
        }
        if (errores.length > 0) {
            toast.error(`${errores.length} fila(s) no pudieron importarse.`);
        }
        onComplete?.();
    }

    // ── Derivados de resumen ──────────────────────────────
    let totalDuplicates = $derived([...matchResults.values()].filter((v) => v.length > 0).length);
    let totalDirect = $derived.by(() => {
        if (!altasSheet) return 0;
        return altasSheet.rows.filter((r) => r.isValid && selectedRows.has(`altas-${r.rowNumber}`) && isDirect(r.fields)).length;
    });
    let totalTickets = $derived.by(() => {
        if (!altasSheet) return 0;
        return altasSheet.rows.filter((r) => r.isValid && selectedRows.has(`altas-${r.rowNumber}`) && !isDirect(r.fields)).length;
    });
</script>

<Modal
    bind:isOpen
    title="Importar Registros"
    description="Suba la hoja ALTAS para dar de alta personal directamente (con folio = legacy, sin ticket)."
    size={step === "review" ? "xl" : "lg"}
    onclose={closeModal}
>
    <div class="space-y-5">
        {#if step === "idle"}
            <div class="flex flex-col items-center justify-center gap-4 py-10 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
                <div class="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <FileSpreadsheet size={28} />
                </div>
                <div class="text-center">
                    <p class="text-sm font-semibold text-slate-700">Selecciona la plantilla completada</p>
                    <p class="text-xs text-slate-400 mt-1">Se usará la hoja <span class="font-mono">✅ ALTAS</span> (.xlsx)</p>
                </div>
                <Button variant="primary" loading={isParsing} onclick={() => fileInput?.click()}>
                    <Upload size={16} class="mr-2" />
                    {isParsing ? "Leyendo archivo…" : "Seleccionar archivo"}
                </Button>
                <input type="file" accept=".xlsx" class="hidden" bind:this={fileInput} onchange={handleFileChange} />
            </div>
        {/if}

        {#if step === "parsed" && altasSheet}
            <div class="grid grid-cols-3 gap-3 text-center">
                <div class="rounded-lg p-3 bg-slate-50 border border-slate-200">
                    <p class="text-2xl font-bold text-slate-800">{altasSheet.rows.length}</p>
                    <p class="text-xs text-slate-500 mt-0.5">Filas encontradas</p>
                </div>
                <div class="rounded-lg p-3 bg-emerald-50 border border-emerald-200">
                    <p class="text-2xl font-bold text-emerald-700">{totalSelected}</p>
                    <p class="text-xs text-emerald-600 mt-0.5">Seleccionadas</p>
                </div>
                <div class="rounded-lg p-3 {altasSheet.invalidCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'} border">
                    <p class="text-2xl font-bold {altasSheet.invalidCount > 0 ? 'text-rose-600' : 'text-slate-400'}">{altasSheet.invalidCount}</p>
                    <p class="text-xs text-slate-400 mt-0.5">Con errores</p>
                </div>
            </div>

            <div class="rounded-lg border border-slate-200 overflow-hidden">
                <div class="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200/50">
                    <input
                        type="checkbox"
                        class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={altasSheet.rows.filter((r) => r.isValid).every((r) => selectedRows.has(`altas-${r.rowNumber}`))}
                        onchange={() => toggleSheetSelection(altasSheet)}
                    />
                    <button class="flex-1 flex items-center justify-between gap-3 text-left" onclick={() => toggleSheet("altas")}>
                        <span class="text-xs font-bold text-slate-600">✅ ALTAS · {altasSheet.rows.length} fila(s)</span>
                        {#if expandedSheets.has("altas")}
                            <ChevronDown size={14} class="text-slate-400" />
                        {:else}
                            <ChevronRight size={14} class="text-slate-400" />
                        {/if}
                    </button>
                </div>
                {#if expandedSheets.has("altas")}
                    <div class="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                        {#each altasSheet.rows as row}
                            <div class="flex items-start gap-3 px-4 py-2.5 {row.isValid ? '' : 'bg-rose-50/50'}">
                                {#if row.isValid}
                                    <input
                                        type="checkbox"
                                        class="mt-1 w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        checked={selectedRows.has(`altas-${row.rowNumber}`)}
                                        onchange={() => toggleRow("altas", row.rowNumber)}
                                    />
                                {:else}
                                    <AlertCircle size={14} class="text-rose-500 mt-0.5 shrink-0" />
                                {/if}
                                <div class="min-w-0">
                                    <p class="text-xs font-medium text-slate-700 truncate">
                                        {[row.fields.apellidos, row.fields.nombres].filter(Boolean).join(", ") || `Fila ${row.rowNumber}`}
                                        {#if row.fields.dependencia}<span class="text-slate-400"> — {row.fields.dependencia}</span>{/if}
                                    </p>
                                    {#if !row.isValid}
                                        <p class="text-[10px] text-rose-500 mt-0.5">Faltan: {row.missingRequired.join(", ")}</p>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}

        {#if step === "review"}
            {#if isReviewing}
                <div class="flex flex-col items-center gap-4 py-12">
                    <div class="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <Loader2 size={28} class="animate-spin" />
                    </div>
                    <p class="text-sm font-semibold text-slate-700">Validando {totalSelected} registro(s)…</p>
                </div>
            {:else if altasSheet}
                <div class="flex items-center gap-3 text-xs flex-wrap">
                    <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                        <UserPlus size={12} /> {totalDirect} directos (legacy)
                    </div>
                    <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                        <Ticket size={12} /> {totalTickets} tickets de alta
                    </div>
                    {#if totalDuplicates > 0}
                        <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-medium">
                            <AlertTriangle size={12} /> {totalDuplicates} posible(s) duplicado(s)
                        </div>
                    {/if}
                    {#if validationErrors.size > 0}
                        <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 font-bold">
                            <AlertCircle size={12} /> {validationErrors.size} con datos no reconocidos (bloqueante)
                        </div>
                    {/if}
                </div>

                <div class="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {#each altasSheet.rows as row (row.rowNumber)}
                        {#if row.isValid && selectedRows.has(`altas-${row.rowNumber}`)}
                            {@const rowKey = `altas-${row.rowNumber}`}
                            {@const direct = isDirect(row.fields)}
                            {@const errs = validationErrors.get(rowKey) ?? []}
                            {@const dups = matchResults.get(rowKey) ?? []}
                            {@const action = direct ? getRowAction(rowKey, row.fields) : "create"}
                            <div class="rounded-lg border {errs.length ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200'} p-3">
                                <div class="flex items-center justify-between gap-3">
                                    <div class="min-w-0">
                                        <p class="text-xs font-bold text-slate-700 truncate">
                                            {[row.fields.apellidos, row.fields.nombres].filter(Boolean).join(", ")}
                                        </p>
                                        <p class="text-[10px] text-slate-400 truncate">{row.fields.dependencia || "—"} · {row.fields.edificio || "—"}</p>
                                    </div>
                                    <div class="flex items-center gap-1.5 shrink-0">
                                        {#if direct}
                                            <Badge variant="emerald" class="text-[9px] font-extrabold px-1.5 py-0.5">Directo · Legacy</Badge>
                                        {:else}
                                            <Badge variant="blue" class="text-[9px] font-extrabold px-1.5 py-0.5">Ticket de alta</Badge>
                                        {/if}
                                    </div>
                                </div>

                                {#if direct && dups.length > 0}
                                    {@const selectedPerson = getSelectedLinkedPerson(rowKey, dups)}
                                    {@const conflicts = selectedConflicts(rowKey, row, selectedPerson)}
                                    <div class="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                                        <p class="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                                            <AlertTriangle size={11} /> {dups.length === 1 ? "Posible duplicado" : `${dups.length} posibles duplicados`}
                                        </p>
                                        <div class="mt-2 space-y-1.5">
                                            {#each dups as candidate (candidate.id)}
                                                {@const candidateKey = `${rowKey}:${candidate.id}`}
                                                <LinkedPersonSummary
                                                    person={candidate}
                                                    selected={selectedPerson?.id === candidate.id}
                                                    expanded={expandedLinkedCandidates.has(candidateKey)}
                                                    onSelect={(id) => setSelectedLinkedPerson(rowKey, id)}
                                                    onToggle={(id) => toggleLinkedCandidate(`${rowKey}:${id}`)}
                                                />
                                            {/each}
                                        </div>
                                        <div class="mt-1.5 flex items-center gap-1 flex-wrap">
                                            <button class="px-2 py-1 rounded text-[10px] font-bold {action === 'link' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}" onclick={() => setRowAction(rowKey, "link")}>Vincular</button>
                                            <button class="px-2 py-1 rounded text-[10px] font-bold {action === 'create' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}" onclick={() => setRowAction(rowKey, "create")}>Crear nuevo</button>
                                            <button class="px-2 py-1 rounded text-[10px] font-bold {action === 'skip' ? 'bg-rose-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}" onclick={() => setRowAction(rowKey, "skip")}>Omitir</button>
                                        </div>

                                        {#if action === "link" && selectedPerson}
                                            {#if conflicts.length > 0}
                                                <div class="mt-2 space-y-1.5">
                                                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{selectedPerson.name} ya tiene:</p>
                                                    {#each conflicts as c (c.mediaKey)}
                                                        {@const cardKey = `${rowKey}:${c.mediaKey}`}
                                                        {@const cardAction = getCardAction(cardKey)}
                                                        <div class="flex items-center justify-between gap-2">
                                                            <span class="text-[10px] font-bold text-slate-700">{c.mediaName} ({c.existingFolio || "activa"})</span>
                                                            <div class="flex items-center gap-1 shrink-0">
                                                                <button class="px-2 py-0.5 rounded text-[9px] font-bold {cardAction === 'omitir' ? 'bg-slate-700 text-white' : 'bg-white text-slate-500 border border-slate-200'}" onclick={() => setCardAction(cardKey, "omitir")}>Omitir</button>
                                                                <button class="px-2 py-0.5 rounded text-[9px] font-bold {cardAction === 'reponer' ? 'bg-amber-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}" onclick={() => setCardAction(cardKey, "reponer")}>Reponer</button>
                                                            </div>
                                                        </div>
                                                    {/each}
                                                </div>
                                            {:else}
                                                <p class="mt-1.5 text-[10px] text-emerald-700 font-medium">Se asignarán los folios a {selectedPerson.name}.</p>
                                            {/if}
                                        {/if}
                                    </div>
                                {:else if direct}
                                    {@const folios = foliosOf(row.fields)}
                                    {#if folios.length > 0}
                                        <div class="mt-1.5 flex flex-wrap gap-1.5">
                                            {#each folios as f}
                                                <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">{f.type}: {f.folio}</span>
                                            {/each}
                                        </div>
                                    {:else}
                                        <p class="mt-1.5 text-[10px] text-slate-400 italic">Sin tarjeta (solo datos).</p>
                                    {/if}
                                {/if}

                                {#if errs.length > 0}
                                    <p class="mt-1.5 text-[10px] text-rose-600 flex items-center gap-1">
                                        <AlertCircle size={11} /> {errs.join(" · ")}
                                    </p>
                                {/if}
                            </div>
                        {/if}
                    {/each}
                </div>
            {/if}
        {/if}

        {#if step === "importing"}
            <div class="flex flex-col items-center gap-4 py-12">
                <div class="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Loader2 size={28} class="animate-spin" />
                </div>
                <p class="text-sm font-semibold text-slate-700">Importando registros…</p>
            </div>
        {/if}

        {#if step === "done" && importResult}
            <div class="space-y-3">
                <div class="flex items-center gap-2 text-sm font-bold text-emerald-700">
                    <CheckCircle2 size={18} /> Importación completada
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="rounded-lg p-3 bg-emerald-50 border border-emerald-200 text-center">
                        <p class="text-2xl font-bold text-emerald-700">{importResult.directos}</p>
                        <p class="text-xs text-emerald-600">Registros directos (legacy)</p>
                    </div>
                    <div class="rounded-lg p-3 bg-blue-50 border border-blue-200 text-center">
                        <p class="text-2xl font-bold text-blue-700">{importResult.tickets}</p>
                        <p class="text-xs text-blue-600">Tickets de alta</p>
                    </div>
                </div>
                {#if importResult.errores.length > 0}
                    <div class="rounded-lg border border-rose-200 bg-rose-50 p-3 space-y-1 max-h-40 overflow-y-auto">
                        {#each importResult.errores as err}
                            <p class="text-[11px] text-rose-700">{#if err.rowNumber}Fila {err.rowNumber}: {/if}{err.message}</p>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    {#snippet footer()}
        {#if step === "parsed"}
            <Button variant="secondary" onclick={closeModal}>Cancelar</Button>
            <Button variant="primary" disabled={totalSelected === 0} onclick={startReview}>Continuar</Button>
        {:else if step === "review"}
            <Button variant="secondary" onclick={() => (step = "parsed")}>Atrás</Button>
            <Button variant="primary" onclick={handleImport}>Importar</Button>
        {:else if step === "done"}
            <Button variant="primary" onclick={closeModal}>Cerrar</Button>
        {/if}
    {/snippet}
</Modal>
