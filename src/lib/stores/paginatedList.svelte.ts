/**
 * PaginatedListState — Estado genérico de lista paginada.
 *
 * Maneja la paginación mecánica (página, tamaño, total, carga)
 * y ofrece helpers de navegación que devuelven booleano para
 * que el caller decida si refrescar los datos.
 *
 * @example
 * class MyStore {
 *   pagination = new PaginatedListState<Widget>();
 *   // delegar getters/setters para backward compat...
 * }
 */
export class PaginatedListState<T> {
    /** Los items de la página actual. */
    items = $state<T[]>([]);

    /** Página actual (1‑based). */
    currentPage = $state(1);

    /** Tamaño de página. */
    pageSize = $state(50);

    /** Total de registros (no páginas). */
    totalRecords = $state(0);

    /** Indicador de carga. */
    isLoading = $state(false);

    /** Total de páginas (derivado). */
    totalPages = $derived(Math.ceil(this.totalRecords / this.pageSize));

    /** Asigna items y total. */
    setItems(data: T[], count: number) {
        this.items = data;
        this.totalRecords = count;
    }

    /** Asigna el flag de carga. */
    setLoading(v: boolean) {
        this.isLoading = v;
    }

    /** Resetea el estado a valores iniciales. */
    clearItems() {
        this.items = [];
        this.totalRecords = 0;
        this.currentPage = 1;
        this.isLoading = false;
    }

    /** Avanza una página si es posible. Devuelve true si hubo cambio. */
    nextPage(): boolean {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            return true;
        }
        return false;
    }

    /** Retrocede una página si es posible. Devuelve true si hubo cambio. */
    prevPage(): boolean {
        if (this.currentPage > 1) {
            this.currentPage--;
            return true;
        }
        return false;
    }

    /** Va a una página específica si está en rango. Devuelve true si hubo cambio. */
    goToPage(page: number): boolean {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            return true;
        }
        return false;
    }

    /** Contador interno para detectar respuestas obsoletas (stale). */
    private _fetchSeq = 0;

    /**
     * Ejecuta un fetcher y maneja el estado de carga/paginación de forma
     * consistente. Ideal para los métodos `refresh()` de cada store.
     *
     * Incluye protección contra respuestas obsoletas: si se llama a fetchPage
     * múltiples veces en rápido sucesión, solo la última llamada actualizará
     * los items (las respuestas anteriores se descartan silenciosamente).
     *
     * @param fetcher — Recibe (currentPage, pageSize), devuelve { data, count }
     * @param page — Página opcional a la que navegar antes de fetchear
     */
    async fetchPage(
        fetcher: (page: number, pageSize: number) => Promise<{ data: T[]; count: number }>,
        page?: number,
    ) {
        const seq = ++this._fetchSeq;
        this.isLoading = true;
        if (page !== undefined) this.currentPage = page;
        try {
            const result = await fetcher(this.currentPage, this.pageSize);
            if (seq !== this._fetchSeq) return; // respuesta obsoleta
            this.setItems(result.data, result.count);
        } finally {
            if (seq === this._fetchSeq) {
                this.isLoading = false;
            }
        }
    }
}
