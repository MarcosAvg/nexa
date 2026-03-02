import ExcelJS from 'exceljs';
import { supabase } from '../supabase';
import type { ExportPersonnelData } from './xlsxExport';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface KoneUsageEntry {
    folio: string;
    conteo: number;
    diasInactividad: number | null;
}

export interface KoneUsageMatchedEntry {
    folio: string;
    conteo: number;
    diasInactividad: number | null;
    person: ExportPersonnelData;
}

export interface KoneUsageMatchResult {
    matched: KoneUsageMatchedEntry[];
    unmatched: KoneUsageEntry[];
    totalImported: number;
}

export interface DuplicateFolioInfo {
    folio: string;
    occurrences: number;
    totalConteo: number;
    rows: { conteo: number; diasInactividad: number | null }[];
}

// ─────────────────────────────────────────
// Parse Excel File
// ─────────────────────────────────────────

/**
 * Reads an Excel file with "Folio" and "Conteo" columns.
 * Prioritizes Column A for Folios and treats them as text (preserving leading zeros).
 */
function parseExcelDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') {
        const utcDays = Math.floor(value - 25569);
        const utcValue = utcDays * 86400;
        return new Date(utcValue * 1000);
    }
    if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) return parsed;

        const parts = value.split(/[/: -]/);
        if (parts.length >= 3) {
            let d = parseInt(parts[0], 10);
            let m = parseInt(parts[1], 10) - 1;
            let y = parseInt(parts[2], 10);
            if (y < 100) y += 2000;
            const maybeDate = new Date(y, m, d);
            if (!isNaN(maybeDate.getTime())) return maybeDate;
        }
    }
    return null;
}

export async function parseKoneUsageFile(
    file: File,
    creationLimitDate: string,
    inactivityLimitDate: string
): Promise<KoneUsageEntry[]> {
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error('El archivo Excel no contiene hojas.');

    // Find column indices by scanning headers
    let folioCol = -1;
    let conteoCol = -1;
    let ultimaModCol = -1;
    let ultimoRegCol = -1;
    let headerRow = -1;

    worksheet.eachRow((row, rowNumber) => {
        if (folioCol >= 0 && conteoCol >= 0 && ultimaModCol >= 0 && ultimoRegCol >= 0) return; // Already found

        row.eachCell((cell, colNumber) => {
            const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const valNorm = normalize(String(cell.value ?? '').trim());
            // We search for "folio" and "conteo".
            // If we find folio in Column A (colNumber 1), we lock it.
            if (valNorm === 'folio') {
                folioCol = colNumber;
                headerRow = rowNumber;
            }
            if (valNorm === 'conteo') {
                conteoCol = colNumber;
            }
            if (valNorm.includes('ultima modificacion')) {
                ultimaModCol = colNumber;
            }
            if (valNorm.includes('ultimo registro')) {
                ultimoRegCol = colNumber;
            }
        });
    });

    // Final validation of columns
    if (folioCol < 0 || conteoCol < 0) {
        throw new Error('No se encontraron las columnas "Folio" y "Conteo" en el archivo.');
    }

    // Extract data rows
    const entries: KoneUsageEntry[] = [];

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRow) return;

        const folioCell = row.getCell(folioCol);
        const conteoCell = row.getCell(conteoCol);

        // USE cell.text to get the literal string shown in Excel (handles numeric folios/leading zeros)
        const folio = (folioCell.text || String(folioCell.value ?? '')).trim();

        const conteoRaw = conteoCell.value;
        const conteo = typeof conteoRaw === 'number'
            ? conteoRaw
            : parseInt(String(conteoRaw ?? '0').trim(), 10);

        let ultimaModDate: Date | null = null;
        let ultimoRegDate: Date | null = null;

        if (ultimaModCol > 0) {
            ultimaModDate = parseExcelDate(row.getCell(ultimaModCol).value);
        }
        if (ultimoRegCol > 0) {
            ultimoRegDate = parseExcelDate(row.getCell(ultimoRegCol).value);
        }

        const parsedCreationLimit = creationLimitDate ? new Date(creationLimitDate + 'T00:00:00') : null;
        const parsedInactivityLimit = inactivityLimitDate ? new Date(inactivityLimitDate + 'T00:00:00') : null;

        if (parsedCreationLimit && ultimaModDate) {
            if (ultimaModDate > parsedCreationLimit) {
                return; // Exclude card created/modified recently
            }
        }

        let diasInactividad: number | null = null;
        if (parsedInactivityLimit && ultimoRegDate) {
            const diffTime = parsedInactivityLimit.getTime() - ultimoRegDate.getTime();
            diasInactividad = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (diasInactividad < 0) diasInactividad = 0;
        }

        if (folio && !isNaN(conteo)) {
            entries.push({ folio, conteo, diasInactividad });
        }
    });

    return entries;
}

