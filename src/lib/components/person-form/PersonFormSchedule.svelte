<script lang="ts">
    /**
     * PersonFormSchedule.svelte
     *
     * Schedule section: days selection and entry/exit times.
     */
    import Select from "../Select.svelte";
    import Input from "../Input.svelte";
    import type { CatalogItem } from "../../types";

    let {
        diasHorario = $bindable(""),
        horaEntrada = $bindable("08:00"),
        horaSalida = $bindable("17:00"),
        schedules = [] as CatalogItem[],
        errors = {} as Record<string, string>,
        disabled = false,
    }: {
        diasHorario: string;
        horaEntrada: string;
        horaSalida: string;
        schedules: CatalogItem[];
        errors?: Record<string, string>;
        disabled?: boolean;
    } = $props();
</script>

<fieldset
    class="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
    {disabled}
>
    <legend class="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
        Horario
    </legend>

    <div class="space-y-1.5">
        <label for="dias" class="text-xs font-bold text-slate-600 block">
            Días
        </label>
        <Select
            id="dias"
            bind:value={diasHorario}
            class={errors.schedule_days ? "border-red-500 ring-red-200" : ""}
        >
            {#each schedules as s}
                <option value={s.name}>{s.name}</option>
            {/each}
        </Select>
        {#if errors.schedule_days}
            <p class="text-[10px] text-red-500 font-medium">{errors.schedule_days}</p>
        {/if}
    </div>

    <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-1.5">
            <label for="entrada" class="text-xs font-bold text-slate-600 block">
                Entrada
            </label>
            <Input id="entrada" type="time" bind:value={horaEntrada} />
        </div>
        <div class="space-y-1.5">
            <label for="salida" class="text-xs font-bold text-slate-600 block">
                Salida
            </label>
            <Input id="salida" type="time" bind:value={horaSalida} />
        </div>
    </div>
</fieldset>
