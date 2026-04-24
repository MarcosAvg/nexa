<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { cardService } from "../services/cards";
    import {
        Search,
        User,
        CreditCard,
        FileText,
        X,
        ClipboardList,
        PlusCircle,
        Zap,
        Settings,
        History,
        Link2,
        Loader2,
        ChevronRight
    } from "lucide-svelte";
    import { personnelService } from "../services/personnel";
    import { personnelState } from "../stores";
    import { push } from "svelte-spa-router";

    let isOpen = $state(false);
    let query = $state("");
    let results = $state<any[]>([]);
    let isLoading = $state(false);
    let selectedIndex = $state(0);
    let inputElement = $state<HTMLInputElement | null>(null);

    // Auto-focus input when opening
    $effect(() => {
        if (isOpen && inputElement) {
            // Using a tiny timeout to ensure the "animate-in" transition doesn't interfere with focus
            const timer = setTimeout(() => {
                inputElement?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    });

    const quickActions = [
        {
            title: "Nueva Alta de Personal",
            subtitle: "Registrar un nuevo colaborador",
            icon: PlusCircle,
            category: "Acción",
            action: () => {
                personnelState.openEditModal(null);
                close();
            },
        },
        {
            title: "Gestión de Enlaces",
            subtitle: "Administrar responsables por área",
            icon: Link2,
            category: "Acción",
            action: () => {
                push("/enlaces");
                close();
            },
        },
        {
            title: "Configuración del Sistema",
            subtitle: "Catálogos y preferencias",
            icon: Settings,
            category: "Navegación",
            action: () => {
                push("/settings");
                close();
            },
        }
    ];

    const navItems = [
        {
            title: "Dashboard",
            path: "/",
            icon: Zap,
            category: "Navegación",
        },
        {
            title: "Personal",
            path: "/personal",
            icon: User,
            category: "Navegación",
        },
        {
            title: "Inventario",
            path: "/cards",
            icon: CreditCard,
            category: "Navegación",
        },
        {
            title: "Tickets",
            path: "/tickets",
            icon: ClipboardList,
            category: "Navegación",
        },
        {
            title: "Auditoría",
            path: "/history",
            icon: History,
            category: "Navegación",
        },
    ];

    $effect(() => {
        if (query.trim().length > 2) {
            search();
        } else {
            results = [];
        }
    });

    // Reset selection when results change
    $effect(() => {
        if (allResults.length > 0 && selectedIndex >= allResults.length) {
            selectedIndex = 0;
        }
    });

    async function search() {
        isLoading = true;
        try {
            const [people, cards] = await Promise.all([
                personnelService.searchByName("", query),
                cardService.searchByFolio(query),
            ]);

            const peopleResults = people.slice(0, 5).map((p) => ({
                id: p.id,
                title: `${p.first_name} ${p.last_name}`,
                subtitle: `${p.employee_no || "S/E"} • ${p.dependency || "Sin dep."}`,
                icon: User,
                category: "Personal",
                action: () => {
                    personnelState.selectPerson(p.id);
                    push("/personal");
                    close();
                },
            }));

            const cardResults = cards.map((c: any) => ({
                id: c.id,
                title: `Folio: ${c.folio} (${c.type})`,
                subtitle: c.person_id
                    ? `Asignada a: ${c.personnel?.first_name} ${c.personnel?.last_name}`
                    : "Disponible en inventario",
                icon: CreditCard,
                category: "Tarjeta",
                action: () => {
                    if (c.person_id) {
                        personnelState.selectPerson(c.person_id);
                        push("/personal");
                    } else {
                        push("/cards");
                    }
                    close();
                },
            }));

            results = [...peopleResults, ...cardResults];
        } catch (e) {
            console.error(e);
        } finally {
            isLoading = false;
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if ((e.ctrlKey || e.metaKey) && e.key === "k") {
            e.preventDefault();
            isOpen = !isOpen;
            if (isOpen) {
                query = "";
                selectedIndex = 0;
            }
        }

        if (!isOpen) return;

        if (e.key === "Escape") {
            close();
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % (allResults.length || 1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            selectedIndex =
                (selectedIndex - 1 + allResults.length) %
                (allResults.length || 1);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (allResults[selectedIndex]) {
                executeAction(allResults[selectedIndex]);
            }
        }
    }

    const allResults = $derived([
        ...quickActions
            .filter((item) =>
                item.title.toLowerCase().includes(query.toLowerCase()) ||
                item.subtitle.toLowerCase().includes(query.toLowerCase())
            ),
        ...navItems
            .filter((item) =>
                item.title.toLowerCase().includes(query.toLowerCase())
            )
            .map((item) => ({
                ...item,
                subtitle: `Ir a ${item.title}`,
                action: () => {
                    push(item.path);
                    close();
                },
            })),
        ...results,
    ]);

    function executeAction(item: any) {
        item.action();
    }

    function close() {
        isOpen = false;
        query = "";
        results = [];
        selectedIndex = 0;
    }

    onMount(() => {
        window.addEventListener("keydown", handleKeydown);
    });

    onDestroy(() => {
        window.removeEventListener("keydown", handleKeydown);
    });
</script>

{#if isOpen}
    <!-- Backdrop with premium blur -->
    <div
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] p-4 flex justify-center items-start pt-[12vh]"
        role="button"
        tabindex="-1"
        onclick={close}
        onkeydown={(e) => e.key === "Escape" && close()}
    >
        <div
            class="w-full max-w-2xl bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.3)] border border-white/20 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            tabindex="-1"
            aria-modal="true"
            aria-label="Buscador Global"
            onclick={(e) => e.stopPropagation()}
        >
            <!-- Search Bar -->
            <div class="relative group">
                <div class="flex items-center px-6 py-5 gap-4">
                    <Search class="text-indigo-500 group-focus-within:scale-110 transition-transform" size={22} />
                    <input
                        bind:this={inputElement}
                        type="text"
                        bind:value={query}
                        placeholder="Busca personal, tarjetas, comandos..."
                        class="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400 text-lg font-medium"
                    />
                    {#if isLoading}
                        <Loader2 class="animate-spin text-indigo-500" size={20} />
                    {:else if query}
                        <button onclick={() => query = ""} class="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={20} />
                        </button>
                    {/if}
                    <div class="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg border border-slate-200/50 shrink-0">
                        <span class="text-[10px] font-bold text-slate-500">ESC</span>
                    </div>
                </div>
                
                <!-- Subtle loading progress bar -->
                {#if isLoading}
                    <div class="absolute bottom-0 left-0 h-[2px] bg-indigo-500 animate-progress-indefinite w-full"></div>
                {/if}
            </div>

            <!-- Results List -->
            <div class="max-h-[50vh] overflow-y-auto p-3 scrollbar-hide">
                {#if allResults.length > 0}
                    {#each allResults as item, i}
                        {@const isSelected = selectedIndex === i}
                        <button
                            class="w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all text-left relative group/item {isSelected
                                ? 'bg-indigo-600 shadow-lg shadow-indigo-200 translate-x-1'
                                : 'hover:bg-slate-50 border-transparent'}"
                            onclick={() => executeAction(item)}
                            onmouseenter={() => (selectedIndex = i)}
                        >
                            <!-- Icon Wrapper -->
                            <div
                                class="w-11 h-11 rounded-xl flex items-center justify-center transition-colors {isSelected
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-100 text-slate-500 group-hover/item:bg-white group-hover/item:text-indigo-600 group-hover/item:shadow-sm'} shrink-0"
                            >
                                <item.icon size={22} />
                            </div>

                            <!-- Content -->
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between gap-2">
                                    <p class="text-sm font-bold truncate {isSelected ? 'text-white' : 'text-slate-700'}">
                                        {item.title}
                                    </p>
                                    <span class="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 {isSelected 
                                        ? 'bg-white/20 text-white' 
                                        : 'bg-slate-100 text-slate-400'}">
                                        {item.category}
                                    </span>
                                </div>
                                {#if item.subtitle}
                                    <p class="text-[11px] mt-0.5 truncate {isSelected ? 'text-indigo-100' : 'text-slate-500'}">
                                        {item.subtitle}
                                    </p>
                                {/if}
                            </div>

                            <!-- Arrow indicator on select -->
                            {#if isSelected}
                                <ChevronRight size={16} class="text-white/70 animate-in slide-in-from-left-2" />
                            {/if}
                        </button>
                    {/each}
                {:else if query.length > 0 && !isLoading}
                    <div class="py-16 flex flex-col items-center justify-center text-center">
                        <div class="w-16 h-16 bg-slate-50 text-slate-200 rounded-3xl flex items-center justify-center mb-4 border border-dashed border-slate-200">
                            <Search size={32} />
                        </div>
                        <h3 class="text-slate-900 font-bold">Sin coincidencias</h3>
                        <p class="text-sm text-slate-500 mt-1 max-w-[200px]">
                            No encontramos nada para "<span class="text-indigo-600 font-semibold">{query}</span>"
                        </p>
                    </div>
                {:else if !query}
                    <!-- Suggestions / Quick Links when empty -->
                    <div class="p-2">
                        <div class="flex items-center gap-2 px-3 mb-3">
                            <Zap size={14} class="text-amber-500 fill-amber-500" />
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Sugerencias rápidas</span>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {#each navItems as item}
                                <button
                                    class="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all text-left group"
                                    onclick={() => {
                                        push(item.path);
                                        close();
                                    }}
                                >
                                    <div class="p-2 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-white group-hover:text-indigo-600 group-hover:shadow-sm transition-all">
                                        <item.icon size={18} />
                                    </div>
                                    <div class="flex-1">
                                        <p class="text-xs font-bold text-slate-600 group-hover:text-slate-900">{item.title}</p>
                                        <p class="text-[10px] text-slate-400">Navegación rápida</p>
                                    </div>
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Enhanced Footer -->
            <div class="px-6 py-4 bg-slate-50/80 backdrop-blur-sm border-t border-slate-100 flex items-center justify-between">
                <div class="flex items-center gap-5">
                    <div class="flex items-center gap-2">
                        <kbd class="px-1.5 py-0.5 rounded border border-slate-300 bg-white text-[10px] font-bold text-slate-500 shadow-sm">↵</kbd>
                        <span class="text-[10px] font-medium text-slate-400">Ejecutar</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <kbd class="px-1.5 py-0.5 rounded border border-slate-300 bg-white text-[10px] font-bold text-slate-500 shadow-sm">↑↓</kbd>
                        <span class="text-[10px] font-medium text-slate-400">Navegar</span>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nexa Live Search</span>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }
    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }

    @keyframes progress-indefinite {
        0% { transform: translateX(-100%); width: 30%; }
        50% { transform: translateX(50%); width: 50%; }
        100% { transform: translateX(100%); width: 30%; }
    }
    .animate-progress-indefinite {
        animation: progress-indefinite 1.5s infinite linear;
    }
</style>

