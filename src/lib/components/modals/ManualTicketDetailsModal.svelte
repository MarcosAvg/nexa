<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import Badge from "../Badge.svelte";
    import { ticketService } from "../../services/tickets";
    import { cardService } from "../../services/cards";
    import { toast } from "svelte-sonner";
    import {
        Calendar,
        User,
        CreditCard,
        AlertCircle,
        CheckCircle2,
        XCircle,
    } from "lucide-svelte";
    import { personnelState, uiState } from "../../stores";

    import { onMount } from "svelte";
    import { personnelService, profileService } from "../../services";

    let {
        isOpen = $bindable(false),
        ticket = null,
        onClose,
        onComplete,
    }: {
        isOpen: boolean;
        ticket: any;
        onClose?: () => void;
        onComplete?: () => void;
    } = $props();

    let isSubmitting = $state(false);
    let users = $state<any[]>([]);
    let fetchedPerson = $state<any>(null);
    let isLoadingPerson = $state(false);

    // Derived person for dependency info
    let relatedPerson = $derived.by(() => {
        if (!ticket?.person_id) return null;
        return (
            personnelState.personnel.find((p) => p.id === ticket.person_id) ||
            fetchedPerson ||
            null
        );
    });

    $effect(() => {
        if (isOpen && ticket?.person_id) {
            const inStore = personnelState.personnel.find(
                (p) => p.id === ticket.person_id,
            );
            if (
                !inStore &&
                !isLoadingPerson &&
                (!fetchedPerson || fetchedPerson.id !== ticket.person_id)
            ) {
                isLoadingPerson = true;
                personnelService
                    .fetchById(ticket.person_id)
                    .then((p) => {
                        if (p) fetchedPerson = p;
                    })
                    .catch((e) => {
                        console.error("Error fetching person:", e);
                    })
                    .finally(() => {
                        isLoadingPerson = false;
                    });
            }
        }
    });

    let displayPersonName = $derived.by(() => {
        if (ticket?.person_id) {
            const person = personnelState.personnel.find(
                (p) => p.id === ticket.person_id,
            );
            if (person) return person.name;
        }
        return (
            ticket?.payload?.relatedPerson?.name ||
            ticket?.personName ||
            "Desconocido"
        );
    });

    onMount(async () => {
        users = await profileService.fetchAll();
    });

    function getUserName(id: string) {
        if (!id) return "N/A";
        // If id is a name (legacy/external), just return it
        if (!id.startsWith("u-") && !id.match(/^[0-9a-f]{8}-/)) return id;

        const user = users.find((u) => u.id === id);
        return user ? user.full_name || user.email : "Usuario no encontrado";
    }

    function handlePersonClick() {
        if (!ticket?.person_id) return;

        // 1. Select the person
        personnelState.selectPerson(ticket.person_id);

        // 2. Navigate to Personal view
        uiState.setActivePage("Personal");

        // 3. Close modal
        closeModal();
    }

    function getPriorityColor(priority: string) {
        switch (priority?.toLowerCase()) {
            case "alta":
                return "rose";
            case "media":
                return "amber";
            case "baja":
                return "blue";
            default:
                return "slate";
        }
    }

    async function handleReject() {
        if (!ticket) return;
        if (
            !confirm(
                "¿Estás seguro de que deseas rechazar (eliminar) este ticket?",
            )
        )
            return;

        isSubmitting = true;
        try {
            await ticketService.delete(ticket.id);
            toast.success("Ticket rechazado y eliminado");
            closeModal();
            onComplete?.();
        } catch (e) {
            console.error(e);
            toast.error("Error al rechazar el ticket");
        } finally {
            isSubmitting = false;
        }
    }

    async function handleComplete() {
        if (!ticket) return;
        isSubmitting = true;
        try {
            // Special logic for programming tickets
            if (ticket.type === "Programación" && ticket.card_id) {
                await cardService.updateProgrammingStatus(
                    ticket.card_id,
                    "done",
                );
            }

            await ticketService.delete(ticket.id);
            toast.success("Ticket completado exitosamente");
            closeModal();
            onComplete?.();
        } catch (e) {
            console.error(e);
            toast.error("Error al completar el ticket");
        } finally {
            isSubmitting = false;
        }
    }

    function closeModal() {
        isOpen = false;
        onClose?.();
    }
</script>

<Modal
    bind:isOpen
    title="Detalles del Ticket"
    description="Revise la información y decida la acción a tomar."
    size="lg"
    onclose={closeModal}
