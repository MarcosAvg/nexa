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
export { mediaTypeVariant, mediaTypeDotClass, mediaTypeRgb } from './mediaTypeAppearance';
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
    exportUsageToExcel,
} from './xlsxExport';

export {
    exportPersonnelAllDependenciesAsZip,
    exportResponsivasAllDependenciesAsZip,
    exportCardlessRegistryAllDependenciesAsZip,
    exportUsageAllDependenciesAsZip,
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
    parseUsageFile,
    findDuplicateFolios,
    getDuplicateFoliosSummary,
    matchUsageToPersonnel,
} from './xlsxUsage';
export type { UsageEntry, UsageMatchedEntry, UsageMatchResult, DuplicateFolioInfo } from './xlsxUsage';

export { generateMediaTemplate, generateUsageTemplate } from './xlsxTemplate';

export { computePersonStatus } from './personStatus';
export type { StatusCardInput } from './personStatus';

export { exportConflictReportToExcel } from './xlsxConflictReport';
export type { ConflictReportInput } from './xlsxConflictReport';


