<script lang="ts">
    /**
     * PersonFormCards.svelte
     *
     * Card management section: list of assigned cards + add button.
     */
    import Badge from "../Badge.svelte";
    import Button from "../Button.svelte";
    import PermissionGuard from "../PermissionGuard.svelte";
    import { Plus, CreditCard, Trash2 } from "lucide-svelte";
    import type { Snippet } from "svelte";

    let {
        tarjetasAsignadas = [] as { type: string; folio: string }[],
        onRemoveCard = (index: number) => {},
        onAddCard = () => {},
        editingPerson = null,
        prefill = null,
    }: {
        tarjetasAsignadas: { type: string; folio: string }[];
        onRemoveCard: (index: number) => void;
        onAddCard: () => void;
        editingPerson?: any;
        prefill?: any;
    } = $props();
</script>

{#if !editingPerson || prefill}
    <fieldset class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
        <legend class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
            Gestión de Tarjetas
        </legend>

        {#if tarjetasAsignadas.length > 0}
            <div class="space-y-2">
                {#each tarjetasAsignadas as card, index}
                    <div class="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                        <div class="flex items-center gap-3">
                            <CreditCard size={18} class="text-slate-400" />
                            <Badge variant={card.type === "KONE" ? "blue" : "amber"}>
                                {card.type}
                            </Badge>
                            <span class="text-sm font-bold text-slate-700">{card.folio}</span>
                        </div>
                        <button
                            type="button"
                            class="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                            onclick={() => onRemoveCard(index)}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                {/each}
            </div>
        {/if}

        <PermissionGuard requireEdit disabledOnly>
            {#snippet children({ disabled })}
                <Button
                    type="button"
                    variant="outline"
                    class="w-full"
                    onclick={onAddCard}
                    {disabled}
                >
                    <Plus size={16} />
                    Asignar Tarjeta Inicial
                </Button>
            {/snippet}
        </PermissionGuard>
    </fieldset>
{/if}
