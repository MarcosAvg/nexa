/**
 * haptics.ts — feedback táctil opcional (Android/Chrome). No-op si no existe.
 */

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const PATTERNS: Record<HapticPattern, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 35,
    success: [12, 40, 12],
    warning: [20, 60, 20],
    error: [40, 40, 40, 40, 40],
};

export function haptic(pattern: HapticPattern = 'light') {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    try {
        navigator.vibrate(PATTERNS[pattern]);
    } catch {
        // Ignorar bloqueos/permisos.
    }
}
