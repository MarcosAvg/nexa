<script lang="ts">
    import SidePanel from "./SidePanel.svelte";
    import Button from "./Button.svelte";
    import Badge from "./Badge.svelte";
    import CardItem from "./CardItem.svelte";
    import {
        Edit,
        Lock,
        UserX,
        Building2,
        Clock,
        Shield,
        Trash2,
        Printer,
        History as HistoryIcon,
        FileText,
        Trash2 as TrashIcon,
        Eye,
    } from "lucide-svelte";
    import { generateResponsivaPdf } from "../utils/pdfGenerator";
    import ResponsivaTemplate from "./ResponsivaTemplate.svelte";
    import ResponsivaPreviewModal from "./ResponsivaPreviewModal.svelte";
    import { toast } from "svelte-sonner";
    import { cardService } from "../services/cards";
    import { responsivaService } from "../services/responsiva";
    import { personnelState } from "../stores";
    import type { Person } from "../types";

    type Props = {
        isOpen: boolean;
        person: Person | null;
        onEdit?: (person: Person) => void;
        onBlock?: (person: Person) => void;
        onDeactivate?: (person: Person) => void;
        onclose?: () => void;
        onCardBlock?: (card: any) => void;
        onCardUnassign?: (card: any) => void;
        onCardReplace?: (card: any) => void;
        onCardAdd?: (person: Person) => void;
        onReactivate?: (person: Person) => void;
        onDeletePermanent?: (person: Person) => void;
        onRefresh?: () => Promise<void>;
    };

    let {
        isOpen = $bindable(),
        person,
        onEdit,
        onBlock,
        onDeactivate,
        onclose,
        onCardBlock,
        onCardUnassign,
        onCardReplace,
        onCardAdd,
        onReactivate,
        onDeletePermanent,
        onRefresh,
    }: Props = $props();

    // Reset highlight when closing
    $effect(() => {
        if (!isOpen) {
            personnelState.highlightedCardId = null;
        }
    });

    let responsivaData = $state<any>(null);
    let selectedShowCard = $state<any>(null);
    let isPreviewModalOpen = $state(false);
    let signedResponsivas = $state<any[]>([]);
    let selectedSignature = $state("");

    $effect(() => {
        if (isOpen && person?.id) {
            loadResponsivas();
        }
    });

    async function loadResponsivas() {
        if (!person?.id) return;
        try {
            signedResponsivas = await responsivaService.fetchByPerson(
                person.id.toString(),
            );
        } catch (error) {
            console.error(
                "[PersonDetailsPanel] Error loading responsivas:",
                error,
            );
        }
    }

    async function handleGenerateResponsiva(card: any) {
        if (!person) return;

        // Safety check: Cannot generate responsiva if not programmed
        if (card.programming_status !== "done") {
            toast.error(
                "La tarjeta debe estar programada antes de generar la responsiva.",
            );
            return;
        }

        const date = new Date();
        const months = [
            "Enero",
            "Febrero",
            "Marzo",
            "Abril",
            "Mayo",
            "Junio",
            "Julio",
            "Agosto",
            "Septiembre",
            "Octubre",
            "Noviembre",
            "Diciembre",
        ];
        const dateStr = `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;

        // Smart Opening: Check if we have a signed version for this folio in history
        let existingResp = signedResponsivas.find(
            (r) => r.folio === card.folio && r.card_type === card.type,
        );

        // Fetch fresh data if it might be stale
        if (existingResp) {
            try {
                await loadResponsivas();
                existingResp = signedResponsivas.find(
                    (r) => r.folio === card.folio && r.card_type === card.type,
                );
            } catch (e) {
                console.error(
                    "[PersonDetailsPanel] Error refreshing responsivas:",
                    e,
                );
            }
        }

        responsivaData = existingResp
            ? {
                  ...existingResp.data,
                  legal_snapshot: existingResp.legal_snapshot,
                  legal_hash: existingResp.legal_hash,
              }
            : {
                  folio: card.folio,
                  nombre: person.name,
                  numEmpleado: person.employee_no,
                  dependencia: person.dependency,
                  usuarioEntrega: "Admin Sistema",
                  fecha: dateStr,
              };

        selectedSignature = existingResp ? existingResp.signature : "";
        selectedShowCard = card;
        isPreviewModalOpen = true;
    }

    async function handleSignCard(card: any, signature?: string) {
        try {
            await cardService.updateResponsivaStatus(card.id, "signed");
            if (signature) {
                selectedSignature = signature;
            }
            if (onRefresh) await onRefresh();
            await loadResponsivas();
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async function handleDeleteResponsiva(id: string) {
        if (!person?.id || !confirm("¿Eliminar este registro de responsiva?"))
            return;

        // Find the record to check the folio before deleting
        const respToDelete = signedResponsivas.find((r) => r.id === id);

        try {
            await responsivaService.delete(id, person.id.toString());

            // Status Rollback: If this folio is currently assigned to the person, mark it as unsigned
            if (respToDelete) {
                const affectedCard = person.cards?.find(
                    (c) =>
                        c.folio === respToDelete.folio &&
                        c.type === respToDelete.card_type,
                );
                if (affectedCard) {
                    await cardService.updateResponsivaStatus(
                        affectedCard.id,
                        "unsigned",
                    );
                    if (onRefresh) await onRefresh();
                }
            }

            toast.success("Responsiva eliminada y estado actualizado");
            await loadResponsivas();
        } catch (error) {
            console.error(error);
            toast.error("Error al eliminar");
        }
    }

    async function handleViewHistory(resp: any) {
        try {
            await loadResponsivas();
            const freshResp =
                signedResponsivas.find((r) => r.id === resp.id) || resp;
            responsivaData = {
                ...freshResp.data,
                legal_snapshot: freshResp.legal_snapshot,
                legal_hash: freshResp.legal_hash,
            };
            selectedSignature = freshResp.signature;
            // Construct a context object for the modal
            selectedShowCard = person?.cards?.find(
                (c) => c.folio === freshResp.folio,
            ) || {
                folio: freshResp.folio,
                type: freshResp.card_type,
                responsiva_status: "signed",
            };
            isPreviewModalOpen = true;
        } catch (e) {
            console.error(
                "[PersonDetailsPanel] Error in handleViewHistory:",
                e,
            );
            toast.error("Error al cargar datos actualizados");
        }
    }
</script>

<SidePanel
    bind:isOpen
    title="Detalles de la Persona"
    subtitle={person?.name}
    {onclose}
>
    {#if person}
        <div class="space-y-6">
            <!-- Info Card -->
            <section
                class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
            >
                <h3
                    class="text-xs font-bold text-slate-400 uppercase tracking-widest"
                >
                    Información General
                </h3>

                <div class="grid gap-3">
                    <div class="flex justify-between items-center">
                        <span class="text-xs text-slate-500"
                            >Nombre completo</span
                        >
                        <span class="text-sm font-bold text-slate-800"
                            >{person.name}</span
                        >
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-xs text-slate-500">No. Empleado</span>
                        <span class="text-sm font-bold text-slate-800"
                            >{person.employee_no}</span
                        >
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-xs text-slate-500">Dependencia</span>
                        <span class="text-sm font-medium text-slate-700"
                            >{person.dependency}</span
                        >
                    </div>
                    {#if person.email}
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-slate-500">Correo</span>
                            <span class="text-sm font-medium text-slate-700"
                                >{person.email}</span
                            >
                        </div>
                    {/if}
                    {#if person.area}
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-slate-500"
                                >Área / Equipo</span
                            >
                            <span class="text-sm font-medium text-slate-700"
                                >{person.area}</span
                            >
                        </div>
                    {/if}
                    {#if person.position}
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-slate-500"
                                >Puesto / Función</span
                            >
                            <span class="text-sm font-medium text-slate-700"
                                >{person.position}</span
                            >
                        </div>
                    {/if}
                </div>

                <!-- Location -->
                <div class="pt-3 border-t border-slate-200">
                    <div class="flex items-center gap-2 text-slate-600 mb-2">
                        <Building2 size={14} />
                        <span class="text-xs font-bold uppercase tracking-wider"
                            >Ubicación</span
                        >
                    </div>
                    <p class="text-sm font-medium text-slate-700">
                        {person.building} - {person.floor}
                    </p>
                </div>

                <!-- Floors Assigned -->
                {#if (person.floors_p2000 && person.floors_p2000.length > 0) || (person.floors_kone && person.floors_kone.length > 0)}
                    <div class="pt-3 border-t border-slate-200 space-y-3">
                        <span
                            class="text-xs font-bold text-slate-500 uppercase tracking-wider block"
                        >
                            Pisos Asignados
                        </span>

                        {#if person.floors_p2000 && person.floors_p2000.length > 0}
                            <div class="space-y-1">
                                <span
                                    class="text-[10px] font-bold text-slate-400 uppercase tracking-tight"
                                    >P2000 (Puertas)</span
                                >
                                <div class="flex flex-wrap gap-1.5">
                                    {#each person.floors_p2000 as flr}
                                        <Badge variant="amber">{flr}</Badge>
                                    {/each}
                                </div>
                            </div>
                        {/if}

                        {#if person.floors_kone && person.floors_kone.length > 0}
                            <div class="space-y-1">
                                <span
                                    class="text-[10px] font-bold text-slate-400 uppercase tracking-tight"
                                    >KONE (Elevadores)</span
                                >
                                <div class="flex flex-wrap gap-1.5">
                                    {#each person.floors_kone as flr}
                                        <Badge variant="blue">{flr}</Badge>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}

                <!-- Special Accesses -->
                {#if person.specialAccesses && person.specialAccesses.length > 0}
                    <div class="pt-3 border-t border-slate-200">
                        <div
                            class="flex items-center gap-2 text-slate-600 mb-2"
                        >
                            <Shield size={14} />
                            <span
                                class="text-xs font-bold uppercase tracking-wider"
                                >Accesos Especiales</span
                            >
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                            {#each person.specialAccesses as access}
                                <Badge variant="violet">{access}</Badge>
                            {/each}
                        </div>
                    </div>
                {/if}

                <!-- Schedule -->
                {#if person.schedule}
                    <div class="pt-3 border-t border-slate-200">
                        <div
                            class="flex items-center gap-2 text-slate-600 mb-2"
                        >
                            <Clock size={14} />
                            <span
                                class="text-xs font-bold uppercase tracking-wider"
                                >Horario</span
                            >
                        </div>
                        <p class="text-sm font-medium text-slate-700">
                            {person.schedule.days}: {person.schedule.entry} - {person
                                .schedule.exit}
                        </p>
                    </div>
                {/if}

                <!-- Status -->
                <div class="pt-3 border-t border-slate-200">
                    <div class="flex justify-between items-center">
                        <span class="text-xs text-slate-500">Estado</span>
                        <Badge
                            variant={person.status === "active" ||
                            person.status === "Activo/a"
                                ? "emerald"
                                : person.status === "blocked" ||
                                    person.status === "Bloqueado/a"
                                  ? "rose"
                                  : "slate"}
                        >
                            {person.status}
                        </Badge>
                    </div>
                </div>
            </section>

            <!-- Action Buttons -->
            <section class="space-y-3">
                <div class="flex items-center justify-between">
                    <h3
                        class="text-xs font-bold text-slate-400 uppercase tracking-widest"
                    >
                        Acciones Rápidas
                    </h3>
                </div>
                <div
                    class="flex items-center gap-2 p-1 rounded-xl bg-slate-50 border border-slate-100"
                >
                    {#if person.status_raw === "inactive" || person.status === "Baja"}
                        <button
                            type="button"
                            class="flex-1 flex flex-col items-center gap-1 p-2 rounded-lg text-emerald-600 hover:bg-white hover:shadow-sm"
                            onclick={() => onReactivate?.(person)}
                        >
                            <Lock size={18} />
                            <span class="text-[10px] font-bold uppercase"
                                >Reactivar</span
                            >
                        </button>
                        <button
                            type="button"
                            class="flex-1 flex flex-col items-center gap-1 p-2 rounded-lg text-rose-600 hover:bg-white hover:shadow-sm"
                            onclick={() => onDeletePermanent?.(person)}
                        >
                            <Trash2 size={18} />
                            <span class="text-[10px] font-bold uppercase"
                                >Eliminar</span
                            >
                        </button>
                    {:else}
                        <button
                            type="button"
                            class="flex-1 flex flex-col items-center gap-1 p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white"
                            onclick={() => onEdit?.(person)}
                        >
                            <Edit size={18} />
                            <span class="text-[10px] font-bold uppercase"
                                >Editar</span
                            >
                        </button>
                        <button
                            type="button"
                            class="flex-1 flex flex-col items-center gap-1 p-2 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-white"
                            onclick={() => onBlock?.(person)}
                        >
                            <Lock size={18} />
                            <span class="text-[10px] font-bold uppercase"
                                >{person.status_raw === "blocked"
                                    ? "Activar"
                                    : "Bloquear"}</span
                            >
                        </button>
                        <button
                            type="button"
                            class="flex-1 flex flex-col items-center gap-1 p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-white"
                            onclick={() => onDeactivate?.(person)}
                        >
                            <UserX size={18} />
                            <span class="text-[10px] font-bold uppercase"
                                >Baja</span
                            >
                        </button>
                    {/if}
                </div>
            </section>

            <!-- Assigned Cards -->
            <section class="space-y-3">
                <div class="flex items-center justify-between">
                    <h3
                        class="text-xs font-bold text-slate-400 uppercase tracking-widest"
                    >
                        Tarjetas Asignadas
                    </h3>
                    {#if person.status !== "Baja" && person.status_raw !== "inactive"}
                        <Button
                            variant="ghost"
                            size="sm"
                            class="h-7 px-2 text-blue-600"
                            onclick={() => onCardAdd?.(person)}
                        >
                            Asignar Tarjeta
                        </Button>
                    {/if}
                </div>
                {#if person.cards && person.cards.length > 0}
                    <div class="space-y-3">
                        {#each person.cards as card}
                            <CardItem
                                type={card.type as any}
                                folio={card.folio}
                                status={card.status as any}
                                responsiva_status={card.responsiva_status as any}
                                programming_status={card.programming_status as any}
                                isHighlighted={personnelState.highlightedCardId ===
                                    card.id}
                                onGenerateResponsiva={() =>
                                    handleGenerateResponsiva(card)}
                                onBlock={() => onCardBlock?.(card)}
                                onUnassign={() => onCardUnassign?.(card)}
                                onReplace={() => onCardReplace?.(card)}
                            />
                        {/each}
                    </div>
                {:else}
                    <div
                        class="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center"
                    >
                        <p class="text-sm text-slate-500">
                            No hay tarjetas asignadas
                        </p>
                    </div>
                {/if}
            </section>

            <!-- Responsivas History -->
            <section class="space-y-3 pt-6 border-t border-slate-200">
                <div class="flex items-center gap-2 text-slate-400">
                    <HistoryIcon size={14} />
                    <h3 class="text-xs font-bold uppercase tracking-widest">
                        Historial de Responsivas
                    </h3>
                </div>

                {#if signedResponsivas.length > 0}
                    <div class="space-y-2">
                        {#each signedResponsivas as resp}
                            <div
                                class="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-blue-200 transition-colors group"
                            >
                                <div class="flex items-center gap-3">
                                    <div
                                        class="p-2 rounded-lg bg-blue-50 text-blue-600"
                                    >
                                        <FileText size={18} />
                                    </div>
                                    <div class="flex flex-col">
                                        <span
                                            class="text-sm font-bold text-slate-800"
                                            >Folio: {resp.folio}</span
                                        >
                                        <span
                                            class="text-[10px] text-slate-500 font-medium"
                                        >
                                            {new Date(
                                                resp.created_at,
                                            ).toLocaleDateString()} • {resp.card_type}
                                        </span>
                                    </div>
                                </div>
                                <div
                                    class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <button
                                        class="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                        onclick={() => handleViewHistory(resp)}
                                        title="Ver Responsiva"
                                    >
                                        <Eye size={16} />
                                    </button>
                                    <button
                                        class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                        onclick={() =>
                                            handleDeleteResponsiva(resp.id)}
                                        title="Eliminar registro"
                                    >
                                        <TrashIcon size={16} />
                                    </button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div
                        class="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center"
                    >
                        <p class="text-xs text-slate-400">
                            No hay responsivas firmadas registradas
                        </p>
                    </div>
                {/if}
            </section>
        </div>
    {/if}

    <ResponsivaPreviewModal
        bind:isOpen={isPreviewModalOpen}
        data={responsivaData}
        {person}
        card={selectedShowCard}
        signature={selectedSignature}
        onSign={handleSignCard}
        onClose={() => (isPreviewModalOpen = false)}
    />
</SidePanel>
