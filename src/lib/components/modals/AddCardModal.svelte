<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import Badge from "../Badge.svelte";
    import { personnelState } from "../../stores";
    import {
        Search,
        CreditCard,
        AlertCircle,
        CheckCircle2,
        PlusCircle,
        Ban,
        ArrowRight,
    } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import { cardService } from "../../services/cards";

    type Props = {
        isOpen: boolean;
        mode?: "assign" | "inventory";
        availableCards?: any[]; // Legacy prop
        replacingCard?: { type: string; folio: string; id: string } | null;
        /** If set, only these card types are selectable (e.g. ['P2000']) */
        allowedCardTypes?: string[] | null;
        onSave?: (
            card: { type: string; folio: string },
            replacementOptions?: { oldCardStatus: string },
        ) => void;
        onclose?: () => void;
    };

    let {
        isOpen = $bindable(),
        mode = "assign",
        replacingCard = null,
        allowedCardTypes = null,
        onSave,
        onclose,
    }: Props = $props();

    let personnel = $derived(personnelState.personnel);
    let extraCards = $derived(personnelState.extraCards);

    let cardType = $state<"P2000" | "KONE">("P2000");
    let searchQuery = $state("");
    let isSubmitting = $state(false);
    let confirmCreate = $state(false);
    let oldCardStatus = $state("blocked"); // blocked | available

    // Sync card type when replacing or when allowedCardTypes restricts to one type
    $effect(() => {
        if (replacingCard) {
            cardType = replacingCard.type as "P2000" | "KONE";
        } else if (allowedCardTypes?.length === 1) {
            cardType = allowedCardTypes[0] as "P2000" | "KONE";
        }
    });

    // List of cards in inventory filtered by type
    let filteredInventory = $derived.by(() => {
        return extraCards.filter(
            (c) =>
                c.type === cardType &&
                c.status !== "blocked" &&
                c.status !== "inactive",
        );
    });

    // Cards matching search in inventory
    let inventoryResults = $derived.by(() => {
        if (!searchQuery.trim()) return filteredInventory.slice(0, 10);
        return filteredInventory.filter((c) =>
            c.folio.toLowerCase().includes(searchQuery.toLowerCase()),
        );
    });

    // ─── Async search status (server-side lookup) ───────────────────────
    // Checks extraCards locally first, then queries Supabase for assigned cards.
    // This ensures ALL cards are checked, not just the paginated personnel subset.
    let searchStatus = $state<{
        type: "available" | "occupied" | "restricted" | "new";
        card?: any;
        owner?: string;
        status?: string;
    } | null>(null);
    let isSearching = $state(false);
    let searchDebounce: ReturnType<typeof setTimeout>;

    $effect(() => {
        const query = searchQuery.trim();
        const type = cardType;

        clearTimeout(searchDebounce);

        if (!query) {
            searchStatus = null;
            isSearching = false;
            return;
        }

        // 1. Quick local check — available cards (extraCards, no person_id)
        const inAvailable = extraCards.find(
            (c) => c.folio === query && c.type === type,
        );
        if (inAvailable) {
            if (
                inAvailable.status === "blocked" ||
                inAvailable.status === "inactive"
            ) {
                searchStatus = {
                    type: "restricted",
                    status: inAvailable.status,
                    card: inAvailable,
                };
            } else {
                searchStatus = { type: "available", card: inAvailable };
            }
            isSearching = false;
            return;
        }

        // 2. Debounced server lookup — checks ALL cards including assigned
        isSearching = true;
        searchDebounce = setTimeout(async () => {
            try {
                const result = await cardService.findByFolio(query, type);

                // Guard: query may have changed during fetch
                if (searchQuery.trim() !== query || cardType !== type) return;

                if (result) {
                    if (result.card.person_id && result.ownerName) {
                        searchStatus = {
                            type: "occupied",
                            owner: result.ownerName,
                            card: result.card,
                        };
                    } else if (
                        result.card.status === "blocked" ||
                        result.card.status === "inactive"
                    ) {
                        searchStatus = {
                            type: "restricted",
                            status: result.card.status,
                            card: result.card,
                        };
                    } else {
                        searchStatus = {
                            type: "available",
                            card: result.card,
                        };
                    }
                } else {
                    searchStatus = { type: "new" };
                }
            } catch {
                // On error, fall back to "new"
                searchStatus = { type: "new" };
            } finally {
                isSearching = false;
            }
        }, 300);
    });

    // Reset confirm when search or type changes
    $effect(() => {
        if (searchQuery || cardType) confirmCreate = false;
    });

    function resetAndClose() {
        searchQuery = "";
        confirmCreate = false;
        isOpen = false;
        onclose?.();
    }

    async function handleSave() {
        if (isSubmitting || !searchQuery.trim()) return;

        const status = searchStatus;
        if (!status) return;

        if (status.type === "occupied") {
            toast.error("Tarjeta Ocupada", {
                description: `El folio ${searchQuery} ya pertenece a ${status.owner}.`,
            });
            return;
        }

        if (status.type === "new" && !confirmCreate) {
            confirmCreate = true;
            return;
        }

        isSubmitting = true;
        try {
            // In inventory mode, we don't assign to a person.
            // In assign mode, we mark it as active.
            const savePayload: any = {
                type: cardType,
                folio: searchQuery.trim(),
                person_id: mode === "inventory" ? null : undefined,
                status: mode === "assign" ? "active" : "available",
            };

            // CRITICAL: If the card already exists in inventory, we MUST pass its ID
            // to update it instead of attempting to create a duplicate folio.
            if (status.type === "available" && status.card?.id) {
                savePayload.id = status.card.id;
            }

            // Pass replacement options if replacing
            if (replacingCard) {
                await onSave?.(savePayload, { oldCardStatus });
            } else {
                await onSave?.(savePayload);
            }

            if (mode === "inventory") {
                toast.success("Tarjeta Registrada", {
                    description: `El folio ${searchQuery} (${cardType}) se agregó al inventario.`,
                });
            } else if (status.type === "new") {
                toast.success("Nueva Tarjeta Registrada", {
                    description: `Se ha creado y asignado el folio ${searchQuery} (${cardType}).`,
                });
            } else if (replacingCard) {
                toast.success("Reposición Exitosa", {
                    description: `Se reemplazó la tarjeta ${replacingCard.folio} por ${searchQuery}.`,
                });
            } else {
                toast.success("Tarjeta Asignada", {
                    description: `Se vinculó el folio existente ${searchQuery} (${cardType}) y ahora está activa.`,
                });
            }

            resetAndClose();
        } catch (e) {
            toast.error("Error", {
                description:
                    mode === "inventory"
                        ? "No se pudo registrar la tarjeta."
                        : "No se pudo asignar la tarjeta.",
            });
        } finally {
            isSubmitting = false;
        }
    }
