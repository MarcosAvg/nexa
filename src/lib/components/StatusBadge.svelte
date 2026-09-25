<script lang="ts">
    import Badge from './Badge.svelte';
    import {
        getCardStatusLabel,
        getCardStatusVariant,
        getFollowupMeta,
        getPersonnelStatusVariant,
        getTicketStatusLabel,
        getTicketStatusVariant,
    } from '../constants/status';

    /**
     * StatusBadge — Badge de estado unificado.
     *
     * Centraliza el mapeo estado→color/etiqueta para personal, tarjetas,
     * tickets y seguimiento de fallas, evitando lógica duplicada por vista.
     *
     * @example
     * <StatusBadge domain="card" value={card.status} />
     * <StatusBadge domain="ticket" value={ticket.status} />
     */
    type Domain = 'personnel' | 'card' | 'ticket' | 'followup';

    type Props = {
        /** Dominio del estado. */
        domain: Domain;
        /** Valor del estado (crudo). */
        value?: string | null;
        /** Clases adicionales. */
        class?: string;
    };

    let { domain, value, class: className = '' }: Props = $props();

    let meta = $derived.by(() => {
        if (domain === 'card') {
            return {
                label: getCardStatusLabel(value ?? ''),
                variant: getCardStatusVariant(value ?? ''),
            };
        }
        if (domain === 'ticket') {
            return {
                label: getTicketStatusLabel(value),
                variant: getTicketStatusVariant(value),
            };
        }
        if (domain === 'followup') {
            return getFollowupMeta(value);
        }
        return {
            label: value ?? '—',
            variant: getPersonnelStatusVariant(value ?? ''),
        };
    });
</script>

<Badge variant={meta.variant} class={className}>{meta.label}</Badge>
