import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Error: Credenciales de Supabase no encontradas en .env');
} else {
    console.log('📡 Supabase conectado a:', supabaseUrl);
    console.log('🔑 Anon Key presente:', !!supabaseAnonKey);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const auth = {
    async signIn(email: string) {
        // Using Magic Links for simplicity and security if configured, 
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
