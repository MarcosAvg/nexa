<script lang="ts">
    import StatusBadge from './StatusBadge.svelte';

    type Props = {
        status?: string | null;
        /** Estado de seguimiento para Reporte de Falla (payload.estado). */
        followup?: 'En revisión' | 'Requiere reposición' | 'Resuelto' | string | null;
        type?: string;
    };

    let { status, followup, type }: Props = $props();

    // Para Reporte de Falla se usa el estado de seguimiento; el resto usa status.
    let isFalla = $derived(type === 'Reporte de Falla' || type === 'Reporte de Fallo');
</script>

{#if isFalla && followup}
    <StatusBadge domain="followup" value={followup} />
{:else}
    <StatusBadge domain="ticket" value={status} />
{/if}
