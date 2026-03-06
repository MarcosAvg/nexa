<script lang="ts">
    import Modal from "../Modal.svelte";
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import { personnelService } from "../../services/personnel";
    import { enlaceService } from "../../services/enlaces";
    import { Search, UserPlus } from "lucide-svelte";
    import { toast } from "svelte-sonner";

    type Props = {
        isOpen: boolean;
        onComplete: () => void;
    };

    let { isOpen = $bindable(), onComplete }: Props = $props();

    let searchQuery = $state("");
    let selectedPersonId = $state("");
    let selectedPersonName = $state("");
    let extension = $state("");
    let isSubmitting = $state(false);

    let searchResults = $state<any[]>([]);
    let searchDebounce: ReturnType<typeof setTimeout>;

    function handleSearchInput(e: Event) {
        const val = (e.target as HTMLInputElement).value;
        searchQuery = val;

        clearTimeout(searchDebounce);

        if (val.trim().length > 2) {
            searchDebounce = setTimeout(async () => {
                try {
                    const results = await personnelService.searchByName(
                        "",
                        val,
                    );
                    if (searchQuery.trim() === val) {
                        searchResults = results.slice(0, 5);
                    }
                } catch (err) {
                    console.error("Search failed:", err);
                }
            }, 300);
        } else {
            searchResults = [];
        }
    }

    function selectPerson(p: any) {
        selectedPersonId = p.id;
        selectedPersonName = `${p.first_name} ${p.last_name}`;
        searchQuery = "";
    }

    function reset() {
        searchQuery = "";
        selectedPersonId = "";
        selectedPersonName = "";
        extension = "";
        isOpen = false;
    }

    async function handleSave() {
        if (!selectedPersonId || !extension.trim() || isSubmitting) return;

        isSubmitting = true;
        try {
            await enlaceService.add(selectedPersonId, extension.trim());
            toast.success("Enlace Asignado", {
                description: "Se ha agregado el contacto correctamente.",
            });
            onComplete();
            reset();
        } catch (error: any) {
            toast.error("Error", {
                description: error.message || "No se pudo asignar el enlace.",
            });
        } finally {
            isSubmitting = false;
        }
    }
</script>

<Modal
    bind:isOpen
    title="Asignar Enlace Administrativo"
    description="Busque un personal y asigne su extensión."
    size="md"
    onclose={reset}
>
    <!-- Se agrega min-h-[300px] para que el modal sea un poco más alto -->
    <div class="space-y-4 min-h-[300px]">
        {#if selectedPersonId}
            <div
                class="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between"
            >
                <div>
                    <p
                        class="text-[10px] font-bold text-blue-400 tracking-widest uppercase"
                    >
                        Personal Seleccionado
                    </p>
                    <p class="text-sm font-bold text-blue-900">
                        {selectedPersonName}
                    </p>
                </div>
                <button
                    type="button"
                    class="text-xs font-bold text-blue-600 hover:text-blue-800"
                    onclick={() => {
                        selectedPersonId = "";
                        selectedPersonName = "";
                    }}>Cambiar</button
                >
            </div>
        {:else}
            <div class="relative">
                <!-- Se cambia text-slate-400 a text-slate-600 para mejor contraste de la lupa -->
                <div
                    class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-600"
                >
                    <Search size={18} strokeWidth={2.5} />
                </div>
                <Input
                    type="text"
                    id="search-person"
                    name="search-person"
                    placeholder="Buscar por nombre o número de empleado..."
                    value={searchQuery}
                    oninput={handleSearchInput}
                    class="pl-10 h-10 w-full"
                />

                {#if searchResults.length > 0}
                    <div
                        class="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-2 overflow-hidden"
                    >
                        {#each searchResults as p}
                            <button
                                type="button"
                                class="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                                onclick={() => selectPerson(p)}
                            >
                                <div class="font-bold text-sm text-slate-800">
                                    {p.first_name}
                                    {p.last_name}
                                </div>
                                <div class="text-[10px] text-slate-400">
                                    {p.employee_no
                                        ? `#${p.employee_no}`
                                        : "Sin número"}
                                </div>
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}

        <div class="space-y-1">
            <span
                class="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1"
                >Extensión Telefónica</span
            >
            <Input
                type="text"
                id="enlace-ext"
                name="enlace-ext"
                placeholder="Ej. 1234"
                bind:value={extension}
                class="w-full"
            />
        </div>
    </div>

    {#snippet footer()}
        <Button variant="ghost" onclick={reset}>Cancelar</Button>
        <Button
            variant="primary"
            onclick={handleSave}
            disabled={!selectedPersonId || !extension.trim()}
            loading={isSubmitting}
        >
            <UserPlus size={16} class="mr-2" />
            Asignar
        </Button>
    {/snippet}
</Modal>
