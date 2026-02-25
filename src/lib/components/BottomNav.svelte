<script lang="ts">
    import { link } from "svelte-spa-router";
    import active from "svelte-spa-router/active";
    import {
        LayoutDashboard,
        Users,
        CreditCard,
        ClipboardList,
        History,
        Settings,
    } from "lucide-svelte";

    const items = [
        { label: "Inicio", href: "/dashboard", icon: LayoutDashboard },
        { label: "Personal", href: "/personal", icon: Users },
        { label: "Tarjetas", href: "/cards", icon: CreditCard },
        { label: "Pendientes", href: "/tickets", icon: ClipboardList },
        { label: "Historial", href: "/history", icon: History },
        { label: "Ajustes", href: "/settings", icon: Settings },
    ];
</script>

<nav
    class="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-white/80 backdrop-blur-xl border-t border-slate-200/60 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
    style="padding-bottom: env(safe-area-inset-bottom, 0px);"
>
    <div class="flex items-stretch justify-around h-16">
        {#each items as item}
            <a
                href={item.href}
                use:link
                use:active={{
                    className: "active-bottom-nav",
                }}
                class="group relative flex flex-col items-center justify-center gap-0.5 flex-1 text-slate-400 transition-all duration-300"
            >
                <!-- Active indicator dot -->
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
    </div>
</nav>
