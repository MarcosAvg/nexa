<script lang="ts">
    import { tick } from 'svelte';
    import { ChevronDown, Search, Check } from 'lucide-svelte';
    import { mediaState } from '../stores';
    import { normalizeSearch } from '../utils';

    /**
     * Combobox — Selector desplegable con buscador integrado.
     *
     * Reemplaza al `<select>` nativo en filtros y formularios donde conviene
     * buscar dentro de la lista (sensible a mayúsculas/acentos).
     *
     * Modos:
     * - Simple (por defecto): usa `bind:value` (string/number).
     * - Múltiple (`multiple`): usa `bind:values` (array). El menú permanece
     *   abierto al marcar y el trigger resume la selección.
     *
     * Modo de despliegue:
     * - `overlay` (por defecto en desktop): lista flotante `absolute`.
     * - `inline`: la lista se expande en flujo (empuja el contenido). Se usa en
     *   móvil y dentro de modales para evitar recortes (`overflow-y-auto`).
     *
     * @example
     * <Combobox bind:value={dep} options={deps} placeholder="Todas" />
     * <Combobox multiple bind:values={depsSel} options={deps} placeholder="Todas" />
     */
    type Option = string | number | { value: string | number; label: string };

    type Props = {
        /** Valor seleccionado en modo simple (two-way bindable). */
        value?: string | number;
        /** Valores seleccionados en modo múltiple (two-way bindable). */
        values?: (string | number)[];
        /** Activa la selección múltiple. @default false */
        multiple?: boolean;
        /** Opciones: strings/números u objetos `{ value, label }`. */
        options?: Option[];
        /** Texto mostrado cuando no hay selección. @default "Seleccionar..." */
        placeholder?: string;
        /** Deshabilitar el selector. */
        disabled?: boolean;
        /** Clases CSS adicionales (se aplican al botón trigger). */
        class?: string;
        /** ID del trigger (para asociar `<label for>`). */
        id?: string;
        /** Callback al cambiar la selección (modo simple). */
        onchange?: (value: string | number) => void;
        /** Callback al cambiar la selección (modo múltiple). */
        onchangeMulti?: (values: (string | number)[]) => void;
        /** Fuerza la lista en flujo (sin overlay). Ideal en modales. */
        inline?: boolean;
    };

    let {
        value = $bindable(),
        values = $bindable([]),
        multiple = false,
        options = [],
        placeholder = 'Seleccionar...',
        disabled = false,
        class: className = '',
        id,
        onchange,
        onchangeMulti,
        inline = false,
    }: Props = $props();

    type Norm = { value: string | number; label: string; haystack: string };

    let normalized = $derived<Norm[]>(
        options.map((opt) => {
            if (typeof opt === 'string' || typeof opt === 'number') {
                return { value: opt, label: String(opt), haystack: normalizeSearch(String(opt)) };
            }
            return { value: opt.value, label: opt.label, haystack: normalizeSearch(opt.label) };
        }),
    );

    let isOpen = $state(false);
    let query = $state('');
    let activeIndex = $state(0);
    let container: HTMLDivElement | undefined = $state();
    let searchInput: HTMLInputElement | undefined = $state();

    let filtered = $derived.by(() => {
        const q = normalizeSearch(query);
        if (!q) return normalized;
        const terms = q.split(' ').filter(Boolean);
        return normalized.filter((o) => terms.every((t) => o.haystack.includes(t)));
    });

    /** Valores seleccionados normalizados a string. */
    let selectedStrings = $derived(
        multiple
            ? values.map(String)
            : value === undefined || value === null || value === ''
              ? []
              : [String(value)],
    );

    let triggerLabel = $derived.by(() => {
        if (!multiple) {
            return normalized.find((o) => String(o.value) === String(value))?.label ?? '';
        }
        const labels = normalized
            .filter((o) => selectedStrings.includes(String(o.value)))
            .map((o) => o.label);
        if (labels.length === 0) return '';
        if (labels.length === 1) return labels[0];
        return `${labels.length} seleccionados`;
    });

    let useOverlay = $derived(!inline && mediaState.isDesktop.matches);

    const menuId = `combobox-list-${Math.random().toString(36).slice(2, 9)}`;

    function isSelected(opt: Norm): boolean {
        return selectedStrings.includes(String(opt.value));
    }

    function open() {
        if (disabled) return;
        isOpen = true;
        query = '';
        activeIndex = multiple
            ? 0
            : Math.max(
                  0,
                  normalized.findIndex((o) => String(o.value) === String(value)),
              );
    }

    function close() {
        isOpen = false;
        query = '';
    }

    function toggleOpen() {
        if (isOpen) close();
        else open();
    }

    function selectSingle(opt: Norm) {
        value = opt.value;
        onchange?.(opt.value);
        close();
    }

    function toggleValue(opt: Norm) {
        const v = String(opt.value);
        const current = values.map(String);
        const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
        // Conserva el tipo original de cada valor (number vs string).
        const nextRaw = next.map((s) => normalized.find((o) => String(o.value) === s)?.value ?? s);
        values = nextRaw;
        onchangeMulti?.(nextRaw);
    }

    function handleOption(opt: Norm) {
        if (multiple) toggleValue(opt);
        else selectSingle(opt);
    }

    function clearValues() {
        values = [];
        onchangeMulti?.([]);
    }

    function move(delta: number) {
        if (filtered.length === 0) return;
        activeIndex = (activeIndex + delta + filtered.length) % filtered.length;
        queueMicrotask(() =>
            document.getElementById(`${menuId}-opt-${activeIndex}`)?.scrollIntoView({ block: 'nearest' }),
        );
    }

    function handleTriggerKeydown(e: KeyboardEvent) {
        if (disabled) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isOpen) open();
        }
    }

    function handleListKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            e.stopPropagation();
            close();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            move(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            move(-1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[activeIndex]) handleOption(filtered[activeIndex]);
        } else if (e.key === 'Home') {
            e.preventDefault();
            activeIndex = 0;
        } else if (e.key === 'End') {
            e.preventDefault();
            activeIndex = Math.max(0, filtered.length - 1);
        }
    }

    function handleWindowClick(e: MouseEvent) {
        if (isOpen && container && !container.contains(e.target as Node)) close();
    }

    $effect(() => {
        if (isOpen) tick().then(() => searchInput?.focus());
    });
