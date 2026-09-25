import { describe, it, expect } from 'vitest';
import {
    PERSONNEL_STATUS_META,
    getCardStatusLabel,
    getCardStatusVariant,
    getFollowupMeta,
    getPersonnelStatusVariant,
    getTicketPriorityVariant,
    getTicketStatusLabel,
    getTicketStatusVariant,
} from '../../src/lib/constants/status';

describe('constants/status', () => {
    it('expone metadata única de estados de personal', () => {
        expect(PERSONNEL_STATUS_META).toHaveLength(8);
        expect(getPersonnelStatusVariant('Activo/a')).toBe('emerald');
        expect(getPersonnelStatusVariant('En proceso')).toBe('sky');
        expect(getPersonnelStatusVariant('Bloqueado/a')).toBe('rose');
        expect(getPersonnelStatusVariant('desconocido')).toBe('slate');
    });

    it('mapea estados de tarjeta', () => {
        expect(getCardStatusVariant('active')).toBe('emerald');
        expect(getCardStatusVariant('blocked')).toBe('rose');
        expect(getCardStatusVariant('inactive')).toBe('slate');
        expect(getCardStatusVariant('available')).toBe('blue');
        expect(getCardStatusVariant('otro')).toBe('blue');

        expect(getCardStatusLabel('active')).toBe('Activa');
        expect(getCardStatusLabel('available')).toBe('Disponible');
        expect(getCardStatusLabel('custom')).toBe('custom');
    });

    it('mapea estados de ticket', () => {
        expect(getTicketStatusVariant('completed')).toBe('emerald');
        expect(getTicketStatusVariant('cancelled')).toBe('rose');
        expect(getTicketStatusVariant('rejected')).toBe('rose');
        expect(getTicketStatusVariant('in_progress')).toBe('blue');
        expect(getTicketStatusVariant(undefined)).toBe('amber');

        expect(getTicketStatusLabel('in_progress')).toBe('En gestión');
        expect(getTicketStatusLabel('completed')).toBe('Completado');
        expect(getTicketStatusLabel(undefined)).toBe('Pendiente');
    });

    it('normaliza el seguimiento de fallas', () => {
        expect(getFollowupMeta('Resuelto')).toEqual({
            label: 'Resuelto',
            variant: 'emerald',
        });
        expect(getFollowupMeta('Requiere reposición')).toEqual({
            label: 'Requiere reposición',
            variant: 'blue',
        });
        expect(getFollowupMeta('cualquier cosa')).toEqual({
            label: 'En revisión',
            variant: 'amber',
        });
    });

    it('mapea prioridades de ticket', () => {
        expect(getTicketPriorityVariant('Urgente')).toBe('rose');
        expect(getTicketPriorityVariant('alta')).toBe('rose');
        expect(getTicketPriorityVariant('Media')).toBe('amber');
        expect(getTicketPriorityVariant('baja')).toBe('blue');
        expect(getTicketPriorityVariant('otra')).toBe('slate');
    });
});
