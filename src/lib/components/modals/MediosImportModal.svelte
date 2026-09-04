<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import Badge from "../Badge.svelte";
    import { toast } from "svelte-sonner";
    import { handleError, parseTemplateFile } from "../../utils";
    import { supabase } from "../../supabase";
    import { catalogState } from "../../stores";
    import { HistoryService } from "../../services/history";
    import { FileSpreadsheet, Upload, AlertCircle, CheckCircle2, XCircle, Download } from "lucide-svelte";
    import type { ParsedRow } from "../../utils/xlsxImporter";

    let { isOpen = $bindable(false), onComplete }: { isOpen: boolean; onComplete?: () => void } = $props();

    let step = $state<"idle" | "parsed" | "review" | "done">("idle");
    let parseResult = $state<any>(null);
    let mediosRows = $state<ParsedRow[]>([]);
    let validation = $state<{ rowNumber: number; folio: string; tipo: string; status: "ok" | "duplicate_file" | "exists_db" | "invalid_tipo" | "missing_folio"; message: string }[]>([]);
    let isParsing = $state(false);
    let isImporting = $state(false);
    let importResult = $state<{ created: number; errors: string[] } | null>(null);
    let fileInput = $state<HTMLInputElement | undefined>(undefined);

    function reset() {
        step = "idle";
        parseResult = null;
        mediosRows = [];
        validation = [];
        importResult = null;
        isParsing = false;
        isImporting = false;
        if (fileInput) fileInput.value = "";
    }
    function closeModal() { reset(); isOpen = false; }

    async function handleFileChange(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        isParsing = true;
        try {
            const result = await parseTemplateFile(file, catalogState.mediaTypes as any[]);
            const sheet = result.sheets.find((s: any) => s.key === "medios");
            if (!sheet || sheet.rows.length === 0) {
                toast.error("No se encontró la hoja MEDIOS en el archivo");
                step = "idle";
                return;
            }
            parseResult = result;
            mediosRows = sheet.rows;
            step = "parsed";
            await runValidation();
        } catch (err) {
            handleError(err, "Leer Plantilla Medios");
        } finally {
            isParsing = false;
            if (fileInput) fileInput.value = "";
        }
    }

    async function runValidation() {
        const rows = mediosRows;
        const byTypeFolio = new Map<string, number>();
        const toCheck: { tipo: string; folio: string; mediaTypeId?: string }[] = [];

        // Map tipo name -> mediaType
        const typeMap = new Map<string, any>();
        for (const m of catalogState.mediaTypes) {
            typeMap.set(m.name.toLowerCase(), m);
            typeMap.set((m.key || "").toLowerCase(), m);
        }

        // First pass: invalid tipo, missing folio, duplicate in file
        const prelim: typeof validation = [];
        for (const row of rows) {
            const tipoRaw = (row.fields.tipo || "").trim();
            const folioRaw = (row.fields.folio || "").trim();
            const key = `${tipoRaw.toLowerCase()}|${folioRaw}`;
            let status: any = "ok";
            let message = "Listo para importar";

            const mediaType = typeMap.get(tipoRaw.toLowerCase());
            if (!mediaType) {
                status = "invalid_tipo";
                message = `Tipo "${tipoRaw}" no existe`;
            } else if (!folioRaw && mediaType.requires_identifier !== false) {
                status = "missing_folio";
                message = `Folio requerido para ${tipoRaw}`;
            } else if (folioRaw) {
                const count = byTypeFolio.get(key) || 0;
                byTypeFolio.set(key, count + 1);
                toCheck.push({ tipo: tipoRaw, folio: folioRaw, mediaTypeId: mediaType?.id });
            }
            prelim.push({ rowNumber: row.rowNumber, folio: folioRaw, tipo: tipoRaw, status, message });
        }

        // Duplicate in file
        for (const v of prelim) {
            if (v.status === "ok" && v.folio) {
                const key = `${v.tipo.toLowerCase()}|${v.folio}`;
                if ((byTypeFolio.get(key) || 0) > 1) {
                    v.status = "duplicate_file";
                    v.message = "Folio duplicado en el archivo para este tipo";
                }
            }
        }

        // Check against DB: folio exists per media_type
        const validForDbCheck = prelim.filter(p => p.status === "ok" && p.folio);
        if (validForDbCheck.length > 0) {
            // Group by mediaTypeId
            const byMedia = new Map<string, string[]>();
            for (const v of validForDbCheck) {
                const mt = typeMap.get(v.tipo.toLowerCase());
                if (!mt) continue;
                if (!byMedia.has(mt.id)) byMedia.set(mt.id, []);
                byMedia.get(mt.id)!.push(v.folio);
            }
            for (const [mediaTypeId, folios] of byMedia) {
                const { data, error } = await supabase.from("access_media").select("identifier").eq("media_type_id", mediaTypeId).in("identifier", folios);
                if (!error && data) {
                    const existing = new Set(data.map((r: any) => r.identifier));
                    for (const v of prelim) {
                        if (v.status !== "ok") continue;
                        const mt = typeMap.get(v.tipo.toLowerCase());
                        if (mt?.id === mediaTypeId && existing.has(v.folio)) {
                            v.status = "exists_db";
                            v.message = "Ya existe un medio con ese folio para este tipo";
                        }
                    }
                }
            }
        }

        validation = prelim;
        step = "review";
    }

    let totalOk = $derived(validation.filter(v => v.status === "ok").length);
    let totalConflict = $derived(validation.filter(v => v.status !== "ok").length);
    let totalInvalid = $derived(parseResult ? mediosRows.filter((r: ParsedRow) => !r.isValid).length : 0);

    async function handleImport() {
        const toImport = validation.filter(v => v.status === "ok");
        if (toImport.length === 0) {
            toast.error("No hay medios válidos para importar");
            return;
        }
        isImporting = true;
        let created = 0;
        const errors: string[] = [];
        try {
            const typeMap = new Map<string, any>();
            for (const m of catalogState.mediaTypes) {
                typeMap.set(m.name.toLowerCase(), m);
                typeMap.set((m.key || "").toLowerCase(), m);
            }
            const payload = toImport.map(v => {
                const mt = typeMap.get(v.tipo.toLowerCase())!;
                return {
                    media_type_id: mt.id,
                    identifier: v.folio || null,
                    status: "available",
                    person_id: null,
                    programming_status: "pending",
                    responsiva_status: "unsigned",
                };
            });

            // Insert in batches of 100
            for (let i = 0; i < payload.length; i += 100) {
                const batch = payload.slice(i, i + 100);
                const { data, error } = await supabase.from("access_media").insert(batch).select("id, identifier, media_type_id");
                if (error) {
                    // Try one by one to isolate
                    for (const item of batch) {
                        const { error: e2 } = await supabase.from("access_media").insert([item]);
                        if (e2) errors.push(`${item.identifier || "(sin folio)"}: ${e2.message}`);
                        else created++;
                    }
                } else {
                    created += data?.length || batch.length;
                    // History
                    for (const row of (data as any[]) || []) {
                        const mt = catalogState.mediaTypes.find((m: any) => m.id === row.media_type_id);
                        await HistoryService.log("CARD", row.id, "CREATE", {
                            message: `Medio ${row.identifier || ""} creado por importación`,
                            entityName: `${mt?.name || "Medio"} (Folio: ${row.identifier || ""})`
                        });
                    }
                }
            }
            importResult = { created, errors };
            step = "done";
            if (created > 0) toast.success(`${created} medio(s) importados correctamente`);
            if (errors.length > 0) toast.error(`${errors.length} no se pudieron crear`);
            onComplete?.();
        } catch (err) {
            handleError(err, "Importar Medios");
        } finally {
            isImporting = false;
        }
    }
