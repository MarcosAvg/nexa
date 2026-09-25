// ─── Barrel File — src/lib/utils/index.ts ─────────────────────────────
// Re-exporta utilidades ligeras para imports simplificados.
//
// ⚠ IMPORTANTE: este barrel NO debe reexportar runtime de módulos pesados
// (ExcelJS, jsPDF, JSZip). Esos se importan con `await import(...)` dentro de
// los handlers que los usan, para no inflar el chunk inicial. Los `export type`
// sí son seguros (se borran al compilar).
//
// Uso: import { handleError, batchPaginate, ... } from '../utils';

export {
    AppError,
    handleError,
    setErrorReporter,
    withErrorHandling,
    withErrorHandlingSafe,
    withErrorHandlingConditional,
    withTimeout,
    withRetry,
    isTransientError,
} from './error';
export type { RetryOptions } from './error';
export { batchPaginate, batchForEach, batchCollectIds } from './batchPaginate';
export type { DbError } from './batchPaginate';
// NOTA: appEvents.ts fue eliminado — las suscripciones ahora se manejan
// directamente vía Supabase Realtime y llamadas a stores.

export { dbCache } from './dbCache';
export { scrollLock } from './scrollLock';
export { overlayStack } from './overlayStack';
export { overlayHistory } from './overlayHistory';
export { longPress, swipe } from './gestures';
export { haptic } from './haptics';
export { toastWithUndo } from './undoToast';
export type { UndoToastOptions } from './undoToast';
export { catalogCache } from './catalogCache';
export { generateLegalHash } from './crypto';
export { mediaTypeVariant, mediaTypeDotClass, mediaTypeRgb } from './mediaTypeAppearance';
export { personnelActions } from './personnelActions';
export { initGlobalRealtime, destroyGlobalRealtime } from './realtime';
export { createSimpleDebounce } from './search.svelte';

// ─── Tipos de exportadores/importadores (solo tipos, sin runtime) ──────
export type {
    ExportPersonnelData,
    ExportOptions,
    CardlessRegistryExportRow,
    CardlessRegistryExportFilters,
} from './xlsxExport';
export type { ZipProgressCallback } from './zipExport';
export type { SheetKey, ParsedRow, ParsedSheet, ImportParseResult } from './xlsxFields';
export type { UsageEntry, UsageMatchedEntry, UsageMatchResult, DuplicateFolioInfo } from './xlsxUsage';
export type { ConflictReportInput } from './xlsxConflictReport';

// Símbolos ligeros de plantillas (sin ExcelJS).
export { SHEET_TO_TICKET_TYPE, FIELD_LABELS, parseFloors, normalizeEmailText } from './xlsxFields';

export { applyFloorAction, isAction } from './floorActions';
export type { FloorAction } from './floorActions';

export { normalizeFloorLabel, resolveFloorLabel, resolveFloorList, buildFloorResolver } from './floorMatch';

export { capitalize, fullName, personDisplayName, formatDate, formatDateTime, timeAgo } from './format';

export { updateWithLock, fetchCurrentVersion } from './optimisticLock';

export { computePersonStatus } from './personStatus';
export type { StatusCardInput } from './personStatus';
