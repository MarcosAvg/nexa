import type { Snippet } from 'svelte';

/**
 * DetailHost — Host global para el panel de detalle de las listas.
 *
 * Centraliza la apertura de paneles de detalle (DataList) en un único overlay
 * montado a nivel de app (`GlobalOverlays`), fuera de cualquier `Card`, para
 * que `position: fixed` no quede contenido por un ancestro con `backdrop-filter`.
 */
export type DetailEntry = {
    /** DataList que abrió el panel (para limpieza al desmontar). */
    owner: symbol;
    title: string;
    subtitle?: string;
    row: any;
    details?: Snippet<[any]>;
    actions?: Snippet<[any]>;
};

class DetailHostState {
    entry = $state<DetailEntry | null>(null);
    isOpen = $state(false);

    open(entry: DetailEntry) {
        this.entry = entry;
        this.isOpen = true;
    }

    close() {
        this.isOpen = false;
    }

    clear() {
        this.entry = null;
    }

    /** Cierra y limpia solo si el panel pertenece al owner indicado. */
    closeIfOwner(owner: symbol) {
        if (this.entry?.owner === owner) {
            this.close();
            this.clear();
        }
    }
}

export const detailHost = new DetailHostState();
