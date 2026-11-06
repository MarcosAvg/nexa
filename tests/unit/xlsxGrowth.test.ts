import { describe, it, expect } from 'vitest';
import type { DashboardGrowth } from '../../src/lib/types';
import { exportDashboardGrowthToExcel } from '../../src/lib/utils/xlsxGrowth';

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

describe('utils/xlsxGrowth', () => {
    it('genera un libro con resumen y una hoja por corte, incluyendo edificios de la dependencia', async () => {
        const { buffer, filename } = await exportDashboardGrowthToExcel(
            growth,
            { orgName: 'Gobierno de Nuevo León', mediaTypeName: 'KONE' },
            true,
        );

        expect(filename).toBe('Crecimiento_Personal_Gobierno_de_Nuevo_Leon_KONE_2026-01-01_2026-11-06.xlsx');

        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        expect(workbook.worksheets.map((ws) => ws.name)).toEqual([
            'Resumen general',
            'Por edificio',
            'Por dependencia',
            'Por piso',
        ]);

        const summarySheet = workbook.getWorksheet('Resumen general');
        expect(String(summarySheet?.getCell('A2').value)).toContain('Tipo de tarjeta: KONE');
        expect(summarySheet?.getCell('B5').value).toBe(100);
        expect(summarySheet?.getCell('B6').value).toBe(125);
        expect(summarySheet?.getCell('B7').value).toBe(25);
        expect(summarySheet?.getCell('B8').value).toBe(0.25);
        expect(summarySheet?.getCell('B8').numFmt).toBe('0.0%');

        const dependencySheet = workbook.getWorksheet('Por dependencia');
        expect(dependencySheet?.getCell('A4').value).toBe('DEPENDENCIA');
        expect(dependencySheet?.getCell('B4').value).toBe('EDIFICIO(S)');
        expect(dependencySheet?.getCell('A5').value).toBe('Contraloría');
        expect(dependencySheet?.getCell('B5').value).toBe('Torre Administrativa, Biblioteca Central');
        expect(dependencySheet?.getCell('C5').value).toBe(10);
        expect(dependencySheet?.getCell('D5').value).toBe(12);
        expect(dependencySheet?.getCell('E5').value).toBe(2);
        expect(dependencySheet?.getCell('F5').value).toBe(0.2);
        expect(dependencySheet?.getCell('F5').numFmt).toBe('0.0%');
    });
});
