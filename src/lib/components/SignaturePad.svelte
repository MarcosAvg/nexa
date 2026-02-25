<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { Trash2, Check, Tablet, X } from "lucide-svelte";
    import Button from "./Button.svelte";

    type Props = {
        onSave: (signatureBase64: string) => void;
        onCancel: () => void;
        loading?: boolean;
    };

    let { onSave, onCancel, loading = false }: Props = $props();

    // ─── Canvas state ───────────────────────────────────────────────────
    let canvasEl = $state<HTMLCanvasElement | null>(null);
    let ctx = $state<CanvasRenderingContext2D | null>(null);
    let isDrawing = false;
    let hasSignature = $state(false);

    // Smoothing / ink state
    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;
    let lastWidth = 2.5;

    const MIN_WIDTH = 1.2;
    const MAX_WIDTH = 3.5;
    const VELOCITY_FILTER_WEIGHT = 0.7;

    // ─── Tablet overlay state ───────────────────────────────────────────
    let tabletMode = $state(false);
    let overlayEl: HTMLDivElement | null = null;
    let toolbarEl: HTMLDivElement | null = null;

    // ─── Adaptive capture zone ──────────────────────────────────────────
    // When the user first touches in tablet mode, that point becomes the
    // center of a small screen region. Only this region maps to the full
    // canvas, so a natural-sized signature fills the entire pad.
    //
    // ZONE_W / ZONE_H control how much screen space maps to the canvas.
    // Smaller values = small tablet movement → large canvas strokes.
    const ZONE_W = 600; // px of screen width mapped to canvas
    const ZONE_H = 350; // px of screen height mapped to canvas
    let captureZone: { left: number; top: number } | null = null;

    function resetCaptureZone() {
        captureZone = null;
    }

    function ensureCaptureZone(e: PointerEvent) {
        if (captureZone) return;
        // Offset so the first touch maps to (1/3 width, 2/3 height) of the canvas.
        // Horizontal: 1/3 from the left, leaving room to sign rightward.
        // Vertical: 2/3 from the top (1/3 from the bottom), natural lower baseline.
        captureZone = {
            left: Math.max(
                0,
                Math.min(e.clientX - ZONE_W * 0.3, window.innerWidth - ZONE_W),
            ),
            top: Math.max(
                0,
                Math.min(
                    e.clientY - ZONE_H * 0.75,
                    window.innerHeight - ZONE_H,
                ),
            ),
        };
    }

    // ─── Canvas Init ────────────────────────────────────────────────────
    onMount(() => {
        setTimeout(initCanvas, 50);
    });

    onDestroy(() => {
        destroyOverlay();
    });

    function initCanvas() {
        if (!canvasEl) return;
        ctx = canvasEl.getContext("2d", { desynchronized: true });
        if (ctx) {
            ctx.strokeStyle = "#000";
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
        }

        const dpr = window.devicePixelRatio || 1;
        const rect = canvasEl.getBoundingClientRect();
        const width = rect.width || 600;
        const height = rect.height || 200;

        canvasEl.width = width * dpr;
        canvasEl.height = height * dpr;
        ctx?.scale(dpr, dpr);
    }

    // ─── Pointer-to-canvas coordinate mapping ───────────────────────────
    // NORMAL mode: standard canvas-relative coords, null if outside bounds.
    // TABLET mode: the adaptive capture zone maps to the full canvas.
    //   → left edge of zone = left edge of canvas (x=0)
    //   → right edge of zone = right edge of canvas (x=canvasW)
    //   A natural ~15cm signature on the tablet fills the whole canvas.
    function mapToCanvas(e: PointerEvent): { x: number; y: number } | null {
        if (!canvasEl) return null;
        const rect = canvasEl.getBoundingClientRect();

        if (tabletMode && captureZone) {
            // Map capture zone → canvas proportionally
            const x = ((e.clientX - captureZone.left) / ZONE_W) * rect.width;
            const y = ((e.clientY - captureZone.top) / ZONE_H) * rect.height;

            // Clamp to canvas bounds (allow slight overshoot for edge strokes)
            const pad = 5;
            if (
                x < -pad ||
                y < -pad ||
                x > rect.width + pad ||
                y > rect.height + pad
            )
                return null;
            return {
                x: Math.max(0, Math.min(x, rect.width)),
                y: Math.max(0, Math.min(y, rect.height)),
            };
        }

        // Normal mode: canvas-relative with bounds check
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
        return { x, y };
    }

    // ─── Stroke width calculation ───────────────────────────────────────
    // Uses stylus pressure when available, otherwise falls back to velocity
    function calcWidth(
        x: number,
        y: number,
        pressure: number,
        now: number,
    ): number {
        if (pressure > 0 && pressure < 1) {
            // Pressure-based: direct mapping from pressure to width
            const targetWidth = MIN_WIDTH + pressure * (MAX_WIDTH - MIN_WIDTH);
            return (
                lastWidth * VELOCITY_FILTER_WEIGHT +
                targetWidth * (1 - VELOCITY_FILTER_WEIGHT)
            );
        }

        // Velocity-based fallback (mouse / touch without pressure)
        const dist = Math.sqrt(Math.pow(x - lastX, 2) + Math.pow(y - lastY, 2));
        const time = now - lastTime;
        const velocity = dist / (time || 1);
        const targetWidth = Math.max(MIN_WIDTH, MAX_WIDTH - velocity * 1.5);
        return (
            lastWidth * VELOCITY_FILTER_WEIGHT +
            targetWidth * (1 - VELOCITY_FILTER_WEIGHT)
        );
    }

    // ─── Core drawing handlers (Pointer Events) ────────────────────────
    function onPointerDown(e: PointerEvent) {
        e.preventDefault();

        // In tablet mode, set the capture zone on first touch
        if (tabletMode) ensureCaptureZone(e);

        // setPointerCapture ensures moves keep coming even if pointer leaves element
        (e.currentTarget as HTMLElement)?.setPointerCapture(e.pointerId);

        const coords = mapToCanvas(e);
        if (!coords) return;

        isDrawing = true;
        lastX = coords.x;
        lastY = coords.y;
        lastTime = Date.now();
        lastWidth = (MIN_WIDTH + MAX_WIDTH) / 2;

        ctx?.beginPath();
        ctx?.moveTo(coords.x, coords.y);
    }

    function onPointerMove(e: PointerEvent) {
        if (!isDrawing || !ctx) return;
        e.preventDefault();

        const coords = mapToCanvas(e);
        if (!coords) return; // Outside canvas — skip silently

        const now = Date.now();
        const newWidth = calcWidth(coords.x, coords.y, e.pressure, now);

        // Quadratic curve for smooth ink feel
        const midX = (lastX + coords.x) / 2;
        const midY = (lastY + coords.y) / 2;

        ctx.beginPath();
        ctx.lineWidth = newWidth;
        ctx.moveTo(lastX, lastY);
        ctx.quadraticCurveTo(lastX, lastY, midX, midY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();

        lastX = coords.x;
        lastY = coords.y;
        lastTime = now;
        lastWidth = newWidth;
        hasSignature = true;
    }

    function onPointerUp(e: PointerEvent) {
        if (isDrawing) {
            isDrawing = false;
            ctx?.closePath();
            (e.currentTarget as HTMLElement)?.releasePointerCapture(
                e.pointerId,
            );
        }
    }

    // ─── Clear canvas ───────────────────────────────────────────────────
    function clear() {
        if (!ctx || !canvasEl) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        const dpr = window.devicePixelRatio || 1;
        ctx.scale(dpr, dpr);
        hasSignature = false;
        // Reset adaptive zone so next stroke can recenter
        resetCaptureZone();
    }

    function handleSave() {
        if (!canvasEl || !hasSignature) return;
        const dataUrl = canvasEl.toDataURL("image/png");
        onSave(dataUrl);
    }

    // ─── Overlay (Tablet Mode) ──────────────────────────────────────────
    function toggleTabletMode() {
        tabletMode = !tabletMode;
        if (tabletMode) {
            createOverlay();
        } else {
            destroyOverlay();
        }
    }

    function createOverlay() {
        if (overlayEl) return;

        // ── Fullscreen invisible overlay ──
        overlayEl = document.createElement("div");
        overlayEl.id = "signature-capture-overlay";
        Object.assign(overlayEl.style, {
            position: "fixed",
            inset: "0",
            zIndex: "9999",
            touchAction: "none", // Block scroll/zoom/gestures
            cursor: "crosshair",
            background: "transparent",
            userSelect: "none",
            webkitUserSelect: "none",
        } as Record<string, string>);

        // Pointer events on overlay
        overlayEl.addEventListener("pointerdown", onPointerDown);
        overlayEl.addEventListener("pointermove", onPointerMove);
        overlayEl.addEventListener("pointerup", onPointerUp);
        overlayEl.addEventListener("pointercancel", onPointerUp);
        overlayEl.addEventListener("contextmenu", (e) => e.preventDefault());

        document.body.appendChild(overlayEl);

        // ── Floating toolbar (above overlay) ──
        toolbarEl = document.createElement("div");
        toolbarEl.id = "signature-capture-toolbar";
        toolbarEl.innerHTML = `
            <div style="
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                background: rgba(15, 23, 42, 0.92);
                backdrop-filter: blur(12px);
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                color: white;
                font-size: 13px;
                font-family: inherit;
                pointer-events: auto;
            ">
                <span style="opacity: 0.7; margin-right: 4px;">🖊️ Modo tableta activo</span>
                <button id="sig-overlay-clear" style="
                    background: rgba(255,255,255,0.12);
                    border: none;
                    color: white;
                    padding: 6px 14px;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 13px;
                    font-family: inherit;
                    transition: background 0.15s;
                " onmouseover="this.style.background='rgba(255,255,255,0.22)'" onmouseout="this.style.background='rgba(255,255,255,0.12)'">
                    🗑 Limpiar
                </button>
                <button id="sig-overlay-confirm" style="
                    background: #3b82f6;
                    border: none;
                    color: white;
                    padding: 6px 14px;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 13px;
                    font-family: inherit;
                    font-weight: 600;
                    transition: background 0.15s;
                " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
                    ✓ Confirmar
                </button>
                <button id="sig-overlay-close" style="
                    background: rgba(239,68,68,0.2);
                    border: none;
                    color: #fca5a5;
                    padding: 6px 10px;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 13px;
                    font-family: inherit;
                    transition: background 0.15s;
                " onmouseover="this.style.background='rgba(239,68,68,0.35)'" onmouseout="this.style.background='rgba(239,68,68,0.2)'">
                    ✕ Cerrar
                </button>
            </div>
        `;

        document.body.appendChild(toolbarEl);

        // Wire toolbar button events (must stopPropagation so overlay doesn't capture them)
        toolbarEl
            .querySelector("#sig-overlay-clear")
            ?.addEventListener("pointerdown", (e) => {
                e.stopPropagation();
                clear();
            });
        toolbarEl
            .querySelector("#sig-overlay-confirm")
            ?.addEventListener("pointerdown", (e) => {
                e.stopPropagation();
                handleSave();
                destroyOverlay();
                tabletMode = false;
            });
        toolbarEl
            .querySelector("#sig-overlay-close")
            ?.addEventListener("pointerdown", (e) => {
                e.stopPropagation();
                destroyOverlay();
                tabletMode = false;
            });

        // Escape key exits overlay
        window.addEventListener("keydown", onEscapeKey);
    }

    function destroyOverlay() {
        if (overlayEl) {
            overlayEl.removeEventListener("pointerdown", onPointerDown);
            overlayEl.removeEventListener("pointermove", onPointerMove);
            overlayEl.removeEventListener("pointerup", onPointerUp);
            overlayEl.removeEventListener("pointercancel", onPointerUp);
            overlayEl.remove();
            overlayEl = null;
        }
        if (toolbarEl) {
            toolbarEl.remove();
            toolbarEl = null;
        }
        window.removeEventListener("keydown", onEscapeKey);
        isDrawing = false;
    }

    function onEscapeKey(e: KeyboardEvent) {
        if (e.key === "Escape") {
            destroyOverlay();
            tabletMode = false;
        }
    }
</script>

<div class="space-y-4 w-full">
    <div class="text-center">
        <p class="text-sm font-medium text-slate-600 mb-2">
            Firma aquí (usa tu mouse, dedo o stylus)
        </p>
        <canvas
            bind:this={canvasEl}
            class="w-full h-64 sm:h-48 border-2 border-dashed rounded-xl bg-slate-50 cursor-crosshair touch-none shadow-inner transition-all duration-300 {tabletMode
                ? 'border-blue-400 ring-4 ring-blue-400/30 shadow-blue-500/20'
                : 'border-slate-300'}"
            onpointerdown={onPointerDown}
            onpointermove={onPointerMove}
            onpointerup={onPointerUp}
            onpointercancel={onPointerUp}
            onpointerleave={onPointerUp}
        ></canvas>

        {#if tabletMode}
            <p class="mt-2 text-xs text-blue-500 font-medium animate-pulse">
                Modo tableta activo — dibuja en cualquier parte de la pantalla
            </p>
        {/if}
    </div>

    <div class="flex flex-col-reverse sm:flex-row justify-between gap-3">
        <div class="flex gap-2 w-full sm:w-auto">
            <Button variant="ghost" onclick={onCancel} class="w-full sm:w-auto"
                >Cancelar</Button
            >
            <Button
                variant={tabletMode ? "primary" : "outline"}
                onclick={toggleTabletMode}
                class="w-full sm:w-auto flex items-center gap-1.5 {tabletMode
                    ? 'ring-2 ring-blue-400/50'
                    : ''}"
                title={tabletMode
                    ? "Desactivar modo tableta"
                    : "Activar modo tableta (captura pantalla completa)"}
            >
                <Tablet size={16} />
                {tabletMode ? "Tableta ON" : "Modo Tableta"}
            </Button>
        </div>
        <div class="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
            <Button
                variant="outline"
                onclick={clear}
                disabled={!hasSignature}
                class="w-full sm:w-auto"
            >
                <Trash2 size={18} class="mr-2" />
                Limpiar
            </Button>
            <Button
                variant="primary"
                onclick={handleSave}
                disabled={!hasSignature}
                {loading}
                class="w-full sm:w-auto"
            >
                <Check size={18} class="mr-2" />
                Confirmar Firma
            </Button>
        </div>
    </div>
</div>
