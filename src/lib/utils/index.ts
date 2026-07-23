// ─── Barrel File — src/lib/utils/index.ts ─────────────────────────────
// Re-exporta todas las funciones/clases utilitarias para imports simplificados.
// Uso: import { handleError, batchPaginate, ... } from '../utils';

export { AppError, handleError, withErrorHandling, withErrorHandlingSafe, withErrorHandlingConditional, withTimeout } from './error';
export { batchPaginate, batchForEach, batchCollectIds } from './batchPaginate';
export type { DbError } from './batchPaginate';
// NOTA: appEvents.ts fue eliminado — las suscripciones ahora se manejan
// directamente vía Supabase Realtime y llamadas a stores.

export { dbCache } from './dbCache';
export { catalogCache } from './catalogCache';
export { generateLegalHash } from './crypto';
export { generateCardPdf, generateResponsivaPdf } from './pdfGenerator';
export { personnelActions } from './personnelActions';
export { initGlobalRealtime, destroyGlobalRealtime } from './realtime';
export { createSimpleDebounce } from './search.svelte';

// Exportaciones XLSX y ZIP (a través de xlsxExport barrel que re-exporta submódulos)
export type {
    ExportPersonnelData,
    ExportOptions,
    CardlessRegistryExportRow,
    CardlessRegistryExportFilters,
} from './xlsxExport';

export {
    exportPersonnelToExcel,
    exportResponsivasToExcel,
    exportCardsToExcel,
    exportHistoryToExcel,
    exportCardlessRegistryToExcel,
    exportKoneUsageToExcel,
} from './xlsxExport';

export {
    exportPersonnelAllDependenciesAsZip,
    exportResponsivasAllDependenciesAsZip,
    exportCardlessRegistryAllDependenciesAsZip,
    exportKoneUsageAllDependenciesAsZip,
} from './zipExport';
export type { ZipProgressCallback } from './zipExport';

export {
    parseFloors,
    parseTemplateFile,
    SHEET_TO_TICKET_TYPE,
    FIELD_LABELS,
} from './xlsxImporter';
export type { SheetKey, ParsedRow, ParsedSheet, ImportParseResult } from './xlsxImporter';

export {
    parseKoneUsageFile,
    findDuplicateFolios,
    getDuplicateFoliosSummary,
    matchKoneUsageToPersonnel,
} from './xlsxKoneUsage';
export type { KoneUsageEntry, KoneUsageMatchedEntry, KoneUsageMatchResult, DuplicateFolioInfo } from './xlsxKoneUsage';

export { generateRequestTemplate, generateKoneUsageTemplate } from './xlsxTemplate';

export { exportConflictReportToExcel } from './xlsxConflictReport';
export type { ConflictReportInput } from './xlsxConflictReport';


