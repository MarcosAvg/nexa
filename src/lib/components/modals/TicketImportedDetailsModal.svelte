<script lang="ts">
    /**
     * TicketImportedDetailsModal
     * Unified modal for tickets created from the Excel template:
     *   - Modificación → opens ModificationCompareModal with real diff
     *   - Baja de Persona → auto-detect person, confirm baja
     *   - Reposición → auto-detect person+card, validate folio, trigger Firma Responsiva
     *   - Reporte de Falla → show report detail, offer resolve or create reposición ticket
     */
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import ModificationCompareModal from "./ModificationCompareModal.svelte";
    import ConfirmationModal from "./ConfirmationModal.svelte";
    import { personnelService } from "../../services/personnel";
    import { ticketService } from "../../services/tickets";
    import { HistoryService } from "../../services/history";
    import { catalogState, personnelState } from "../../stores";
    import { toast } from "svelte-sonner";
    import {
        AlertCircle,
        CheckCircle2,
        User,
        XCircle,
        CreditCard,
        Loader2,
        AlertTriangle,
    } from "lucide-svelte";

    let {
        isOpen = $bindable(false),
        ticket = null,
        onComplete,
    }: {
        isOpen: boolean;
        ticket: any;
        onComplete?: () => void;
    } = $props();

    // ── State ─────────────────────────────────────────────
    let isSearching = $state(false);
    let isSubmitting = $state(false);
    let candidates = $state<any[]>([]);
    let selectedPerson = $state<any>(null);
    let searchDone = $state(false);

    // Sub-modals
    let isCompareOpen = $state(false);
    let compareTicket = $state<any>(null);
    let isRejectOpen = $state(false);

    let p = $derived(ticket?.payload ?? {});
    let ticketType = $derived(ticket?.type ?? "");

    // ── Auto-search when modal opens ──────────────────────
    $effect(() => {
        if (isOpen && ticket && !searchDone) {
            searchDone = true;
            autoSearch();
        }
        if (!isOpen && !isCompareOpen) {
            candidates = [];
            selectedPerson = null;
            searchDone = false;
            isSearching = false;
            compareTicket = null;
        }
    });

    async function autoSearch() {
        const apellidos = p.apellidos ?? "";
        const nombres = p.nombres ?? "";
        if (!apellidos && !nombres) return;

        isSearching = true;
        try {
            const results = await personnelService.searchByName(
                apellidos,
                nombres,
            );
            candidates = results;
            if (results.length === 1) selectedPerson = results[0];
        } finally {
            isSearching = false;
        }
    }

    // ── Catalog helpers ───────────────────────────────────
    function resolveId(catalog: { id: any; name: string }[], value: string) {
        if (!value) return null;
        return (
            catalog.find((c) => c.name.toLowerCase() === value.toLowerCase()) ??
            null
        );
    }

    // ── MODIFICACIÓN: build compareTicket for ModificationCompareModal ──
    function openCompareModal() {
        if (!selectedPerson) return;

        // Build the 'modified' payload using ModificationCompareModal's expected keys
        const modifiedPayload: any = {};
        if (p.nuevo_apellido) modifiedPayload.apellidos = p.nuevo_apellido;
        if (p.nuevo_nombre) modifiedPayload.nombres = p.nuevo_nombre;
        if (p.nueva_dep) {
            const dep = resolveId(catalogState.dependencies, p.nueva_dep);
            modifiedPayload.dependency = p.nueva_dep;
            modifiedPayload.dependency_id = dep?.id;
        }
        if (p.nuevo_edificio) {
            const bldg = resolveId(catalogState.buildings, p.nuevo_edificio);
            modifiedPayload.edificio = p.nuevo_edificio;
            modifiedPayload.building_id = bldg?.id;
        }
        if (p.nuevo_piso) modifiedPayload.pisoBase = p.nuevo_piso;
        if (p.nueva_area) modifiedPayload.areaEquipo = p.nueva_area;
        if (p.nuevo_puesto) modifiedPayload.puestoFuncion = p.nuevo_puesto;
        if (p.hora_entrada) modifiedPayload.horaEntrada = p.hora_entrada;
        if (p.hora_salida) modifiedPayload.horaSalida = p.hora_salida;

        // Cards and Accesses logic handles strings: "Añadir", "Reemplazar", "Quitar"
        // Since ModificationCompareModal compares the raw floor arrays, we need to apply the action
        // to generate the "proposed" final state of floors/accesses.

        let proposedP2000 = [...(selectedPerson.floors_p2000 || [])];
        if (p.accion_p2000) {
            const action = (p.accion_p2000 ?? "").toLowerCase();
            const floorsStr = p.pisos_p2000 || "";
            const parsedFloors = floorsStr
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean);

            if (action.includes("reemplazar")) proposedP2000 = parsedFloors;
            else if (action.includes("añadir"))
                proposedP2000 = [
                    ...new Set([...proposedP2000, ...parsedFloors]),
                ];
            else if (action.includes("quitar"))
                proposedP2000 = proposedP2000.filter(
                    (f) => !parsedFloors.includes(f),
                );
            else if (action.includes("remover todo")) proposedP2000 = [];
        }
        // Force the compare modal to show differences by explicitly passing the generated arrays
        modifiedPayload.floors_p2000 = proposedP2000;

        let proposedKONE = [...(selectedPerson.floors_kone || [])];
        if (p.accion_kone) {
            const action = (p.accion_kone ?? "").toLowerCase();
            const floorsStr = p.pisos_kone || "";
            const parsedFloors = floorsStr
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean);

            if (action.includes("reemplazar")) proposedKONE = parsedFloors;
            else if (action.includes("añadir"))
                proposedKONE = [...new Set([...proposedKONE, ...parsedFloors])];
            else if (action.includes("quitar"))
                proposedKONE = proposedKONE.filter(
                    (f) => !parsedFloors.includes(f),
                );
            else if (action.includes("remover todo")) proposedKONE = [];
        }
        modifiedPayload.floors_kone = proposedKONE;

        let proposedAccesses = [...(selectedPerson.specialAccesses || [])];
        if (p.accion_acc) {
            const action = (p.accion_acc ?? "").toLowerCase();
            const accesses = [p.acceso1, p.acceso2, p.acceso3]
                .map((s) => s?.trim())
                .filter(Boolean);

            if (action.includes("reemplazar")) proposedAccesses = accesses;
            else if (action.includes("añadir"))
                proposedAccesses = [
                    ...new Set([...proposedAccesses, ...accesses]),
                ];
            else if (action.includes("quitar"))
                proposedAccesses = proposedAccesses.filter(
                    (a) => !accesses.includes(a),
                );
            else if (action.includes("remover todo")) proposedAccesses = [];
        }
        modifiedPayload.specialAccesses = proposedAccesses;

        // Inherit unchanged fields from selectedPerson
        if (!modifiedPayload.nombres)
            modifiedPayload.nombres = selectedPerson.first_name;
        if (!modifiedPayload.apellidos)
            modifiedPayload.apellidos = selectedPerson.last_name;
        if (!modifiedPayload.dependency)
            modifiedPayload.dependency = selectedPerson.dependency;
        if (!modifiedPayload.edificio)
            modifiedPayload.edificio = selectedPerson.building;
        if (!modifiedPayload.pisoBase)
            modifiedPayload.pisoBase = selectedPerson.floor;
        if (!modifiedPayload.areaEquipo)
            modifiedPayload.areaEquipo = selectedPerson.area;
        if (!modifiedPayload.puestoFuncion)
            modifiedPayload.puestoFuncion = selectedPerson.position;

        // These don't need inheriting here since they are computed above

        compareTicket = {
            ...ticket,
            person_id: selectedPerson.id,
            payload: { modified: modifiedPayload },
        };

        isOpen = false;
        isCompareOpen = true;
    }

    function onCompareComplete() {
        compareTicket = null;
        onComplete?.();
    }

    // ── BAJA ─────────────────────────────────────────────
    async function handleBaja() {
        if (!selectedPerson || !ticket) return;
        isSubmitting = true;
        try {
            await personnelService.updateStatus(selectedPerson.id, "deleted");
            await ticketService.delete(
                ticket.id,
                "Baja aplicada desde plantilla",
            );
            toast.success(
                `Baja registrada para ${selectedPerson.last_name}, ${selectedPerson.first_name}.`,
            );
            isOpen = false;
            onComplete?.();
        } catch (err) {
            console.error(err);
            toast.error("Error al dar de baja.");
        } finally {
            isSubmitting = false;
        }
    }

    // ── REPOSICIÓN: folio validation ──────────────────────
    type FolioCheck = { card: any; match: boolean; warning: boolean };

    let folioChecks = $derived.by((): FolioCheck[] => {
        if (ticketType !== "Reposición" || !selectedPerson) return [];
        const cards: any[] = (selectedPerson.cards ?? []).filter(
            (c: any) => c.status === "active",
        );
        const wantsP2000 = ["sí", "si"].includes(
            (p.reponer_p2000 ?? "").toLowerCase(),
        );
        const wantsKONE = ["sí", "si"].includes(
            (p.reponer_kone ?? "").toLowerCase(),
        );

        const checks: FolioCheck[] = [];

        if (wantsP2000) {
            const folioSought = p.folio_p2000?.trim();
            const p2000Cards = cards.filter((c: any) => c.type === "P2000");
            if (p2000Cards.length === 0) {
                // No active P2000 card
                checks.push({
                    card: { type: "P2000", folio: folioSought ?? "—" },
                    match: false,
                    warning: true,
                });
            } else {
                for (const c of p2000Cards) {
                    const match = !folioSought || c.folio === folioSought;
                    checks.push({ card: c, match, warning: !match });
                }
            }
        }
        if (wantsKONE) {
            const folioSought = p.folio_kone?.trim();
            const koneCards = cards.filter((c: any) => c.type === "KONE");
            if (koneCards.length === 0) {
                checks.push({
                    card: { type: "KONE", folio: folioSought ?? "—" },
                    match: false,
                    warning: true,
                });
            } else {
                for (const c of koneCards) {
                    const match = !folioSought || c.folio === folioSought;
                    checks.push({ card: c, match, warning: !match });
                }
            }
        }

        return checks;
    });

    function handleGoToFirmaResponsiva(card: any) {
        if (!selectedPerson || !card?.id) return;
        personnelState.selectPerson(selectedPerson.id);
        personnelState.highlightedCardId = card.id;
        isOpen = false;
    }

    async function handleMarkReposicionDone() {
        if (!ticket) return;
        isSubmitting = true;
        try {
            await ticketService.delete(ticket.id, "Reposición gestionada");
            toast.success("Ticket de reposición cerrado.");
            isOpen = false;
            onComplete?.();
        } catch (err) {
            console.error(err);
            toast.error("Error al cerrar el ticket.");
        } finally {
            isSubmitting = false;
        }
    }

    // ── REPORTE DE FALLA ──────────────────────────────────
    let reportRows = $derived.by(() => {
        if (ticketType !== "Reporte de Falla") return [];
        return [
            { label: "Apellidos", value: p.apellidos },
            { label: "Nombres", value: p.nombres },
            { label: "Dependencia", value: p.dependencia },
            { label: "Tipo de Tarjeta", value: p.tipo_tarjeta },
            { label: "Folio de Tarjeta", value: p.folio },
            { label: "Lugar donde falla", value: p.ubicacion },
            { label: "Descripción", value: p.descripcion },
            { label: "¿Desde cuándo?", value: p.desde_cuando },
            { label: "Urgencia", value: p.urgencia },
            { label: "Observaciones", value: p.observaciones },
        ].filter((r) => r.value);
    });

    async function handleComplete(note?: string) {
        if (!ticket) return;
        isSubmitting = true;
        try {
            await ticketService.delete(ticket.id, note);
            toast.success("Ticket completado.");
            isOpen = false;
            onComplete?.();
        } catch (err) {
            console.error(err);
            toast.error("Error al completar el ticket.");
        } finally {
            isSubmitting = false;
        }
    }

    async function handleCreateReposicionTicket() {
        if (!ticket) return;
        isSubmitting = true;
        try {
            await ticketService.create({
                type: "Reposición",
                title: `Reposición — ${p.apellidos ?? ""}, ${p.nombres ?? ""}`,
                description: `De: Reporte de Falla\nTarjeta: ${p.tipo_tarjeta ?? ""}\nFolio: ${p.folio ?? ""}\nLugar: ${p.ubicacion ?? ""}\nDescripción: ${p.descripcion ?? ""}`,
                priority: p.urgencia?.toLowerCase().includes("alta")
                    ? "alta"
                    : "media",
                payload: { ...p, origen: "Reporte de Falla" },
            });
            await handleComplete("Reposición creada desde reporte de falla");
        } catch (err) {
            console.error(err);
            toast.error("Error al crear ticket de reposición.");
            isSubmitting = false;
        }
    }

    // ── Reject ────────────────────────────────────────────
    async function handleReject() {
        if (!ticket) return;
        isSubmitting = true;
        try {
            await ticketService.delete(ticket.id, "Ticket rechazado");
            await HistoryService.log(
                "PERSONNEL",
                selectedPerson?.id ?? "",
                "REJECT_TICKET",
                {
                    message: `Ticket de ${ticketType} rechazado`,
                },
            );
            toast.info("Ticket rechazado.");
            isRejectOpen = false;
            isOpen = false;
            onComplete?.();
        } catch (err) {
            console.error(err);
            toast.error("Error al rechazar.");
        } finally {
            isSubmitting = false;
        }
    }

    function closeModal() {
        isOpen = false;
    }
