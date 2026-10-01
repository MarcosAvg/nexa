import { describe, it, expect } from 'vitest';
import { quotePostgrestValue, postgrestInList, orWithNone } from '../../src/lib/utils/filters';
import { expandPersonnelStatusFilter } from '../../src/lib/constants/status';

describe('utils/filters', () => {
    it('quotePostgrestValue comilla y escapa', () => {
        expect(quotePostgrestValue('P2000')).toBe('"P2000"');
        expect(quotePostgrestValue('Media de otro edificio')).toBe('"Media de otro edificio"');
        expect(quotePostgrestValue(42)).toBe('"42"');
    });

    it('postgrestInList genera la lista entre paréntesis', () => {
        expect(postgrestInList(['a', 'b'])).toBe('("a","b")');
        expect(postgrestInList([])).toBe('()');
    });

    it('orWithNone combina NULL con valores reales', () => {
        expect(orWithNone('building_id', ['1', '__none__'])).toBe('building_id.is.null,building_id.in.("1")');
        expect(orWithNone('floor', ['__none__'])).toBe('floor.is.null');
        expect(orWithNone('floor', ['1', '2'])).toBe('floor.in.("1","2")');
        expect(orWithNone('floor', [])).toBe('');
    });
});

describe('constants/status', () => {
    it('expandPersonnelStatusFilter devuelve la selección directa', () => {
        expect(expandPersonnelStatusFilter([])).toEqual([]);
        expect(expandPersonnelStatusFilter(['Baja', 'Activo/a'])).toEqual(['Baja', 'Activo/a']);
    });

    it('expandPersonnelStatusFilter resuelve "No Activos" como complemento', () => {
        const result = expandPersonnelStatusFilter(['No Activos']);
        expect(result).not.toContain('No Activos');
        expect(result).toContain('Baja');
        expect(result).toContain('Sin Acceso');
        expect(result).toContain('En proceso');
        expect(result).not.toContain('Activo/a');
        expect(result).not.toContain('Parcial');
        expect(result).not.toContain('Media de otro edificio');
    });

    it('expandPersonnelStatusFilter une "No Activos" con selecciones activas', () => {
        const result = expandPersonnelStatusFilter(['No Activos', 'Activo/a']);
        expect(result).toContain('Activo/a');
        expect(result).toContain('Baja');
    });
});
