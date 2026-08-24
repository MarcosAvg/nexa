<script lang="ts">
    import Badge from "./Badge.svelte";

    type Props = {
        responsiva_status?: string | null;
        programming_status?: string | null;
    };

    let { responsiva_status, programming_status }: Props = $props();
</script>

{#if responsiva_status === "legacy"}
    <Badge variant="slate" class="text-[8px] px-1 py-0 h-4">LEGACY</Badge>
{:else if responsiva_status !== "signed"}
    <Badge variant="rose" class="text-[8px] px-1 py-0 h-4">SIN RESPONSIVA</Badge>
{/if}
{#if programming_status !== "done"}
    <Badge variant="blue" class="text-[8px] px-1 py-0 h-4">SIN PROGRAMAR</Badge>
{/if}
