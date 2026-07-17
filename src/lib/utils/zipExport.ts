/**
 * zipExport.ts
 *
 * Bulk "export all dependencies" utilities.
 * Generates one Excel file per dependency and bundles them in a ZIP.
 */

import { personnelService } from '../services/personnel';
import { ticketService } from '../services/tickets';
import { cardlessRegistryService } from '../services/cardlessRegistry';
import {
    exportPersonnelToExcel,
    exportResponsivasToExcel,
    exportCardlessRegistryToExcel,
    exportKoneUsageToExcel,
} from './xlsxExport';
import type { ExportOptions } from './xlsxExport';
import type { KoneUsageMatchResult } from './xlsxKoneUsage';

export type ZipProgressCallback = (current: number, total: number, label: string) => void;

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Sanitise a dependency name for use as a filename / folder label. */
function safeName(dep: string): string {
    return dep.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').replace(/\s+/g, '_');
}

async function buildZip(
    files: { buffer: ArrayBuffer; filename: string }[],
    zipName: string
): Promise<void> {
    const JSZip = (await import('jszip')).default;
    const { saveAs } = await import('file-saver');

    const zip = new JSZip();
    for (const { buffer, filename } of files) {
        zip.file(filename, buffer);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    saveAs(zipBlob, zipName);
}

// ─── Personnel ZIP ─────────────────────────────────────────────────────────

/**
 * Exports the personnel directory for every dependency as individual Excel
 * files bundled in a single ZIP.
 */
export async function exportPersonnelAllDependenciesAsZip(
    dependencies: { id: string; name: string }[],
    globalFilters: { status?: string; search?: string } = {},
    onProgress?: ZipProgressCallback
): Promise<void> {
    const dateStr = new Date().toISOString().split('T')[0];
    const files: { buffer: ArrayBuffer; filename: string }[] = [];
    const total = dependencies.length;

    for (let i = 0; i < dependencies.length; i++) {
        const dep = dependencies[i];
        onProgress?.(i, total, dep.name);

        const data = await personnelService.fetchForExport(
            globalFilters.search ?? '',
            globalFilters.status ?? 'Todos',
            dep.id,
        );

        if (data.length === 0) continue;

        const options: ExportOptions = {
            filters: {
                status: globalFilters.status,
                dependency: dep.name,
                search: globalFilters.search,
            },
            splitByDependency: false,
        };

        const result = await exportPersonnelToExcel(data as any[], options, true);
        files.push(result);
    }

    if (files.length === 0) return;

    onProgress?.(total, total, 'Comprimiendo...');
    await buildZip(files, `Directorio_Personal_Por_Dependencia_${dateStr}.zip`);
}

// ─── Responsivas ZIP ───────────────────────────────────────────────────────

/**
 * Exports pending responsivas for every dependency as individual Excel
 * files bundled in a single ZIP.
 */
export async function exportResponsivasAllDependenciesAsZip(
    dependencies: { id: string; name: string }[],
    onProgress?: ZipProgressCallback
): Promise<void> {
    const dateStr = new Date().toISOString().split('T')[0];
    const files: { buffer: ArrayBuffer; filename: string }[] = [];
    const total = dependencies.length;

    for (let i = 0; i < dependencies.length; i++) {
        const dep = dependencies[i];
        onProgress?.(i, total, dep.name);

        const data = await ticketService.fetchResponsivasForExport(dep.id);
        if (data.length === 0) continue;

        const result = await exportResponsivasToExcel(data, dep.name, true);
        files.push(result);
    }

    if (files.length === 0) return;

    onProgress?.(total, total, 'Comprimiendo...');
    await buildZip(files, `Responsivas_Por_Dependencia_${dateStr}.zip`);
}

// ─── Cardless Registry ZIP ─────────────────────────────────────────────────

/**
 * Exports the cardless registry for every dependency as individual Excel
 * files bundled in a single ZIP.
 */
export async function exportCardlessRegistryAllDependenciesAsZip(
    dependencies: { id: string; name: string }[],
    baseFilters: {
        startDate?: string;
        endDate?: string;
        reason?: string;
        search?: string;
    } = {},
    onProgress?: ZipProgressCallback
): Promise<void> {
    const dateStr = new Date().toISOString().split('T')[0];
    const files: { buffer: ArrayBuffer; filename: string }[] = [];
    const total = dependencies.length;

    for (let i = 0; i < dependencies.length; i++) {
        const dep = dependencies[i];
        onProgress?.(i, total, dep.name);

        const rows = await cardlessRegistryService.fetchAllMatching({
            ...baseFilters,
            dependencyId: dep.id,
        });
        if (rows.length === 0) continue;

        const result = await exportCardlessRegistryToExcel(
            rows,
            {
                ...baseFilters,
                dependency: dep.name,
            },
            true,
        );
        files.push(result);
    }

    if (files.length === 0) return;

    onProgress?.(total, total, 'Comprimiendo...');
    await buildZip(files, `Registro_Sin_Tarjeta_Por_Dependencia_${dateStr}.zip`);
}

// ─── KONE Usage ZIP ────────────────────────────────────────────────────────

/**
 * Exports the KONE usage report for every dependency (derived from the already
 * matched result) as individual Excel files bundled in a single ZIP.
 */
export async function exportKoneUsageAllDependenciesAsZip(
    matchResult: KoneUsageMatchResult,
    usageThreshold: number = 10,
    onProgress?: ZipProgressCallback
): Promise<void> {
    const dateStr = new Date().toISOString().split('T')[0];

    // Collect unique dependencies from the matched data
    const depSet = new Set(
        matchResult.matched.map((m) => m.person.dependency || 'Sin Dependencia')
    );
    const depList = Array.from(depSet).sort();

    const files: { buffer: ArrayBuffer; filename: string }[] = [];
    const total = depList.length;

    for (let i = 0; i < depList.length; i++) {
        const dep = depList[i];
        onProgress?.(i, total, dep);

        // Filter the match result to this dependency
        const filteredResult: KoneUsageMatchResult = {
            matched: matchResult.matched.filter(
                (m) => (m.person.dependency || 'Sin Dependencia') === dep
            ),
            unmatched: matchResult.unmatched,
            totalImported: matchResult.totalImported,
        };

        if (filteredResult.matched.length === 0) continue;

        const result = await exportKoneUsageToExcel(
            filteredResult,
            usageThreshold,
            dep,
            true,
        );
        files.push(result);
    }

    if (files.length === 0) return;

    onProgress?.(total, total, 'Comprimiendo...');
    await buildZip(files, `Conteo_Uso_KONE_Por_Dependencia_${dateStr}.zip`);
}
