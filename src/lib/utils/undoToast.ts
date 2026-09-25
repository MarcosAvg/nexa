import { toast } from 'svelte-sonner';

export interface UndoToastOptions {
    /** Mensaje de éxito. */
    message: string;
    /** Descripción opcional. */
    description?: string;
    /** Acción de deshacer (idealmente idempotente). */
    onUndo: () => void | Promise<void>;
    /** Texto del botón de deshacer. @default "Deshacer" */
    undoLabel?: string;
    /** Duración en ms. @default 7000 */
    duration?: number;
    /** Callback si el usuario no deshace (acción confirmada). */
    onCommit?: () => void;
}

/**
 * Muestra un toast de éxito con acción de "Deshacer".
 *
 * Se usa para acciones destructivas o de estado cuyo inverso es conocido
 * (p. ej. bloquear↔reactivar). El toast permanece visible el tiempo indicado
 * para dar oportunidad de revertir.
 */
export function toastWithUndo({
    message,
    description,
    onUndo,
    undoLabel = 'Deshacer',
    duration = 7000,
    onCommit,
}: UndoToastOptions) {
    toast.success(message, {
        description,
        duration,
        action: {
            label: undoLabel,
            onClick: async () => {
                try {
                    await onUndo();
                    toast.success('Acción deshecha');
                } catch (error) {
                    toast.error('No se pudo deshacer', {
                        description: error instanceof Error ? error.message : undefined,
                    });
                }
            },
        },
        onAutoClose: () => onCommit?.(),
        onDismiss: () => onCommit?.(),
    });
}
