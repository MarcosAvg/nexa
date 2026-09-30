import { describe, it, expect } from 'vitest';
import { resolveMediaTypeIds, isMediaAllowed } from '../../src/lib/utils/mediaKeys';

const MEDIA_TYPES = [
    { key: 'kone', id: 'uuid-kone' },
    { key: 'p2000', id: 'uuid-p2000' },
    { key: 'hid', id: 'uuid-hid' },
];

describe('utils/mediaKeys', () => {
    it('resolveMediaTypeIds mapea keys a ids', () => {
        expect(resolveMediaTypeIds(['kone', 'hid'], MEDIA_TYPES)).toEqual(['uuid-kone', 'uuid-hid']);
    });

    it('resolveMediaTypeIds ignora keys desconocidas', () => {
        expect(resolveMediaTypeIds(['kone', 'otro'], MEDIA_TYPES)).toEqual(['uuid-kone']);
        expect(resolveMediaTypeIds(['otro'], MEDIA_TYPES)).toEqual([]);
    });

    it('isMediaAllowed: lista vacía = todos', () => {
        expect(isMediaAllowed('kone', [])).toBe(true);
        expect(isMediaAllowed(undefined, [])).toBe(true);
        expect(isMediaAllowed(null, [])).toBe(true);
    });

    it('isMediaAllowed: filtra por keys configuradas', () => {
        expect(isMediaAllowed('kone', ['kone', 'hid'])).toBe(true);
        expect(isMediaAllowed('p2000', ['kone', 'hid'])).toBe(false);
        expect(isMediaAllowed(undefined, ['kone'])).toBe(false);
    });
});