</script>

<svelte:window onclick={handleWindowClick} />

<div bind:this={container} class="relative w-full">
    <button
        type="button"
        {id}
        {disabled}
        class="w-full flex items-center justify-between gap-2 px-4 rounded-control border border-slate-200 bg-white text-left text-[14px] font-medium text-slate-700
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 {className.includes(
            'h-',
        )
            ? ''
            : 'h-10'} {className}"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onclick={toggleOpen}
        onkeydown={handleTriggerKeydown}
    >
        <span class="truncate {triggerLabel ? '' : 'text-slate-400'}">{triggerLabel || placeholder}</span>
        <ChevronDown
            size={16}
            class="shrink-0 text-slate-400 transition-transform {isOpen ? 'rotate-180' : ''}"
        />
    </button>

    {#if isOpen}
        <div
            id={menuId}
            class="{useOverlay
                ? 'absolute z-50 mt-2 w-full'
                : 'mt-2 w-full'} bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden"
            role="listbox"
            aria-multiselectable={multiple}
            aria-label={placeholder}
            tabindex="-1"
            onkeydown={handleListKeydown}
        >
            <div class="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
                <Search size={15} class="text-slate-400 shrink-0" />
                <input
                    bind:this={searchInput}
                    value={query}
                    oninput={(e) => {
                        query = e.currentTarget.value;
                        activeIndex = 0;
                    }}
                    placeholder="Buscar..."
                    class="w-full bg-transparent text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none"
                    aria-label="Buscar opción"
                />
            </div>

            <div class="max-h-60 overflow-y-auto py-1">
                {#if filtered.length === 0}
                    <div class="px-4 py-3 text-sm text-slate-400 text-center">Sin resultados</div>
                {:else}
                    {#each filtered as opt, i (opt.value)}
                        <button
                            type="button"
                            id="{menuId}-opt-{i}"
                            role="option"
                            aria-selected={isSelected(opt)}
                            class="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium transition-colors {i ===
                            activeIndex
                                ? 'bg-blue-50 text-blue-800'
                                : 'text-slate-700 hover:bg-slate-50'}"
                            onmouseenter={() => (activeIndex = i)}
                            onclick={() => handleOption(opt)}
                        >
                            {#if multiple}
                                <span
                                    class="shrink-0 w-4 h-4 rounded-[5px] border flex items-center justify-center transition-colors {isSelected(
                                        opt,
                                    )
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'border-slate-300 bg-white'}"
                                >
                                    {#if isSelected(opt)}
                                        <Check size={11} strokeWidth={3} />
                                    {/if}
                                </span>
                            {/if}
                            <span class="truncate flex-1">{opt.label}</span>
                            {#if !multiple && isSelected(opt)}
                                <Check size={15} class="shrink-0 text-blue-600" />
                            {/if}
                        </button>
                    {/each}
                {/if}
            </div>

            {#if multiple && selectedStrings.length > 0}
                <div class="border-t border-slate-100 px-3 py-2">
                    <button
                        type="button"
                        class="text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-rose-600 transition-colors"
                        onclick={clearValues}
                    >
                        Limpiar selección
                    </button>
                </div>
            {/if}
        </div>
    {/if}
</div>
