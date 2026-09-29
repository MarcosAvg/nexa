<script lang="ts">
    import Select from './Select.svelte';

    /**
     * PageSizeControl — Selector compacto de filas por página.
     *
     * Pensado para colocarse junto a la paginación. Tope de 1000 filas
     * (máximo por request de PostgREST).
     */
    type Props = {
        /** Cantidad de filas por página. */
        value: number;
        /** Callback al cambiar la cantidad. */
        onchange?: (value: number) => void;
        /** Deshabilitar durante carga o sin conexión. */
        disabled?: boolean;
    };

    let { value, onchange, disabled = false }: Props = $props();

    const OPTIONS = [50, 100, 250, 500, 1000].map((n) => ({ value: String(n), label: String(n) }));

    function handleChange(e: Event) {
        onchange?.(Number((e.target as HTMLSelectElement).value));
    }
</script>

<div class="flex items-center gap-1.5 shrink-0">
    <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Ver</span>
    <div class="w-20">
        <Select
            value={String(value)}
            options={OPTIONS}
            placeholder=""
            {disabled}
            class="h-9 text-xs font-bold"
            onchange={handleChange}
        />
    </div>
</div>
