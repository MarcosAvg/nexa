import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Error: Credenciales de Supabase no encontradas en .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
