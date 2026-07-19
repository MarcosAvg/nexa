<script lang="ts">
    /**
     * TicketReporteFallaDetail.svelte
     *
     * Displays a detail table for Reporte de Falla ticket type.
     */
    let {
        reportRows = [] as { label: string; value: string }[],
    }: {
        reportRows: { label: string; value: string }[];
    } = $props();
</script>

<div class="rounded-xl border border-slate-200 overflow-hidden">
    <table class="w-full text-xs">
        <tbody class="divide-y divide-slate-100">
            {#each reportRows as row, i}
                <tr class={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td class="px-4 py-2 font-semibold text-slate-500 w-40">
                        {row.label}
                    </td>
                    <td class="px-4 py-2 text-slate-800">
                        {row.value}
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
