<script lang="ts">
    import { link } from "svelte-spa-router";
    import active from "svelte-spa-router/active";
    import { uiState, userState } from "../stores";
    import { supabase } from "../supabase";
    import { MoreHorizontal, Search, X, LogOut, Wrench } from "lucide-svelte";
    import { slide } from "svelte/transition";

    type NavItem = { label: string; href: string; icon?: any };

    let { items = [] }: { items?: NavItem[] } = $props();

    // Se muestran hasta 4 destinos como acceso directo; el resto vive en "Más".
    const primaryItems = $derived(items.slice(0, 4));
    const moreItems = $derived(items.slice(4));

    function openSearch() {
        uiState.closeMoreMenu();
        uiState.openCommandPalette();
    }

    function closeMore() {
        uiState.closeMoreMenu();
    }

    async function handleLogout() {
        uiState.closeMoreMenu();
        await supabase.auth.signOut();
    }
</script>

<nav
    class="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-white/80 backdrop-blur-xl border-t border-slate-200/60 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
    style="padding-bottom: env(safe-area-inset-bottom, 0px);"
>
    <div class="flex items-stretch justify-around h-16">
        {#each primaryItems as item}
            <a
                href={item.href}
                use:link
                use:active={{
                    className: "active-bottom-nav",
                }}
                class="group relative flex flex-col items-center justify-center gap-0.5 flex-1 text-slate-400 transition-all duration-300"
            >
                <!-- Punto indicador activo -->
                <div
                    class="absolute top-1 w-1 h-1 rounded-full bg-blue-500 transition-all duration-300 scale-0 group-[.active-bottom-nav]:scale-100 opacity-0 group-[.active-bottom-nav]:opacity-100"
                ></div>

                <div
                    class="transition-all duration-300 group-[.active-bottom-nav]:text-blue-600 group-[.active-bottom-nav]:scale-110 group-hover:text-slate-600"
                >
                    <item.icon size={22} strokeWidth={2} />
                </div>
                <span
                    class="text-[10px] font-bold tracking-tight transition-colors duration-300 group-[.active-bottom-nav]:text-blue-600 group-[.active-bottom-nav]:font-extrabold group-hover:text-slate-600"
                >
                    {item.label}
                </span>
            </a>
        {/each}

        <!-- Botón de menú dinámico -->
        <button
            type="button"
            onclick={() => uiState.toggleMoreMenu()}
            class="group relative flex flex-col items-center justify-center gap-0.5 flex-1 text-slate-400 transition-all duration-300 hover:text-slate-600"
            aria-haspopup="dialog"
            aria-expanded={uiState.isMoreMenuOpen}
        >
            <!-- Punto indicador activo (se muestra cuando la hoja está abierta) -->
            <div
                class="absolute top-1 w-1 h-1 rounded-full bg-blue-500 transition-all duration-300 {uiState.isMoreMenuOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}"
            ></div>

            <div
                class="transition-all duration-300 {uiState.isMoreMenuOpen ? 'text-blue-600 scale-110' : ''}"
            >
                <MoreHorizontal size={22} strokeWidth={2} />
            </div>
            <span
                class="text-[10px] font-bold tracking-tight transition-colors duration-300 {uiState.isMoreMenuOpen ? 'text-blue-600 font-extrabold' : ''}"
            >
                Más
            </span>
        </button>
    </div>
</nav>

<!-- Hoja "Más": buscador global + secciones fuera del acceso directo -->
{#if uiState.isMoreMenuOpen}
    <button
        type="button"
        class="fixed inset-0 z-50 lg:hidden bg-slate-900/50 backdrop-blur-sm"
        onclick={closeMore}
        aria-label="Cerrar menú"
    ></button>

    <div
        class="fixed z-50 lg:hidden bottom-0 inset-x-0 max-h-[88dvh] overflow-y-auto overscroll-contain bg-white rounded-t-[28px] border-t border-slate-200 shadow-2xl pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]"
        role="dialog"
        aria-modal="true"
        aria-label="Más opciones"
        transition:slide={{ duration: 250 }}
    >
        <div class="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1"></div>

        <div class="flex items-center justify-between px-5 pt-2 pb-3">
            <h2 class="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Más opciones
            </h2>
            <button
                type="button"
                onclick={closeMore}
                class="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
                aria-label="Cerrar"
            >
                <X size={20} strokeWidth={2.5} />
            </button>
        </div>

        <!-- Buscador global -->
        <div class="px-4 pb-3">
            <button
                type="button"
                onclick={openSearch}
                class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-100 text-slate-500 font-semibold active:scale-[0.98] transition-all"
            >
                <Search size={20} strokeWidth={2.5} />
                <span>Buscar personal, tarjetas...</span>
            </button>
        </div>

        <!-- Secciones adicionales -->
        <nav class="px-4 grid grid-cols-2 gap-2.5">
            {#each moreItems as item}
                <a
                    href={item.href}
                    use:link
                    onclick={closeMore}
                    class="flex items-center gap-3 px-4 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-700 font-bold text-sm active:scale-[0.98] transition-all hover:bg-slate-100"
                >
                    {#if item.icon}
                        <span class="text-slate-500">
                            <item.icon size={20} strokeWidth={2.4} />
                        </span>
                    {/if}
                    <span class="truncate">{item.label}</span>
                </a>
            {/each}
        </nav>

        <!-- Sesión y utilidades -->
        <div class="px-4 pt-4 mt-4 border-t border-slate-100 space-y-2.5">
            {#if userState.profile}
                <div class="flex items-center gap-3 px-2">
                    <div
                        class="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-extrabold overflow-hidden"
                    >
                        {#if userState.profile.avatar_url}
                            <img
                                src={userState.profile.avatar_url}
                                alt={userState.profile.full_name || "Usuario"}
                                class="h-full w-full object-cover"
                            />
                        {:else}
                            <span class="text-sm">
                                {(userState.profile.full_name || "U").charAt(0).toUpperCase()}
                            </span>
                        {/if}
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-extrabold text-slate-800 truncate">
                            {userState.profile.full_name || "Usuario"}
                        </p>
                        <p class="text-[11px] font-medium text-slate-400 truncate">
                            {userState.profile.email}
                        </p>
                    </div>
                </div>
            {/if}

            {#if userState.profile?.role === "admin"}
                <button
                    type="button"
                    onclick={() => uiState.toggleDirectEditMode()}
                    class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98] {uiState.isDirectEditMode
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-slate-50 border-slate-100 text-slate-600'}"
                >
                    <Wrench size={18} strokeWidth={2.5} />
                    <span class="text-sm font-bold">Editor Directo</span>
                    <span class="ml-auto text-[11px] font-extrabold uppercase tracking-wider">
                        {uiState.isDirectEditMode ? "Activo" : "Inactivo"}
                    </span>
                </button>
            {/if}

            <button
                type="button"
                onclick={handleLogout}
                class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 active:scale-[0.98] transition-all"
            >
                <LogOut size={18} strokeWidth={2.5} />
                <span class="text-sm font-bold">Cerrar sesión</span>
            </button>
        </div>
    </div>
{/if}
