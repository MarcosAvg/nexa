<script lang="ts">
    /**
     * PersonFormAccess.svelte
     *
     * Special Access section: toggle group for special access areas.
     */
    import ToggleGroup from "../ToggleGroup.svelte";
    import type { CatalogItem } from "../../types";

    let {
        accesosEspeciales = $bindable<string[]>([]),
        specialAccesses = [] as CatalogItem[],
        disabled = false,
    }: {
        accesosEspeciales: string[];
        specialAccesses: CatalogItem[];
        disabled?: boolean;
    } = $props();
</script>

<fieldset
    class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
    {disabled}
>
    <legend class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
        Accesos Especiales
    </legend>

    <ToggleGroup
        label=""
        options={specialAccesses.map((a) => a.name)}
        bind:value={accesosEspeciales}
    />
</fieldset>
