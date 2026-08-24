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
    import { floorsForKey } from "../../services/accessAssignments";
    import { HistoryService } from "../../services/history";
    import { catalogState, personnelState } from "../../stores";
    import { activeMediaTypes } from "../../utils/mediaContract";
    import InfoCard from "../InfoCard.svelte";
    import CardCheckItem from "../CardCheckItem.svelte";
    import { toast } from "svelte-sonner";
    import { handleError, parseFloors, capitalize } from "../../utils";
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
        Search,
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

    // ── Búsqueda manual (cuando el auto-search no encuentra) ──
    let manualQuery = $state("");
    let manualSearching = $state(false);
    let manualCandidates = $state<any[]>([]);

    // ── Estado de seguimiento del Reporte de Falla ──
    let seguimientoEstado = $state<"En revisión" | "Requiere reposición" | "Resuelto">("En revisión");

    // Sub-modales
    let isCompareOpen = $state(false);
    let compareTicket = $state<any>(null);
    let isRejectOpen = $state(false);
    let isConfirmCloseOpen = $state(false);
    let pendingCloseNote = $state<string>("Ticket cerrado.");

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

    /** Búsqueda manual por nombre (con debounce) cuando el auto-search no da resultado. */
    let manualDebounce: ReturnType<typeof setTimeout> | undefined;
    async function runManualSearch() {
        const q = manualQuery.trim();
        if (!q) {
            manualCandidates = [];
            return;
        }
        manualSearching = true;
        try {
            const terms = q.split(/\s+/).filter(Boolean);
            const apellidos = terms[0] ?? "";
            const nombres = terms.slice(1).join(" ");
            const results = await personnelService.searchByName(
                apellidos,
                nombres,
            );
            manualCandidates = results;
        } catch {
            manualCandidates = [];
        } finally {
            manualSearching = false;
        }
    }
    function onManualQuery() {
        if (manualDebounce) clearTimeout(manualDebounce);
        manualDebounce = setTimeout(runManualSearch, 250);
    }
    function pickManualCandidate(person: any) {
        selectedPerson = person;
        manualCandidates = [];
        manualQuery = "";
        searchDone = true;
    }

    // ── Catalog helpers ───────────────────────────────────
    function resolveId(catalog: { id: any; name: string }[], value: string) {
        if (!value) return null;
        return (
            catalog.find((c) => c.name.toLowerCase() === value.toLowerCase()) ??
            null
        );
    }

    // ── Medios (catálogo genérico con fallback por defecto) ──────────────
    type MediaInfoLike = { key: string; name: string; has_floors: boolean };

    const DEFAULT_MEDIAS: MediaInfoLike[] = [
        { key: 'p2000', name: 'P2000', has_floors: true },
        { key: 'kone', name: 'KONE', has_floors: true },
        { key: 'accesspro', name: 'AccessPRO', has_floors: false },
    ];

    /** Medios activos del catálogo (con fallback al catálogo por defecto). */
    let activeMedias = $derived.by((): MediaInfoLike[] => {
        const list = activeMediaTypes(catalogState.mediaTypes);
        return list.length > 0 ? list : DEFAULT_MEDIAS;
    });

    /** Medios con pisos (para la sección de MODIFICACIÓN). */
    let floorMedias = $derived.by(() => activeMedias.filter((m) => m.has_floors));

    /** Clave de medio a partir del nombre (p.ej. "P2000" → "p2000"). */
    function mediaKeyForName(name: string): string {
        const m = activeMedias.find((mm) => mm.name === name);
        return m ? m.key : name.toLowerCase();
    }

    /** Folio solicitado en el payload para el tipo de tarjeta dado. */
    function folioForType(type: string): string | undefined {
        const key = mediaKeyForName(type);
        return (p as any)[`folio_${key}`] || undefined;
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

        // Pisos por clave de medio (derivados del catálogo con has_floors).
        const floorMediaKeys = Array.from(new Set(
            catalogState.mediaTypes
                .filter((m: any) => m.active !== false && m.has_floors)
                .map((m: any) => m.key),
        ));
        for (const key of floorMediaKeys) {
            const cap = capitalize(key);
            const proposed = [...floorsForKey(selectedPerson.floors, key)];
            const action = (p as any)[`accion_${key}`];
            const pisos = (p as any)[`pisos_${key}`];
            if (action) {
                const parsedFloors = parseFloors(pisos);
                if (isAction(action, "clear")) proposed.length = 0;
                else if (isAction(action, "replace")) proposed.splice(0, proposed.length, ...parsedFloors);
                else if (isAction(action, "add"))
                    proposed.splice(0, proposed.length,
                        ...Array.from(new Set([...proposed, ...parsedFloors])));
                else if (isAction(action, "remove"))
                    proposed.splice(0, proposed.length,
                        ...proposed.filter((f) => !parsedFloors.includes(f)));
            }
            // Forzar al modal de comparación a mostrar diferencias pasando los arrays generados
            modifiedPayload[`floors_${key}`] = proposed;
            modifiedPayload[`pisos${cap}`] = proposed;
        }

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
        const YES = ["sí", "si"];

        const checks: FolioCheck[] = [];

        // Deriva los tipos de medio desde el catálogo; cada uno se busca por
        // sus columnas de reposición (reponer_<key> / folio_<key>).
        const replacementMediaKeys = Array.from(new Set(
            catalogState.mediaTypes
                .filter((m: any) => m.active !== false)
                .map((m: any) => ({ key: m.key, name: m.name })),
        ));
        for (const media of replacementMediaKeys) {
            const wanted = YES.includes(((`reponer_${media.key}` as any) in p ? (p as any)[`reponer_${media.key}`] : "").toLowerCase());
            const folioSought = (p as any)[`folio_${media.key}`]?.trim();
            const wantFolio = (p as any)[`folio_${media.key}`]?.trim().length > 0 || YES.includes((p[`reponer_${media.key}`] ?? "").toLowerCase());
            if (!wanted && !wantFolio) continue;
            const mediaCards = cards.filter((c: any) => c.type === media.name);
            if (mediaCards.length === 0) {
                checks.push({
                    card: { type: media.name, folio: folioSought ?? "—" },
                    match: false,
                    warning: true,
                });
            } else {
                for (const c of mediaCards) {
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
        // Validar que exista al menos una tarjeta del medio identificada
        // (con folio) antes de cerrar la reposición como gestionada.
        if (!folioChecks.some((c) => !!c.card?.id)) {
            toast.warning(
                "No se puede marcar como gestionado sin una tarjeta del medio identificada. Verifique el folio/tarjeta a reponer.",
            );
            return;
        }
        pendingCloseNote = "Reposición gestionada";
        isConfirmCloseOpen = true;
    }

    async function doCloseTicket() {
        if (!ticket) return;
        isSubmitting = true;
        try {
            await ticketService.delete(ticket.id, pendingCloseNote);
            toast.success("Ticket cerrado.");
            isOpen = false;
            onComplete?.();
        } catch (err) {
            handleError(err, "Cerrar Ticket");
        } finally {
            isSubmitting = false;
            isConfirmCloseOpen = false;
        }
    }

    /** Cierre directo (sin confirmación) para flujos automáticos. */
    async function closeTicketNow(note: string) {
        if (!ticket) return;
        isSubmitting = true;
        try {
            await ticketService.delete(ticket.id, note);
            toast.success("Ticket cerrado.");
            isOpen = false;
            onComplete?.();
        } catch (err) {
            handleError(err, "Cerrar Ticket");
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
     *  "AccessPRO"     → ["AccessPRO"]
     */
    function resolveTipos(raw: string): string[] {
        const t = raw.toLowerCase().trim();
        if (!t) return [];
        if (t.includes("ambas")) return activeMedias.map((m) => m.name);
        const matching = activeMedias.filter(
            (m) => t.includes(m.name.toLowerCase()) || t.includes(m.key),
        );
        if (matching.length > 0) return matching.map((m) => m.name);
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
        pendingCloseNote = note || "Ticket cerrado.";
        isConfirmCloseOpen = true;
    }

    async function handleCreateReposicionTicket() {
        if (!ticket) return;
        // No crear reposición sin medio/tarjeta o folio especificado.
        const rawTipo = (p.tipo_tarjeta ?? "").trim();
        const folio = (p.folio ?? "").trim();
        const tipos = resolveTipos(rawTipo);
        const hasMappedMedia = tipos.some((t) =>
            activeMedias.some((m) => m.name === t || m.key === t),
        );
        if (tipos.length === 0 || !hasMappedMedia || (!rawTipo && !folio)) {
            toast.error(
                "No se puede crear una reposición sin medio/tipo de tarjeta. Verifique el reporte antes de continuar.",
            );
            return;
        }
        isSubmitting = true;
        try {
            // Mapear campos de Reporte de Falla → campos que entiende el modal de Reposición
            const repoPayload: Record<string, any> = {
                ...p,
                origen: "Reporte de Falla",
                estado: seguimientoEstado,
            };

            // Usar resolveTipos para manejar "Tarjeta P2000", "Tarjeta KONE" y "Ambas tarjetas"
            for (const media of activeMedias) {
                if (tipos.includes(media.name)) {
                    repoPayload[`reponer_${media.key}`] = "sí";
                    repoPayload[`folio_${media.key}`] = folio;
                }
            }

            await ticketService.create({
                type: "Reposición",
                title: `Reposición — ${p.apellidos ?? ""}, ${p.nombres ?? ""}`,
                description: `De: Reporte de Falla\nTarjeta: ${p.tipo_tarjeta ?? ""}\nFolio: ${p.folio ?? ""}\nLugar: ${p.ubicacion ?? ""}\nDescripción: ${p.descripcion ?? ""}`,
                priority: p.urgencia?.toLowerCase().includes("alta")
                    ? "alta"
                    : "media",
                person_id: selectedPerson?.id ?? null,
                payload: repoPayload,
            });

            // Si hay persona identificada, navegar al perfil + resaltar tarjeta
            if (selectedPerson) {
                if (affectedCardId) {
                    personnelState.highlightedCardId = affectedCardId;
                }
                personnelState.selectPerson(selectedPerson.id);
            }

            await closeTicketNow("Reposición creada desde reporte de falla");
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

<ConfirmationModal
    bind:isOpen={isConfirmCloseOpen}
    title="Cerrar ticket"
    description="El ticket se eliminará del tablero. Esta acción no se puede deshacer. ¿Continuar?"
    confirmText="Sí, cerrar"
    cancelText="Cancelar"
    variant="warning"
    onConfirm={doCloseTicket}
    onCancel={() => (isConfirmCloseOpen = false)}
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
                    <div class="space-y-2">
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
                        <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                            <p
                                class="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"
                            >
                                <Search size={11} /> Buscar persona manualmente
                            </p>
                            <input
                                type="text"
                                class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                placeholder="Apellidos, Nombres…"
                                bind:value={manualQuery}
                                oninput={onManualQuery}
                            />
                            {#if manualSearching}
                                <div class="flex items-center gap-2 text-xs text-slate-500">
                                    <Loader2 size={13} class="animate-spin" />
                                    Buscando…
                                </div>
                            {:else if manualCandidates.length > 0}
                                <div class="space-y-1.5">
                                    {#each manualCandidates.slice(0, 5) as c}
                                        <button
                                            class="w-full flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-left transition-colors"
                                            onclick={() => pickManualCandidate(c)}
                                        >
                                            <div class="flex items-center gap-2.5">
                                                <div
                                                    class="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"
                                                >
                                                    <User size={13} />
                                                </div>
                                                <div>
                                                    <p
                                                        class="text-sm font-semibold text-slate-800"
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
                                                class="text-[10px] font-bold text-blue-500"
                                                >Seleccionar →</span
                                            >
                                        </button>
                                    {/each}
                                </div>
                            {:else if manualQuery}
                                <p
                                    class="text-[10px] text-slate-400 italic"
                                >
                                    Sin coincidencias para "{manualQuery}". Intente con otro nombre.
                                </p>
                            {/if}
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
                    {#each floorMedias as media}
                        {#if p[`accion_${media.key}`]}<div class="text-slate-500">
                                Acción {media.name}
                            </div>
                            <div class="text-amber-800 font-medium">
                                {p[`accion_${media.key}`]}: {p[`pisos_${media.key}`] || "N/A"}
                            </div>{/if}
                    {/each}
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
                                                    >{folioForType(check.card.type)}</strong
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
                                payload. Revise los campos "¿Reponer {activeMedias.map((m) => m.name).join("/")}?".</span
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

            <!-- ── Reporte de Falla: estado de seguimiento ── -->
            <div class="rounded-xl border border-orange-200 bg-orange-50/40 p-4 space-y-2.5">
                <p
                    class="text-[10px] font-bold text-orange-700 uppercase tracking-widest flex items-center gap-1.5"
                >
                    <AlertTriangle size={11} /> Estado de seguimiento
                </p>
                <p class="text-xs text-slate-600">
                    Registra el avance del reporte. El estado se incluirá al crear
                    la reposición o al resolver la falla.
                </p>
                <div class="flex flex-wrap gap-2">
                    <button
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors {seguimientoEstado === 'En revisión' ? 'bg-orange-100 text-orange-800 border border-orange-300 shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-orange-50'}"
                        onclick={() => (seguimientoEstado = "En revisión")}
                    >
                        <AlertCircle size={13} /> En revisión
                    </button>
                    <button
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors {seguimientoEstado === 'Requiere reposición' ? 'bg-amber-100 text-amber-800 border border-amber-300 shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-amber-50'}"
                        onclick={() => (seguimientoEstado = "Requiere reposición")}
                    >
                        <CreditCard size={13} /> Requiere reposición
                    </button>
                    <button
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors {seguimientoEstado === 'Resuelto' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-emerald-50'}"
                        onclick={() => (seguimientoEstado = "Resuelto")}
                    >
                        <CheckCircle2 size={13} /> Resuelto
                    </button>
                </div>
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
                        class="border-slate-200 text-slate-600 hover:bg-slate-50 group"
                        disabled={!selectedPerson}
                        onclick={handleBaja}
                    >
                        <User size={15} class="mr-1.5" />
                        Ver perfil
                        <ArrowRight
                            size={16}
                            class="ml-1.5 group-hover:translate-x-0.5 transition-transform"
                        />
                    </Button>

                    <!-- REPOSICIÓN -->
                {:else if ticketType === "Reposición"}
                    <Button
                        variant="outline"
                        class="border-slate-200 text-slate-600 hover:bg-slate-50 group"
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
                        class="border-slate-200 text-slate-600 hover:bg-slate-50 group"
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
                        onclick={() => handleComplete(`Falla resuelta (${seguimientoEstado})`)}
                    >
                        <CheckCircle2 size={15} class="mr-1.5" />
                        Falla Resuelta
                    </Button>
                {/if}
            </div>
        </div>
    {/snippet}
</Modal>
