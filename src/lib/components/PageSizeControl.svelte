<script lang="ts">
    import Select from './Select.svelte';

    /**
     * PageSizeControl — Selector compacto de filas por página.
     *
     * Se usa dentro de las barras de acciones masivas: solo es visible
     * cuando hay selección activa.
     */
    type Props = {
        /** Valor actual: cantidad de filas o 'all' (Todos). */
        value: number | 'all';
        /** Callback al cambiar la cantidad. */
        onchange?: (value: number | 'all') => void;
        /** Deshabilitar durante carga o sin conexión. */
        disabled?: boolean;
    };

    let { value, onchange, disabled = false }: Props = $props();

    const OPTIONS = [
        { value: '50', label: '50' },
        { value: '100', label: '100' },
        { value: '250', label: '250' },
        { value: '500', label: '500' },
        { value: 'all', label: 'Todos' },
    ];

    function handleChange(e: Event) {
        const raw = (e.target as HTMLSelectElement).value;
        onchange?.(raw === 'all' ? 'all' : Number(raw));
    }
</script>

<div class="flex items-center gap-1.5 shrink-0">
    <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Ver</span>
    <div class="w-24">
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