>
    {#if ticket}
        <div class="space-y-6">
            <!-- Header Info -->
            <div class="flex items-start justify-between gap-4">
                <div class="space-y-1">
                    <h3 class="text-lg font-bold text-slate-900">
                        {ticket.title}
                    </h3>
                    <div class="flex items-center gap-2">
                        <Badge variant="slate">{ticket.type}</Badge>
                        <Badge variant={getPriorityColor(ticket.priority)}>
                            Prioridad {ticket.priority}
                        </Badge>
                    </div>
                </div>
                <div class="text-right text-xs text-slate-500 space-y-1">
                    <div class="flex items-center justify-end gap-1.5">
                        <Calendar size={14} />
                        <span
                            >Created: {new Date(
                                ticket.created_at,
                            ).toLocaleDateString()}</span
                        >
                    </div>
                    <div>
                        {new Date(ticket.created_at).toLocaleTimeString()}
                    </div>
                </div>
            </div>

            <!-- Description -->
            <div class="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4
                    class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2"
                >
                    Descripción
                </h4>
                <p
                    class="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap"
                >
                    {ticket.description || "Sin descripción detallada."}
                </p>
            </div>

            <!-- Assignment Info -->
            {#if ticket.payload?.createdBy || ticket.payload?.assignedTo}
                <div
                    class="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200"
                >
                    <div>
                        <h4
                            class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1"
                        >
                            Creado Por
                        </h4>
                        <p class="text-sm font-medium text-slate-700">
                            {getUserName(ticket.payload.createdBy)}
                        </p>
                    </div>
                    <div>
                        <h4
                            class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1"
                        >
                            Asignado A
                        </h4>
                        <p class="text-sm font-medium text-slate-700">
                            {getUserName(ticket.payload.assignedTo)}
                        </p>
                    </div>
                </div>
            {/if}

            <!-- Related Info -->
            {#if displayPersonName || ticket.cardFolio}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {#if displayPersonName}
                        <button
                            class="p-3 rounded-lg border border-slate-100 flex items-center gap-3 text-left w-full hover:bg-slate-50 hover:border-blue-200 transition-all group cursor-pointer disabled:cursor-default disabled:hover:bg-transparent disabled:hover:border-slate-100"
                            onclick={handlePersonClick}
                            disabled={!ticket.person_id}
                        >
                            <div
                                class="w-8 h-8 rounded-full bg-blue-100/50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 group-hover:scale-110 transition-all disabled:group-hover:scale-100 disabled:group-hover:bg-blue-100/50"
                            >
                                <User size={16} />
                            </div>
                            <div>
                                <div
                                    class="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"
                                >
                                    Personal
                                    {#if ticket.person_id}
                                        <span class="text-xs text-blue-500"
                                            >↗</span
                                        >
                                    {:else}
                                        <span
                                            class="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-normal normal-case"
                                            >(Externo)</span
                                        >
                                    {/if}
                                </div>
                                <div class="text-sm font-bold text-slate-700">
                                    {displayPersonName}
                                </div>
                                {#if ticket?.person_id && relatedPerson?.dependency}
                                    <div
                                        class="text-[10px] text-slate-500 font-medium mt-0.5"
                                    >
                                        {relatedPerson.dependency}
                                    </div>
                                {:else if !ticket?.person_id && ticket?.payload?.relatedPerson}
                                    <div
                                        class="text-[10px] text-slate-500 font-medium mt-0.5 space-x-2"
                                    >
                                        {#if ticket.payload.relatedPerson.employee_no}
                                            <span
                                                ><span class="opacity-50"
                                                    >No.</span
                                                >
                                                {ticket.payload.relatedPerson
                                                    .employee_no}</span
                                            >
                                        {/if}
                                        {#if ticket.payload.relatedPerson.employee_no && ticket.payload.relatedPerson.dependency}
                                            <span class="opacity-50">|</span>
                                        {/if}
                                        {#if ticket.payload.relatedPerson.dependency}
                                            <span
                                                >{ticket.payload.relatedPerson
                                                    .dependency}</span
                                            >
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        </button>
                    {/if}

                    {#if ticket.cardFolio}
                        <div
                            class="p-3 rounded-lg border border-slate-100 flex items-center gap-3"
                        >
                            <div
                                class="w-8 h-8 rounded-full bg-amber-100/50 flex items-center justify-center text-amber-600"
                            >
                                <CreditCard size={16} />
                            </div>
                            <div>
                                <div
                                    class="text-[10px] font-bold text-slate-400 uppercase"
                                >
                                    Tarjeta
                                </div>
                                <div class="text-sm font-bold text-slate-700">
                                    {ticket.cardFolio}
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    {/if}

    {#snippet footer()}
        <div class="flex items-center justify-between w-full">
            <Button
                variant="ghost"
                class="text-slate-400 hover:text-slate-600"
                onclick={closeModal}>Cerrar</Button
            >
            <div class="flex items-center gap-3">
                <Button
                    variant="outline"
                    class="border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300"
                    onclick={handleReject}
                    loading={isSubmitting}
                >
                    <XCircle size={18} class="mr-2" />
                    Rechazar
                </Button>
                <Button
                    variant="primary"
                    class="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 border-emerald-500"
                    onclick={handleComplete}
                    loading={isSubmitting}
                >
                    <CheckCircle2 size={18} class="mr-2" />
                    Completar Ticket
                </Button>
            </div>
        </div>
    {/snippet}
</Modal>
