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
    import InfoCard from "../InfoCard.svelte";
    import CardCheckItem from "../CardCheckItem.svelte";
    import { toast } from "svelte-sonner";
    import { handleError, parseFloors } from "../../utils";
    import {
        AlertCircle,
        CheckCircle2,
        User,
        XCircle,
        CreditCard,
        Loader2,
        AlertTriangle,
        ArrowRight,
        MapPin,
        Calendar,
        FileText,
    } from "lucide-svelte";



    let {
        /** Controla la visibilidad (two-way bindable). */
        isOpen = $bindable(false),
        /** Ticket importado a visualizar/gestionar. */
        ticket = null,
        /** Callback al completar la gestión del ticket. */
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

    // Sub-modales
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
        if (!selectedPerson) return;                // Construir payload 'modified' usando las claves esperadas por ModificationCompareModal
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

    // La lógica de tarjetas y accesos maneja strings: "Añadir", "Reemplazar", "Quitar"
    // Como ModificationCompareModal compara arrays de pisos, necesitamos aplicar la acción
    // para generar el estado final "propuesto" de pisos/accesos.            // Helper para matching robusto de acciones
        const isAction = (
            act: string,
            type: "replace" | "add" | "remove" | "clear",
        ) => {
            const a = (act ?? "").toLowerCase();
            if (type === "clear")
                return (
                    a.includes("todo") ||
                    a.includes("vaciar") ||
                    a.includes("limpiar")
                );
            if (type === "replace")
                return (
                    a.includes("reemplazar") ||
                    a.includes("remplazar") ||
                    a.includes("sustituir")
                );
            if (type === "add")
                return (
                    a.includes("añadir") ||
                    a.includes("anadir") ||
                    a.includes("sumar") ||
                    a.includes("agregar")
                );
            if (type === "remove")
                return (
                    a.includes("quitar") ||
                    a.includes("eliminar") ||
                    a.includes("borrar") ||
                    a.includes("remover")
                );
            return false;
        };

        let proposedP2000 = [...(selectedPerson.floors_p2000 || [])];
        if (p.accion_p2000) {
            const action = p.accion_p2000;
            const parsedFloors = parseFloors(p.pisos_p2000);

            if (isAction(action, "clear")) proposedP2000 = [];
            else if (isAction(action, "replace")) proposedP2000 = parsedFloors;
            else if (isAction(action, "add"))
                proposedP2000 = parseFloors([...proposedP2000, ...parsedFloors].join(","));
            else if (isAction(action, "remove"))
                proposedP2000 = proposedP2000.filter(
                    (f) => !parsedFloors.includes(f),
                );
        }
        // Forzar al modal de comparación a mostrar diferencias pasando los arrays generados
        modifiedPayload.floors_p2000 = proposedP2000;

        let proposedKONE = [...(selectedPerson.floors_kone || [])];
        if (p.accion_kone) {
            const action = p.accion_kone;
            const parsedFloors = parseFloors(p.pisos_kone);

            if (isAction(action, "clear")) proposedKONE = [];
            else if (isAction(action, "replace")) proposedKONE = parsedFloors;
            else if (isAction(action, "add"))
                proposedKONE = parseFloors([...proposedKONE, ...parsedFloors].join(","));
            else if (isAction(action, "remove"))
                proposedKONE = proposedKONE.filter(
                    (f) => !parsedFloors.includes(f),
                );
        }
        modifiedPayload.floors_kone = proposedKONE;

        let proposedAccesses = [...(selectedPerson.specialAccesses || [])];
        if (p.accion_acc) {
            const action = p.accion_acc;
            const accesses = [p.acceso1, p.acceso2, p.acceso3]
                .map((s) => s?.trim())
                .filter(Boolean);

            if (isAction(action, "clear")) proposedAccesses = [];
            else if (isAction(action, "replace")) proposedAccesses = accesses;
            else if (isAction(action, "add"))
                proposedAccesses = [
                    ...new Set([...proposedAccesses, ...accesses]),
                ];
            else if (isAction(action, "remove"))
                proposedAccesses = proposedAccesses.filter(
                    (a) => !accesses.includes(a),
                );
        }
        modifiedPayload.specialAccesses = proposedAccesses;

        // Heredar campos no modificados de selectedPerson
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

        // Estos no necesitan heredarse aquí porque se calculan arriba

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
    function handleBaja() {
        if (!selectedPerson || !ticket) return;

        // Marcar contexto de baja para señalar el botón en el sidepanel
        personnelState.bajaContextPersonId = selectedPerson.id;

        // Abrir el sidepanel de la persona para gestionar su baja
        personnelState.selectPerson(selectedPerson.id);
        isOpen = false;
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
                // Sin tarjeta P2000 activa
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
        // Resaltar la tarjeta a reponer (como Programación resalta su tarjeta)
        personnelState.highlightedCardId = card.id;
        personnelState.selectPerson(selectedPerson.id);
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
            handleError(err, "Cerrar Reposición");
        } finally {
            isSubmitting = false;
        }
    }

    // ── REPORTE DE FALLA ──────────────────────────────────
    type AffectedCardCheck = {
        type: string;
        folio: string;
        status: "found" | "mismatch" | "nocard" | "noperson";
        cardId: string | null;
    };

    /** Normaliza tipo_tarjeta del Excel a tipos del sistema.
     *  "Tarjeta P2000" → ["P2000"]
     *  "Tarjeta KONE"  → ["KONE"]
     *  "Ambas tarjetas" → ["P2000", "KONE"]
     */
    function resolveTipos(raw: string): string[] {
        const t = raw.toLowerCase().trim();
        if (t.includes("ambas")) return ["P2000", "KONE"];
        if (t.includes("p2000")) return ["P2000"];
        if (t.includes("kone")) return ["KONE"];
        return [raw];
    }

    let affectedCardChecks = $derived.by((): AffectedCardCheck[] => {
        if (ticketType !== "Reporte de Falla") return [];
        const rawTipo = (p.tipo_tarjeta ?? "").trim();
        const folio = (p.folio ?? "").trim();
        if (!rawTipo && !folio) return [];

        const tipos = resolveTipos(rawTipo);

        if (!selectedPerson) {
            return tipos.map((t) => ({
                type: t,
                folio,
                status: "noperson" as const,
                cardId: null,
            }));
        }

        const cards: any[] = selectedPerson.cards ?? [];
        const checks: AffectedCardCheck[] = [];

        for (const tipo of tipos) {
            const exact = cards.find(
                (c: any) =>
                    c.folio?.toString() === folio &&
                    c.type?.toLowerCase() === tipo.toLowerCase(),
            );
            if (exact) {
                checks.push({
                    type: exact.type,
                    folio: exact.folio,
                    status: "found",
                    cardId: exact.id,
                });
                continue;
            }

            const sameType = cards.find(
                (c: any) =>
                    c.status === "active" &&
                    c.type?.toLowerCase() === tipo.toLowerCase(),
            );
            if (sameType) {
                checks.push({
                    type: sameType.type,
                    folio: sameType.folio,
                    status: "mismatch",
                    cardId: sameType.id,
                });
                continue;
            }

            checks.push({
                type: tipo,
                folio,
                status: "nocard",
                cardId: null,
            });
        }

        return checks;
    });

    let affectedCardId = $derived(
        affectedCardChecks.find((c) => c.cardId != null)?.cardId ?? null,
    );

    function handleViewPersonProfile() {
        if (!selectedPerson) return;
        personnelState.selectPerson(selectedPerson.id);
        isOpen = false;
    }

    function handleGoToAffectedCard(cardId: string) {
        if (!selectedPerson) return;
        personnelState.highlightedCardId = cardId;
        personnelState.selectPerson(selectedPerson.id);
        isOpen = false;
    }

    async function handleComplete(note?: string) {
        if (!ticket) return;
        isSubmitting = true;
        try {
            await ticketService.delete(ticket.id, note);
            toast.success("Ticket completado.");
            isOpen = false;
            onComplete?.();
        } catch (err) {
            handleError(err, "Completar Ticket");
        } finally {
            isSubmitting = false;
        }
    }

    async function handleCreateReposicionTicket() {
        if (!ticket) return;
        isSubmitting = true;
        try {
            // Mapear campos de Reporte de Falla → campos que entiende el modal de Reposición
            const rawTipo = (p.tipo_tarjeta ?? "").trim();
            const folio = (p.folio ?? "").trim();
            const repoPayload: Record<string, any> = { ...p, origen: "Reporte de Falla" };

            // Usar resolveTipos para manejar "Tarjeta P2000", "Tarjeta KONE" y "Ambas tarjetas"
            const tipos = resolveTipos(rawTipo);
            if (tipos.includes("P2000")) {
                repoPayload.reponer_p2000 = "sí";
                repoPayload.folio_p2000 = folio;
            }
            if (tipos.includes("KONE")) {
                repoPayload.reponer_kone = "sí";
                repoPayload.folio_kone = folio;
            }

            await ticketService.create({
                type: "Reposición",
                title: `Reposición — ${p.apellidos ?? ""}, ${p.nombres ?? ""}`,
                description: `De: Reporte de Falla\nTarjeta: ${p.tipo_tarjeta ?? ""}\nFolio: ${p.folio ?? ""}\nLugar: ${p.ubicacion ?? ""}\nDescripción: ${p.descripcion ?? ""}`,
                priority: p.urgencia?.toLowerCase().includes("alta")
                    ? "alta"
                    : "media",
                payload: repoPayload,
            });

            // Si hay persona identificada, navegar al perfil + resaltar tarjeta
            if (selectedPerson) {
                if (affectedCardId) {
                    personnelState.highlightedCardId = affectedCardId;
                }
                personnelState.selectPerson(selectedPerson.id);
            }

            await handleComplete("Reposición creada desde reporte de falla");
        } catch (err) {
            handleError(err, "Crear Ticket de Reposición");
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
                    entityName: selectedPerson
                        ? `${selectedPerson.last_name}, ${selectedPerson.first_name}`
                        : `Ticket rechazado (${ticketType})`,
                },
            );
            toast.info("Ticket rechazado.");
            isRejectOpen = false;
            isOpen = false;
            onComplete?.();
        } catch (err) {
            handleError(err, "Rechazar Ticket");
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
        <!-- ── Person detection ── -->
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
                    <div
                        class="p-3 bg-amber-50 rounded-lg border border-amber-200 mb-3"
                    >
                        <p
                            class="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-1.5"
                        >
                            <AlertCircle size={12} /> Se encontraron {candidates.length}
                            coincidencias
                        </p>
                        <p class="text-[10px] text-amber-600 mb-3">
                            Selecciona la persona correcta para vincular este
                            ticket:
                        </p>
                        <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {#each candidates as c}
                                <button
                                    class="w-full flex items-center justify-between p-2.5 rounded-lg border border-amber-200/50 bg-white hover:bg-amber-100 hover:border-amber-300 text-left transition-all group"
                                    onclick={() => (selectedPerson = c)}
                                >
                                    <div class="flex items-center gap-3">
                                        <div
                                            class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-amber-200 group-hover:text-amber-600 transition-colors"
                                        >
                                            <User size={14} />
                                        </div>
                                        <div>
                                            <p
                                                class="text-sm font-bold text-slate-800"
                                            >
                                                {c.last_name}, {c.first_name}
                                            </p>
                                            <p
                                                class="text-[10px] text-slate-500"
                                            >
                                                {c.dependency} · {c.building}
                                            </p>
                                        </div>
                                    </div>
                                    <span
                                        class="text-[10px] font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >Seleccionar →</span
                                    >
                                </button>
                            {/each}
                        </div>
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

        <!-- ── MODIFICACIÓN: summary + open compare button ── -->
        {#if ticketType === "Modificación" && selectedPerson}
            <InfoCard
                variant="amber"
                icon={ArrowRight}
                title="Cambios solicitados"
                hint='Al hacer clic en "Revisar Cambios" se abrirá el panel de comparación completo con los datos actuales vs. propuestos.'
            >
                <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {#if p.nuevo_apellido}<div class="text-slate-500">
                            Apellidos
                        </div>
                        <div class="text-amber-800 font-medium">
                            {p.nuevo_apellido}
                        </div>{/if}
                    {#if p.nuevo_nombre}<div class="text-slate-500">Nombres</div>
                        <div class="text-amber-800 font-medium">
                            {p.nuevo_nombre}
                        </div>{/if}
                    {#if p.nueva_dep}<div class="text-slate-500">Dependencia</div>
                        <div class="text-amber-800 font-medium">
                            {p.nueva_dep}
                        </div>{/if}
                    {#if p.nuevo_edificio}<div class="text-slate-500">Edificio</div>
                        <div class="text-amber-800 font-medium">
                            {p.nuevo_edificio}
                        </div>{/if}
                    {#if p.nuevo_piso}<div class="text-slate-500">Piso Base</div>
                        <div class="text-amber-800 font-medium">
                            {p.nuevo_piso}
                        </div>{/if}
                    {#if p.nueva_area}<div class="text-slate-500">Área</div>
                        <div class="text-amber-800 font-medium">
                            {p.nueva_area}
                        </div>{/if}
                    {#if p.nuevo_puesto}<div class="text-slate-500">Puesto</div>
                        <div class="text-amber-800 font-medium">
                            {p.nuevo_puesto}
                        </div>{/if}
                    {#if p.hora_entrada}<div class="text-slate-500">Hora Entrada</div>
                        <div class="text-amber-800 font-medium">
                            {p.hora_entrada}
                        </div>{/if}
                    {#if p.hora_salida}<div class="text-slate-500">Hora Salida</div>
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
            </InfoCard>
        {/if}

        <!-- ── BAJA: guidance card ── -->
        {#if ticketType === "Baja de Persona" && selectedPerson}
            <InfoCard
                variant="rose"
                hint='Al hacer clic en "Revisar perfil →" se abrirá el perfil completo de la persona donde podrás gestionar su baja y revisar tarjetas asociadas.'
            >
                <div class="space-y-3">
                    <div class="flex items-start gap-3">
                        <div
                            class="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0"
                        >
                            <User size={20} />
                        </div>
                        <div>
                            <p class="text-sm font-bold text-slate-900">
                                {selectedPerson.last_name}, {selectedPerson.first_name}
                            </p>
                            <p class="text-xs text-slate-500">
                                {selectedPerson.dependency} · {selectedPerson.building}
                            </p>
                        </div>
                    </div>

                    <div class="text-sm text-rose-700 font-medium">
                        Se desactivarán <strong
                            >{(selectedPerson.cards ?? []).filter(
                                (c: any) => c.status === "active",
                            ).length}</strong
                        > tarjeta(s) asociadas.
                    </div>

                    {#if p.tipo_baja || p.motivo}
                        <div
                            class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs bg-white/60 rounded-lg p-3"
                        >
                            {#if p.tipo_baja}
                                <span class="text-slate-500">Tipo de baja</span>
                                <span class="text-rose-700 font-medium"
                                    >{p.tipo_baja}</span
                                >
                            {/if}
                            {#if p.motivo}
                                <span class="text-slate-500">Motivo</span>
                                <span class="text-rose-700 font-medium"
                                    >{p.motivo}</span
                                >
                            {/if}
                        </div>
                    {/if}

                    <div
                        class="flex items-start gap-2.5 p-3 rounded-lg bg-rose-100/50 border border-rose-200/50"
                    >
                        <AlertTriangle
                            size={16}
                            class="text-rose-500 shrink-0 mt-0.5"
                        />
                        <p class="text-xs text-rose-700 leading-relaxed">
                            Revisa la información de
                            <strong>{selectedPerson.first_name}</strong> en el
                            panel lateral para confirmar sus datos y tarjetas
                            antes de procesar la baja.
                        </p>
                    </div>
                </div>
            </InfoCard>
        {/if}

        <!-- ── REPOSICIÓN: folio validation + cards ── -->
        {#if ticketType === "Reposición" && selectedPerson}
            <InfoCard
                variant="amber"
                hint='Al hacer clic en "Ir →" se te llevará al perfil de la persona con la tarjeta preseleccionada para el flujo de Firma Responsiva.'
            >
                <div class="space-y-2">
                    {#each folioChecks as check}
                        <CardCheckItem
                            type={check.card.type}
                            folio={check.card.folio ?? "—"}
                            warning={check.warning}
                            navColor="amber"
                            showNav={!!check.card.id}
                            onNavigate={() =>
                                handleGoToFirmaResponsiva(check.card)}
                        >
                            {#snippet status()}
                                {#if check.warning}
                                    <div
                                        class="text-xs text-amber-700 flex items-start gap-2"
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
                                        class="text-xs text-emerald-600 flex items-center gap-1.5 font-medium"
                                    >
                                        <CheckCircle2 size={13} /> Folio coincide correctamente.
                                    </p>
                                {/if}
                            {/snippet}
                        </CardCheckItem>
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
            </InfoCard>
        {/if}

        <!-- ── REPORTE DE FALLA: detail view ── -->
        {#if ticketType === "Reporte de Falla"}
            <InfoCard
                variant="orange"
                hint='Selecciona "Requiere Reposición" para crear un ticket de reemplazo, o "Falla Resuelta" si el problema ya fue solucionado.'
            >
                <!-- ── Severity banner ── -->
                {#if p.urgencia}
                    <div
                        class="flex items-center gap-3 p-3 rounded-xl {p.urgencia?.toLowerCase().includes('alta')
                            ? 'bg-red-50 border border-red-200'
                            : 'bg-amber-50 border border-amber-200'}"
                    >
                        <div
                            class="w-9 h-9 rounded-full {p.urgencia?.toLowerCase().includes('alta')
                                ? 'bg-red-100 text-red-600'
                                : 'bg-amber-100 text-amber-600'} flex items-center justify-center shrink-0"
                        >
                            <AlertCircle size={18} />
                        </div>
                        <div>
                            <p
                                class="text-xs font-bold {p.urgencia?.toLowerCase().includes('alta')
                                    ? 'text-red-700'
                                    : 'text-amber-700'} uppercase tracking-widest"
                            >
                                Urgencia {p.urgencia}
                            </p>
                            <p
                                class="text-[10px] {p.urgencia?.toLowerCase().includes('alta')
                                    ? 'text-red-500'
                                    : 'text-amber-600'}"
                            >
                                {p.urgencia?.toLowerCase().includes('alta')
                                    ? 'Se requiere atención inmediata'
                                    : 'Requiere atención en los próximos días'}
                            </p>
                        </div>
                    </div>
                {/if}

                <!-- ── Affected card (with navigation like Reposición) ── -->
                {#each affectedCardChecks as check}
                    <CardCheckItem
                        type={check.type}
                        folio={check.folio || "Folio no especificado"}
                        warning={check.status !== "found"}
                        navColor="orange"
                        showNav={!!check.cardId && !!selectedPerson}
                        onNavigate={() =>
                            handleGoToAffectedCard(check.cardId!)}
                    >
                        {#snippet status()}
                            {#if check.status === "found"}
                                <p
                                    class="text-[11px] text-emerald-600 font-medium flex items-center gap-1"
                                >
                                    <CheckCircle2 size={12} />
                                    Tarjeta encontrada en el sistema
                                </p>
                            {:else if check.status === "mismatch"}
                                <p
                                    class="text-[11px] text-amber-600 font-medium flex items-center gap-1"
                                >
                                    <AlertTriangle size={12} />
                                    Folio no coincide con tarjeta activa
                                </p>
                            {:else if check.status === "nocard"}
                                <p
                                    class="text-[11px] text-amber-600 font-medium flex items-center gap-1"
                                >
                                    <AlertTriangle size={12} />
                                    Sin tarjeta activa de este tipo
                                </p>
                            {:else}
                                <p
                                    class="text-[11px] text-slate-500 flex items-center gap-1"
                                >
                                    Tarjeta reportada (sin persona asociada)
                                </p>
                            {/if}
                        {/snippet}
                    </CardCheckItem>
                {/each}

                <!-- ── Report details (icon + label cards) ── -->
                <div>
                    <p
                        class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"
                    >
                        <FileText size={11} />
                        Detalles del reporte
                    </p>
                    <div class="space-y-2">
                        {#if p.ubicacion}
                            <div
                                class="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/60 border border-slate-100"
                            >
                                <MapPin
                                    size={14}
                                    class="text-slate-400 shrink-0"
                                />
                                <div>
                                    <p
                                        class="text-[10px] font-semibold text-slate-400"
                                    >
                                        Ubicación
                                    </p>
                                    <p
                                        class="text-xs font-medium text-slate-700"
                                    >
                                        {p.ubicacion}
                                    </p>
                                </div>
                            </div>
                        {/if}
                        {#if p.desde_cuando}
                            <div
                                class="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/60 border border-slate-100"
                            >
                                <Calendar
                                    size={14}
                                    class="text-slate-400 shrink-0"
                                />
                                <div>
                                    <p
                                        class="text-[10px] font-semibold text-slate-400"
                                    >
                                        Desde
                                    </p>
                                    <p
                                        class="text-xs font-medium text-slate-700"
                                    >
                                        {p.desde_cuando}
                                    </p>
                                </div>
                            </div>
                        {/if}
                        {#if p.descripcion}
                            <div
                                class="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/60 border border-slate-100"
                            >
                                <FileText
                                    size={14}
                                    class="text-slate-400 shrink-0 mt-0.5"
                                />
                                <div>
                                    <p
                                        class="text-[10px] font-semibold text-slate-400"
                                    >
                                        Descripción
                                    </p>
                                    <p
                                        class="text-xs text-slate-700 leading-relaxed"
                                    >
                                        {p.descripcion}
                                    </p>
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>

                <!-- ── Observaciones ── -->
                {#if p.observaciones}
                    <div class="pt-2 border-t border-orange-200/50">
                        <p
                            class="text-[10px] font-semibold text-orange-600 mb-1.5 flex items-center gap-1.5"
                        >
                            <AlertTriangle size={11} />
                            Observaciones
                        </p>
                        <p
                            class="text-xs text-slate-700 bg-white/60 rounded-lg p-3 leading-relaxed border border-orange-100"
                        >
                            {p.observaciones}
                        </p>
                    </div>
                {/if}
            </InfoCard>
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
                        class="border-rose-200 text-rose-600 hover:bg-rose-50 group"
                        disabled={!selectedPerson}
                        onclick={handleBaja}
                    >
                        <User size={15} class="mr-1.5" />
                        Revisar perfil
                        <ArrowRight
                            size={16}
                            class="ml-1.5 group-hover:translate-x-0.5 transition-transform"
                        />
                    </Button>

                    <!-- REPOSICIÓN -->
                {:else if ticketType === "Reposición"}
                    <Button
                        variant="outline"
                        class="border-amber-200 text-amber-600 hover:bg-amber-50 group"
                        disabled={!selectedPerson}
                        loading={isSubmitting}
                        onclick={handleMarkReposicionDone}
                    >
                        <CheckCircle2 size={15} class="mr-1.5" />
                        Marcar como gestionado
                        <ArrowRight
                            size={16}
                            class="ml-1.5 group-hover:translate-x-0.5 transition-transform"
                        />
                    </Button>

                    <!-- REPORTE DE FALLA -->
                {:else if ticketType === "Reporte de Falla"}
                    <Button
                        variant="outline"
                        class="border-orange-200 text-orange-600 hover:bg-orange-50 group"
                        disabled={!selectedPerson}
                        onclick={handleViewPersonProfile}
                    >
                        <User size={15} class="mr-1.5" />
                        Ver perfil
                        <ArrowRight
                            size={16}
                            class="ml-1.5 group-hover:translate-x-0.5 transition-transform"
                        />
                    </Button>
                    <Button
                        variant="outline"
                        class="border-amber-200 text-amber-700 hover:bg-amber-50 group"
                        loading={isSubmitting}
                        onclick={handleCreateReposicionTicket}
                    >
                        <CreditCard size={15} class="mr-1.5" />
                        Requiere Reposición
                        <ArrowRight
                            size={16}
                            class="ml-1.5 group-hover:translate-x-0.5 transition-transform"
                        />
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
