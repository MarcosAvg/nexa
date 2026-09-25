<script lang="ts">
    import { type Snippet } from 'svelte';
    import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-svelte';
    import { mediaState } from '../stores';
    import { longPress } from '../utils';

    type TopSnippet = Snippet<[any]>;

    /** Columna de la tabla de datos. */
    type Column = {
        /** Campo del objeto que se muestra en esta columna. */
        key: string;
        /** Texto del encabezado visible. */
        label: string;
        /** Snippet para render personalizado de celdas. */
        render?: TopSnippet;
        /** Clases CSS adicionales para el <th>/<td>. */
        class?: string;
        /** Oculta esta columna en vista móvil. */
        hideOnMobile?: boolean;
        /** Permite ordenar por esta columna. @default true */
        sortable?: boolean;
        /** Ancho fijo de la columna (ej: "200px"). */
        width?: string;
        /** Ancho máximo de la columna. */
        maxWidth?: string;
    };

    /**
     * DataTable — Tabla de datos con scroll virtual, ordenamiento y vista móvil.
     *
     * @example
     * <DataTable data={items} columns={columns}>
     *     {#snippet actions(row)}
     *         <Button onclick={() => onEdit(row)}>Editar</Button>
     *     {/snippet}
     * </DataTable>
     */
    type Props = {
        /** Arreglo de datos a mostrar. */
        data: any[];
        /** Definición de columnas. */
        columns: Column[];
        /** Snippet de acciones por fila (columna extra a la derecha). */
        actions?: TopSnippet;
        /** Snippet para vista móvil personalizada. */
        mobileCard?: TopSnippet;
        /** Snippet que reemplaza TODA la sección móvil (p. ej. un <DataList>). Recibe las filas ordenadas. */
        mobileList?: Snippet<[any[]]>;
        /** Ancho de la columna de acciones. @default "140px" */
        actionsWidth?: string;
        /** Función que retorna clases CSS condicionales por fila. */
        rowClass?: (row: any) => string;
        /**
         * Habilita arrastrar filas para reordenarlas (drag & drop nativo).
         * onDrop recibe (fromIndex, toIndex) sobre el arreglo de datos original.
         */
        dnd?: {
            onDrop: (from: number, to: number) => void;
            /** Deshabilita el arrastre (ej. mientras se guarda el orden). */
            disabled?: boolean;
        };
        /** Habilita la selección múltiple con checkboxes. */
        selectable?: boolean;
        /** Filas seleccionadas (two-way bindable). */
        selectedRows?: any[];
    };
    let {
        data,
        columns,
        actions,
        mobileCard,
        mobileList,
        actionsWidth = '140px',
        rowClass,
        dnd,
        selectable = false,
        selectedRows = $bindable([]),
    }: Props = $props();

    function rowKey(row: any): any {
        return row?.id ?? row?.folio ?? row?.name;
    }

    function isRowSelected(row: any): boolean {
        const key = rowKey(row);
        return selectedRows.some((r) => rowKey(r) === key);
    }

    function toggleRowSelection(row: any, checked: boolean) {
        const key = rowKey(row);
        if (checked) {
            if (!selectedRows.some((r) => rowKey(r) === key)) {
                selectedRows = [...selectedRows, row];
            }
        } else {
            selectedRows = selectedRows.filter((r) => rowKey(r) !== key);
        }
    }

    function toggleSelectAll(checked: boolean) {
        selectedRows = checked ? [...sortedData] : [];
    }

    // Modo selección en móvil: se activa con long-press (no hay checkboxes fijos).
    let selectionMode = $state(false);
    $effect(() => {
        if (!selectable || selectedRows.length === 0) selectionMode = false;
    });

    function startSelectionMobile(row: any) {
        if (!selectable) return;
        selectionMode = true;
        toggleRowSelection(row, true);
    }

    /** Sincroniza la propiedad DOM `indeterminate` (no es un atributo HTML). */
    function indeterminate(node: HTMLInputElement, value: boolean) {
        node.indeterminate = value;
        return {
            update(v: boolean) {
                node.indeterminate = v;
            },
        };
    }

    // Estado de ordenamiento
    let sortKey = $state<string | null>(null);
    let sortDirection = $state<'asc' | 'desc' | null>(null);

    // Estado interno del drag & drop de filas
    let dragFromIndex = $state<number | null>(null);
    let dragOverIndex = $state<number | null>(null);

    function dragStart(e: DragEvent, index: number) {
        if (!dnd || dnd.disabled) return;
        e.dataTransfer!.effectAllowed = 'move';
        e.dataTransfer!.setData('text/plain', String(index));
        dragFromIndex = index;
        dragOverIndex = null;
    }

    function dragOver(e: DragEvent, index: number) {
        if (!dnd || dragFromIndex === null) return;
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
        if (dragOverIndex !== index) dragOverIndex = index;
    }

    function dragLeave(e: DragEvent, index: number) {
        // No limpiar si el puntero se mueve a un hijo de la fila (evita parpadeo)
        const related = e.relatedTarget;
        if (related instanceof Node && e.currentTarget instanceof Node && e.currentTarget.contains(related))
            return;
        if (dragOverIndex === index) dragOverIndex = null;
    }

    function dragDrop(e: DragEvent, index: number) {
        if (!dnd || dragFromIndex === null) return;
        e.preventDefault();
        if (dragFromIndex !== index) dnd.onDrop(dragFromIndex, index);
        dragFromIndex = null;
        dragOverIndex = null;
    }

    function dragEnd() {
        dragFromIndex = null;
        dragOverIndex = null;
    }

    let sortedData = $derived.by(() => {
        if (!sortKey || !sortDirection) return data;

        return [...data].sort((a, b) => {
            let aVal = a[sortKey!];
            let bVal = b[sortKey!];

            // Normalizar para ordenamiento (manejar valores faltantes)
            if (aVal === null || aVal === undefined) aVal = '';
            if (bVal === null || bVal === undefined) bVal = '';

            // Comparación de strings
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                const cmp = aVal.localeCompare(bVal, undefined, {
                    numeric: true,
                    sensitivity: 'base',
                });
                return sortDirection === 'asc' ? cmp : -cmp;
            }

            // Otras comparaciones (números, etc.)
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    });

    let allSelected = $derived(
        selectable && sortedData.length > 0 && sortedData.every((r) => isRowSelected(r)),
    );
    let someSelected = $derived(selectable && selectedRows.length > 0 && !allSelected);

    function toggleSort(key: string) {
        if (sortKey === key) {
            if (sortDirection === 'asc') {
                sortDirection = 'desc';
            } else if (sortDirection === 'desc') {
                sortKey = null;
                sortDirection = null;
            }
        } else {
            sortKey = key;
            sortDirection = 'asc';
        }
    }

    // Lógica de expansión de tarjetas para móvil
    let expandedRowIds = $state(new Set<any>());

    function toggleRow(row: any) {
        const id = row.id || row.folio || row.name || Math.random();
        if (expandedRowIds.has(id)) {
            expandedRowIds.delete(id);
        } else {
            expandedRowIds.add(id);
        }
        expandedRowIds = new Set(expandedRowIds);
    }

    function isRowExpanded(row: any): boolean {
        const id = row.id || row.folio || row.name || false;
        return id ? expandedRowIds.has(id) : false;
    }
</script>

<!-- Vista de tabla para escritorio (oculta en pantallas pequeñas/medianas) -->
<div
    class="hidden lg:block overflow-hidden rounded-2xl border border-slate-200/50 shadow-sm bg-white/80 backdrop-blur-sm"
>
    <div class="w-full overflow-auto custom-scrollbar" style="max-height: 65vh;">
        <table
            class="w-full min-w-[1024px] table-fixed text-left text-sm text-slate-600 border-collapse relative"
        >
            <thead
                class="bg-slate-50/95 backdrop-blur-sm text-[11px] uppercase tracking-[0.15em] text-slate-500 font-bold border-b border-slate-200/50 sticky top-0 z-20"
            >
                <tr>
                    {#if selectable}
                        <th scope="col" class="w-10 px-4 py-4 lg:py-5">
                            <input
                                type="checkbox"
                                class="w-4 h-4 rounded border-slate-300 accent-blue-600 cursor-pointer"
                                aria-label="Seleccionar todas las filas"
                                checked={allSelected}
                                use:indeterminate={someSelected}
                                onchange={(e) => toggleSelectAll(e.currentTarget.checked)}
                            />
                        </th>
                    {/if}
                    {#each columns as column}
                        <th
                            scope="col"
                            class="px-5 py-4 lg:px-6 lg:py-5 {column.class || ''} {column.sortable !== false
                                ? 'hover:bg-slate-100/70 transition-all duration-300 group'
                                : ''}"
                            style:width={column.width}
                            style:max-width={column.maxWidth}
                            aria-sort={column.sortable !== false && sortKey === column.key
                                ? sortDirection === 'asc'
                                    ? 'ascending'
                                    : 'descending'
                                : undefined}
                        >
                            {#if column.sortable !== false}
                                <button
                                    type="button"
                                    class="flex items-center gap-2.5 w-full text-left cursor-pointer uppercase tracking-[0.15em] text-[11px] font-bold text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 rounded"
                                    onclick={() => toggleSort(column.key)}
                                >
                                    {column.label}
                                    <div
                                        class="flex-shrink-0 transition-all duration-300 {sortKey ===
                                        column.key
                                            ? 'text-blue-500 scale-110'
                                            : 'text-slate-400 group-hover:text-slate-500 group-hover:scale-105'}"
                                    >
                                        {#if sortKey === column.key}
                                            {#if sortDirection === 'asc'}
                                                <ChevronUp size={15} strokeWidth={2.5} />
                                            {:else}
                                                <ChevronDown size={15} strokeWidth={2.5} />
                                            {/if}
                                        {:else}
                                            <ChevronsUpDown size={14} strokeWidth={2} />
                                        {/if}
                                    </div>
                                </button>
                            {:else}
                                <div class="flex items-center gap-2.5">
                                    {column.label}
                                </div>
                            {/if}
                        </th>
                    {/each}
                    {#if actions}
                        <th
                            scope="col"
                            class="px-5 py-4 lg:px-6 lg:py-5 text-right font-bold"
                            style:width={actionsWidth}>Acciones</th
                        >
                    {/if}
                </tr>
            </thead>
            {#if sortedData.length === 0}
                <tbody class="divide-y divide-slate-100/60">
                    <tr>
                        <td
                            colspan={columns.length + (actions ? 1 : 0) + (selectable ? 1 : 0)}
                            class="px-5 py-8 text-center text-slate-500 text-sm border-0"
                        >
                            No hay datos para mostrar
                        </td>
                    </tr>
                </tbody>
            {:else}
                <tbody class="divide-y divide-slate-100/60">
                    {#each sortedData as row, rowIndex (row.id || row.folio || row.name || rowIndex)}
                        <tr
                            class="group transition-all duration-300 hover:bg-blue-50/30 even:bg-slate-50/30 {rowClass
                                ? rowClass(row)
                                : ''} {dnd && !dnd.disabled
                                ? 'cursor-grab active:cursor-grabbing select-none'
                                : ''} {dragFromIndex === rowIndex ? 'opacity-40' : ''} {dragFromIndex !==
                                null &&
                            dragOverIndex === rowIndex &&
                            dragFromIndex !== rowIndex
                                ? 'bg-blue-50/80!'
                                : ''}"
                            draggable={!!dnd && !dnd.disabled}
                            ondragstart={(e) => dragStart(e, rowIndex)}
                            ondragover={(e) => dragOver(e, rowIndex)}
                            ondragleave={(e) => dragLeave(e, rowIndex)}
                            ondrop={(e) => dragDrop(e, rowIndex)}
                            ondragend={dragEnd}
                        >
                            {#if selectable}
                                <td class="w-10 px-4 py-4">
                                    <input
                                        type="checkbox"
                                        class="w-4 h-4 rounded border-slate-300 accent-blue-600 cursor-pointer"
                                        aria-label="Seleccionar fila"
                                        checked={isRowSelected(row)}
                                        onchange={(e) => toggleRowSelection(row, e.currentTarget.checked)}
                                    />
                                </td>
                            {/if}
                            {#each columns as column}
                                <td
                                    class="px-5 py-4 lg:px-6 lg:py-4.5 text-[13.5px] font-medium text-slate-700/90 transition-colors group-hover:text-slate-900 {column.width ||
                                    column.maxWidth
                                        ? 'truncate'
                                        : ''} {column.class || ''}"
                                    style:width={column.width}
                                    style:max-width={column.maxWidth}
                                >
                                    <div class={column.width || column.maxWidth ? 'truncate' : ''}>
                                        {#if column.render}
                                            {@render column.render(row)}
                                        {:else}
                                            {row[column.key]}
                                        {/if}
                                    </div>
                                </td>
                            {/each}
                            {#if actions}
                                <td
                                    class="px-5 py-4 lg:px-6 lg:py-4.5 whitespace-nowrap text-right"
                                    style:width={actionsWidth}
                                >
                                    <div
                                        class="flex justify-end opacity-60 group-hover:opacity-100 transition-opacity duration-300"
                                    >
                                        {@render actions(row)}
                                    </div>
                                </td>
                            {/if}
                        </tr>
                    {/each}
                </tbody>
            {/if}
        </table>
    </div>
</div>

<!-- Vista móvil: DataList declarativo si se provee; si no, tarjetas. -->
{#if mobileList}
    {@render mobileList(sortedData)}
{:else}
    {#if selectable}
        <div class="px-1">
            <p class="text-[11px] font-medium text-slate-400">Mantén pulsada una tarjeta para seleccionar.</p>
        </div>
    {/if}
    <div class="lg:hidden space-y-4">
        {#each sortedData as row, i (row.id || Math.random())}
            <div
                class="relative {selectable && (selectionMode || !mediaState.isMobile.matches) ? 'pl-9' : ''}"
                use:longPress={{ onLongPress: () => startSelectionMobile(row) }}
            >
                {#if selectable && (selectionMode || !mediaState.isMobile.matches)}
                    <label
                        class="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 cursor-pointer"
                    >
                        <input
                            type="checkbox"
                            class="w-4 h-4 rounded border-slate-300 accent-blue-600 cursor-pointer"
                            aria-label="Seleccionar fila"
                            checked={isRowSelected(row)}
                            onchange={(e) => toggleRowSelection(row, e.currentTarget.checked)}
                        />
                    </label>
                {/if}
                {#if mobileCard}
                    {@render mobileCard(row)}
                {:else}
                    <!-- Componente de tarjeta con lógica de estado interno simplificada -->
                    <article
                        class="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 space-y-4 relative overflow-hidden transition-all duration-200 {dnd &&
                        !dnd.disabled
                            ? 'cursor-grab active:cursor-grabbing select-none'
                            : ''}            {dragFromIndex === i ? 'opacity-40' : ''} {dragFromIndex !==
                            null &&
                        dragOverIndex === i &&
                        dragFromIndex !== i
                            ? 'bg-blue-50/80! ring-1 ring-blue-200'
                            : ''}"
                        draggable={!!dnd && !dnd.disabled}
                        ondragstart={(e) => dragStart(e, i)}
                        ondragover={(e) => dragOver(e, i)}
                        ondragleave={(e) => dragLeave(e, i)}
                        ondrop={(e) => dragDrop(e, i)}
                        ondragend={dragEnd}
                    >
                        <!-- Encabezado de tarjeta -->
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex flex-col">
                                <span class="text-[10px] font-bold uppercase text-slate-400 tracking-wider"
                                    >{columns[0]?.label}</span
                                >
                                <div class="font-bold text-slate-900 text-[16px] tracking-tight">
                                    {row[columns[0]?.key]}
                                </div>
                            </div>
                            {#if actions}
                                <div class="flex items-center gap-2">
                                    {@render actions(row)}
                                </div>
                            {/if}
                        </div>

                        <!-- Contenido de tarjeta (expandible) -->
                        <div class="grid grid-cols-1 gap-1 pt-1">
                            <!-- Campos siempre visibles (siguientes 1 o 2) -->
                            {#each columns.slice(1, 3) as column}
                                <div
                                    class="flex items-center justify-between gap-4 py-1.5 border-b border-slate-50 last:border-0"
                                >
                                    <span
                                        class="text-[11px] font-bold uppercase tracking-wider text-slate-400"
                                        >{column.label}</span
                                    >
                                    <span class="text-[13px] font-semibold text-slate-700">
                                        {#if column.render}
                                            {@render column.render(row)}
                                        {:else}
                                            {row[column.key]}
                                        {/if}
                                    </span>
                                </div>
                            {/each}

                            <!-- Campos expandibles -->
                            <div
                                class="content-wrapper overflow-hidden transition-all duration-300"
                                style="max-height: {isRowExpanded(row)
                                    ? '500px'
                                    : '0px'}; opacity: {isRowExpanded(row)
                                    ? '1'
                                    : '0'}; visibility: {isRowExpanded(row) ? 'visible' : 'hidden'}"
                            >
                                {#each columns.slice(3) as column}
                                    {#if !column.hideOnMobile}
                                        <div
                                            class="flex items-center justify-between gap-4 py-2 border-b border-slate-50 last:border-0"
                                        >
                                            <span
                                                class="text-[11px] font-bold uppercase tracking-wider text-slate-400"
                                                >{column.label}</span
                                            >
                                            <span class="text-[13px] font-semibold text-slate-700">
                                                {#if column.render}
                                                    {@render column.render(row)}
                                                {:else}
                                                    {row[column.key]}
                                                {/if}
                                            </span>
                                        </div>
                                    {/if}
                                {/each}
                            </div>

                            <!-- Alternar expansión -->
                            {#if columns.length > 3}
                                <button
                                    class="w-full pt-3 text-[11px] font-bold text-blue-600 uppercase tracking-widest hover:text-blue-700 flex items-center justify-center gap-1"
                                    onclick={() => toggleRow(row)}
                                >
                                    {isRowExpanded(row) ? 'Ver menos' : 'Ver más detalles'}
                                </button>
                            {/if}
                        </div>
                    </article>
                {/if}
            </div>
        {/each}
    </div>
{/if}

<style>
    .custom-scrollbar::-webkit-scrollbar {
        height: 5px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #e2e8f0;
        border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #cbd5e1;
    }
</style>
