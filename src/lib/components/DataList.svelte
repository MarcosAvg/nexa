<script lang="ts">
    import { type Snippet } from 'svelte';
    import { ChevronRight } from 'lucide-svelte';
    import SwipeActions from './SwipeActions.svelte';
    import { detailHost } from '../stores';
    import { longPress } from '../utils';

    /**
     * DataList — Lista móvil compacta tipo app nativa.
     *
     * Reemplaza las "cards" ad-hoc: filas densas con leading/título/subtítulo/
     * trailing y, al tocar, un bottom sheet con detalle y acciones.
     * Soporta swipe actions y selección por long-press.
     *
     * @example
     * <DataList items={rows} title={(r)=>r.name} subtitle={(r)=>r.email}>
     *     {#snippet leading(r)}<Avatar ... />{/snippet}
     *     {#snippet trailing(r)}<Badge ... />{/snippet}
     *     {#snippet details(r)}...{/snippet}
     * </DataList>
     */
    export type DataListAction = {
        label: string;
        tone?: 'blue' | 'amber' | 'emerald' | 'rose' | 'indigo' | 'slate';
        onAction: () => void;
    };

    type Props = {
        items: any[];
        /** Clave estable por fila. @default row.id */
        key?: (row: any) => any;
        /** Contenido a la izquierda (avatar/ícono). */
        leading?: Snippet<[any]>;
        /** Texto principal. */
        title: Snippet<[any]>;
        /** Texto secundario. */
        subtitle?: Snippet<[any]>;
        /** Contenido a la derecha (estado/valor). */
        trailing?: Snippet<[any]>;
        /** Contenido del bottom sheet de detalle. */
        details?: Snippet<[any]>;
        /** Acciones (footer) del bottom sheet. */
        sheetActions?: Snippet<[any]>;
        /** Acciones de swipe por fila. */
        actions?: (row: any) => DataListAction[];
        /** Si se define, el tap llama a esto en lugar de abrir el sheet. */
        onOpen?: (row: any) => void;
        /** Habilita selección por long-press. */
        selectable?: boolean;
        /** Filas seleccionadas (two-way bindable). */
        selectedRows?: any[];
        /** Título del sheet. */
        sheetTitle?: (row: any) => string | undefined;
        /** Subtítulo del sheet. */
        sheetSubtitle?: (row: any) => string | undefined;
    };

    let {
        items = [],
        key = (row: any) => row?.id,
        leading,
        title,
        subtitle,
        trailing,
        details,
        sheetActions,
        actions,
        onOpen,
        selectable = false,
        selectedRows = $bindable([]),
        sheetTitle,
        sheetSubtitle,
    }: Props = $props();

    let selectionMode = $state(false);

    // Owner del host global de detalle (limpieza al desmontar).
    const hostOwner = Symbol('data-list');

    $effect(() => {
        return () => detailHost.closeIfOwner(hostOwner);
    });

    function rowKey(row: any) {
        return key(row);
    }

    function isSelected(row: any) {
        return selectedRows.some((r) => rowKey(r) === rowKey(row));
    }

    function toggleSelect(row: any, checked: boolean) {
        if (checked) {
            if (!isSelected(row)) selectedRows = [...selectedRows, row];
        } else {
            selectedRows = selectedRows.filter((r) => rowKey(r) !== rowKey(row));
        }
    }

    function handleOpen(row: any) {
        if (selectable && selectionMode) {
            toggleSelect(row, !isSelected(row));
            return;
        }
        if (onOpen) {
            onOpen(row);
            return;
        }
        if (details || sheetActions) {
            detailHost.open({
                owner: hostOwner,
                title: sheetTitle?.(row) ?? 'Detalle',
                subtitle: sheetSubtitle?.(row),
                row,
                details,
                actions: sheetActions,
            });
        }
    }

    function startSelection(row: any) {
        if (!selectable) return;
        selectionMode = true;
        toggleSelect(row, true);
    }

    $effect(() => {
        if (!selectable || selectedRows.length === 0) selectionMode = false;
    });
</script>

{#if selectable && selectionMode}
    <div class="lg:hidden mb-2 px-1">
        <p class="text-[11px] font-medium text-slate-400">Selección activa · toca las filas para marcar</p>
    </div>
{/if}

<div
    class="lg:hidden divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm"
>
    {#each items as row (rowKey(row))}
        {@const rowActions = actions?.(row) ?? []}
        <SwipeActions actions={rowActions} rounded={false} showButton={false}>
            <div
                class="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer active:bg-slate-50 transition-colors"
                use:longPress={{ onLongPress: () => startSelection(row) }}
                onclick={() => handleOpen(row)}
                role="button"
                tabindex="0"
                onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpen(row);
                    }
                }}
            >
                {#if selectable && selectionMode}
                    <input
                        type="checkbox"
                        class="w-4 h-4 rounded border-slate-300 accent-blue-600 shrink-0"
                        aria-label="Seleccionar"
                        checked={isSelected(row)}
                        onclick={(e) => e.stopPropagation()}
                        onchange={(e) => toggleSelect(row, e.currentTarget.checked)}
                    />
                {/if}

                {#if leading}
                    <div class="shrink-0">{@render leading(row)}</div>
                {/if}

                <div class="min-w-0 flex-1">
                    <div class="text-[13.5px] font-semibold text-slate-900 truncate">
                        {@render title(row)}
                    </div>
                    {#if subtitle}
                        <div class="text-[11px] text-slate-500 truncate mt-0.5">
                            {@render subtitle(row)}
                        </div>
                    {/if}
                </div>

                {#if trailing}
                    <div class="shrink-0">{@render trailing(row)}</div>
                {/if}

                <ChevronRight size={14} class="text-slate-300 shrink-0" />
            </div>
        </SwipeActions>
    {:else}
        <div class="px-4 py-6 text-center text-sm text-slate-400">Sin registros</div>
    {/each}
</div>
