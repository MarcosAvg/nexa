<script lang="ts">
    /**
     * TicketBajaDetail.svelte
     *
     * Confirmation card for Baja de Persona ticket type.
     */
    let {
        selectedPerson = null,
        p = {} as Record<string, string>,
    }: {
        selectedPerson: any | null;
        p: Record<string, string>;
    } = $props();

    let activeCardCount = $derived(
        (selectedPerson?.cards ?? []).filter((c: any) => c.status === "active").length
    );
</script>

{#if selectedPerson}
    <div class="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-2">
        <p class="text-sm font-bold text-rose-700">
            ¿Confirmar baja de esta persona?
        </p>
        <p class="text-xs text-rose-600">
            Se desactivarán <strong>{activeCardCount}</strong> tarjeta(s) asociadas.
        </p>
        {#if p.tipo_baja}
            <p class="text-xs text-rose-600">
                Tipo: <strong>{p.tipo_baja}</strong>
            </p>
        {/if}
        {#if p.motivo}
            <p class="text-xs text-rose-600">
                Motivo: <strong>{p.motivo}</strong>
            </p>
        {/if}
    </div>
{/if}
