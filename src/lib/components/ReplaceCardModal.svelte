<script lang="ts">
    import Modal from "./Modal.svelte";
    import Button from "./Button.svelte";
    import Badge from "./Badge.svelte";
    import { appState } from "../state.svelte";
    import { RefreshCw, Trash2, ArrowRight, CheckCircle2 } from "lucide-svelte";

    type CardFolio = {
        folio: string;
        type: "P2000" | "KONE";
        status: "available" | "assigned" | "blocked";
        assignedTo?: string;
    };

    type Props = {
        isOpen: boolean;
        oldCard: any | null;
        availableCards?: any[];
        onConfirm?: (
            newCard: { type: string; folio: string },
            deleteOld: boolean,
        ) => Promise<void> | void;
        onclose?: () => void;
        loading?: boolean;
    };

    let {
        isOpen = $bindable(),
        oldCard,
        availableCards = [],
        onConfirm,
        onclose,
        loading = false,
    }: Props = $props();

    const { personnel } = $derived(appState);

    let searchQuery = $state("");
    let selectedFolio = $state<CardFolio | null>(null);
    let isNewFolio = $state(false);
    let deleteOld = $state(false);
    let isSuccess = $state(false);

    const allCards = $derived.by(() => {
        if (!oldCard) return [];
        const assigned = personnel.flatMap((p) =>
            (p.cards || []).map((c: any) => ({
                folio: c.folio,
                type: c.type,
                status: "assigned" as const,
                assignedTo: p.name,
            })),
        );
        const available = availableCards.map((c) => ({
            ...c,
            assignedTo: null,
        }));
        return [...available, ...assigned];
    });

    let filteredFolios = $derived.by(() => {
        if (!oldCard) return [];
        return allCards
            .filter((c) => c.type === oldCard.type)
            .filter((f) =>
                f.folio.toLowerCase().includes(searchQuery.toLowerCase()),
            );
    });

    function selectFolio(folio: CardFolio) {
        selectedFolio = folio;
        isNewFolio = false;
        searchQuery = folio.folio;
    }

    function createNewFolio() {
        if (searchQuery.trim() && oldCard) {
            const trimmedFolio = searchQuery.trim();
            // Check if this folio is already present in allCards
            const existing = allCards.find(
                (c) =>
                    c.folio.toLowerCase() === trimmedFolio.toLowerCase() &&
                    c.type === oldCard.type,
            );

            if (existing) {
                selectedFolio = existing;
                isNewFolio = false;
            } else {
                selectedFolio = {
                    folio: trimmedFolio,
                    type: oldCard.type,
                    status: "available",
                };
                isNewFolio = true;
            }
        }
    }

    async function handleConfirm() {
        if (selectedFolio && oldCard) {
            try {
                await onConfirm?.(
                    { type: oldCard.type, folio: selectedFolio.folio },
                    deleteOld,
                );
                isSuccess = true;
            } catch (e) {
                console.error("Replacement failed", e);
            }
        }
    }

    function resetAndClose() {
        searchQuery = "";
        selectedFolio = null;
        isNewFolio = false;
        deleteOld = false;
        isSuccess = false;
        isOpen = false;
        onclose?.();
    }

    function getStatusVariant(
        status: string,
    ): "emerald" | "amber" | "rose" | "slate" {
        switch (status) {
            case "available":
                return "emerald";
            case "assigned":
                return "rose";
            case "blocked":
                return "slate";
            default:
                return "amber";
        }
    }
</script>

<Modal
    bind:isOpen
    title="Reposición de Tarjeta"
    size="md"
    onclose={resetAndClose}
