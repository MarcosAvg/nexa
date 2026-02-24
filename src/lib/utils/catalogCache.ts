/**
 * catalogCache.ts
 *
 * A simple localStorage-based TTL cache for static catalog data
 * (buildings, dependencies, schedules, special_accesses).
 * These rarely change, so we avoid fetching them on every page load.
 *
 * TTL: 24 hours by default.
 */

const CACHE_KEY_PREFIX = 'nexa_catalog_';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

export const catalogCache = {
    get<T>(key: string): T | null {
        try {
            const raw = localStorage.getItem(CACHE_KEY_PREFIX + key);
            if (!raw) return null;
            const entry: CacheEntry<T> = JSON.parse(raw);
            if (Date.now() > entry.expiresAt) {
                localStorage.removeItem(CACHE_KEY_PREFIX + key);
                return null;
            }
            return entry.data;
        } catch {
            return null;
        }
    },

    set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
        try {
            const entry: CacheEntry<T> = {
                data,
                expiresAt: Date.now() + ttlMs,
            };
            localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(entry));
        } catch {
            // localStorage can be full (e.g., private mode). Silently fail.
        }
    },

    invalidate(key: string): void {
        localStorage.removeItem(CACHE_KEY_PREFIX + key);
    },

    invalidateAll(): void {
        Object.keys(localStorage)
            .filter(k => k.startsWith(CACHE_KEY_PREFIX))
            .forEach(k => localStorage.removeItem(k));
    },
};
