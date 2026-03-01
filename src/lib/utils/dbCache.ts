import { set, get } from 'idb-keyval';

export const dbCache = {
    async save(key: string, data: any): Promise<void> {
        try {
            await set(key, data);
        } catch (err) {
            console.error(`Failed to save cache for key: ${key}`, err);
        }
    },

    async load<T>(key: string): Promise<T | null> {
        try {
            const data = await get<T>(key);
            return typeof data !== 'undefined' ? data : null;
        } catch (err) {
            console.error(`Failed to load cache for key: ${key}`, err);
            return null;
        }
    }
};
