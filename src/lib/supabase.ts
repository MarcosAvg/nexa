import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Error: Credenciales de Supabase no encontradas en .env');
}

/**
 * Lock en memoria que sustituye al `navigator.locks` del navegador.
 *
 * Evita el error `LockAcquireTimeoutError` ("lock:sb-*auth-token" falló)
 * que se produce por contención del lock entre pestañas/contextos o al volver
 * de segundo plano. Serializa las operaciones por nombre sin expirar, de modo
 * que la app nunca lanza ese error no-fatal de Supabase Auth.
 */
const navLocks = new Map<string, Promise<unknown>>();

function inMemoryNavLock(
    name: string,
    _acquireTimeout: number,
    fn: () => Promise<unknown>,
): Promise<unknown> {
    const prev = navLocks.get(name) ?? Promise.resolve();
    const next = prev.then(() => fn()).finally(() => {
        if (navLocks.get(name) === next) navLocks.delete(name);
    });
    navLocks.set(name, next);
    return next;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Usa el lock en memoria en lugar del `navigator.locks` del navegador,
        // que es lo que provoca el LockAcquireTimeoutError no-fatal.
        lock: inMemoryNavLock as any,
    },
});

export const auth = {
    async signIn(email: string) {
        // Usando Magic Links por simplicidad y seguridad si está configurado, 
        // or password if the user prefers. Let's start with a generic signIn.
        const { error } = await supabase.auth.signInWithOtp({ email });
        return { error };
    },
    async signOut() {
        const { error } = await supabase.auth.signOut();
        return { error };
    },
    onAuthStateChange(callback: (session: any) => void) {
        return supabase.auth.onAuthStateChange((_event, session) => {
            callback(session);
        });
    },
    async getProfile(userId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        return { data, error };
    }
};
