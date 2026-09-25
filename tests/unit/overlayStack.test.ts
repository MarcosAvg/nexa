import { describe, it, expect } from 'vitest';
import { overlayStack } from '../../src/lib/utils/overlayStack';

describe('utils/overlayStack', () => {
    it('solo el tope es considerado superior', () => {
        const a = Symbol('a');
        const b = Symbol('b');

        overlayStack.push(a);
        expect(overlayStack.isTop(a)).toBe(true);

        overlayStack.push(b);
        expect(overlayStack.isTop(b)).toBe(true);
        expect(overlayStack.isTop(a)).toBe(false);

        overlayStack.pop(b);
        expect(overlayStack.isTop(a)).toBe(true);

        overlayStack.pop(a);
        expect(overlayStack.isTop(a)).toBe(false);
    });
});
