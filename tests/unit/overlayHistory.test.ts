// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { overlayHistory } from '../../src/lib/utils/overlayHistory';

describe('utils/overlayHistory', () => {
    it('el popstate cierra el overlay superior', () => {
        const closeA = vi.fn();
        const closeB = vi.fn();
        const a = Symbol('a');
        const b = Symbol('b');

        overlayHistory.push(a, closeA);
        overlayHistory.push(b, closeB);
        expect(overlayHistory.size()).toBe(2);

        // Back: cierra el tope (B).
        window.dispatchEvent(new PopStateEvent('popstate'));
        expect(closeB).toHaveBeenCalledTimes(1);
        expect(closeA).not.toHaveBeenCalled();
        expect(overlayHistory.size()).toBe(1);
    });
});
