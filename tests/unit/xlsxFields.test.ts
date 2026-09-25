import { describe, it, expect } from 'vitest';
import { parseFloors, normalizeEmailText } from '../../src/lib/utils/xlsxFields';

describe('utils/xlsxFields', () => {
    it('parseFloors separa por comas, punto y coma, punto y "y"', () => {
        expect(parseFloors('3, 4;5')).toEqual(['3', '4', '5']);
        expect(parseFloors('1 y 2')).toEqual(['1', '2']);
        expect(parseFloors('2, 2, 1')).toEqual(['1', '2']); // dedup + orden natural
        expect(parseFloors('')).toEqual([]);
        expect(parseFloors(null)).toEqual([]);
    });

    it('normalizeEmailText limpia mailto, ángulos y query', () => {
        expect(normalizeEmailText('mailto:User@Dom.com?subject=x')).toBe('User@Dom.com');
        expect(normalizeEmailText('<a@b.co>')).toBe('a@b.co');
        expect(normalizeEmailText('')).toBe('');
        expect(normalizeEmailText(null)).toBe('');
    });
});
