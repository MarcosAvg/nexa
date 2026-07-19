<script lang="ts">
    /**
     * PersonFormLocation.svelte
     *
     * Location section: building selection, base floor, and floor assignments.
     */
    import Select from "../Select.svelte";
    import ToggleGroup from "../ToggleGroup.svelte";
    import type { CatalogItem } from "../../types";

    let {
        edificio = $bindable(""),
        pisoBase = $bindable(""),
        pisosP2000 = $bindable<string[]>([]),
        pisosKone = $bindable<string[]>([]),
        availableFloors = [] as string[],
        buildings = [] as CatalogItem[],
        errors = {} as Record<string, string>,
        disabled = false,
    }: {
        edificio: string;
        pisoBase: string;
        pisosP2000: string[];
        pisosKone: string[];
        availableFloors: string[];
        buildings: CatalogItem[];
        errors?: Record<string, string>;
        disabled?: boolean;
    } = $props();
</script>

<fieldset
    class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
    {disabled}
>
    <legend class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
        Ubicación
    </legend>

    <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-1.5">
            <label for="edificio" class="text-xs font-bold text-slate-600 block">
                Edificio
            </label>
            <Select
                id="edificio"
                bind:value={edificio}
                class={errors.building ? "border-red-500 ring-red-200" : ""}
            >
                {#each buildings as b}
                    <option value={b.name}>{b.name}</option>
                {/each}
            </Select>
            {#if errors.building}
                <p class="text-[10px] text-red-500 font-medium">{errors.building}</p>
            {/if}
        </div>
        <div class="space-y-1.5">
            <label for="pisoBase" class="text-xs font-bold text-slate-600 block">
                Piso Base
            </label>
            <Select
                id="pisoBase"
                bind:value={pisoBase}
                disabled={!edificio}
                class={errors.floor ? "border-red-500 ring-red-200" : ""}
            >
                {#each availableFloors as f}
                    <option value={f}>{f}</option>
                {/each}
            </Select>
            {#if errors.floor}
                <p class="text-[10px] text-red-500 font-medium">{errors.floor}</p>
            {/if}
        </div>
    </div>

    {#if edificio}
        <div class="space-y-4">
            <ToggleGroup
                label="Pisos Asignados P2000 (Puertas)"
                options={availableFloors}
                bind:value={pisosP2000}
                showSelectAll={true}
            />
            <ToggleGroup
                label="Pisos Asignados KONE (Elevadores)"
                options={availableFloors}
                bind:value={pisosKone}
                showSelectAll={true}
            />
        </div>
    {/if}
</fieldset>
