/**
 * Reusable confirm modal state.
 *
 * Crea una instancia global (o local) y úsala desde cualquier vista
 * sin tener que definir el mismo objeto $state cada vez.
 *
 * Uso:
 *   import { confirm } from "../utils/confirmModal";
 *
 *   confirm.open({
 *     title: "¿Eliminar?",
 *     description: "Esta acción no se puede deshacer.",
 *     variant: "danger",
 *     confirmText: "Eliminar",
 *     onConfirm: async () => { await eliminar(); },
 *   });
 */

export type ConfirmVariant = "danger" | "warning" | "info";

export interface ConfirmOptions {
    title: string;
    description: string;
    variant?: ConfirmVariant;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
}

export class ConfirmModalState {
    isOpen = $state(false);
    title = $state("");
    description = $state("");
    variant = $state<ConfirmVariant>("danger");
    confirmText = $state("Confirmar");
    cancelText = $state("Cancelar");
    onConfirm = $state<() => void | Promise<void>>(async () => {});
    onCancel = $state<() => void>(() => {});

    open(options: ConfirmOptions) {
        this.title = options.title;
        this.description = options.description;
        this.variant = options.variant ?? "danger";
        this.confirmText = options.confirmText ?? "Confirmar";
        this.cancelText = options.cancelText ?? "Cancelar";
        this.onConfirm = options.onConfirm;
        this.onCancel = options.onCancel ?? (() => {});
        this.isOpen = true;
    }

    close() {
        this.isOpen = false;
    }

    reset() {
        this.isOpen = false;
        this.title = "";
        this.description = "";
        this.variant = "danger";
        this.confirmText = "Confirmar";
        this.cancelText = "Cancelar";
        this.onConfirm = async () => {};
        this.onCancel = () => {};
    }
}

/** Singleton global — usar desde cualquier vista que necesite un modal de confirmación. */
export const confirm = new ConfirmModalState();
