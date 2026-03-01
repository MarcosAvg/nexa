<script lang="ts">
    import { push, location } from "svelte-spa-router";
    import { supabase } from "../supabase";
    import { uiState, userState } from "../stores";
    import DashboardLayout from "./DashboardLayout.svelte";
    import {
        LayoutDashboard,
        Users,
        CreditCard,
        ClipboardList,
        History,
        Settings,
    } from "lucide-svelte";
    import { onMount } from "svelte";

    // Navigation items filtered by role
    const sidebarItems = $derived.by(() => {
        const items = [
            { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
            { label: "Personal", href: "/personal", icon: Users },
            { label: "Tarjetas", href: "/cards", icon: CreditCard },
            { label: "Pendientes", href: "/tickets", icon: ClipboardList },
            { label: "Historial", href: "/history", icon: History },
        ];

        if (userState.isAdmin) {
            items.push({
                label: "Configuración",
                href: "/settings",
                icon: Settings,
            });
        }

        return items;
    });

    let { children } = $props();

    async function handleLogout() {
        await supabase.auth.signOut();
        // Router will handle redirect if we add a guard, or App.svelte will see no session
    }

    // Derived state for current user
    const currentUser = $derived.by(() => {
        if (!userState.profile) return undefined;
        return {
            name: userState.profile.full_name || "Usuario",
            email: userState.profile.email,
            avatar: userState.profile.avatar_url,
        };
    });

    // Sync active page with route for header title
    $effect(() => {
        const path = $location;
        if (path.includes("dashboard")) uiState.setActivePage("Dashboard");
        else if (path.includes("personal")) uiState.setActivePage("Personal");
        else if (path.includes("cards")) uiState.setActivePage("Tarjetas");
        else if (path.includes("tickets")) uiState.setActivePage("Pendientes");
        else if (path.includes("history")) uiState.setActivePage("Historial");
        else if (path.includes("settings"))
            uiState.setActivePage("Configuración");
    });
    import CommandPalette from "./CommandPalette.svelte";
    import { networkStore } from "../stores/network.svelte";
    import { WifiOff } from "lucide-svelte";
</script>

{#if !networkStore.isOnline}
    <div
        class="fixed top-0 left-0 right-0 z-[100] bg-red-500 text-white text-xs font-bold py-1.5 px-4 text-center flex items-center justify-center gap-2 shadow-sm animate-in slide-in-from-top"
    >
        <WifiOff size={14} />
        Modo Sin Conexión (Solo Lectura)
    </div>
{/if}

<DashboardLayout {sidebarItems} user={currentUser} onLogout={handleLogout}>
    {@render children()}
</DashboardLayout>

<CommandPalette />
