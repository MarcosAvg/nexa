<script lang="ts">
    import SidePanel from "./SidePanel.svelte";
    import Button from "./Button.svelte";
    import Badge from "./Badge.svelte";
    import CardItem from "./CardItem.svelte";
    import PermissionGuard from "./PermissionGuard.svelte";
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
    import { generateResponsivaPdf, generateCardPdf, handleError } from "../utils";
    import ResponsivaTemplate from "./ResponsivaTemplate.svelte";
    import ResponsivaPreviewModal from "./ResponsivaPreviewModal.svelte";
    import { toast } from "svelte-sonner";

    import { cardService } from "../services/cards";
    import { responsivaService } from "../services/responsiva";
    import { personnelState } from "../stores";
    import { uiState } from "../stores/ui.svelte";
    import type { Person } from "../types";

    /**
     * PersonDetailsPanel — Panel lateral con detalles completos de una persona.
     *
     * Muestra información general, ubicación, pisos asignados, horario,
     * accesos especiales, tarjetas con sus responsivas, y acciones rápidas
     * (editar, bloquear, desactivar, etc.).
     *
     * @example
     * <PersonDetailsPanel bind:isOpen {person} onEdit={openEditModal} onclose={() => {}} />
     */
    type Props = {
        /** Controla la visibilidad del panel (two-way bindable). */
        isOpen: boolean;
        /** Persona a mostrar (null mientras no haya selección). */
        person: Person | null;
        /** Callback al editar la persona. */
        onEdit?: (person: Person) => void;
        /** Callback al bloquear la persona. */
        onBlock?: (person: Person) => void;
        /** Callback al desactivar la persona. */
        onDeactivate?: (person: Person) => void;
        /** Callback al cerrar el panel. */
        onclose?: () => void;
        /** Callback al bloquear una tarjeta. */
        onCardBlock?: (card: any) => void;
        /** Callback al desasignar una tarjeta. */
        onCardUnassign?: (card: any) => void;
        /** Callback al reemplazar una tarjeta. */
        onCardReplace?: (card: any) => void;
        /** Callback al agregar una nueva tarjeta. */
        onCardAdd?: (person: Person) => void;
        /** Callback al reactivar la persona (cambio de estado). */
        onReactivate?: (person: Person) => void;
        /** Callback al eliminar permanentemente la persona. */
        onDeletePermanent?: (person: Person) => void;
        /** Callback para refrescar datos después de operaciones. */
        onRefresh?: () => Promise<void>;
        /** Callback al programar una tarjeta. */
        onCardProgram?: (card: any) => void;
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
        onCardProgram,
    }: Props = $props();

    // Restablecer resaltado al cerrar
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
            handleError(error, "Cargar Responsivas");
        }
    }

    async function handleGenerateResponsiva(card: any) {
        if (!person) return;

        // Verificación de seguridad: no se puede generar responsiva si no está programada
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

        // Apertura inteligente: verificar si existe versión firmada de este folio en historial
        let existingResp = signedResponsivas.find(
            (r) => r.folio === card.folio && r.card_type === card.type,
        );

        // Obtener datos actualizados si pudieran estar desactualizados
        if (existingResp) {
            try {
                await loadResponsivas();
                existingResp = signedResponsivas.find(
                    (r) => r.folio === card.folio && r.card_type === card.type,
                );
            } catch (e) {
                handleError(e, "Refrescar Responsivas");
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
            handleError(error, "Firmar Tarjeta");
            throw error;
        }
    }

    async function handleDeleteResponsiva(id: string) {
        if (!person?.id || !confirm("¿Eliminar este registro de responsiva?"))
            return;

        // Buscar el registro para verificar el folio antes de eliminar
        const respToDelete = signedResponsivas.find((r) => r.id === id);

        try {
            await responsivaService.delete(id, person.id.toString());

            // Reversión de estado: si este folio está asignado, marcarlo como no firmado
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
            handleError(error, "Eliminar Responsiva");
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
            // Construir objeto de contexto para el modal
            selectedShowCard = person?.cards?.find(
                (c) => c.folio === freshResp.folio,
            ) || {
                folio: freshResp.folio,
                type: freshResp.card_type,
                responsiva_status: "signed",
            };
            isPreviewModalOpen = true;
        } catch (e) {
            handleError(e, "Ver Historial de Responsiva");
        }
    }
    async function copyToClipboard(text: string, label: string) {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            toast.success(`${label} copiado`);
        } catch (err) {
            toast.error("Error al copiar");
        }
    }

    async function handlePrintCard(card: any) {
        try {
            await generateCardPdf(card.folio, card.type);
            toast.success("PDF generado para impresión");
        } catch (error) {
            handleError(error, "Generar PDF de Tarjeta");
        }
    }

    async function handleDirectCardStatusChange(
        card: any,
        field: "responsiva_status" | "programming_status",
        value: string | null
    ) {
        try {
            const { supabase } = await import("../supabase");
            const { error } = await supabase
                .from("cards")
                .update({ [field]: value })
                .eq("id", card.id);
            if (error) throw error;

            const fieldLabel = field === "responsiva_status" ? "Responsiva" : "Programación";
            const valueLabel = field === "responsiva_status"
                ? (value === "signed" ? "Firmada" : value === "legacy" ? "Legacy" : "Sin Firmar")
                : (value === "done" ? "Programada" : "Sin Programar");
            toast.success(`${fieldLabel} → ${valueLabel}`);
            await onRefresh?.();
        } catch (e) {
            handleError(e, "Actualizar Estado de Tarjeta");
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
            <!-- Tarjeta de información -->
            <section
                class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
            >
                <h3
                    class="text-xs font-bold text-slate-400 uppercase tracking-widest"
                >
                    Información General
                </h3>

                <div class="grid gap-3">
                    <button 
                        type="button"
                        class="flex justify-between items-center w-full text-left group transition-colors cursor-pointer"
                        onclick={() => copyToClipboard(person?.first_name || '', 'Nombres')}
                        title="Copiar nombres"
                    >
                        <span class="text-xs text-slate-500 group-hover:text-blue-500 transition-colors"
                            >Nombres</span
                        >
                        <span class="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors"
                            >{person.first_name}</span
                        >
                    </button>
                    <button 
                        type="button"
                        class="flex justify-between items-center w-full text-left group transition-colors cursor-pointer"
                        onclick={() => copyToClipboard(person?.last_name || '', 'Apellidos')}
                        title="Copiar apellidos"
                    >
                        <span class="text-xs text-slate-500 group-hover:text-blue-500 transition-colors"
                            >Apellidos</span
                        >
                        <span class="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors"
                            >{person.last_name}</span
                        >
                    </button>
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

                <!-- Ubicación -->
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

                <!-- Pisos Asignados -->
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

                <!-- Accesos Especiales -->
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

                <!-- Horario -->
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

                <!-- Estado -->
                <div class="pt-3 border-t border-slate-200">
                    <div class="flex justify-between items-center">
                        <span class="text-xs text-slate-500">Estado</span>
                        <Badge
                            variant={person.status === "Activo/a"
                                ? "emerald"
                                : person.status === "Parcial"
                                  ? "amber"
                                  : person.status === "Bloqueado/a"
                                    ? "rose"
                                    : "slate"}
                        >
                            {person.status}
                        </Badge>
                    </div>
                </div>
            </section>

            <!-- Botones de acción -->
            <section class="space-y-3">
                <div class="flex items-center justify-between">
                    <h3
                        class="text-xs font-bold text-slate-400 uppercase tracking-widest"
                    >
                        Acciones Rápidas
                    </h3>
                </div>
                <div
                    class="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100"
                >
                    {#if person.status_raw === "inactive" || person.status === "Baja"}
                        <PermissionGuard requireEdit disabledOnly>
                            {#snippet children({ disabled })}
                                <button
                                    type="button"
                                    class="flex-1 flex flex-col items-center gap-1.5 p-3.5 rounded-lg text-emerald-600 hover:bg-white hover:shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                    onclick={() => onReactivate?.(person)}
                                    {disabled}
                                >
                                    <Lock size={20} />
                                    <span
                                        class="text-[10px] font-bold uppercase"
                                        >Reactivar</span
                                    >
                                </button>
                            {/snippet}
                        </PermissionGuard>
                        <PermissionGuard requireAdmin disabledOnly>
                            {#snippet children({ disabled })}
                                <button
                                    type="button"
                                    class="flex-1 flex flex-col items-center gap-1.5 p-3.5 rounded-lg text-rose-600 hover:bg-white hover:shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                    onclick={() => onDeletePermanent?.(person)}
                                    {disabled}
                                >
                                    <Trash2 size={20} />
                                    <span
                                        class="text-[10px] font-bold uppercase"
                                        >Eliminar</span
                                    >
                                </button>
                            {/snippet}
                        </PermissionGuard>
                    {:else}
                        <PermissionGuard requireEdit disabledOnly>
                            {#snippet children({ disabled })}
                                <button
                                    type="button"
                                    class="flex-1 flex flex-col items-center gap-1.5 p-3.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white transition-all active:scale-95 disabled:opacity-50"
                                    onclick={() => onEdit?.(person)}
                                    {disabled}
                                >
                                    <Edit size={20} />
                                    <span
                                        class="text-[10px] font-bold uppercase"
                                        >Editar</span
                                    >
                                </button>
                                <button
                                    type="button"
                                    class="flex-1 flex flex-col items-center gap-1.5 p-3.5 rounded-lg {person.status ===
                                    'Bloqueado/a'
                                        ? 'text-emerald-600'
                                        : 'text-slate-500 hover:text-amber-600'} hover:bg-white transition-all active:scale-95 disabled:opacity-50"
                                    onclick={() =>
                                        person.status === "Bloqueado/a"
                                            ? onReactivate?.(person)
                                            : onBlock?.(person)}
                                    {disabled}
                                >
                                    <Lock size={20} />
                                    <span
                                        class="text-[10px] font-bold uppercase"
                                        >{person.status === "Bloqueado/a"
                                            ? "Activar"
                                            : "Bloquear"}</span
                                    >
                                </button>
                                <button
                                    type="button"
                                    class="flex-1 flex flex-col items-center gap-1.5 p-3.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-white transition-all active:scale-95 disabled:opacity-50"
                                    onclick={() => onDeactivate?.(person)}
                                    {disabled}
                                >
                                    <UserX size={20} />
                                    <span
                                        class="text-[10px] font-bold uppercase"
                                        >Baja</span
                                    >
                                </button>
                            {/snippet}
                        </PermissionGuard>
                    {/if}
                </div>
            </section>

            <!-- Tarjetas Asignadas -->
            <section class="space-y-3">
                <div class="flex items-center justify-between">
                    <h3
                        class="text-xs font-bold text-slate-400 uppercase tracking-widest"
                    >
                        Tarjetas Asignadas
                    </h3>
                    {#if person.status !== "Baja" && person.status_raw !== "inactive"}
                        <PermissionGuard requireEdit>
                            <Button
                                variant="soft-blue"
                                size="sm"
                                class="h-7 px-3"
                                onclick={() => onCardAdd?.(person)}
                            >
                                Asignar Tarjeta
                            </Button>
                        </PermissionGuard>
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
                                onProgram={() => onCardProgram?.(card)}
                                onPrint={() => handlePrintCard(card)}
                                onDirectStatusChange={uiState.isDirectEditMode
                                    ? (field, value) => handleDirectCardStatusChange(card, field, value)
                                    : undefined}
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

            <!-- Historial de Responsivas -->
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
                                    <PermissionGuard requireAdmin>
                                        <button
                                            class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                            onclick={() =>
                                                handleDeleteResponsiva(resp.id)}
                                            title="Eliminar registro"
                                        >
                                            <TrashIcon size={16} />
                                        </button>
                                    </PermissionGuard>
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
