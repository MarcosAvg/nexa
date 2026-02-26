<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import { AlertTriangle, Trash2, RotateCcw } from "lucide-svelte";
    import type { Person } from "../../services/personnel";

    let {
        isOpen = $bindable(false),
        person,
        onConfirm,
        onCancel = () => {},
    } = $props<{
        isOpen: boolean;
        person: Person;
        onConfirm: (
            cardActionMap: Record<string, "delete" | "keep">,
        ) => Promise<void>;
        onCancel?: () => void;
    }>();

    let isSubmitting = $state(false);
    let cardActionMap = $state<Record<string, "delete" | "keep">>({});

    // Initialize map when person changes or modal opens
    $effect(() => {
        if (isOpen && person?.cards) {
            const initialMap: Record<string, "delete" | "keep"> = {};
            person.cards.forEach((card: any) => {
                initialMap[card.id] = "keep"; // Default to keep available
            });
            cardActionMap = initialMap;
        }
    });

    async function handleConfirm() {
        isSubmitting = true;
        try {
            await onConfirm?.(cardActionMap);
            isOpen = false;
        } finally {
            isSubmitting = false;
        }
    }

    function handleCancel() {
        onCancel?.();
        isOpen = false;
    }

    function toggleAction(cardId: string) {
        cardActionMap[cardId] =
            cardActionMap[cardId] === "keep" ? "delete" : "keep";
    }
</script>

<Modal
    bind:isOpen
    title="¿ELIMINAR PERMANENTEMENTE?"
    size="md"
    zIndex="z-[100]"
    onclose={handleCancel}
>
    <div class="flex flex-col gap-6">
        <div
            class="flex items-start gap-4 p-4 bg-rose-50 border border-rose-100 rounded-xl"
        >
            <div class="p-2.5 bg-rose-100 text-rose-600 rounded-lg">
                <AlertTriangle size={24} />
            </div>
            <div class="space-y-1">
                <h3 class="font-bold text-rose-900 uppercase text-sm">
                    Atención: Acción Irreversible
                </h3>
                <p class="text-sm text-rose-700 leading-relaxed">
                    Vas a eliminar a <strong
                        >{person?.first_name} {person?.last_name}</strong
                    >. Esta acción borrará todo su historial y registros
                    personales.
                </p>
            </div>
        </div>

        {#if person?.cards && person.cards.length > 0}
            <div class="space-y-3">
                <p
                    class="text-xs font-bold text-slate-500 uppercase tracking-wider"
                >
                    Gestión de Tarjetas Asignadas
                </p>
                <div class="grid gap-2">
                    {#each person.cards as card}
                        <div
                            class="flex items-center justify-between p-3 rounded-xl border {cardActionMap[
                                card.id
                            ] === 'delete'
                                ? 'border-rose-200 bg-rose-50/50'
                                : 'border-slate-200 bg-slate-50/30'} transition-all"
                        >
                            <div class="flex items-center gap-3">
                                <div
                                    class="px-2 py-1 rounded text-[10px] font-bold uppercase {card.type ===
                                    'P2000'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-sky-100 text-sky-700'}"
                                >
                                    {card.type}
                                </div>
                                <span class="text-sm font-medium text-slate-700"
                                    >Folio: {card.folio}</span
                                >
                            </div>

                            <button
                                class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                                    {cardActionMap[card.id] === 'delete'
                                    ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm'
                                    : 'bg-white text-emerald-600 border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50'}"
                                onclick={() => toggleAction(card.id)}
                            >
                                {#if cardActionMap[card.id] === "delete"}
                                    <Trash2 size={14} />
                                    ELIMINAR
                                {:else}
                                    <RotateCcw size={14} />
                                    DEJAR DISPONIBLE
                                {/if}
                            </button>
                        </div>
                    {/each}
                </div>
                <p class="text-[11px] text-slate-400 italic">
                    * Las tarjetas dejadas disponibles se desvincularán y
                    volverán al inventario.
                </p>
            </div>
        {:else}
            <p class="text-sm text-slate-500 italic text-center py-4">
                Esta persona no tiene tarjetas asignadas.
            </p>
        {/if}
    </div>

    {#snippet footer()}
        <div class="flex justify-end gap-3 w-full">
            <Button
                variant="ghost"
                onclick={handleCancel}
                disabled={isSubmitting}
            >
                Cancelar
            </Button>
            <Button
                variant="danger"
                onclick={handleConfirm}
                loading={isSubmitting}
                class="min-w-[180px]"
            >
                Confirmar Eliminación
            </Button>
        </div>
    {/snippet}
</Modal>
