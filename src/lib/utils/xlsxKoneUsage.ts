import ExcelJS from 'exceljs';
import { supabase } from '../supabase';
import type { ExportPersonnelData } from './xlsxExport';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface KoneUsageEntry {
    folio: string;
    conteo: number;
}

export interface KoneUsageMatchedEntry {
    folio: string;
    conteo: number;
    person: ExportPersonnelData;
}

export interface KoneUsageMatchResult {
    matched: KoneUsageMatchedEntry[];
    unmatched: KoneUsageEntry[];
    totalImported: number;
}

// ─────────────────────────────────────────
// Parse Excel File
// ─────────────────────────────────────────

/**
 * Reads an Excel file with "Folio" and "Conteo" columns.
 * Prioritizes Column A for Folios and treats them as text (preserving leading zeros).
 */
export async function parseKoneUsageFile(file: File): Promise<KoneUsageEntry[]> {
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error('El archivo Excel no contiene hojas.');

    // Find column indices by scanning headers
    let folioCol = -1;
    let conteoCol = -1;
    let headerRow = -1;

    worksheet.eachRow((row, rowNumber) => {
        if (folioCol >= 0 && conteoCol >= 0) return; // Already found

        row.eachCell((cell, colNumber) => {
            const val = String(cell.value ?? '').trim().toLowerCase();
            // We search for "folio" and "conteo".
            // If we find folio in Column A (colNumber 1), we lock it.
            if (val === 'folio') {
                folioCol = colNumber;
                headerRow = rowNumber;
            }
            if (val === 'conteo') {
                conteoCol = colNumber;
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
        // If cell.text is empty, fallback to String(cell.value)
        const folio = (folioCell.text || String(folioCell.value ?? '')).trim();

        const conteoRaw = conteoCell.value;
        const conteo = typeof conteoRaw === 'number'
            ? conteoRaw
            : parseInt(String(conteoRaw ?? '0').trim(), 10);

        if (folio && !isNaN(conteo)) {
            entries.push({ folio, conteo });
        }
    });

    return entries;
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

    // Build a folio→conteo map (in case of duplicates, sum conteos)
    const conteoMap = new Map<string, number>();
    for (const entry of entries) {
        conteoMap.set(entry.folio, (conteoMap.get(entry.folio) || 0) + entry.conteo);
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

    for (const [folio, conteo] of conteoMap) {
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

            matched.push({ folio, conteo, person });
        } else {
            unmatched.push({ folio, conteo });
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