>
    <div class="space-y-6">
        {#if !isSuccess}
            <!-- Old Card Info -->
            {#if oldCard}
                <div
                    class="p-4 rounded-xl border border-slate-200 bg-slate-50/50"
                >
                    <span
                        class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2"
                        >Tarjeta Actual a Retirar</span
                    >
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div
                                class="p-2 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-400"
                            >
                                <RefreshCw size={18} />
                            </div>
                            <div>
                                <p class="text-sm font-bold text-slate-700">
                                    {oldCard.folio}
                                </p>
                                <p
                                    class="text-[10px] font-medium text-slate-500 uppercase"
                                >
                                    {oldCard.type}
                                </p>
                            </div>
                        </div>
                        <Badge variant="rose">Sustituir</Badge>
                    </div>
                </div>
            {/if}

            <div class="flex justify-center py-2">
                <div class="p-2 rounded-full bg-slate-100 text-slate-400">
                    <ArrowRight size={20} />
                </div>
            </div>

            <!-- New Card Selection -->
            <div class="space-y-4">
                <div class="space-y-2">
                    <span
                        class="text-xs font-bold text-slate-500 uppercase tracking-widest block"
                        >Buscar Nueva Tarjeta ({oldCard?.type})</span
                    >
                    <input
                        type="text"
                        class="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all"
                        placeholder="Escribe el folio de la nueva tarjeta..."
                        bind:value={searchQuery}
                        oninput={() => {
                            selectedFolio = null;
                            isNewFolio = false;
                        }}
                    />

                    <!-- Folio Results -->
                    <div
                        class="max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100"
                    >
                        {#if searchQuery && !selectedFolio}
                            {#each filteredFolios as folio}
                                <button
                                    type="button"
                                    class="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                                    onclick={() => selectFolio(folio)}
                                >
                                    <div class="flex flex-col">
                                        <span
                                            class="text-sm font-bold text-slate-700"
                                            >{folio.folio}</span
                                        >
                                        {#if folio.assignedTo}
                                            <span
                                                class="text-[10px] text-slate-500 font-medium"
                                                >Asignada a: {folio.assignedTo}</span
                                            >
                                        {/if}
                                    </div>
                                    <Badge
                                        variant={getStatusVariant(folio.status)}
                                    >
                                        {folio.status === "available"
                                            ? "Disponible"
                                            : folio.status === "assigned"
                                              ? "Asignada"
                                              : "Bloqueada"}
                                    </Badge>
                                </button>
                            {/each}

                            {#if filteredFolios.length === 0 || !filteredFolios.some((f) => f.folio.toLowerCase() === searchQuery.toLowerCase())}
                                <button
                                    type="button"
                                    class="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-50 transition-colors text-left"
                                    onclick={createNewFolio}
                                >
                                    <span
                                        class="text-sm font-medium text-slate-600"
                                    >
                                        Crear nuevo folio: <span
                                            class="font-bold text-slate-900"
                                            >{searchQuery}</span
                                        >
                                    </span>
                                    <Badge variant="blue">Nuevo</Badge>
                                </button>
                            {/if}
                        {:else if !searchQuery && !selectedFolio && oldCard}
                            <div
                                class="px-4 py-2 bg-slate-50 border-b border-slate-100"
                            >
                                <span
                                    class="text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                                >
                                    Invéntario Disponible ({availableCards.filter(
                                        (c) =>
                                            c.type === oldCard.type &&
                                            c.status === "available",
                                    ).length})
                                </span>
                            </div>
                            {#each availableCards
                                .filter((c) => c.type === oldCard.type && c.status === "available")
                                .slice(0, 10) as folio}
                                <button
                                    type="button"
                                    class="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                                    onclick={() => selectFolio(folio)}
                                >
                                    <span
                                        class="text-sm font-bold text-slate-700"
                                        >{folio.folio}</span
                                    >
                                    <Badge variant="emerald">Disponible</Badge>
                                </button>
                            {:else}
                                <div class="px-4 py-6 text-center">
                                    <p class="text-sm text-slate-400 italic">
                                        No hay tarjetas {oldCard.type} disponibles
                                        en el inventario.
                                    </p>
                                </div>
                            {/each}

                            {#if availableCards.filter((c) => c.type === oldCard.type).length > 10}
                                <div
                                    class="px-4 py-2 text-center bg-slate-50/50"
                                >
                                    <span
                                        class="text-[10px] font-medium text-slate-400 italic"
                                        >Usa el buscador para ver más...</span
                                    >
                                </div>
                            {/if}
                        {/if}
                    </div>
                </div>

                <!-- New Selection Status -->
                {#if selectedFolio}
                    <div
                        class="p-4 rounded-xl border-2 {isNewFolio
                            ? 'border-blue-200 bg-blue-50'
                            : selectedFolio.status === 'available'
                              ? 'border-emerald-200 bg-emerald-50'
                              : selectedFolio.status === 'assigned'
                                ? 'border-rose-200 bg-rose-50'
                                : 'border-slate-200 bg-slate-50'}"
                    >
                        <div class="flex items-center gap-3">
                            <Badge
                                variant={isNewFolio
                                    ? "blue"
                                    : getStatusVariant(selectedFolio.status)}
                            >
                                {isNewFolio
                                    ? "Folio Nuevo"
                                    : selectedFolio.status === "available"
                                      ? "Disponible"
                                      : selectedFolio.status === "assigned"
                                        ? "Asignada"
                                        : "Bloqueada"}
                            </Badge>
                            <span class="text-sm font-bold text-slate-700"
                                >{selectedFolio.folio}</span
                            >
                        </div>
                        <p
                            class="mt-2 text-xs font-medium {isNewFolio
                                ? 'text-blue-600'
                                : selectedFolio.status === 'available'
                                  ? 'text-emerald-600'
                                  : 'text-rose-600'}"
                        >
                            {#if isNewFolio}
                                Se registrará y asignará como la nueva tarjeta.
                            {:else if selectedFolio.status === "available"}
                                Tarjeta seleccionada para la reposición.
                            {:else if selectedFolio.status === "assigned"}
                                ⚠️ Esta tarjeta ya pertenece a: {selectedFolio.assignedTo}
                            {:else}
                                Esta tarjeta está bloqueada.
                            {/if}
                        </p>
                    </div>
                {/if}
            </div>

            <!-- Deletion Toggle -->
            <div class="pt-4 border-t border-slate-100">
                <label
                    class="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-slate-300 transition-colors"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="p-2 rounded-lg {deleteOld
                                ? 'bg-rose-50 text-rose-600'
                                : 'bg-slate-50 text-slate-400'} transition-colors"
                        >
                            <Trash2 size={18} />
                        </div>
                        <div>
                            <p class="text-sm font-bold text-slate-700">
                                Eliminar tarjeta anterior
                            </p>
                            <p class="text-[10px] font-medium text-slate-500">
                                ¿Deseas borrarla permanentemente?
                            </p>
                        </div>
                    </div>
                    <div
                        class="relative inline-flex items-center cursor-pointer"
                    >
                        <input
                            type="checkbox"
                            bind:checked={deleteOld}
                            class="sr-only peer"
                        />
                        <div
                            class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"
                        ></div>
                    </div>
                </label>
            </div>
        {/if}
    </div>

    {#if isSuccess}
        <div
            class="py-12 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300"
        >
            <div
                class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4"
            >
                <CheckCircle2 size={32} />
            </div>
            <h3 class="text-xl font-bold text-slate-900 mb-2">
                ¡Reposición Exitosa!
            </h3>
            <p class="text-sm text-slate-500 max-w-xs">
                Se ha asignado la nueva tarjeta <b>{selectedFolio?.folio}</b>
                correctamente. El sistema ha generado los tickets de seguimiento.
            </p>
        </div>
    {/if}

    {#snippet footer()}
        {#if !isSuccess}
            <Button variant="ghost" onclick={resetAndClose}>Cancelar</Button>
            <Button
                variant="primary"
                onclick={handleConfirm}
                {loading}
                disabled={!selectedFolio ||
                    selectedFolio.status === "blocked" ||
                    selectedFolio.status === "assigned"}
            >
                Confirmar Reposición
            </Button>
        {:else}
            <Button variant="primary" class="w-full" onclick={resetAndClose}
                >Finalizar</Button
            >
        {/if}
    {/snippet}
</Modal>
