<script lang="ts">
    /**
     * TicketPersonSearch.svelte
     *
     * Reusable person search/detection UI used by multiple ticket types.
     * Shows searching state, candidate list, or selected person.
     */
    import { User, Loader2, AlertCircle, CheckCircle2 } from "lucide-svelte";

    let {
        isSearching = false,
        candidates = [],
        selectedPerson = null,
        apellidos = "",
        nombres = "",
        searchDone = false,
        onSelectPerson = (person: any) => {},
        onClearSelection = () => {},
    }: {
        isSearching: boolean;
        candidates: any[];
        selectedPerson: any | null;
        apellidos: string;
        nombres: string;
        searchDone: boolean;
        onSelectPerson: (person: any) => void;
        onClearSelection: () => void;
    } = $props();
</script>

<div class="rounded-xl border border-slate-200 p-3">
    <p
        class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"
    >
        <User size={11} /> Persona identificada en el sistema
    </p>

    {#if isSearching}
        <div class="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={14} class="animate-spin" />
            Buscando <strong>{apellidos}, {nombres}</strong>…
        </div>
    {:else if candidates.length === 0 && searchDone}
        <div class="flex items-start gap-2 text-sm text-rose-600">
            <AlertCircle size={14} class="mt-0.5 shrink-0" />
            <div>
                <p class="font-semibold">Persona no encontrada en el sistema</p>
                <p class="text-xs text-rose-400">
                    Buscado: "{apellidos}, {nombres}"
                </p>
            </div>
        </div>
    {:else if candidates.length > 1 && !selectedPerson}
        <div class="p-3 bg-amber-50 rounded-lg border border-amber-200 mb-3">
            <p
                class="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-1.5"
            >
                <AlertCircle size={12} /> Se encontraron {candidates.length} coincidencias
            </p>
            <p class="text-[10px] text-amber-600 mb-3">
                Selecciona la persona correcta para vincular este ticket:
            </p>
            <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {#each candidates as c}
                    <button
                        class="w-full flex items-center justify-between p-2.5 rounded-lg border border-amber-200/50 bg-white hover:bg-amber-100 hover:border-amber-300 text-left transition-all group"
                        onclick={() => onSelectPerson(c)}
                    >
                        <div class="flex items-center gap-3">
                            <div
                                class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-amber-200 group-hover:text-amber-600 transition-colors"
                            >
                                <User size={14} />
                            </div>
                            <div>
                                <p class="text-sm font-bold text-slate-800">
                                    {c.last_name}, {c.first_name}
                                </p>
                                <p class="text-[10px] text-slate-500">
                                    {c.dependency} · {c.building}
                                </p>
                            </div>
                        </div>
                        <span
                            class="text-[10px] font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >Seleccionar →</span>
                    </button>
                {/each}
            </div>
        </div>
    {:else if selectedPerson}
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 size={16} />
                </div>
                <div>
                    <p class="text-sm font-semibold text-slate-800">
                        {selectedPerson.last_name}, {selectedPerson.first_name}
                    </p>
                    <p class="text-xs text-slate-400">
                        {selectedPerson.dependency} · {selectedPerson.building}
                    </p>
                </div>
            </div>
            {#if candidates.length > 1}
                <button
                    class="text-xs text-blue-500 hover:underline"
                    onclick={onClearSelection}
                >Cambiar</button>
            {/if}
        </div>
    {/if}
</div>
