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

    // Icons
    const sidebarItems = [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Personal", href: "/personal", icon: Users },
        { label: "Tarjetas", href: "/cards", icon: CreditCard },
        { label: "Pendientes", href: "/tickets", icon: ClipboardList },
        { label: "Historial", href: "/history", icon: History },
        { label: "Configuración", href: "/settings", icon: Settings },
    ];

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
</script>

<DashboardLayout {sidebarItems} user={currentUser} onLogout={handleLogout}>
    {@render children()}
</DashboardLayout>