</script>

<Modal
    bind:isOpen
    title={replacingCard
        ? "Reponer Tarjeta"
        : mode === "inventory"
          ? "Nueva Tarjeta"
          : "Asignar Tarjeta"}
    description={replacingCard
        ? `Sustitución de tarjeta ${replacingCard.type} - ${replacingCard.folio}`
        : mode === "inventory"
          ? "Registre un nuevo folio en el inventario del sistema."
          : "Ingrese el folio para buscarlo en inventario o registrar uno nuevo."}
    size="md"
    onclose={resetAndClose}
>
    <div class="space-y-6">
        {#if replacingCard}
            <div
                class="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800"
            >
                <div
                    class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0"
                >
                    <CreditCard size={16} />
                </div>
                <div class="flex-1 min-w-0">
                    <p
                        class="text-xs font-bold uppercase tracking-wider opacity-70"
                    >
                        Reponiendo
                    </p>
                    <p class="font-bold truncate">
                        {replacingCard.type} · {replacingCard.folio}
                    </p>
                </div>
                <ArrowRight size={16} class="opacity-50" />
            </div>
        {/if}

        <!-- Type Selection with NEXA Colors -->
        <div class="space-y-2">
            <span
                class="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1"
                >Tipo de Acceso</span
            >
            <div class="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    disabled={!!replacingCard}
                    class="relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all {cardType ===
                    'P2000'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm'
                        : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:bg-slate-50'} {replacingCard &&
                    cardType !== 'P2000'
                        ? 'opacity-50 cursor-not-allowed'
                        : ''}"
                    onclick={() => {
                        if (!replacingCard) cardType = "P2000";
                    }}
                >
                    <span class="text-sm font-bold">P2000</span>
                    <span class="text-[10px] opacity-70"
                        >Puertas/Torniquetes</span
                    >
                    {#if cardType === "P2000"}
                        <div
                            class="absolute -top-2 -right-2 bg-amber-500 text-white rounded-full p-0.5"
                        >
                            <CheckCircle2 size={14} />
                        </div>
                    {/if}
                </button>

                <button
                    type="button"
                    disabled={!!replacingCard}
                    class="relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all {cardType ===
                    'KONE'
                        ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-sm'
                        : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:bg-slate-50'} {replacingCard &&
                    cardType !== 'KONE'
                        ? 'opacity-50 cursor-not-allowed'
                        : ''}"
                    onclick={() => {
                        if (!replacingCard) cardType = "KONE";
                    }}
                >
                    <span class="text-sm font-bold">KONE</span>
                    <span class="text-[10px] opacity-70">Elevadores</span>
                    {#if cardType === "KONE"}
                        <div
                            class="absolute -top-2 -right-2 bg-sky-500 text-white rounded-full p-0.5"
                        >
                            <CheckCircle2 size={14} />
                        </div>
                    {/if}
                </button>
            </div>
        </div>

        <!-- Old Card Status Selector (Only when replacing) -->
        {#if replacingCard}
            <div class="space-y-2 animate-in fade-in slide-in-from-top-2">
                <span
                    class="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1"
                >
                    Estado de Tarjeta Anterior
                </span>
                <div class="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        class="relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all {oldCardStatus ===
                        'blocked'
                            ? 'border-rose-500 bg-rose-50 text-rose-900 shadow-sm'
                            : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}"
                        onclick={() => (oldCardStatus = "blocked")}
                    >
                        <span class="text-xs font-bold">Baja Definitiva</span>
                        <span class="text-[9px] opacity-70"
                            >Bloquear (Robo/Extravío)</span
                        >
                        {#if oldCardStatus === "blocked"}
                            <div
                                class="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-0.5"
                            >
                                <CheckCircle2 size={12} />
                            </div>
                        {/if}
                    </button>

                    <button
                        type="button"
                        class="relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all {oldCardStatus ===
                        'available'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm'
                            : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}"
                        onclick={() => (oldCardStatus = "available")}
                    >
                        <span class="text-xs font-bold">Disponible</span>
                        <span class="text-[9px] opacity-70"
                            >Regresar a Inventario</span
                        >
                        {#if oldCardStatus === "available"}
                            <div
                                class="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-0.5"
                            >
                                <CheckCircle2 size={12} />
                            </div>
                        {/if}
                    </button>
                </div>
            </div>
        {/if}

        <!-- Smart Search Input -->
        <div class="space-y-3">
            <div class="relative">
                <div
                    class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                    <Search size={18} />
                </div>
                <input
                    type="text"
                    placeholder={mode === "inventory"
                        ? "Ingrese el folio a crear..."
                        : "Ingrese folio a buscar o crear..."}
                    bind:value={searchQuery}
                    class="w-full pl-10 pr-4 h-12 text-base font-bold border-2 border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all"
                    onkeydown={(e) => {
                        if (e.key === "Enter") handleSave();
                    }}
                />
            </div>

            <!-- Folio Results List (Only in assign mode) -->
            {#if mode === "assign"}
                <div
                    class="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm"
                >
                    {#if inventoryResults.length > 0}
                        <div
                            class="px-3 py-1.5 bg-slate-50 border-b border-slate-100"
                        >
                            <span
                                class="text-[9px] font-bold text-slate-400 uppercase tracking-widest"
                            >
                                Inventario {cardType} ({filteredInventory.length})
                            </span>
                        </div>
                        {#each inventoryResults as card}
                            <button
                                type="button"
                                class="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                                onclick={() => {
                                    searchQuery = card.folio;
                                    confirmCreate = false;
                                }}
                            >
                                <div class="flex items-center gap-2">
                                    <CreditCard
                                        size={14}
                                        class="text-slate-400"
                                    />
                                    <span
                                        class="text-sm font-bold text-slate-700"
                                        >{card.folio}</span
                                    >
                                </div>
                                <Badge variant="emerald">Disponible</Badge>
                            </button>
                        {/each}

                        {#if filteredInventory.length > 10 && !searchQuery}
                            <div class="px-4 py-2 text-center bg-slate-50/30">
                                <span class="text-[10px] text-slate-400 italic"
                                    >Usa el buscador para ver más...</span
                                >
                            </div>
                        {/if}
                    {:else if !searchQuery.trim()}
                        <div class="px-4 py-6 text-center">
                            <p class="text-sm text-slate-400 italic">
                                No hay tarjetas {cardType} disponibles en inventario.
                            </p>
                        </div>
                    {/if}
                </div>
            {/if}

            <!-- Real-time Status Feedback -->
            {#if searchQuery.trim()}
                <div
                    class="animate-in fade-in slide-in-from-top-2 duration-200"
                >
                    {#if isSearching}
                        <div
                            class="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100 text-slate-500"
                        >
                            <div
                                class="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"
                            ></div>
                            <span class="text-sm">Buscando folio...</span>
                        </div>
                    {:else if searchStatus?.type === "available"}
                        <div
                            class="flex items-center gap-3 p-3 rounded-lg {mode ===
                            'inventory'
                                ? 'bg-slate-100 border-slate-200 text-slate-600'
                                : 'bg-emerald-50 border-emerald-100 text-emerald-700'}"
                        >
                            {#if mode === "inventory"}
                                <AlertCircle size={18} />
                            {:else}
                                <CheckCircle2 size={18} />
                            {/if}
                            <div class="text-sm">
                                <p class="font-bold">
                                    {mode === "inventory"
                                        ? "Ya existe en inventario"
                                        : "Tarjeta Disponible"}
                                </p>
                                <p class="text-xs opacity-80">
                                    {mode === "inventory"
                                        ? "Este folio ya está registrado y disponible."
                                        : "Lista para ser asignada inmediatamente."}
                                </p>
                            </div>
                        </div>
                    {:else if searchStatus?.type === "occupied"}
                        <div
                            class="flex items-center gap-3 p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-700"
                        >
                            <AlertCircle size={18} />
                            <div class="text-sm">
                                <p class="font-bold">Folio Ocupado</p>
                                <p class="text-xs opacity-80">
                                    Esta tarjeta ya pertenece a <b
                                        >{searchStatus.owner}</b
                                    >.
                                </p>
                            </div>
                        </div>
                    {:else if searchStatus?.type === "restricted"}
                        <div
                            class="flex items-center gap-3 p-3 rounded-lg bg-slate-100 border border-slate-200 text-slate-600"
                        >
                            <Ban size={18} />
                            <div class="text-sm">
                                <p class="font-bold">Acceso Restringido</p>
                                <p class="text-xs opacity-80">
                                    Esta tarjeta tiene estado: <b
                                        class="uppercase"
                                        >{searchStatus.status === "blocked"
                                            ? "Bloqueada"
                                            : "No Disponible"}</b
                                    >.
                                </p>
                            </div>
                        </div>
                    {:else if searchStatus?.type === "new"}
                        <div
                            class="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-700"
                        >
                            <PlusCircle size={18} />
                            <div class="text-sm">
                                <p class="font-bold">Nuevo Registro</p>
                                <p class="text-xs opacity-80">
                                    El folio no existe. Se creará una nueva
                                    tarjeta en el sistema.
                                </p>
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>

        {#if confirmCreate}
            <div
                class="p-4 rounded-xl bg-slate-900 text-white space-y-2 animate-in pulse duration-500"
            >
                <div class="flex items-center gap-2">
                    <AlertCircle size={16} class="text-amber-400" />
                    <span class="text-xs font-bold uppercase tracking-widest"
                        >Confirmación de Seguridad</span
                    >
                </div>
                <p class="text-sm text-slate-300">
                    ¿Está seguro de que desea crear el folio <b>{searchQuery}</b
                    >
                    como una nueva tarjeta de tipo <b>{cardType}</b>?
                </p>
            </div>
        {/if}
    </div>

    {#snippet footer()}
        <Button variant="ghost" onclick={resetAndClose}>Cancelar</Button>
        <Button
            variant={confirmCreate
                ? "amber"
                : searchStatus?.type === "occupied" ||
                    searchStatus?.type === "restricted"
                  ? "ghost"
                  : "primary"}
            onclick={handleSave}
            loading={isSubmitting}
            class="px-8 min-w-[120px]"
            disabled={!searchQuery.trim() ||
                searchStatus?.type === "occupied" ||
                searchStatus?.type === "restricted" ||
                (searchStatus?.type === "available" && mode === "inventory")}
        >
            {#if confirmCreate}
                ¡Sí, crear!
            {:else if searchStatus?.type === "new"}
                Crear tarjeta
            {:else if searchStatus?.type === "occupied"}
                Ocupada
            {:else if searchStatus?.type === "restricted"}
                Restringida
            {:else if searchStatus?.type === "available" && mode === "inventory"}
                Existente
            {:else if replacingCard}
                Reponer
            {:else}
                Asignar
            {/if}
        </Button>
    {/snippet}
</Modal>
