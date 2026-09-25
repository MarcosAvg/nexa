import { describe, it, expect, vi } from 'vitest';
import { isTransientError, withRetry } from '../../src/lib/utils/error';

describe('utils/error — reintentos', () => {
    it('isTransientError detecta red/timeout/5xx', () => {
        expect(isTransientError(new Error('Failed to fetch'))).toBe(true);
        expect(isTransientError({ isTimeout: true })).toBe(true);
        expect(isTransientError({ code: 503 })).toBe(true);
        expect(isTransientError({ code: '429' })).toBe(true);
        expect(isTransientError(new Error('violación de unicidad'))).toBe(false);
        expect(isTransientError(null)).toBe(false);
    });

    it('withRetry reintenta ante error transitorio y termina bien', async () => {
        let calls = 0;
        const fn = vi.fn(async () => {
            calls++;
            if (calls < 3) throw new Error('Failed to fetch');
            return 'ok';
        });
        const result = await withRetry(fn, { retries: 3, baseDelayMs: 1 });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('withRetry no reintenta errores no transitorios', async () => {
        const fn = vi.fn(async () => {
            throw new Error('validación');
        });
        await expect(withRetry(fn, { retries: 3, baseDelayMs: 1 })).rejects.toThrow('validación');
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
