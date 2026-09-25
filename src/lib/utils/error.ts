import { toast } from 'svelte-sonner';

/**
 * Hook de reporte de errores (p. ej. Sentry). Por defecto es no-op; la app
 * puede registrar un reporter en el arranque con `setErrorReporter`.
 */
let errorReporter: ((error: unknown, context: string) => void) | null = null;

export function setErrorReporter(fn: ((error: unknown, context: string) => void) | null) {
    errorReporter = fn;
}

function reportError(error: unknown, context: string) {
    try {
        errorReporter?.(error, context);
    } catch {
        // El reporter nunca debe romper el manejo de errores.
    }
}

export class AppError extends Error {
    constructor(
        public message: string,
        public code?: string,
        public originalError?: unknown,
    ) {
        super(message);
        this.name = 'AppError';
    }
}

const POSTGRES_ERROR_MESSAGES: Record<string, string> = {
    '23505': 'El registro ya existe (duplicado).',
    '23503': 'Operación no permitida: referencia a un registro inexistente.',
    '23502': 'Falta un campo obligatorio en el registro.',
    '23514': 'El valor no cumple la restricción de la base de datos.',
    '22001': 'El valor excede la longitud máxima permitida.',
    '22003': 'El valor sale del rango permitido.',
    '22023': 'El tipo de dato del valor no es válido.',
    '42501': 'No tienes permisos para realizar esta operación.',
    '42P01': 'La tabla o vista referenciada no existe.',
    '42703': 'La columna referenciada no existe.',
    '40001': 'Conflicto de concurrencia: reintenta la operación.',
};

export function handleError(error: unknown, context: string = 'An error occurred') {
    let message = 'Ha ocurrido un error inesperado.';
    let detail: string | undefined;

    if (error instanceof AppError) {
        message = error.message;
        if (error.code) detail = error.code;
    } else if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    } else if (error && typeof error === 'object') {
        const e = error as Record<string, any>;
        if (typeof e.message === 'string' && e.message.trim()) {
            message = e.message;
        }
        if (typeof e.details === 'string' && e.details.trim()) {
            detail = e.details;
        }
    }

    // Manejo específico de errores de Supabase/Postgres.
    if (error && typeof error === 'object') {
        const code = (error as any).code as string | undefined;
        if (code && POSTGRES_ERROR_MESSAGES[code]) {
            message = POSTGRES_ERROR_MESSAGES[code];
        }
    }

    if (error && typeof error === 'object' && 'isTimeout' in error) {
        message = 'La solicitud tardó demasiado. Por favor, verifique su conexión e intente nuevamente.';
    }

    // Supresión de duplicados: si este mismo error ya se notificó (por un wrapper
    // que re-lanza), el caller no debe mostrar otro toast.
    if (error && typeof error === 'object' && (error as Record<string, any>).__errorNotified) {
        return null;
    }
    if (error && typeof error === 'object') {
        (error as Record<string, any>).__errorNotified = true;
    }

    reportError(error, context);

    toast.error(context, {
        description: detail ? `${message} ${detail}`.trim() : message,
    });
    return null;
}

/**
 * Wraps an async function with try/catch + handleError.
 * Rethrows the error after handling (for fetch/query methods).
 */
export async function withErrorHandling<T>(fn: () => Promise<T>, context: string): Promise<T> {
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
    fallback: T,
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
    fallback: T,
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
            const error = new Error('Request timed out');
            (error as any).isTimeout = true;
            reject(error);
        }, timeoutMs);
    });

    return Promise.race([
        Promise.resolve(promise).finally(() => {
            clearTimeout(timeoutHandle);
        }),
        timeoutPromise,
    ]);
}

// ─── Reintentos con backoff ─────────────────────────────────────────────

export interface RetryOptions {
    /** Número de reintentos (además del intento inicial). @default 2 */
    retries?: number;
    /** Retardo base en ms. @default 300 */
    baseDelayMs?: number;
    /** Retardo máximo en ms. @default 4000 */
    maxDelayMs?: number;
    /** Decide si un error es reintentable. @default heurística de red/timeout */
    shouldRetry?: (error: unknown) => boolean;
    /** Callback informativo en cada reintento. */
    onRetry?: (attempt: number, error: unknown) => void;
}

/** Heurística: errores transitorios de red/timeout/5xx. */
export function isTransientError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const e = error as Record<string, any>;
    if (e.isTimeout) return true;
    const message = String(e.message ?? '').toLowerCase();
    if (
        message.includes('failed to fetch') ||
        message.includes('networkerror') ||
        message.includes('network error') ||
        message.includes('load failed') ||
        message.includes('timeout') ||
        message.includes('temporarily unavailable')
    ) {
        return true;
    }
    const code = e.code ?? e.status ?? e.statusCode;
    if (typeof code === 'number' && code >= 500) return true;
    if (typeof code === 'string' && ['503', '502', '504', '429'].includes(code)) return true;
    return false;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ejecuta `fn` reintentando ante errores transitorios con backoff exponencial
 * y jitter. Re-lanza el último error si se agotan los intentos.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const retries = options.retries ?? 2;
    const baseDelayMs = options.baseDelayMs ?? 300;
    const maxDelayMs = options.maxDelayMs ?? 4000;
    const shouldRetry = options.shouldRetry ?? isTransientError;

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt === retries || !shouldRetry(error)) throw error;
            options.onRetry?.(attempt + 1, error);
            const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
            const jitter = Math.random() * baseDelayMs;
            await delay(exp + jitter);
        }
    }
    throw lastError;
}
