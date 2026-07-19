/**
 * toastHelpers.ts
 *
 * Shared helpers for managing toast lifecycle (loading → success / error)
 * across export and ZIP download operations.
 */

import { toast } from "svelte-sonner";
import { handleError } from "./error";

/**
 * Wraps an async operation with a loading toast, automatically transitioning
 * to a success toast on completion or dismissing + showing an error on failure.
 *
 * @param loadingMessage - Initial toast text while the operation runs.
 * @param successMessage  - Toast text shown on success (replaces the loading toast).
 * @param fn              - The async operation. Receives an `updateMessage` callback
 *                          that can be called to change the loading toast text mid‑flight
 *                          (useful for progress updates during ZIP generation etc.).
 * @param errorContext    - Context label passed to `handleError` for error toasts.
 * @returns The resolved value of `fn`, or `null` if an error occurred.
 *
 * @example
 *   // Uso simple
 *   await withLoadingToast(
 *     "Preparando exportación...",
 *     "Exportación completada",
 *     async () => {
 *       const data = await service.fetchForExport(...);
 *       exportToExcel(data);
 *     },
 *     "Exportar Datos",
 *   );
 *
 * @example
 *   // Con actualizaciones de progreso (ej. ZIP por dependencia)
 *   await withLoadingToast(
 *     "Preparando ZIP...",
 *     "ZIP descargado",
 *     async (update) => {
 *       await exportAllAsZip(deps, (_, __, label) => {
 *         update(`Procesando: ${label}`);
 *       });
 *     },
 *     "Exportar ZIP",
 *   );
 */
export async function withLoadingToast<T>(
    loadingMessage: string,
    successMessage: string,
    fn: (updateMessage: (msg: string) => void) => Promise<T>,
    errorContext: string,
): Promise<T | null> {
    const toastId = toast.loading(loadingMessage);
    try {
        const result = await fn(
            (msg: string) => toast.loading(msg, { id: toastId }),
        );
        toast.success(successMessage, { id: toastId });
        return result;
    } catch (error) {
        toast.dismiss(toastId);
        handleError(error, errorContext);
        return null;
    }
}
