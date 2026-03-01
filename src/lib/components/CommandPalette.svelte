<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { cardService } from "../services/cards";
    import { Search, User, CreditCard, FileText, X } from "lucide-svelte";
    import { personnelService } from "../services/personnel";
    import { personnelState } from "../stores";
    import { push } from "svelte-spa-router";

    let isOpen = $state(false);
    let query = $state("");
    let results = $state<any[]>([]);
    let isLoading = $state(false);
    let selectedIndex = $state(0);

    const navItems = [
        {
            title: "Dashboard / Inicio",
            path: "/",
            icon: FileText,
            category: "Navegación",
        },
        {
            title: "Directorio de Personal",
            path: "/personal",
            icon: User,
            category: "Navegación",
        },
        {
            title: "Inventario de Tarjetas",
            path: "/cards",
            icon: CreditCard,
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

    async function search() {
        isLoading = true;
        try {
            const [people, cards] = await Promise.all([
                personnelService.searchByName("", query),
                cardService.searchByFolio(query),
            ]);

            const peopleResults = people.slice(0, 4).map((p) => ({
                id: p.id,
                title: `${p.first_name} ${p.last_name}`,
                subtitle: `${p.employee_no || "S/E"} - ${p.dependency || "Sin dep."}`,
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
                    // Si tiene persona, mandarlo a Personnel View con ese id seleccionado
                    if (c.person_id) {
                        personnelState.selectPerson(c.person_id);
                        push("/personal");
                    } else {
                        // Sino, llevarlo a Cards View buscando su folio
                        push("/cards");
                        // Ideally we could set a filter store here, for now it will just route.
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
        ...navItems
            .filter((item) =>
                item.title.toLowerCase().includes(query.toLowerCase()),
            )
            .map((item) => ({
                ...item,
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
    }

    onMount(() => {
        window.addEventListener("keydown", handleKeydown);
    });

    onDestroy(() => {
        window.removeEventListener("keydown", handleKeydown);
    });
</script>

{#if isOpen}
    <!-- Backdrop -->
    <div
        class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] p-4 flex justify-center items-start pt-[8vh]"
        role="button"
        tabindex="-1"
        onclick={close}
        onkeydown={(e) => e.key === "Escape" && close()}
    >
        <div
            class="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            tabindex="-1"
            aria-modal="true"
            aria-label="Buscador Global"
            onclick={(e) => e.stopPropagation()}
        >
            <!-- Search Input -->
            <div
                class="flex items-center p-4 gap-3 border-b border-slate-100 bg-white"
            >
                <Search class="text-slate-400" size={20} />
                <input
                    type="text"
                    bind:value={query}
                    placeholder="Busca personal, folios o navegación... (Ctrl+K)"
                    class="flex-1 bg-transparent border-none outline-none text-slate-700 placeholder:text-slate-400 font-medium"
                    autofocus
                />
                <button
                    onclick={close}
                    class="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            <!-- Results -->
            <div class="max-h-[45vh] overflow-y-auto p-2 scrollbar-hide">
                {#if allResults.length > 0}
                    {#each allResults as item, i}
                        <button
                            class="w-full flex items-center gap-4 p-3 rounded-xl transition-all text-left {selectedIndex ===
                            i
                                ? 'bg-indigo-50 border-indigo-100'
                                : 'hover:bg-slate-50 border-transparent'} border"
                            onclick={() => executeAction(item)}
                            onmouseenter={() => (selectedIndex = i)}
                        >
                            <div
                                class="w-10 h-10 rounded-xl flex items-center justify-center {selectedIndex ===
                                i
                                    ? 'bg-indigo-100 text-indigo-600'
                                    : 'bg-slate-100 text-slate-500'} shrink-0"
                            >
                                <item.icon size={20} />
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between">
                                    <p
                                        class="text-sm font-bold text-slate-700 truncate"
                                    >
                                        {item.title}
                                    </p>
                                    <span
                                        class="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-2 shrink-0"
                                        >{item.category}</span
                                    >
                                </div>
                                {#if item.subtitle}
                                    <p
                                        class="text-[11px] text-slate-500 truncate"
                                    >
                                        {item.subtitle}
                                    </p>
                                {/if}
                            </div>
                        </button>
                    {/each}
                {:else if query.length > 2 && !isLoading}
                    <div class="p-12 text-center">
                        <div
                            class="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-3"
                        >
                            <Search size={24} />
                        </div>
                        <p class="text-sm text-slate-500">
                            No se encontraron resultados para "<span
                                class="font-bold">{query}</span
                            >"
                        </p>
                    </div>
                {:else if !query}
                    <div class="p-4">
                        <p
                            class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2"
                        >
                            Sugerencias
                        </p>
                        {#each navItems as item}
                            <button
                                class="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 text-left group"
                                onclick={() => {
                                    push(item.path);
                                    close();
                                }}
                            >
                                <item.icon
                                    size={16}
                                    class="text-slate-400 group-hover:text-indigo-500"
                                />
                                <span
                                    class="text-xs font-medium text-slate-600 group-hover:text-slate-900"
                                    >{item.title}</span
                                >
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Footer -->
            <div
                class="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between"
            >
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-1">
                        <span
                            class="text-[9px] font-bold text-slate-400 bg-white border border-slate-200 px-1 rounded shadow-sm"
                            >↵</span
                        >
                        <span class="text-[10px] text-slate-500"
                            >Seleccionar</span
                        >
                    </div>
                    <div class="flex items-center gap-1">
                        <span
                            class="text-[9px] font-bold text-slate-400 bg-white border border-slate-200 px-1 rounded shadow-sm"
                            >↑↓</span
                        >
                        <span class="text-[10px] text-slate-500">Navegar</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span
                            class="text-[9px] font-bold text-slate-400 bg-white border border-slate-200 px-1 rounded shadow-sm"
                            >ESC</span
                        >
                        <span class="text-[10px] text-slate-500">Cerrar</span>
                    </div>
                </div>
                <div class="text-[10px] text-slate-400 font-medium">
                    Nexa Command Palette
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

    @keyframes pulse-indigo {
        0%,
        100% {
            transform: scale(1);
        }
        50% {
            transform: scale(1.05);
        }
    }
</style>
