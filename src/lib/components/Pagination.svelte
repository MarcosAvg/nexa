<script lang="ts">
    import Button from "./Button.svelte";

    /**
     * Pagination — Controles de paginación con botones de página y ellipsis.
     *
     * @example
     * <Pagination currentPage={1} pageSize={50} totalRecords={234}
     *     onPrevPage={() => store.prevPage()}
     *     onNextPage={() => store.nextPage()}
     *     onGoToPage={(p) => store.goToPage(p)} />
     */
    type Props = {
        /** Página actual (1-indexed). */
        currentPage: number;
        /** Registros por página. */
        pageSize: number;
        /** Total de registros en la consulta. */
        totalRecords: number;
        /** Callback para ir a la página anterior. */
        onPrevPage: () => void;
        /** Callback para ir a la página siguiente. */
        onNextPage: () => void;
        /** Callback para ir a una página específica. */
        onGoToPage: (page: number) => void;
        /** Deshabilita botones durante carga. */
        isLoading?: boolean;
    };

    let {
        currentPage,
        pageSize,
        totalRecords,
        onPrevPage,
        onNextPage,
        onGoToPage,
        isLoading = false,
    }: Props = $props();

    let totalPages = $derived(Math.ceil(totalRecords / pageSize));
    let startRecord = $derived((currentPage - 1) * pageSize + 1);
    let endRecord = $derived(Math.min(currentPage * pageSize, totalRecords));

    function getPageRange(curr: number, total: number): (number | "...")[] {
        const delta = 2;
        const range: number[] = [];
        const rangeWithDots: (number | "...")[] = [];

        for (let i = 1; i <= total; i++) {
            if (
                i === 1 ||
                i === total ||
                (i >= curr - delta && i <= curr + delta)
            ) {
                range.push(i);
            }
        }

        let l: number | null = null;
        for (const i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l !== 1) {
                    rangeWithDots.push("...");
                }
            }
            rangeWithDots.push(i);
            l = i;
        }

        return rangeWithDots;
    }
</script>

{#if totalRecords > 0}
    <div class="flex flex-col sm:flex-row justify-between items-center gap-4 py-4">
        <div class="text-sm text-slate-500">
            Mostrando
            <span class="font-medium text-slate-900">{startRecord}</span>
            a
            <span class="font-medium text-slate-900">{endRecord}</span>
            de
            <span class="font-medium text-slate-900">{totalRecords}</span>
            registros
        </div>

        <div class="flex items-center gap-2">
            <Button
                variant="soft-blue"
                size="sm"
                disabled={currentPage === 1 || isLoading}
                onclick={onPrevPage}
            >
                Anterior
            </Button>

            <div class="flex items-center gap-1">
                {#each getPageRange(currentPage, totalPages) as page}
                    {#if page === "..."}
                        <span class="px-2 text-slate-400">...</span>
                    {:else}
                        <button
                            class="w-8 h-8 rounded-lg text-sm font-medium transition-colors {currentPage ===
                            page
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                : 'text-slate-600 hover:bg-slate-100'}"
                            onclick={() => onGoToPage(page as number)}
                            disabled={isLoading}
                        >
                            {page}
                        </button>
                    {/if}
                {/each}
            </div>

            <Button
                variant="soft-blue"
                size="sm"
                disabled={currentPage === totalPages || isLoading}
                onclick={onNextPage}
            >
                Siguiente
            </Button>
        </div>
    </div>
{/if}