// ─────────────────────────────────────────
// Find Duplicate Folios
// ─────────────────────────────────────────

/**
 * Identifies duplicate folios in the parsed entries and returns detailed information.
 * Useful for debugging and understanding why totalImported differs from raw row count.
 */
export function findDuplicateFolios(entries: KoneUsageEntry[]): DuplicateFolioInfo[] {
    const folioMap = new Map<string, { conteo: number; diasInactividad: number | null }[]>();
    
    // Group all entries by folio
    for (const entry of entries) {
        const existing = folioMap.get(entry.folio);
        if (existing) {
            existing.push({ conteo: entry.conteo, diasInactividad: entry.diasInactividad });
        } else {
            folioMap.set(entry.folio, [{ conteo: entry.conteo, diasInactividad: entry.diasInactividad }]);
        }
    }
    
    // Find folios with multiple occurrences (duplicates)
    const duplicates: DuplicateFolioInfo[] = [];
    for (const [folio, rows] of folioMap.entries()) {
        if (rows.length > 1) {
            const totalConteo = rows.reduce((sum, row) => sum + row.conteo, 0);
            duplicates.push({
                folio,
                occurrences: rows.length,
                totalConteo,
                rows
            });
        }
    }
    
    // Sort by total occurrences descending
    duplicates.sort((a, b) => b.occurrences - a.occurrences);
    
    return duplicates;
}

/**
 * Returns a summary string of duplicate folios for logging or display purposes.
 */
export function getDuplicateFoliosSummary(duplicates: DuplicateFolioInfo[]): string {
    if (duplicates.length === 0) {
        return 'No se encontraron folios duplicados.';
    }
    
    const totalDuplicates = duplicates.reduce((sum, dup) => sum + dup.occurrences, 0);
    const uniqueDuplicates = duplicates.length;
    const totalDuplicateRows = totalDuplicates - uniqueDuplicates;
    
    let summary = `Se encontraron ${uniqueDuplicates} folios duplicados (${totalDuplicateRows} filas extra):\n\n`;
    
    duplicates.forEach((dup, index) => {
        summary += `${index + 1}. Folio "${dup.folio}" aparece ${dup.occurrences} veces:\n`;
        dup.rows.forEach((row, i) => {
            summary += `   - Fila ${i + 1}: conteo=${row.conteo}, inactividad=${row.diasInactividad || 'N/A'}\n`;
        });
        summary += `   - Total conteo: ${dup.totalConteo}\n\n`;
    });
    
    return summary;
}

// ─────────────────────────────────────────
// Match Folios to Personnel via Supabase
// ─────────────────────────────────────────

/**
 * Looks up KONE cards by folio in the database, joining personnel data.
 * Returns matched entries with full person data and unmatched entries.
 * Handles Supabase 1000-record limit and chunks large folio lists.
 */
