import { toast } from "svelte-sonner";

export class AppError extends Error {
    constructor(
        public message: string,
        public code?: string,
        public originalError?: unknown
    ) {
        super(message);
        this.name = "AppError";
    }
}

export function handleError(error: unknown, context: string = "An error occurred") {
    let message = "Ha ocurrido un error inesperado.";

    if (error instanceof AppError) {
        message = error.message;
    } else if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === "string") {
        message = error;
    }

    // Manejo de errores específico de Supabase
    if (error && typeof error === 'object' && 'code' in error) {
        switch (error.code) {
            case "23505":    // Violación de unicidad
                message = "El registro ya existe (duplicado).";
                break;
            case "23503":    // Violación de clave foránea
                message = "Operación no permitida: referencia a un registro inexistente.";
                break;
            // Añadir más códigos según sea necesario
        }
    }

    if (error && typeof error === 'object' && 'isTimeout' in error) {
        message = "La solicitud tardó demasiado. Por favor, verifique su conexión e intente nuevamente.";
    }

    toast.error(message);
    return null;
}

/**
 * Wraps an async function with try/catch + handleError.
 * Rethrows the error after handling (for fetch/query methods).
 */
export async function withErrorHandling<T>(
    fn: () => Promise<T>,
    context: string
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        handleError(error, context);
        throw error;
    }
}

/**
 * Wraps an async function with try/catch + handleError.
 * Returns a fallback value on error (for create/update/delete methods).
 */
export async function withErrorHandlingSafe<T>(
    fn: () => Promise<T>,
    context: string,
    fallback: T
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        handleError(error, context);
        return fallback;
    }
}

/**
 * Wraps an async function with try/catch + handleError.
 * Conditionally rethrows based on a throwOnError flag.
 * Use for methods that accept a throwOnError parameter.
 */
export async function withErrorHandlingConditional<T>(
    fn: () => Promise<T>,
    context: string,
    throwOnError: boolean,
    fallback: T
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        handleError(error, context);
        if (throwOnError) throw error;
        return fallback;
    }
}

export async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number = 15000): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
            const error = new Error("Request timed out");
            (error as any).isTimeout = true;
            reject(error);
        }, timeoutMs);
    });

    return Promise.race([
        Promise.resolve(promise).finally(() => {
            clearTimeout(timeoutHandle);
        }),
        timeoutPromise
    ]);
}
