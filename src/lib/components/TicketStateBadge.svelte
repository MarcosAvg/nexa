<script lang="ts">
    import Badge from "./Badge.svelte";

    type Props = {
        status?: string | null;
        /** Estado de seguimiento para Reporte de Falla (payload.estado). */
        followup?: "En revisión" | "Requiere reposición" | "Resuelto" | string | null;
        type?: string;
    };

    let { status, followup, type }: Props = $props();

    // Para Reporte de Falla se usa el estado de seguimiento; el resto usa status.
    let isFalla = $derived(type === "Reporte de Falla" || type === "Reporte de Fallo");
</script>

{#if isFalla && followup}
    {#if followup === "Resolver" || followup === "Falla Resuelta" || followup === "Resuelto"}
        <Badge variant="emerald">Resuelto</Badge>
    {:else if followup === "Requiere reposición" || followup === "Requiere Reposición"}
        <Badge variant="blue">Requiere reposición</Badge>
    {:else}
        <Badge variant="amber">En revisión</Badge>
    {/if}
{:else if status === "completed"}
    <Badge variant="emerald">Completado</Badge>
{:else if status === "cancelled" || status === "rejected"}
    <Badge variant="rose">Rechazado</Badge>
{:else if status === "in_progress"}
    <Badge variant="blue">En gestión</Badge>
{:else}
    <Badge variant="amber">Pendiente</Badge>
{/if}