</script>

<Modal bind:isOpen={isOpen} title="Importar Medios — Inventario" size="xl" onclose={closeModal}>
    {#if step === "idle"}
        <div class="space-y-6">
            <div class="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
                <div class="w-14 h-14 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-3">
                    <FileSpreadsheet size={28} />
                </div>
                <p class="text-sm font-bold text-slate-800">Plantilla separada de Medios</p>
                <p class="text-xs text-slate-500 mt-1">Columnas: <b>Tipo</b> (desplegable con tipos vigentes) y <b>Folio</b>. Cada fila es un medio disponible.</p>
                <input bind:this={fileInput} type="file" accept=".xlsx,.xls" class="hidden" onchange={handleFileChange} />
                <div class="flex justify-center gap-2 mt-4">
                    <Button variant="soft-blue" onclick={() => fileInput?.click()} disabled={isParsing}>
                        <Upload size={14} class="mr-1.5" /> Seleccionar archivo
                    </Button>
                </div>
            </div>
        </div>
    {:else if step === "parsed" || step === "review"}
        <div class="space-y-4">
            <div class="flex items-center gap-3 text-xs flex-wrap">
                <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                    <CheckCircle2 size={12} /> {totalOk} listos
                </div>
                {#if totalConflict > 0}
                    <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium">
                        <XCircle size={12} /> {totalConflict} con conflicto
                    </div>
                {/if}
                {#if totalInvalid > 0}
                    <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-medium">
                        <AlertCircle size={12} /> {totalInvalid} inválidas
                    </div>
                {/if}
                <div class="ml-auto text-[11px] text-slate-400">{mediosRows.length} filas totales</div>
            </div>

            <div class="rounded-xl border border-slate-200 overflow-hidden">
                <div class="grid grid-cols-[50px_1fr_1fr_140px] gap-px bg-slate-200 text-[10px] font-bold uppercase tracking-wider">
                    <div class="bg-slate-50 px-3 py-2 text-center">#</div>
                    <div class="bg-slate-50 px-3 py-2">Tipo</div>
                    <div class="bg-slate-50 px-3 py-2">Folio</div>
                    <div class="bg-slate-50 px-3 py-2 text-center">Estado</div>
                </div>
                {#each validation as v}
                    <div class="grid grid-cols-[50px_1fr_1fr_140px] gap-px bg-slate-200 text-xs">
                        <div class="bg-white px-3 py-2 text-center text-slate-500">{v.rowNumber}</div>
                        <div class="bg-white px-3 py-2 font-medium {v.status !== 'ok' ? 'text-rose-600' : ''}">{v.tipo || "—"}</div>
                        <div class="bg-white px-3 py-2 font-mono text-[11px]">{v.folio || "—"}</div>
                        <div class="bg-white px-3 py-1.5 text-center">
                            {#if v.status === "ok"}
                                <Badge variant="emerald" class="text-[10px]">OK</Badge>
                            {:else}
                                <Badge variant="rose" class="text-[10px]">{v.message}</Badge>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>

            {#if totalConflict > 0}
                <div class="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2">
                    <AlertCircle size={14} class="text-amber-600 mt-0.5" />
                    <p class="text-xs text-amber-800">Las filas con conflicto no se importarán. Corrige el archivo o desmarca duplicados/tipos inválidos.</p>
                </div>
            {/if}
        </div>
    {:else if step === "done" && importResult}
        <div class="text-center py-6 space-y-3">
            <div class="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 size={28} />
            </div>
            <p class="font-bold text-slate-800">{importResult.created} medio(s) creados</p>
            {#if importResult.errors.length > 0}
                <div class="text-left rounded-lg bg-rose-50 border border-rose-200 p-3 max-h-40 overflow-auto">
                    {#each importResult.errors as e}
                        <p class="text-xs text-rose-700">{e}</p>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}

    {#snippet footer()}
        {#if step === "review"}
            <Button variant="ghost" onclick={closeModal}>Cancelar</Button>
            <Button variant="primary" onclick={handleImport} disabled={isImporting || totalOk === 0} loading={isImporting}>
                Importar {totalOk} medio(s)
            </Button>
        {:else if step === "done"}
            <Button variant="primary" onclick={closeModal}>Cerrar</Button>
        {:else if step === "parsed"}
            <Button variant="ghost" onclick={closeModal}>Cancelar</Button>
        {/if}
    {/snippet}
</Modal>
