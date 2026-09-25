import { describe, it, expect, vi, afterEach } from 'vitest';
import { capitalize, fullName, personDisplayName, formatDate, timeAgo } from '../../src/lib/utils/format';

afterEach(() => {
    vi.useRealTimers();
});

describe('utils/format', () => {
    it('capitalize', () => {
        expect(capitalize('hola')).toBe('Hola');
        expect(capitalize('')).toBe('');
    });

    it('fullName', () => {
        expect(fullName('Ana', 'López')).toBe('Ana López');
        expect(fullName(null, 'López')).toBe('López');
        expect(fullName()).toBe('');
    });

    it('personDisplayName', () => {
        expect(personDisplayName({ name: 'Alias' })).toBe('Alias');
        expect(personDisplayName({ nombres: 'Ana', apellidos: 'López' })).toBe('López Ana');
        expect(personDisplayName({ first_name: 'Ana', last_name: 'López' })).toBe('Ana López');
        expect(personDisplayName(null)).toBe('—');
    });

    it('formatDate devuelve em dash para valores inválidos', () => {
        expect(formatDate(null)).toBe('—');
        expect(formatDate('no-es-fecha')).toBe('—');
    });

    it('timeAgo con reloj controlado', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T00:05:00Z'));
        expect(timeAgo('2024-01-01T00:00:00Z')).toBe('hace 5 minutos');
        expect(timeAgo('2023-12-31T23:05:00Z')).toBe('hace 1 hora');
        expect(timeAgo(null)).toBe('—');
    });
});
