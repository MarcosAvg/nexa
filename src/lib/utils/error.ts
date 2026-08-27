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

const POSTGRES_ERROR_MESSAGES: Record<string, string> = {
    "23505": "El registro ya existe (duplicado).",
    "23503": "Operación no permitida: referencia a un registro inexistente.",
    "23502": "Falta un campo obligatorio en el registro.",
    "23514": "El valor no cumple la restricción de la base de datos.",
    "22001": "El valor excede la longitud máxima permitida.",
    "22003": "El valor sale del rango permitido.",
    "22023": "El tipo de dato del valor no es válido.",
    "42501": "No tienes permisos para realizar esta operación.",
    "42P01": "La tabla o vista referenciada no existe.",
    "42703": "La columna referenciada no existe.",
    "40001": "Conflicto de concurrencia: reintenta la operación.",
};

export function handleError(error: unknown, context: string = "An error occurred") {
    let message = "Ha ocurrido un error inesperado.";
    let detail: string | undefined;

    if (error instanceof AppError) {
        message = error.message;
        if (error.code) detail = error.code;
    } else if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === "string") {
        message = error;
    } else if (error && typeof error === "object") {
        const e = error as Record<string, any>;
        if (typeof e.message === "string" && e.message.trim()) {
            message = e.message;
        }
        if (typeof e.details === "string" && e.details.trim()) {
            detail = e.details;
        }
    }

    // Manejo específico de errores de Supabase/Postgres.
    if (error && typeof error === "object") {
        const code = (error as any).code as string | undefined;
        if (code && POSTGRES_ERROR_MESSAGES[code]) {
            message = POSTGRES_ERROR_MESSAGES[code];
        }
    }

    if (error && typeof error === "object" && "isTimeout" in error) {
        message = "La solicitud tardó demasiado. Por favor, verifique su conexión e intente nuevamente.";
    }

    // Supresión de duplicados: si este mismo error ya se notificó (por un wrapper
    // que re-lanza), el caller no debe mostrar otro toast.
    if (
        error &&
        typeof error === "object" &&
        (error as Record<string, any>).__errorNotified
    ) {
        return null;
    }
    if (error && typeof error === "object") {
        (error as Record<string, any>).__errorNotified = true;
    }

    toast.error(context, {
        description: detail ? `${message} ${detail}`.trim() : message,
    });
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
