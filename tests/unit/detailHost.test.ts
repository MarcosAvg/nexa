import { describe, it, expect } from 'vitest';
import { detailHost } from '../../src/lib/stores/detailHost.svelte';

describe('stores/detailHost', () => {
    it('abre, cierra y limpia la entrada', () => {
        const owner = Symbol('list');
        detailHost.open({ owner, title: 'Detalle', row: { id: 1 } });
        expect(detailHost.isOpen).toBe(true);
        expect(detailHost.entry?.title).toBe('Detalle');

        detailHost.close();
        expect(detailHost.isOpen).toBe(false);
        expect(detailHost.entry).not.toBeNull();

        detailHost.clear();
        expect(detailHost.entry).toBeNull();
    });

    it('closeIfOwner solo cierra la entrada del owner indicado', () => {
        const ownerA = Symbol('a');
        const ownerB = Symbol('b');
        detailHost.open({ owner: ownerA, title: 'A', row: {} });

        detailHost.closeIfOwner(ownerB);
        expect(detailHost.entry).not.toBeNull();

        detailHost.closeIfOwner(ownerA);
        expect(detailHost.entry).toBeNull();
        expect(detailHost.isOpen).toBe(false);
    });
});
