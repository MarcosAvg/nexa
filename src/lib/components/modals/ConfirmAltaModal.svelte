<script lang="ts">
    /**
     * ConfirmAltaModal - Thin wrapper
     * Opens PersonModal pre-filled from the import ticket payload.
     * Adds a "Rechazar" button that rejects the ticket without creating the person.
     * Card types are restricted to what the ticket requested.
     */
    import PersonModal from "./PersonModal.svelte";
    import ConfirmationModal from "./ConfirmationModal.svelte";
    import { ticketService } from "../../services/tickets";
    import { personnelService } from "../../services/personnel";
    import { HistoryService } from "../../services/history";
    import { toast } from "svelte-sonner";
    import Badge from "../Badge.svelte";
    import {
        AlertTriangle,
        CreditCard,
        Loader2,
        User,
        XCircle,
    } from "lucide-svelte";
    import Button from "../Button.svelte";
    import { parseFloors } from "../../utils/xlsxImporter";

    let {
        isOpen = $bindable(false),
        ticket = null,
        onComplete,
    }: {
        isOpen: boolean;
        ticket: any;
        onComplete?: () => void;
    } = $props();

    let isRejectOpen = $state(false);
    let isRejecting = $state(false);
    let selectedCandidate = $state<any>(null);

    let p = $derived(ticket?.payload ?? {});

    // Build the prefill object from payload field names
    let prefill = $derived.by(() => {
        if (!p) return null;
        return {
            nombres: p.nombres,
            apellidos: p.apellidos,
            noEmpleado: p.no_empleado,
            dependencia: p.dependencia,
            edificio: p.edificio,
            pisoBase: p.piso_base,
            area: p.area,
            puesto: p.puesto,
            horario: p.horario,
            horaEntrada: p.hora_entrada,
            horaSalida: p.hora_salida,
            correo: p.correo?.replace(/^mailto:\s*/i, "").trim(),
            pisosP2000: parseFloors(p.pisos_p2000),
            pisosKone: parseFloors(p.pisos_kone),
            specialAccesses: [p.acceso1, p.acceso2, p.acceso3]
                .map((s: string) => s?.trim())
                .filter(Boolean),
        };
    });

    /** Card types requested in the template */
    let allowedCardTypes = $derived.by(() => {
        const types: string[] = [];
        const wantsP2000 = ["sí", "si"].includes(
            (p.p2000_req ?? "").toLowerCase(),
        );
        const wantsKONE = ["sí", "si"].includes(
            (p.kone_req ?? "").toLowerCase(),
        );
        if (wantsP2000) types.push("P2000");
        if (wantsKONE) types.push("KONE");
        return types.length > 0 ? types : null; // null = allow all
    });

    async function handlePersonSaved() {
        // PersonModal already created the person. Delete the ticket.
        if (!ticket) return;
        try {
            await ticketService.delete(
                ticket.id,
                "Alta registrada desde plantilla",
            );
            onComplete?.();
        } catch (err) {
            console.error(err);
        }
    }

    let isSearching = $state(false);
    let candidates = $state<any[]>([]);
    let searchDone = $state(false);

    $effect(() => {
        if (isOpen && p && !searchDone) {
            searchDone = true;
            autoSearch();
        }
        if (!isOpen) {
            candidates = [];
            selectedCandidate = null;
            searchDone = false;
            isSearching = false;
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
        } finally {
            isSearching = false;
        }
    }

    async function handleReject() {
        if (!ticket) return;
        isRejecting = true;
        try {
            await ticketService.delete(ticket.id, "Alta rechazada");
            await HistoryService.log("PERSONNEL", "", "REJECT_ALTA", {
                message: `Solicitud de alta rechazada: ${p.apellidos}, ${p.nombres}`,
            });
            toast.info("Solicitud rechazada.");
            isRejectOpen = false;
            isOpen = false;
            onComplete?.();
        } catch (err) {
            console.error(err);
            toast.error("Error al rechazar.");
        } finally {
            isRejecting = false;
        }
    }
</script>

<!-- PersonModal pre-filled as a new person (no id = insert) -->
<PersonModal
    bind:isOpen
    {prefill}
    {allowedCardTypes}
    editingPerson={selectedCandidate}
    forceDirectSave={!!selectedCandidate}
    oncomplete={handlePersonSaved}
    onclose={() => {
        isOpen = false;
    }}
>
    {#snippet headerContent()}
        <!-- Requested Cards Badge -->
        {#if allowedCardTypes}
            <div
                class="flex items-center gap-2 mb-4 p-3 rounded-lg border border-blue-100 bg-blue-50/50"
            >
                <span
                    class="text-[10px] font-bold text-blue-600 uppercase tracking-widest"
                    >Solicitando:</span
                >
                <div class="flex gap-1.5">
                    {#each allowedCardTypes as type}
                        <Badge variant={type === "KONE" ? "blue" : "amber"}
                            >{type}</Badge
                        >
                    {/each}
                </div>
            </div>
        {/if}

        {#if isSearching}
            <div class="rounded-xl border border-slate-200 p-3 mb-4">
                <div class="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 size={14} class="animate-spin" />
                    Validando si <strong>{p.apellidos}, {p.nombres}</strong> ya existe...
                </div>
            </div>
        {:else if candidates.length > 0}
            <div
                class="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4 space-y-3"
            >
                <div class="flex items-start gap-2 text-amber-800 text-sm">
                    <AlertTriangle size={16} class="mt-0.5 shrink-0" />
                    <div>
                        <p class="font-bold">Posible duplicado detectado</p>
                        <p class="text-xs text-amber-700 mt-1">
                            Se encontraron {candidates.length} persona(s) con nombres
                            similares en el sistema. Asegúrate de que no se trata
                            de la misma persona antes de continuar con la creación.
                        </p>
                    </div>
                </div>
                <div class="space-y-1.5 max-h-32 overflow-y-auto mt-2">
                    {#each candidates as c}
                        <button
                            type="button"
                            class="w-full flex items-center justify-between p-2.5 rounded-lg border border-amber-200/50 bg-white hover:bg-amber-100 hover:border-amber-300 transition-all text-left group"
                            onclick={() => (selectedCandidate = c)}
                        >
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 group-hover:bg-amber-200 group-hover:text-amber-600 transition-colors"
                                >
                                    <User size={14} />
                                </div>
                                <div class="min-w-0">
                                    <p
                                        class="text-sm font-bold text-slate-800 truncate"
                                    >
                                        {c.last_name}, {c.first_name}
                                    </p>
                                    <p
                                        class="text-[10px] text-slate-500 truncate"
                                    >
                                        {c.dependency} · {c.building}
                                    </p>
                                </div>
                            </div>
                            <span
                                class="text-[10px] font-bold text-amber-600 uppercase group-hover:translate-x-1 transition-transform shrink-0"
                                >Vincular →</span
                            >
                        </button>
                    {/each}
                </div>
            </div>
        {/if}

        {#if selectedCandidate}
            <div
                class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4"
            >
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div
                            class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"
                        >
                            <User size={16} />
                        </div>
                        <div>
                            <p class="text-sm font-bold text-emerald-800">
                                Vincular a: {selectedCandidate.last_name}, {selectedCandidate.first_name}
                            </p>
                            <p class="text-xs text-emerald-600">
                                Se añadirán los accesos solicitados a esta
                                persona.
                            </p>
                            {#if selectedCandidate.cards && selectedCandidate.cards.length > 0}
                                <div class="mt-2 flex flex-wrap gap-2">
                                    {#each selectedCandidate.cards as card}
                                        <div
                                            class="flex items-center gap-1.5 px-2 py-1 bg-white border border-emerald-100 rounded text-[10px] font-medium text-slate-600 shadow-sm"
                                        >
                                            <CreditCard
                                                size={10}
                                                class="text-slate-400"
                                            />
                                            <span class="font-bold"
                                                >{card.type}:</span
                                            >
                                            <span>{card.folio}</span>
                                            <Badge
                                                variant={card.status ===
                                                "active"
                                                    ? "emerald"
                                                    : "rose"}
                                                class="scale-[0.8] origin-left ml-0.5"
                                            >
                                                {card.status === "active"
                                                    ? "Activa"
                                                    : "Bloqueada"}
                                            </Badge>
                                        </div>
                                    {/each}
                                </div>
                            {:else}
                                <p
                                    class="text-[10px] text-emerald-500 mt-1 italic italic flex items-center gap-1"
                                >
                                    <CreditCard size={10} /> Sin tarjetas asignadas
                                    actualmente.
                                </p>
                            {/if}
                        </div>
                    </div>
                    <button
                        type="button"
                        class="text-xs font-bold text-slate-400 hover:text-slate-600"
                        onclick={() => (selectedCandidate = null)}
                        >Desvincular</button
                    >
                </div>
            </div>
        {/if}
    {/snippet}

    {#snippet leftFooterContent()}
        <Button
            variant="ghost"
            class="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
            onclick={() => (isRejectOpen = true)}
            disabled={isRejecting}
        >
            <XCircle size={15} class="mr-1.5" />
            Rechazar
        </Button>
    {/snippet}
</PersonModal>

<!-- Reject confirmation -->
<ConfirmationModal
    bind:isOpen={isRejectOpen}
    title="Rechazar solicitud de Alta"
    description="El ticket será eliminado y la persona NO será dada de alta. ¿Continuar?"
    confirmText="Sí, rechazar"
    cancelText="Cancelar"
    variant="warning"
    onConfirm={handleReject}
/>
