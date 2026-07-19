<script lang="ts">
    /**
     * SkeletonCard — Esqueleto de tarjetas para estado de carga (móvil).
     *
     * Imita el layout de las tarjetas móviles del DataTable.
     *
     * @example
     * <SkeletonCard columns={5} rows={5} hasActions={true} />
     */
    type Props = {
        /** Número de "columnas" (filas de datos) por tarjeta. @default 4 */
        columns?: number;
        /** Número de tarjetas esqueleto. @default 5 */
        rows?: number;
        /** Muestra placeholders de botones de acción. @default false */
        hasActions?: boolean;
        /** Clases CSS adicionales. */
        className?: string;
    };

    let {
        columns = 4,
        rows = 5,
        hasActions = false,
        className = "",
    }: Props = $props();

    // Staggered widths for a natural look — each row index maps to widths
    const labelWidths = ["w-24", "w-20", "w-16", "w-28", "w-22"] as const;
    const valueWidths = ["w-28", "w-24", "w-20", "w-32", "w-26"] as const;

    function labelW(idx: number): string {
        return labelWidths[idx % labelWidths.length];
    }

    function valueW(idx: number): string {
        return valueWidths[idx % valueWidths.length];
    }
</script>

<div class="relative overflow-hidden space-y-4 {className}">
    <!-- Shimmer overlay -->
    <div class="absolute inset-0 -translate-x-full animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)] pointer-events-none"></div>

    {#each Array(rows) as _, rowIdx}
        <div class="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 space-y-4">
            <!-- Header: label placeholder + value placeholder + optional actions -->
            <div class="flex items-start justify-between gap-3">
                <div class="flex flex-col gap-1.5 flex-1 min-w-0">
                    <div class="h-3 w-20 bg-slate-200 rounded"></div>
                    <div class="h-5 w-36 bg-slate-100 rounded"></div>
                </div>
                {#if hasActions}
                    <div class="flex items-center gap-1 shrink-0">
                        {#each Array(3) as _}
                            <div class="h-8 w-8 bg-slate-100 rounded-lg"></div>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Field rows -->
            {#each Array(Math.min(columns, 4)) as _, colIdx}
                <div class="flex items-center justify-between gap-4 py-1.5 border-b border-slate-50 last:border-0">
                    <div class="h-2.5 {labelW(colIdx)} bg-slate-200 rounded"></div>
                    <div class="h-3.5 {valueW(colIdx)} bg-slate-100 rounded"></div>
                </div>
            {/each}

            <!-- "Ver más" placeholder if more than 3 visible fields -->
            {#if columns > 3}
                <div class="flex justify-center pt-1">
                    <div class="h-3 w-24 bg-slate-100 rounded"></div>
                </div>
            {/if}
        </div>
    {/each}
</div>
