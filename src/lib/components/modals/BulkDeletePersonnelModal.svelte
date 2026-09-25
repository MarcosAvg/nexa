<script lang="ts">
    import Modal from '../Modal.svelte';
    import Button from '../Button.svelte';
    import { AlertTriangle, Trash2, RotateCcw } from 'lucide-svelte';
    import type { Person } from '../../types';

    /**
     * BulkDeletePersonnelModal — Confirmación de eliminación permanente de varias
     * personas, con decisión por lote sobre sus tarjetas asignadas.
     *
     * @example
     * <BulkDeletePersonnelModal bind:isOpen people={selected} onConfirm={handleDelete} />
     */
    type Props = {
        isOpen?: boolean;
        people: Person[];
        onConfirm: (action: 'keep' | 'delete') => Promise<void>;
        onCancel?: () => void;
    };

    let { isOpen = $bindable(false), people = [], onConfirm, onCancel = () => {} }: Props = $props();

    let cardAction = $state<'keep' | 'delete'>('keep');
    let isSubmitting = $state(false);

    let totalCards = $derived(people.reduce((n, p) => n + (p.cards?.length ?? 0), 0));

    // Reset de la decisión al abrir.
    $effect(() => {
        if (isOpen) cardAction = 'keep';
    });

    async function handleConfirm() {
        isSubmitting = true;
        try {
            await onConfirm(cardAction);
            isOpen = false;
        } finally {
            isSubmitting = false;
        }
    }

    function handleCancel() {
        onCancel();
        isOpen = false;
    }
</script>

<Modal bind:isOpen title="¿ELIMINAR PERMANENTEMENTE?" size="md" zIndex="z-[100]" onclose={handleCancel}>
    <div class="flex flex-col gap-6">
        <div class="flex items-start gap-4 p-4 bg-rose-50 border border-rose-100 rounded-xl">
            <div class="p-2.5 bg-rose-100 text-rose-600 rounded-lg">
                <AlertTriangle size={24} />
            </div>
            <div class="space-y-1">
                <h3 class="font-bold text-rose-900 uppercase text-sm">Atención: Acción irreversible</h3>
                <p class="text-sm text-rose-700 leading-relaxed">
                    Vas a eliminar <strong>{people.length} persona(s)</strong>. Esta acción borrará todo su
                    historial y registros personales.
                </p>
            </div>
        </div>

        <div class="space-y-3">
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Personas seleccionadas</p>
            <ul class="max-h-40 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
                {#each people as person (person.id)}
                    <li class="flex items-center justify-between px-3 py-2 text-sm">
                        <span class="font-medium text-slate-700 truncate">
                            {person.first_name}
                            {person.last_name}
                        </span>
                        <span class="text-[11px] font-bold text-slate-400 shrink-0">
                            {person.cards?.length ?? 0} tarjeta(s)
                        </span>
                    </li>
                {/each}
            </ul>
        </div>

        {#if totalCards > 0}
            <div class="space-y-3">
                <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Gestión de tarjetas asignadas ({totalCards})
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                        type="button"
                        class="flex items-center gap-3 p-3 rounded-xl border text-left transition-all {cardAction ===
                        'keep'
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-slate-200 hover:border-slate-300'}"
                        onclick={() => (cardAction = 'keep')}
                    >
                        <RotateCcw size={18} class="text-emerald-600 shrink-0" />
                        <span>
                            <span class="block text-sm font-bold text-slate-800"> Dejar disponibles </span>
                            <span class="block text-[11px] text-slate-500">
                                Vuelven al inventario (no se borran).
                            </span>
                        </span>
                    </button>
                    <button
                        type="button"
                        class="flex items-center gap-3 p-3 rounded-xl border text-left transition-all {cardAction ===
                        'delete'
                            ? 'border-rose-300 bg-rose-50'
                            : 'border-slate-200 hover:border-slate-300'}"
                        onclick={() => (cardAction = 'delete')}
                    >
                        <Trash2 size={18} class="text-rose-600 shrink-0" />
                        <span>
                            <span class="block text-sm font-bold text-slate-800"> Eliminar tarjetas </span>
                            <span class="block text-[11px] text-slate-500">
                                Se borran junto con el personal.
                            </span>
                        </span>
                    </button>
                </div>
            </div>
        {:else}
            <p class="text-sm text-slate-500 italic text-center py-2">
                Las personas seleccionadas no tienen tarjetas asignadas.
            </p>
        {/if}
    </div>

    {#snippet footer()}
        <div class="flex justify-end gap-3 w-full">
            <Button variant="ghost" onclick={handleCancel} disabled={isSubmitting}>Cancelar</Button>
            <Button variant="danger" onclick={handleConfirm} loading={isSubmitting} class="min-w-[180px]">
                Confirmar Eliminación
            </Button>
        </div>
    {/snippet}
</Modal>
