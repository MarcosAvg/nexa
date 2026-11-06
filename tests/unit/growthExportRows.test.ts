import { describe, it, expect } from 'vitest';
import type { DashboardGrowth } from '../../src/lib/types';
import {
    buildGrowthBuildingRows,
    buildGrowthDependencyRows,
    buildGrowthFloorRows,
    buildGrowthSummary,
    formatDependencyBuildings,
    growthExportFileName,
    growthPercentFraction,
} from '../../src/lib/utils/growthExportRows';

const growth: DashboardGrowth = {
    startDate: '2026-01-01',
    endDate: '2026-11-06',
    minCreatedAt: '2025-06-01',
    totals: { initial: 100, final: 125, increment: 25, percent: 25 },
    byDependency: [
        {
            id: 1,
            name: 'Contraloría',
            sort_order: 1,
            initial: 10,
            final: 12,
            increment: 2,
            percent: 20,
            buildings: ['Torre Administrativa', 'Biblioteca Central'],
        },
        {
            id: 2,
            name: 'Registro Civil',
            sort_order: 2,
            initial: 0,
            final: 3,
            increment: 3,
            percent: null,
        },
    ],
    byBuilding: [
        {
            id: 10,
            name: 'Torre Administrativa',
            sort_order: 1,
            initial: 50,
            final: 60,
            increment: 10,
            percent: 20,
        },
    ],
    byFloor: [
        {
            buildingId: 10,
            buildingName: 'Torre Administrativa',
            floorId: 100,
            label: 'Piso 1',
            initial: 20,
            final: 22,
            increment: 2,
            percent: 10,
        },
    ],
};

describe('utils/growthExportRows', () => {
    it('convierte el porcentaje del indicador a fracción numérica', () => {
        expect(growthPercentFraction(25)).toBe(0.25);
        expect(growthPercentFraction(-5.5)).toBe(-0.055);
        expect(growthPercentFraction(null)).toBeNull();
    });

    it('lista los edificios de una dependencia y usa guion si no tiene', () => {
        expect(formatDependencyBuildings(['Torre Administrativa', 'Biblioteca Central'])).toBe(
            'Torre Administrativa, Biblioteca Central',
        );
        expect(formatDependencyBuildings([])).toBe('—');
        expect(formatDependencyBuildings(undefined)).toBe('—');
    });

    it('arma las filas de dependencia con su(s) edificio(s)', () => {
        expect(buildGrowthDependencyRows(growth)).toEqual([
            {
                name: 'Contraloría',
                buildings: 'Torre Administrativa, Biblioteca Central',
                initial: 10,
                final: 12,
                increment: 2,
                percent: 0.2,
            },
            {
                name: 'Registro Civil',
                buildings: '—',
                initial: 0,
                final: 3,
                increment: 3,
                percent: null,
            },
        ]);
    });

    it('arma las filas de edificio y piso', () => {
        expect(buildGrowthBuildingRows(growth)).toEqual([
            {
                name: 'Torre Administrativa',
                initial: 50,
                final: 60,
                increment: 10,
                percent: 0.2,
            },
        ]);
        expect(buildGrowthFloorRows(growth)).toEqual([
            {
                building: 'Torre Administrativa',
                floor: 'Piso 1',
                initial: 20,
                final: 22,
                increment: 2,
                percent: 0.1,
            },
        ]);
    });

    it('expone el resumen general del indicador', () => {
        expect(buildGrowthSummary(growth)).toEqual({
            initial: 100,
            final: 125,
            increment: 25,
            percent: 0.25,
        });
    });

    it('genera un nombre de archivo con organización, tipo de tarjeta y periodo', () => {
        expect(growthExportFileName(growth, 'Gobierno de Nuevo León')).toBe(
            'Crecimiento_Personal_Gobierno_de_Nuevo_Leon_2026-01-01_2026-11-06.xlsx',
        );
        expect(growthExportFileName(growth, 'Gobierno de Nuevo León', 'KONE')).toBe(
            'Crecimiento_Personal_Gobierno_de_Nuevo_Leon_KONE_2026-01-01_2026-11-06.xlsx',
        );
    });
});
