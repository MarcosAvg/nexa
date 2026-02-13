<script lang="ts">
    import { supabase } from "../supabase";
    import Button from "./Button.svelte";
    import Input from "./Input.svelte";
    import Card from "./Card.svelte";
    import {
        LogIn,
        UserPlus,
        Mail,
        Lock,
        AlertCircle,
        ChevronLeft,
    } from "lucide-svelte";

    let email = $state("");
    let password = $state("");
    let fullName = $state("");
    let isSignUp = $state(false);
    let loading = $state(false);
    let errorMessage = $state("");
    let message = $state("");

    async function handleLogin(e: Event) {
        e.preventDefault();
        loading = true;
        errorMessage = "";
        message = "";

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            errorMessage = error.message;
        }
        loading = false;
    }

    async function handleAction(e: Event) {
        if (isSignUp) {
            handleSignUp(e);
        } else {
            handleLogin(e);
        }
    }

    async function handleSignUp(e: Event) {
        e.preventDefault();
        loading = true;
        errorMessage = "";
        message = "";

        if (!fullName.trim()) {
            errorMessage = "El nombre completo es requerido";
            loading = false;
            return;
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
            },
        });

        if (error) {
            errorMessage = error.message;
        } else if (data.user && data.session) {
            message = "¡Registro exitoso! Iniciando sesión...";
        } else {
            message =
                "Registro enviado. Por favor, verifica tu correo electrónico para confirmar tu cuenta.";
        }
        loading = false;
    }

    function toggleMode() {
        isSignUp = !isSignUp;
        errorMessage = "";
        message = "";
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
            <h1 class="text-3xl font-bold text-slate-900 tracking-tight">
                Nexa Control
            </h1>
            <p class="text-slate-500 mt-2">
                Gestión unificada de accesos y personal
            </p>
        </div>

        <Card
            class="p-8 shadow-xl border-slate-200/60 bg-white/80 backdrop-blur-sm"
        >
            <form onsubmit={handleAction} class="space-y-6">
                <div class="space-y-4">
                    {#if isSignUp}
                        <div
                            class="space-y-2 animate-in fade-in slide-in-from-top-2"
                        >
                            <label
                                for="fullName"
                                class="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1"
                            >
                                Nombre Completo
                            </label>
                            <div class="relative">
                                <div
                                    class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                >
                                    <UserPlus size={18} />
                                </div>
                                <input
                                    id="fullName"
                                    type="text"
                                    bind:value={fullName}
                                    placeholder="Nombre completo"
                                    class="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-700 focus:bg-white focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
                                    required={isSignUp}
                                />
                            </div>
                        </div>
                    {/if}

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
                            <input
                                id="email"
                                type="email"
                                bind:value={email}
                                placeholder="usuario@nexa.com"
                                class="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-700 focus:bg-white focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
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
                            <input
                                id="password"
                                type="password"
                                bind:value={password}
                                placeholder="••••••••"
                                class="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-700 focus:bg-white focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
                                required
                            />
                        </div>
                    </div>
                </div>

                {#if errorMessage}
                    <div
                        class="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2"
                    >
                        <AlertCircle class="text-rose-600 mt-0.5" size={18} />
                        <p class="text-xs font-medium text-rose-800">
                            {errorMessage}
                        </p>
                    </div>
                {/if}

                {#if message}
                    <div
                        class="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2"
                    >
                        <div class="text-emerald-600 mt-0.5">
                            <svg
                                class="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        </div>
                        <p class="text-xs font-medium text-emerald-800">
                            {message}
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
                        {isSignUp ? "Registrando..." : "Iniciando sesión..."}
                    {:else}
                        {isSignUp ? "Crear Cuenta" : "Entrar al Sistema"}
                    {/if}
                </Button>

                <div class="pt-2 text-center">
                    <button
                        type="button"
                        onclick={toggleMode}
                        class="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
                    >
                        {isSignUp
                            ? "¿Ya tienes cuenta? Inicia sesión"
                            : "¿No tienes cuenta? Regístrate"}
                    </button>
                </div>
            </form>
        </Card>

        <p class="text-center text-slate-400 text-xs mt-8">
            &copy; 2024 Nexa Control. Todos los derechos reservados.
        </p>
    </div>
</div>
