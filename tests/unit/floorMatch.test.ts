import { describe, it, expect } from 'vitest';
import {
    normalizeFloorLabel,
    resolveFloorLabel,
    resolveFloorList,
    buildFloorResolver,
} from '../../src/lib/utils/floorMatch';

describe('utils/floorMatch', () => {
    it('normaliza acentos, mayúsculas y espacios', () => {
        expect(normalizeFloorLabel('  Piso  3  ')).toBe('piso 3');
        expect(normalizeFloorLabel('Sótano')).toBe('sotano');
    });

    it('resuelve por número y por alias especial', () => {
        expect(resolveFloorLabel('piso 3', ['3', 'Planta Baja'])).toBe('3');
        expect(resolveFloorLabel('3°', ['3'])).toBe('3');
        expect(resolveFloorLabel('pb', ['Planta Baja'])).toBe('Planta Baja');
        expect(resolveFloorLabel('sot', ['Sótano'])).toBe('Sótano');
        expect(resolveFloorLabel('zzz', ['3'])).toBeNull();
        expect(resolveFloorLabel('', ['3'])).toBeNull();
    });

    it('resolveFloorList separa resueltos y no reconocidos y deduplica', () => {
        const { resolved, unresolved } = resolveFloorList(['piso 3', '4', 'piso 3', 'zz'], ['3', '4']);
        expect(resolved).toEqual(['3', '4']);
        expect(unresolved).toEqual(['zz']);
    });

    it('buildFloorResolver resuelve por edificio', () => {
        const resolve = buildFloorResolver([
            { id: 1, label: '3', building_id: 10 },
            { id: 2, label: 'Planta Baja', building_id: 10 },
            { id: 3, label: '1', building_id: 20 },
        ]);
        expect(resolve(10, 'piso 3')).toBe(1);
        expect(resolve(10, 'pb')).toBe(2);
        expect(resolve(20, '1')).toBe(3);
        expect(resolve(99, '1')).toBeNull();
    });
});
