<script lang="ts">
    /**
     * SkeletonTable — Esqueleto de tabla para estado de carga (desktop).
     *
     * Muestra barras placeholder con efecto shimmer.
     *
     * @example
     * <SkeletonTable columns={5} rows={5} hasActions={true} />
     */
    type Props = {
        /** Número de columnas. @default 4 */
        columns?: number;
        /** Número de filas. @default 5 */
        rows?: number;
        /** Muestra columna de acciones. @default false */
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

    // Header bar widths per column index
    const headerWidths = [
        "w-32", "w-44", "w-24", "w-28", "w-20", "w-36", "w-24",
    ] as const;

    // Row bar widths — staggered per row+col to look natural
    const rowWidths: Record<string, string[]> = {
        0: ["w-36", "w-14", "w-12", "w-28", "w-16", "w-20", "w-14"],
        1: ["w-28", "w-20", "w-16", "w-24", "w-12", "w-28", "w-18"],
        2: ["w-40", "w-16", "w-14", "w-20", "w-20", "w-24", "w-12"],
        3: ["w-32", "w-12", "w-18", "w-32", "w-14", "w-16", "w-20"],
        4: ["w-24", "w-18", "w-20", "w-16", "w-18", "w-32", "w-16"],
    };

    function colWidth(rowIdx: number, colIdx: number): string {
        const widths = rowWidths[rowIdx % 5];
        return colIdx < widths.length ? widths[colIdx] : "w-20";
    }

    // Only push last column right when there's no actions column — when actions
    // exists the actions bar handles right-alignment.
    function lastColClass(colIdx: number): string {
        if (colIdx < columns - 1) return "";
        return hasActions ? "" : "ml-auto";
    }
</script>

<div class="relative overflow-hidden divide-y divide-slate-100/60 {className}">
    <!-- Shimmer overlay -->
    <div class="absolute inset-0 -translate-x-full animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)] pointer-events-none"></div>
    <!-- Table header skeleton -->
    <div class="flex items-center gap-6 px-6 py-5 bg-slate-50/80">
        {#each Array(columns) as _, i}
            <div class="h-3 {headerWidths[i] || 'w-24'} bg-slate-200 rounded {lastColClass(i)}"></div>
        {/each}
        {#if hasActions}
            <div class="h-3 w-20 bg-slate-200 rounded ml-auto"></div>
        {/if}
    </div>
    <!-- Skeleton data rows -->
    {#each Array(rows) as _, rowIdx}
        <div class="flex items-center gap-6 px-6 py-4.5">
            {#each Array(columns) as _, colIdx}
                <div class="h-5 {colWidth(rowIdx, colIdx)} bg-slate-100 rounded {lastColClass(colIdx)}"></div>
            {/each}
            {#if hasActions}
                <div class="h-8 w-16 bg-slate-100 rounded-lg ml-auto"></div>
            {/if}
        </div>
    {/each}
</div>
