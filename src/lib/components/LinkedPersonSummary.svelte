<script lang="ts">
    import Badge from './Badge.svelte';
    import { CreditCard, Eye, EyeOff, User } from 'lucide-svelte';
    import type { Person } from '../types';
    import { getCardStatusLabel, getCardStatusVariant, getPersonnelStatusVariant } from '../constants/status';
    import { computePersonStatus } from '../utils/personStatus';
    import { mediaTypeVariant } from '../utils/mediaTypeAppearance';

    /**
     * LinkedPersonSummary — Ficha compacta y de solo lectura para una persona
     * candidata durante la importación de registros.
     *
     * Permite seleccionar la candidata que se vinculará y expandir sus datos
     * básicos: empleado, dependencia, edificio, estado y tarjetas activas.
     */
    type Props = {
        /** Candidata encontrada por nombre. */
        person: Person;
        /** Indica si esta candidata es la seleccionada para vincular. */
        selected?: boolean;
        /** Muestra la ficha compacta. */
        expanded?: boolean;
        /** Selecciona la candidata para vincular. */
        onSelect?: (id: string) => void;
        /** Alterna la ficha compacta. */
        onToggle?: (id: string) => void;
    };

    let { person, selected = false, expanded = false, onSelect, onToggle }: Props = $props();

    let statusLabel = $derived(computePersonStatus(person.status_raw, person.cards, person.building_id));
    let statusVariant = $derived(getPersonnelStatusVariant(statusLabel));
    let activeCards = $derived(
        [...(person.cards ?? [])]
            .filter((card) => card.status === 'active')
            .sort((a, b) => a.type.localeCompare(b.type) || a.folio.localeCompare(b.folio)),
    );
</script>

<div
    class="rounded-lg border p-2.5 transition-colors {selected
        ? 'border-emerald-500 bg-emerald-50/70'
        : 'border-slate-200 bg-white'}"
>
    <div class="flex items-start justify-between gap-2">
        <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 text-left"
            onclick={() => onSelect?.(person.id)}
        >
            <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full {selected
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'}"
            >
                <User size={13} />
            </span>
            <span class="min-w-0">
                <span class="block truncate text-xs font-bold text-slate-800">
                    {person.last_name}, {person.first_name}
                </span>
                <span class="block truncate text-[10px] text-slate-500">
                    {person.employee_no ? `#${person.employee_no} · ` : ''}{person.dependency ||
                        'Sin dependencia'} · {person.building || 'Sin edificio'}
                </span>
            </span>
        </button>
        <div class="flex shrink-0 items-center gap-1.5">
            <Badge variant={statusVariant} class="px-1.5 py-0.5 text-[9px] font-extrabold">
                {statusLabel}
            </Badge>
            {#if selected}
                <Badge variant="emerald" class="px-1.5 py-0.5 text-[9px] font-extrabold">Vinculada</Badge>
            {/if}
            <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
                onclick={() => onToggle?.(person.id)}
            >
                {#if expanded}
                    <EyeOff size={11} /> Ocultar
                {:else}
                    <Eye size={11} /> Ver datos
                {/if}
            </button>
        </div>
    </div>

    {#if expanded}
        <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-white/80 p-2 text-[10px]">
            <div>
                <dt class="font-bold uppercase tracking-wider text-slate-400">No. empleado</dt>
                <dd class="font-bold text-slate-700">{person.employee_no || '—'}</dd>
            </div>
            <div>
                <dt class="font-bold uppercase tracking-wider text-slate-400">Estado</dt>
                <dd class="font-bold text-slate-700">{statusLabel}</dd>
            </div>
            <div class="col-span-2">
                <dt class="font-bold uppercase tracking-wider text-slate-400">Dependencia</dt>
                <dd class="font-medium text-slate-700">{person.dependency || '—'}</dd>
            </div>
            <div class="col-span-2">
                <dt class="font-bold uppercase tracking-wider text-slate-400">Edificio</dt>
                <dd class="font-medium text-slate-700">
                    {person.building || '—'}{person.floor ? ` · Piso ${person.floor}` : ''}
                </dd>
            </div>
        </dl>

        <div class="mt-2">
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tarjetas activas</p>
            {#if activeCards.length > 0}
                <div class="mt-1 flex flex-wrap gap-1.5">
                    {#each activeCards as card (card.id)}
                        <span
                            class="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                        >
                            <CreditCard size={10} class="text-slate-400" />
                            <Badge
                                variant={mediaTypeVariant(card.type)}
                                class="px-1 py-0 text-[9px] font-extrabold">{card.type}</Badge
                            >
                            <span class="font-bold">{card.folio}</span>
                            <Badge
                                variant={getCardStatusVariant(card.status)}
                                class="px-1 py-0 text-[9px] font-extrabold"
                                >{getCardStatusLabel(card.status)}</Badge
                            >
                        </span>
                    {/each}
                </div>
            {:else}
                <p class="mt-1 text-[10px] italic text-slate-400">Sin tarjetas asignadas actualmente.</p>
            {/if}
        </div>
    {/if}
</div>