export async function matchKoneUsageToPersonnel(
    entries: KoneUsageEntry[]
): Promise<KoneUsageMatchResult> {
    if (entries.length === 0) {
        return { matched: [], unmatched: [], totalImported: 0 };
    }

    // Build a folio→Map info (in case of duplicates, keep newest or sum? Let's sum conteos, and preserve minimum inactividad)
    const conteoMap = new Map<string, { conteo: number, diasInactividad: number | null }>();
    for (const entry of entries) {
        const existing = conteoMap.get(entry.folio);
        if (existing) {
            existing.conteo += entry.conteo;
            if (entry.diasInactividad !== null && existing.diasInactividad !== null) {
                existing.diasInactividad = Math.min(existing.diasInactividad, entry.diasInactividad);
            } else if (entry.diasInactividad !== null) {
                existing.diasInactividad = entry.diasInactividad;
            }
        } else {
            conteoMap.set(entry.folio, { conteo: entry.conteo, diasInactividad: entry.diasInactividad });
        }
    }

    const folios = Array.from(conteoMap.keys());
    const allMatchingCards: any[] = [];

    // Chunking to avoid extremely long queries and handle pagination
    const CHUNK_SIZE = 500;
    for (let i = 0; i < folios.length; i += CHUNK_SIZE) {
        const chunk = folios.slice(i, i + CHUNK_SIZE);
        let hasMore = true;
        let page = 0;
        const PAGE_SIZE = 1000;

        while (hasMore) {
            const { data: cards, error } = await supabase
                .from('cards')
                .select(`
                    id, folio, type, status, person_id,
                    personnel (
                        id, first_name, last_name, employee_no, email, area, position, floor, status,
                        buildings ( name ),
                        dependencies ( name ),
                        schedules ( name, default_entry, default_exit ),
                        cards ( id, folio, type, status, programming_status, responsiva_status ),
                        floors_p2000, floors_kone, special_accesses, entry_time, exit_time
                    )
                `)
                .eq('type', 'KONE')
                .in('folio', chunk)
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            if (error) {
                throw new Error(`Error al buscar tarjetas (chunk ${i}): ${error.message}`);
            }

            if (cards && cards.length > 0) {
                allMatchingCards.push(...cards);
                if (cards.length < PAGE_SIZE) {
                    hasMore = false;
                } else {
                    page++;
                }
            } else {
                hasMore = false;
            }
        }
    }

    // Build a lookup: folio → card data
    const cardByFolio = new Map<string, any>();
    for (const card of allMatchingCards) {
        if (card.personnel) {
            cardByFolio.set(card.folio, card);
        }
    }

    const matched: KoneUsageMatchedEntry[] = [];
    const unmatched: KoneUsageEntry[] = [];
    for (const [folio, data] of conteoMap) {
        const card = cardByFolio.get(folio);
        if (card && card.personnel) {
            const p = card.personnel as any;

            // Map to ExportPersonnelData
            const allCards = (p.cards || []);
            const activeCards = allCards.filter((c: any) => c.status === 'active');
            const readyCards = activeCards.filter(
                (c: any) => c.programming_status === 'done' && (c.responsiva_status === 'signed' || c.responsiva_status === 'legacy')
            );
            const readyTypes = new Set(readyCards.map((c: any) => c.type));

            let displayStatus = 'Baja';
            if (p.status === 'active') {
                if (readyTypes.size >= 2) displayStatus = 'Activo/a';
                else if (readyTypes.size === 1) displayStatus = 'Parcial';
                else if (allCards.length > 0) displayStatus = 'Bloqueado/a';
                else displayStatus = 'Sin Acceso';
            } else if (p.status === 'blocked') {
                displayStatus = 'Bloqueado/a';
            }

            const person: ExportPersonnelData = {
                first_name: p.first_name || '',
                last_name: p.last_name || '',
                employee_no: p.employee_no || '',
                building: p.buildings?.name || 'N/A',
                dependency: p.dependencies?.name || 'N/A',
                area: p.area || '',
                position: p.position || '',
                floor: p.floor || '',
                floors_p2000: p.floors_p2000 || [],
                floors_kone: p.floors_kone || [],
                status: displayStatus,
                specialAccesses: p.special_accesses || [],
                schedule: p.schedules ? {
                    days: p.schedules.name,
                    entry: p.entry_time || p.schedules.default_entry || '09:00',
                    exit: p.exit_time || p.schedules.default_exit || '18:00'
                } : null,
                email: p.email,
                cards: allCards.map((c: any) => ({ type: c.type, folio: c.folio })),
            };

            matched.push({ folio, conteo: data.conteo, diasInactividad: data.diasInactividad, person });
        } else {
            unmatched.push({ folio, conteo: data.conteo, diasInactividad: data.diasInactividad });
        }
    }

    // Sort matches by conteo descending
    matched.sort((a, b) => b.conteo - a.conteo);

    return {
        matched,
        unmatched,
        totalImported: conteoMap.size,
    };
}
