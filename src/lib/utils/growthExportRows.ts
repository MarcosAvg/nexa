import type { DashboardGrowth, GrowthDependency, GrowthFloor } from '../types';

/** Delta base del reporte de crecimiento. `percent` se expresa como fracción (0.25 = 25%). */
export interface GrowthBaseDelta {
    initial: number;
    final: number;
    increment: number;
    percent: number | null;
}

/** Fila con nombre para edificios y dependencias. */
export interface GrowthBaseRow extends GrowthBaseDelta {
    name: string;
}

export interface GrowthDependencyRow extends GrowthBaseRow {
    buildings: string;
}

export interface GrowthFloorRow extends GrowthBaseDelta {
    building: string;
    floor: string;
}

export interface GrowthSummary {
    initial: number;
    final: number;
    increment: number;
    percent: number | null;
}

/** El indicador entrega el porcentaje como 0-100; Excel lo espera como fracción. */
export function growthPercentFraction(percent: number | null): number | null {
    return percent === null ? null : percent / 100;
}

/** Une los edificios de una dependencia en una sola celda. */
export function formatDependencyBuildings(buildings: string[] | null | undefined): string {
    if (!buildings || buildings.length === 0) return '—';
    return buildings.join(', ');
}

export function buildGrowthSummary(growth: DashboardGrowth): GrowthSummary {
    return {
        initial: growth.totals.initial,
        final: growth.totals.final,
        increment: growth.totals.increment,
        percent: growthPercentFraction(growth.totals.percent),
    };
}

export function buildGrowthBuildingRows(growth: DashboardGrowth): GrowthBaseRow[] {
    return growth.byBuilding.map((building) => ({
        name: building.name,
        initial: building.initial,
        final: building.final,
        increment: building.increment,
        percent: growthPercentFraction(building.percent),
    }));
}

export function buildGrowthDependencyRows(growth: DashboardGrowth): GrowthDependencyRow[] {
    return growth.byDependency.map((dependency: GrowthDependency) => ({
        name: dependency.name,
        buildings: formatDependencyBuildings(dependency.buildings),
        initial: dependency.initial,
        final: dependency.final,
        increment: dependency.increment,
        percent: growthPercentFraction(dependency.percent),
    }));
}

export function buildGrowthFloorRows(growth: DashboardGrowth): GrowthFloorRow[] {
    return growth.byFloor.map((floor: GrowthFloor) => ({
        building: floor.buildingName,
        floor: floor.label,
        initial: floor.initial,
        final: floor.final,
        increment: floor.increment,
        percent: growthPercentFraction(floor.percent),
    }));
}

/** Rango del reporte en formato legible para el encabezado. */
export function growthPeriodLabel(growth: DashboardGrowth): string {
    if (!growth.startDate && !growth.endDate) return 'Desde creación';
    return `${growth.startDate ?? '—'} a ${growth.endDate ?? '—'}`;
}

function fileSlug(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/** Nombre del archivo: incluye organización y periodo cuando están disponibles. */
export function growthExportFileName(growth: DashboardGrowth, orgName: string): string {
    const parts = ['Crecimiento', 'Personal'];
    const org = fileSlug(orgName);
    if (org) parts.push(org);
    const start = growth.startDate ?? new Date().toISOString().split('T')[0];
    const end = growth.endDate ?? new Date().toISOString().split('T')[0];
    parts.push(start, end);
    return `${parts.join('_')}.xlsx`;
}
