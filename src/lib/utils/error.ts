import { toast } from "svelte-sonner";

export class AppError extends Error {
    constructor(
        public message: string,
        public code?: string,
        public originalError?: any
    ) {
        super(message);
        this.name = "AppError";
    }
}

export function handleError(error: any, context: string = "An error occurred") {
    console.error(`[${context}]`, error);

    let message = "Ha ocurrido un error inesperado.";

    if (error instanceof AppError) {
        message = error.message;
    } else if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === "string") {
        message = error;
    }

    // Supabase specific error handling
    if (error?.code) {
        switch (error.code) {
            case "23505": // Unique violation
                message = "El registro ya existe (duplicado).";
                break;
            case "23503": // Foreign key violation
                message = "Operación no permitida: referencia a un registro inexistente.";
                break;
            // Add more codes as needed
        }
    }

    if (error?.isTimeout) {
        message = "La solicitud tardó demasiado. Por favor, verifique su conexión e intente nuevamente.";
    }

    toast.error(message);
    return null;
}

export async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number = 15000): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
            const error: any = new Error("Request timed out");
            error.isTimeout = true;
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
