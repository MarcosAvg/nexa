import { describe, it, expect } from 'vitest';
import { PaginatedListState } from '../../src/lib/stores/paginatedList.svelte';

describe('stores/paginatedList', () => {
    it('setItems y navegación', () => {
        const list = new PaginatedListState<number>();
        list.pageSize = 10;
        list.setItems([1, 2, 3], 25); // 3 páginas
        expect(list.totalPages).toBe(3);

        expect(list.nextPage()).toBe(true);
        expect(list.currentPage).toBe(2);
        expect(list.goToPage(3)).toBe(true);
        expect(list.nextPage()).toBe(false);
        expect(list.prevPage()).toBe(true);
        expect(list.currentPage).toBe(2);
        expect(list.goToPage(99)).toBe(false);
    });

    it('fetchPage setea items y apaga loading', async () => {
        const list = new PaginatedListState<number>();
        await list.fetchPage(async () => ({ data: [1, 2], count: 2 }), 1);
        expect(list.items).toEqual([1, 2]);
        expect(list.totalRecords).toBe(2);
        expect(list.isLoading).toBe(false);
        expect(list.error).toBeNull();
    });

    it('fetchPage captura el error sin romper', async () => {
        const list = new PaginatedListState<number>();
        await list.fetchPage(async () => {
            throw new Error('falló la red');
        });
        expect(list.error).toBe('falló la red');
        expect(list.isLoading).toBe(false);
        expect(list.items).toEqual([]);
    });

    it('descarta respuestas obsoletas', async () => {
        const list = new PaginatedListState<string>();
        let resolveFirst: (v: { data: string[]; count: number }) => void = () => {};
        const first = new Promise<{ data: string[]; count: number }>((res) => {
            resolveFirst = res;
        });

        const p1 = list.fetchPage(() => first, 1);
        const p2 = list.fetchPage(async () => ({ data: ['nuevo'], count: 1 }), 2);

        // La primera responde después: debe descartarse.
        resolveFirst({ data: ['viejo'], count: 1 });
        await Promise.all([p1, p2]);

        expect(list.items).toEqual(['nuevo']);
        expect(list.currentPage).toBe(2);
    });
});
