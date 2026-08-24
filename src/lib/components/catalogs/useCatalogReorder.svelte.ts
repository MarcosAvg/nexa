    /**
     * useCatalogReorder — Composable para reordenar una lista de catálogo con
     * actualización optimista y rollback si la persistencia falla.
     */
    import { toast } from "svelte-sonner";
    import { catalogService, type CatalogTable } from "../../services/catalogs";

    export function useCatalogReorder(opts: {
        table: CatalogTable;
        getItems: () => any[];
        setItems: (items: any[]) => void;
        fetchFn: () => Promise<void>;
    }) {
        let isReordering = $state(false);

        async function handleDrop(from: number, to: number) {
            if (isReordering || from === to) return;
            const next = [...opts.getItems()];
            const [item] = next.splice(from, 1);
            next.splice(to, 0, item);
            isReordering = true;
            opts.setItems(next);
            try {
                await catalogService.reorderCatalog(opts.table, next);
                toast.success("Orden actualizado");
            } catch {
                toast.error("Error al actualizar el orden");
                await opts.fetchFn();
            } finally {
                isReordering = false;
            }
        }

        return { isReordering, handleDrop };
    }
