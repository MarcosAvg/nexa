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
    import { AlertTriangle, Loader2, User, XCircle } from "lucide-svelte";
    import Button from "../Button.svelte";

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
            correo: p.correo,
            pisosP2000: p.pisos_p2000
                ? p.pisos_p2000
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean)
                : [],
            pisosKone: p.pisos_kone
                ? p.pisos_kone
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean)
                : [],
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
    editingPerson={null}
    oncomplete={handlePersonSaved}
    onclose={() => {
        isOpen = false;
    }}
>
    {#snippet headerContent()}
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
                        <div
                            class="w-full flex items-center gap-3 p-2 rounded-lg border border-amber-200/50 bg-white text-left"
                        >
                            <User size={14} class="text-slate-400 shrink-0" />
                            <div>
                                <p class="text-sm font-semibold text-slate-800">
                                    {c.last_name}, {c.first_name}
                                </p>
                                <p class="text-xs text-slate-400">
                                    {c.dependency} · {c.building}
                                </p>
                            </div>
                        </div>
                    {/each}
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
