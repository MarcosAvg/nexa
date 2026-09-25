// ─── Stack de overlays ──────────────────────────────────────────────────
// Permite que Escape cierre solo el overlay superior (modal o panel) cuando
// hay varios apilados (p. ej. un modal abierto desde otro modal).

const stack: symbol[] = [];

export const overlayStack = {
    push(id: symbol): void {
        stack.push(id);
    },
    pop(id: symbol): void {
        const i = stack.lastIndexOf(id);
        if (i >= 0) stack.splice(i, 1);
    },
    isTop(id: symbol): boolean {
        return stack[stack.length - 1] === id;
    },
};