</script>

<!-- ── Modification compare modal (opens after closing this one) ── -->
<ModificationCompareModal
    bind:isOpen={isCompareOpen}
    ticket={compareTicket}
    onComplete={onCompareComplete}
/>

<!-- ── Reject confirmation ── -->
<ConfirmationModal
    bind:isOpen={isRejectOpen}
    title="Rechazar ticket"
    description="El ticket será eliminado sin aplicar ningún cambio. ¿Continuar?"
    confirmText="Sí, rechazar"
    cancelText="Cancelar"
    variant="warning"
    onConfirm={handleReject}
/>

<Modal
    bind:isOpen
    title={ticketType}
    description="Ticket importado desde plantilla Excel"
    size="lg"
    onclose={closeModal}
>
    <div class="space-y-4">
        <!-- ── Person detection (all except Reporte de Falla) ── -->
        {#if ticketType !== "Reporte de Falla"}
            <div class="rounded-xl border border-slate-200 p-3">
                <p
                    class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"
                >
                    <User size={11} /> Persona identificada en el sistema
                </p>

                {#if isSearching}
                    <div class="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 size={14} class="animate-spin" />
                        Buscando <strong>{p.apellidos}, {p.nombres}</strong>…
                    </div>
                {:else if candidates.length === 0 && searchDone}
                    <div class="flex items-start gap-2 text-sm text-rose-600">
                        <AlertCircle size={14} class="mt-0.5 shrink-0" />
                        <div>
                            <p class="font-semibold">
                                Persona no encontrada en el sistema
                            </p>
                            <p class="text-xs text-rose-400">
                                Buscado: "{p.apellidos}, {p.nombres}"
                            </p>
                        </div>
                    </div>
                {:else if candidates.length > 1 && !selectedPerson}
                    <p
                        class="text-xs text-amber-600 mb-2 flex items-center gap-1.5"
                    >
                        <AlertCircle size={12} /> Se encontraron {candidates.length}
                        personas. Selecciona la correcta:
                    </p>
                    <div class="space-y-1.5 max-h-36 overflow-y-auto">
                        {#each candidates as c}
                            <button
                                class="w-full flex items-center gap-3 p-2 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200 text-left transition-colors"
                                onclick={() => (selectedPerson = c)}
                            >
                                <User
                                    size={14}
                                    class="text-slate-400 shrink-0"
                                />
                                <div>
                                    <p
                                        class="text-sm font-semibold text-slate-800"
                                    >
                                        {c.last_name}, {c.first_name}
                                    </p>
                                    <p class="text-xs text-slate-400">
                                        {c.dependency} · {c.building}
                                    </p>
                                </div>
                            </button>
                        {/each}
                    </div>
                {:else if selectedPerson}
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div
                                class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"
                            >
                                <CheckCircle2 size={16} />
                            </div>
                            <div>
                                <p class="text-sm font-semibold text-slate-800">
                                    {selectedPerson.last_name}, {selectedPerson.first_name}
                                </p>
                                <p class="text-xs text-slate-400">
                                    {selectedPerson.dependency} · {selectedPerson.building}
                                </p>
                            </div>
                        </div>
                        {#if candidates.length > 1}
                            <button
                                class="text-xs text-blue-500 hover:underline"
                                onclick={() => (selectedPerson = null)}
                                >Cambiar</button
                            >
                        {/if}
                    </div>
                {/if}
            </div>
        {/if}

        <!-- ── MODIFICACIÓN: summary + open compare button ── -->
        {#if ticketType === "Modificación"}
            {#if selectedPerson}
                <div
                    class="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2"
                >
                    <p
                        class="text-xs font-bold text-amber-700 uppercase tracking-widest"
                    >
                        Cambios solicitados
                    </p>
                    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {#if p.nuevo_apellido}<div class="text-slate-500">
                                Apellidos
                            </div>
                            <div class="text-amber-800 font-medium">
                                {p.nuevo_apellido}
                            </div>{/if}
                        {#if p.nuevo_nombre}<div class="text-slate-500">
                                Nombres
                            </div>
                            <div class="text-amber-800 font-medium">
                                {p.nuevo_nombre}
                            </div>{/if}
                        {#if p.nueva_dep}<div class="text-slate-500">
                                Dependencia
                            </div>
                            <div class="text-amber-800 font-medium">
                                {p.nueva_dep}
                            </div>{/if}
                        {#if p.nuevo_edificio}<div class="text-slate-500">
                                Edificio
                            </div>
                            <div class="text-amber-800 font-medium">
                                {p.nuevo_edificio}
                            </div>{/if}
                        {#if p.nuevo_piso}<div class="text-slate-500">
                                Piso Base
                            </div>
                            <div class="text-amber-800 font-medium">
                                {p.nuevo_piso}
                            </div>{/if}
                        {#if p.nueva_area}<div class="text-slate-500">Área</div>
                            <div class="text-amber-800 font-medium">
                                {p.nueva_area}
                            </div>{/if}
                        {#if p.nuevo_puesto}<div class="text-slate-500">
                                Puesto
                            </div>
                            <div class="text-amber-800 font-medium">
                                {p.nuevo_puesto}
                            </div>{/if}
                        {#if p.hora_entrada}<div class="text-slate-500">
                                Hora Entrada
                            </div>
                            <div class="text-amber-800 font-medium">
                                {p.hora_entrada}
                            </div>{/if}
                        {#if p.hora_salida}<div class="text-slate-500">
                                Hora Salida
                            </div>
                            <div class="text-amber-800 font-medium">
                                {p.hora_salida}
                            </div>{/if}
                        {#if p.accion_p2000}<div class="text-slate-500">
                                Acción P2000
                            </div>
                            <div class="text-amber-800 font-medium">
                                {p.accion_p2000}: {p.pisos_p2000 || "N/A"}
                            </div>{/if}
                        {#if p.accion_kone}<div class="text-slate-500">
                                Acción KONE
                            </div>
                            <div class="text-amber-800 font-medium">
                                {p.accion_kone}: {p.pisos_kone || "N/A"}
                            </div>{/if}
                        {#if p.accion_acc}<div class="text-slate-500">
                                Acción Acc. Esp.
                            </div>
                            <div
                                class="text-amber-800 font-medium whitespace-nowrap overflow-hidden text-ellipsis"
                            >
                                {p.accion_acc}: {[
                                    p.acceso1,
                                    p.acceso2,
                                    p.acceso3,
                                ]
                                    .filter(Boolean)
                                    .join(", ") || "N/A"}
                            </div>{/if}
                    </div>
                    <p class="text-[10px] text-amber-600 mt-1">
                        Al hacer clic en "Revisar Cambios" se abrirá el panel de
                        comparación completo con los datos actuales vs.
                        propuestos.
                    </p>
                </div>
            {/if}
        {/if}

        <!-- ── BAJA: confirmation card ── -->
        {#if ticketType === "Baja de Persona" && selectedPerson}
            <div
                class="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-2"
            >
                <p class="text-sm font-bold text-rose-700">
                    ¿Confirmar baja de esta persona?
                </p>
                <p class="text-xs text-rose-600">
                    Se desactivarán <strong
                        >{(selectedPerson.cards ?? []).filter(
                            (c: any) => c.status === "active",
                        ).length}</strong
                    > tarjeta(s) asociadas.
                </p>
                {#if p.tipo_baja}<p class="text-xs text-rose-600">
                        Tipo: <strong>{p.tipo_baja}</strong>
                    </p>{/if}
                {#if p.motivo}<p class="text-xs text-rose-600">
                        Motivo: <strong>{p.motivo}</strong>
                    </p>{/if}
            </div>
        {/if}

        <!-- ── REPOSICIÓN: folio validation + cards ── -->
        {#if ticketType === "Reposición" && selectedPerson}
            <div class="space-y-2">
                {#each folioChecks as check}
                    <div
                        class="rounded-xl border {check.warning
                            ? 'border-amber-300 bg-amber-50'
                            : 'border-slate-200 bg-white'} p-3 flex items-center gap-3"
                    >
                        <div
                            class="w-8 h-8 rounded-full {check.warning
                                ? 'bg-amber-100 text-amber-600'
                                : 'bg-slate-100 text-slate-500'} flex items-center justify-center shrink-0"
                        >
                            <CreditCard size={16} />
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-0.5">
                                <span
                                    class="text-[10px] font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded tracking-wider"
                                    >{check.card.type}</span
                                >
                                <span
                                    class="text-sm font-semibold text-slate-700 truncate"
                                    >{check.card.folio ?? "—"}</span
                                >
                            </div>
                            {#if check.warning}
                                <div
                                    class="text-xs text-amber-700 flex items-start gap-2 mt-1"
                                >
                                    <AlertTriangle
                                        size={14}
                                        class="shrink-0 mt-0.5"
                                    />
                                    <div class="leading-snug">
                                        {#if !check.card.id}
                                            No hay tarjeta {check.card.type} activa
                                            asignada.
                                        {:else}
                                            Folio en plantilla (<strong
                                                >{check.card.type === "P2000"
                                                    ? p.folio_p2000
                                                    : p.folio_kone}</strong
                                            >) no coincide con la tarjeta
                                            asignada (<strong
                                                >{check.card.folio}</strong
                                            >). Verifique antes de continuar.
                                        {/if}
                                    </div>
                                </div>
                            {:else}
                                <p
                                    class="text-xs text-emerald-600 flex items-center gap-1.5 mt-0.5 font-medium"
                                >
                                    <CheckCircle2 size={13} /> Folio coincide correctamente.
                                </p>
                            {/if}
                        </div>
                        {#if check.card.id}
                            <button
                                class="text-xs text-blue-500 hover:underline font-medium shrink-0"
                                onclick={() =>
                                    handleGoToFirmaResponsiva(check.card)}
                            >
                                Ir →
                            </button>
                        {/if}
                    </div>
                {/each}
                {#if folioChecks.length === 0 && selectedPerson}
                    <div
                        class="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2"
                    >
                        <AlertCircle size={14} class="mt-0.5 shrink-0" />
                        <span
                            >No se identificaron tarjetas a reponer según el
                            payload. Revise los campos "¿Reponer P2000/KONE?".</span
                        >
                    </div>
                {/if}
            </div>
            <p class="text-[10px] text-slate-400">
                Al hacer clic en "Ir →" se te llevará al perfil de la persona
                con la tarjeta preseleccionada para el flujo de Firma
                Responsiva.
            </p>
        {/if}

        <!-- ── REPORTE DE FALLA: detail view ── -->
        {#if ticketType === "Reporte de Falla"}
            <div class="rounded-xl border border-slate-200 overflow-hidden">
                <table class="w-full text-xs">
                    <tbody class="divide-y divide-slate-100">
                        {#each reportRows as row, i}
                            <tr
                                class={i % 2 === 0 ? "bg-white" : "bg-slate-50"}
                            >
                                <td
                                    class="px-4 py-2 font-semibold text-slate-500 w-40"
                                    >{row.label}</td
                                >
                                <td class="px-4 py-2 text-slate-800"
                                    >{row.value}</td
                                >
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </div>

    {#snippet footer()}
        <div class="flex items-center justify-between w-full">
            <!-- Reject (left side) -->
            <Button
                variant="ghost"
                class="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                onclick={() => (isRejectOpen = true)}
                disabled={isSubmitting}
            >
                <XCircle size={15} class="mr-1.5" />
                Rechazar
            </Button>

            <div class="flex items-center gap-2">
                <!-- MODIFICACIÓN: open compare modal -->
                {#if ticketType === "Modificación"}
                    <Button
                        variant="primary"
                        disabled={!selectedPerson}
                        onclick={openCompareModal}
                    >
                        Revisar Cambios →
                    </Button>

                    <!-- BAJA -->
                {:else if ticketType === "Baja de Persona"}
                    <Button
                        variant="outline"
                        class="border-rose-200 text-rose-600 hover:bg-rose-50"
                        disabled={!selectedPerson}
                        loading={isSubmitting}
                        onclick={handleBaja}
                    >
                        <XCircle size={15} class="mr-1.5" />
                        Confirmar Baja
                    </Button>

                    <!-- REPOSICIÓN -->
                {:else if ticketType === "Reposición"}
                    <Button
                        variant="outline"
                        disabled={!selectedPerson}
                        loading={isSubmitting}
                        onclick={handleMarkReposicionDone}
                    >
                        Marcar como gestionado
                    </Button>

                    <!-- REPORTE DE FALLA -->
                {:else if ticketType === "Reporte de Falla"}
                    <Button
                        variant="outline"
                        class="border-amber-200 text-amber-700 hover:bg-amber-50"
                        loading={isSubmitting}
                        onclick={handleCreateReposicionTicket}
                    >
                        <CreditCard size={15} class="mr-1.5" />
                        Requiere Reposición
                    </Button>
                    <Button
                        variant="primary"
                        class="bg-emerald-600 hover:bg-emerald-700 border-emerald-500"
                        loading={isSubmitting}
                        onclick={() => handleComplete("Falla resuelta")}
                    >
                        <CheckCircle2 size={15} class="mr-1.5" />
                        Falla Resuelta
                    </Button>
                {/if}
            </div>
        </div>
    {/snippet}
</Modal>
