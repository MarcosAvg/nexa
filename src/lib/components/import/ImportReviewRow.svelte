<!--
 * ImportReviewRow.svelte
 *
 * Fila expandible del paso de revisión de importación.
 * Muestra los datos de una fila de la plantilla y las
 * coincidencias encontradas en la base de datos, incluyendo
 * detalles específicos por tipo de solicitud.
 -->
<script lang="ts">
    import Badge from "../Badge.svelte";
    import type { ParsedRow } from "../../utils";
    import type { Person } from "../../types";
    import {
        User,
        CreditCard,
        CheckCircle2,
        AlertTriangle,
        ChevronDown,
        ChevronRight,
    } from "lucide-svelte";

    let {
        row,
        sheetKey,
        matches,
        isExpanded,
        onToggle,
    }: {
        row: ParsedRow;
        sheetKey: string;
        matches: Person[];
        isExpanded: boolean;
        onToggle: () => void;
    } = $props();

    const CARD_TYPE_COLORS: Record<string, string> = {
        P2000: "bg-amber-100 text-amber-700 border-amber-200",
        KONE: "bg-blue-100 text-blue-700 border-blue-200",
    };

    /** For Altas: which card types are requested */
    function getRequestedCards(fields: Record<string, string>): string[] {
        const types: string[] = [];
        const yes = ["sí", "si"];
        if (yes.includes((fields.p2000_req ?? "").toLowerCase())) types.push("P2000");
        if (yes.includes((fields.kone_req ?? "").toLowerCase())) types.push("KONE");
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

    /** Get active cards for a person */
    function getActiveCards(person: Person): any[] {
        return ((person as any).cards ?? []).filter(
            (c: any) => c.status === "active",
        );
    }

    function cardStatusBadge(status: string): { text: string; color: "emerald" | "rose" | "slate" } {
        if (status === "active") return { text: "Activa", color: "emerald" };
        if (status === "blocked") return { text: "Bloqueada", color: "rose" };
        return { text: status, color: "slate" };
    }
</script>

<div class="rounded-xl border border-slate-200 overflow-hidden bg-white">                                <!-- Encabezado de fila -->
    <button
        class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50/50 transition-colors"
        onclick={onToggle}
    >
        <div class="flex items-center gap-3 min-w-0">
            {#if matches.length > 0}
                <div
                    class="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0"
                >
                    <CheckCircle2 size={13} />
                </div>
            {:else}
                <div
                    class="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0"
                >
                    <AlertTriangle size={13} />
                </div>
            {/if}
            <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-800 truncate">
                    {[row.fields.apellidos, row.fields.nombres]
                        .filter(Boolean)
                        .join(", ")}
                </p>
                <p class="text-[10px] text-slate-400 truncate">
                    {row.fields.dependencia ?? ""}
                    {#if matches.length > 0}
                        · <span class="text-emerald-600 font-medium"
                            >{matches.length} coincidencia(s)</span>
                    {:else}
                        · <span class="text-amber-600 font-medium"
                            >Persona nueva / no encontrada</span>
                    {/if}
                </p>
            </div>
        </div>
        <div class="shrink-0 text-slate-400">
            {#if isExpanded}
                <ChevronDown size={14} />
            {:else}
                <ChevronRight size={14} />
            {/if}
        </div>
    </button>                            <!-- Detalle expandido -->
    {#if isExpanded}
        <div class="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
            <!-- ── TYPE: ALTAS ── -->
            {#if sheetKey === "altas"}
                {@const requestedCards = getRequestedCards(row.fields)}
                {#if requestedCards.length > 0}
                    <div class="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                        <span class="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Solicita:</span>
                        <div class="flex gap-1.5">
                            {#each requestedCards as type}
                                <span
                                    class="text-[10px] font-bold px-2 py-0.5 rounded border {CARD_TYPE_COLORS[type] ?? 'bg-slate-100 text-slate-600 border-slate-200'}"
                                >{type}</span>
                            {/each}
                        </div>
                    </div>
                {/if}
                {#if row.fields.pisos_p2000}
                    <p class="text-[10px] text-slate-500">
                        <span class="font-semibold">Pisos P2000:</span> {row.fields.pisos_p2000}
                    </p>
                {/if}
                {#if row.fields.pisos_kone}
                    <p class="text-[10px] text-slate-500">
                        <span class="font-semibold">Pisos KONE:</span> {row.fields.pisos_kone}
                    </p>
                {/if}

            <!-- ── TYPE: MODIFICACIONES ── -->
            {:else if sheetKey === "modificaciones"}
                {@const changes = getModificationChanges(row.fields)}
                {#if changes.length > 0}
                    <div class="rounded-lg bg-amber-50 border border-amber-100 p-3">
                        <p class="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-2">Cambios solicitados</p>
                        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                            {#each changes as change}
                                <div class="text-slate-500">{change.label}</div>
                                <div class="text-amber-800 font-medium truncate">{change.value}</div>
                            {/each}
                        </div>
                    </div>
                {:else}
                    <p class="text-[10px] text-slate-400 italic">Sin cambios específicos detectados en los campos.</p>
                {/if}

            <!-- ── TYPE: BAJA ── -->
            {:else if sheetKey === "baja_persona"}
                <div class="rounded-lg bg-rose-50 border border-rose-100 p-3 space-y-1">
                    {#if row.fields.tipo_baja}
                        <p class="text-xs text-rose-700"><span class="font-semibold">Tipo:</span> {row.fields.tipo_baja}</p>
                    {/if}
                    {#if row.fields.motivo}
                        <p class="text-xs text-rose-700"><span class="font-semibold">Motivo:</span> {row.fields.motivo}</p>
                    {/if}
                </div>

            <!-- ── TYPE: REPOSICIÓN ── -->
            {:else if sheetKey === "reposicion"}
                {@const repoCards = getReposicionCards(row.fields)}
                {#if repoCards.length > 0}
                    <div class="rounded-lg bg-blue-50 border border-blue-100 p-3">
                        <p class="text-[10px] font-bold text-blue-700 uppercase tracking-widest mb-2">Tarjetas a reponer</p>
                        <div class="space-y-1">
                            {#each repoCards as rc}
                                <div class="flex items-center gap-2 text-xs">
                                    <span
                                        class="font-bold px-1.5 py-0.5 rounded {CARD_TYPE_COLORS[rc.type] ?? 'bg-slate-100'} text-[10px]"
                                    >{rc.type}</span>
                                    <span class="text-slate-600">Folio: {rc.folio || "—"}</span>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
                {#if row.fields.motivo}
                    <p class="text-[10px] text-slate-500"><span class="font-semibold">Motivo:</span> {row.fields.motivo}</p>
                {/if}

            <!-- ── TYPE: REPORTE DE FALLA ── -->
            {:else if sheetKey === "reporte_falla"}
                <div class="rounded-lg bg-violet-50 border border-violet-100 p-3 space-y-1">
                    {#if row.fields.tipo_tarjeta}
                        <p class="text-xs text-violet-700">
                            <span class="font-semibold">Tarjeta:</span> {row.fields.tipo_tarjeta}
                            {row.fields.folio ? `(${row.fields.folio})` : ""}
                        </p>
                    {/if}
                    {#if row.fields.descripcion}
                        <p class="text-xs text-violet-700"><span class="font-semibold">Problema:</span> {row.fields.descripcion}</p>
                    {/if}
                    {#if row.fields.ubicacion}
                        <p class="text-xs text-violet-700"><span class="font-semibold">Ubicación:</span> {row.fields.ubicacion}</p>
                    {/if}
                    {#if row.fields.urgencia}
                        <p class="text-xs text-violet-700"><span class="font-semibold">Urgencia:</span> {row.fields.urgencia}</p>
                    {/if}
                </div>
            {/if}

            <!-- ── MATCH RESULTS (all types) ── -->
            {#if matches.length > 0}
                <div class="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                    <p class="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <User size={11} />
                        {matches.length === 1 ? "Coincidencia encontrada" : `${matches.length} coincidencias`}
                    </p>
                    <div class="space-y-2">
                        {#each matches.slice(0, 3) as person}
                            {@const activeCards = getActiveCards(person)}
                            <div class="p-2.5 rounded-lg bg-white border border-emerald-100">
                                <div class="flex items-center gap-2.5 mb-1.5">
                                    <div class="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                        <User size={13} />
                                    </div>
                                    <div class="min-w-0">
                                        <p class="text-xs font-bold text-slate-800 truncate">
                                            {person.last_name}, {person.first_name}
                                        </p>
                                        <p class="text-[10px] text-slate-400 truncate">
                                            {person.dependency} · {person.building}{person.employee_no ? ` · #${person.employee_no}` : ""}
                                        </p>
                                    </div>
                                </div>

                                {#if activeCards.length > 0}
                                    <div class="flex flex-wrap gap-1.5 mt-1.5 ml-9">
                                        {#each activeCards as card}
                                            {@const statusInfo = cardStatusBadge(card.status)}
                                            <div class="flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded text-[10px] font-medium text-slate-600">
                                                <CreditCard size={9} class="text-slate-400" />
                                                <span class="font-bold">{card.type}:</span>
                                                <span>{card.folio}</span>
                                                <Badge
                                                    variant={statusInfo.color}
                                                    class="scale-[0.75] origin-left"
                                                >{statusInfo.text}</Badge>
                                            </div>
                                        {/each}
                                    </div>
                                {:else}
                                    <p class="text-[10px] text-slate-400 italic ml-9 flex items-center gap-1">
                                        <CreditCard size={9} /> Sin tarjetas activas
                                    </p>
                                {/if}

                                <!-- Contexto específico por tipo en persona coincidente -->
                                {#if sheetKey === "baja_persona" && activeCards.length > 0}
                                    <p class="text-[10px] text-rose-500 font-medium mt-1.5 ml-9">
                                        ⚠ Se desactivarán {activeCards.length} tarjeta(s) con la baja.
                                    </p>
                                {/if}

                                {#if sheetKey === "reposicion"}
                                    {@const repoCards = getReposicionCards(row.fields)}
                                    {#each repoCards as rc}
                                        {@const existingCard = activeCards.find((c: any) => c.type === rc.type)}
                                        {#if existingCard}
                                            {#if rc.folio && rc.folio !== existingCard.folio}
                                                <p class="text-[10px] text-amber-600 font-medium mt-1 ml-9 flex items-center gap-1">
                                                    <AlertTriangle size={10} /> Folio en plantilla ({rc.folio}) ≠ folio asignado ({existingCard.folio})
                                                </p>
                                            {:else}
                                                <p class="text-[10px] text-emerald-600 font-medium mt-1 ml-9 flex items-center gap-1">
                                                    <CheckCircle2 size={10} /> Folio {rc.type} coincide.
                                                </p>
                                            {/if}
                                        {:else}
                                            <p class="text-[10px] text-amber-600 font-medium mt-1 ml-9 flex items-center gap-1">
                                                <AlertTriangle size={10} /> No tiene tarjeta {rc.type} activa.
                                            </p>
                                        {/if}
                                    {/each}
                                {/if}

                                {#if sheetKey === "reporte_falla" && row.fields.folio}
                                    {@const reportCard = activeCards.find((c: any) => c.folio === row.fields.folio)}
                                    {#if reportCard}
                                        <p class="text-[10px] text-emerald-600 font-medium mt-1 ml-9 flex items-center gap-1">
                                            <CheckCircle2 size={10} /> Tarjeta {reportCard.type} ({reportCard.folio}) encontrada.
                                        </p>
                                    {:else}
                                        <p class="text-[10px] text-amber-600 font-medium mt-1 ml-9 flex items-center gap-1">
                                            <AlertTriangle size={10} /> Folio "{row.fields.folio}" no coincide con ninguna tarjeta activa.
                                        </p>
                                    {/if}
                                {/if}
                            </div>
                        {/each}
                        {#if matches.length > 3}
                            <p class="text-[10px] text-emerald-600 italic mt-1">…y {matches.length - 3} más</p>
                        {/if}
                    </div>
                </div>
            {:else}
                <div class="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                    <AlertTriangle size={13} class="shrink-0" />
                    <span>
                        No se encontró a "<strong>{row.fields.apellidos}, {row.fields.nombres}</strong>" en la base de datos.
                        {#if sheetKey === "altas"}
                            Se creará como persona nueva al procesar el ticket.
                        {:else}
                            Será necesario vincular manualmente al procesar el ticket.
                        {/if}
                    </span>
                </div>
            {/if}
        </div>
    {/if}
</div>
