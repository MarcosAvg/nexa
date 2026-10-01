<script lang="ts">
    import { supabase } from '../supabase';
    import { Button, Input, Card } from '../components';
    import { LogIn, Mail, Lock, AlertCircle } from 'lucide-svelte';

    let email = $state('');
    let password = $state('');
    let loading = $state(false);
    let errorMessage = $state('');

    async function handleLogin(e: Event) {
        e.preventDefault();
        loading = true;
        errorMessage = '';

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            errorMessage = error.message;
        }
        loading = false;
    }
</script>

<div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
        <!-- Logo/Header -->
        <div class="text-center mb-8">
            <div
                class="inline-flex items-center justify-center w-16 h-16 bg-slate-900 text-white rounded-2xl mb-4 shadow-xl"
            >
                <LogIn size={32} />
            </div>
            <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Nexa Control</h1>
            <p class="text-slate-500 mt-2">Gestión unificada de accesos y personal</p>
        </div>

        <Card class="p-8 shadow-xl border-slate-200/60 bg-white/80 backdrop-blur-sm">
            <form onsubmit={handleLogin} class="space-y-6">
                <div class="space-y-4">
                    <div class="space-y-2">
                        <label
                            for="email"
                            class="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1"
                        >
                            Correo Electrónico
                        </label>
                        <div class="relative">
                            <div
                                class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            >
                                <Mail size={18} />
                            </div>
                            <Input
                                id="email"
                                type="email"
                                bind:value={email}
                                placeholder="usuario@nexa.com"
                                class="h-12 pl-11 text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label
                            for="password"
                            class="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1"
                        >
                            Contraseña
                        </label>
                        <div class="relative">
                            <div
                                class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            >
                                <Lock size={18} />
                            </div>
                            <Input
                                id="password"
                                type="password"
                                bind:value={password}
                                placeholder="••••••••"
                                class="h-12 pl-11 text-sm"
                                required
                            />
                        </div>
                    </div>
                </div>

                {#if errorMessage}
                    <div
                        role="alert"
                        aria-live="assertive"
                        class="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2"
                    >
                        <AlertCircle class="text-rose-600 mt-0.5" size={18} />
                        <p class="text-xs font-medium text-rose-800">
                            {errorMessage}
                        </p>
                    </div>
                {/if}

                <Button
                    variant="primary"
                    class="w-full h-12 rounded-xl text-base shadow-lg shadow-slate-900/10"
                    disabled={loading}
                    type="submit"
                >
                    {#if loading}
                        Iniciando sesión...
                    {:else}
                        Entrar al Sistema
                    {/if}
                </Button>

                <p class="pt-2 text-center text-xs font-medium text-slate-400">
                    El acceso es solo por invitación. Pide a un administrador que te registre.
                </p>
            </form>
        </Card>

        <p class="text-center text-slate-400 text-xs mt-8">
            &copy; 2024 Nexa Control. Todos los derechos reservados.
        </p>
    </div>
</div>
