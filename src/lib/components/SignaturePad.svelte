<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { Trash2, Check, X } from 'lucide-svelte';
    import Button from './Button.svelte';

    /**
     * SignaturePad — Pad de firma digital con canvas.
     *
     * Soporta mouse, touch y stylus con grosor adaptativo.
     *
     * @example
     * <SignaturePad onSave={handleSave} onCancel={handleCancel} loading={isSaving} />
     */
    type Props = {
        /** Callback con la firma en base64. */
        onSave: (signatureBase64: string) => void;
        /** Callback al cancelar. */
        onCancel: () => void;
        /** Muestra spinner de carga. */
        loading?: boolean;
    };

    let { onSave, onCancel, loading = false }: Props = $props();

    // ─── Canvas state ───────────────────────────────────────────────────
    let canvasEl = $state<HTMLCanvasElement | null>(null);
    let ctx = $state<CanvasRenderingContext2D | null>(null);
    let isDrawing = false;
    let hasSignature = $state(false);

    // Suavizado / estado de tinta
    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;
    let lastWidth = 2.5;

    const MIN_WIDTH = 1.2;
    const MAX_WIDTH = 3.5;
    const VELOCITY_FILTER_WEIGHT = 0.7;

    // ─── Canvas Init ────────────────────────────────────────────────────
    let resizeObserver: ResizeObserver | null = null;

    onMount(() => {
        setTimeout(initCanvas, 50);
        // Re-inicializa el lienzo cuando cambia su tamaño (rotación/cambio de layout),
        // preservando la firma ya dibujada.
        if (typeof ResizeObserver !== 'undefined' && canvasEl) {
            resizeObserver = new ResizeObserver(() => {
                if (!isDrawing) reinitCanvasPreservingSignature();
            });
            resizeObserver.observe(canvasEl);
        }
    });

    onDestroy(() => {
        resizeObserver?.disconnect();
        resizeObserver = null;
    });

    function initCanvas() {
        if (!canvasEl) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvasEl.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 380;

        // Asignar width/height resetea el estado del contexto (incluido el transform).
        canvasEl.width = Math.round(width * dpr);
        canvasEl.height = Math.round(height * dpr);

        ctx = canvasEl.getContext('2d', { desynchronized: true });
        if (!ctx) return;
        // setTransform es idempotente (a diferencia de scale, que se acumularía).
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.strokeStyle = '#000';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }

    function reinitCanvasPreservingSignature() {
        if (!canvasEl) return;
        const data = hasSignature ? canvasEl.toDataURL('image/png') : null;
        initCanvas();
        if (!data || !ctx || !canvasEl) return;
        const dpr = window.devicePixelRatio || 1;
        const img = new Image();
        img.onload = () => {
            if (!ctx || !canvasEl) return;
            ctx.drawImage(img, 0, 0, canvasEl.width / dpr, canvasEl.height / dpr);
        };
        img.src = data;
    }

    // ─── Pointer-to-canvas coordinate mapping ───────────────────────────
    // Coordenadas relativas al canvas estándar, null si está fuera de límites.
    function mapToCanvas(e: PointerEvent): { x: number; y: number } | null {
        if (!canvasEl) return null;
        const rect = canvasEl.getBoundingClientRect();

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
        return { x, y };
    }

    // ─── Stroke width calculation ───────────────────────────────────────
    // Usa presión del lápiz cuando está disponible, si no, usa velocidad
    function calcWidth(x: number, y: number, pressure: number, now: number): number {
        if (pressure > 0 && pressure < 1) {
            // Basado en presión: mapeo directo de presión a ancho
            const targetWidth = MIN_WIDTH + pressure * (MAX_WIDTH - MIN_WIDTH);
            return lastWidth * VELOCITY_FILTER_WEIGHT + targetWidth * (1 - VELOCITY_FILTER_WEIGHT);
        }

        // Fallback basado en velocidad (mouse / touch sin presión)
        const dist = Math.sqrt(Math.pow(x - lastX, 2) + Math.pow(y - lastY, 2));
        const time = now - lastTime;
        const velocity = dist / (time || 1);
        const targetWidth = Math.max(MIN_WIDTH, MAX_WIDTH - velocity * 1.5);
        return lastWidth * VELOCITY_FILTER_WEIGHT + targetWidth * (1 - VELOCITY_FILTER_WEIGHT);
    }

    // ─── Core drawing handlers (Pointer Events) ────────────────────────
    function onPointerDown(e: PointerEvent) {
        e.preventDefault();

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
        if (!coords) return; // Fuera del canvas — saltar silenciosamente

        const now = Date.now();
        const newWidth = calcWidth(coords.x, coords.y, e.pressure, now);

        // Curva cuadrática para sensación de tinta suave
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
            (e.currentTarget as HTMLElement)?.releasePointerCapture(e.pointerId);
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
    }

    function handleSave() {
        if (!canvasEl || !hasSignature) return;
        const dataUrl = canvasEl.toDataURL('image/png');
        onSave(dataUrl);
    }
</script>

<div class="flex flex-col gap-3 w-full flex-1 min-h-0">
    <div class="flex-1 min-h-[300px] flex flex-col">
        <p class="text-sm font-medium text-slate-600 mb-2 text-center shrink-0">
            Firma aquí (usa tu mouse, dedo o stylus)
        </p>
        <canvas
            bind:this={canvasEl}
            class="w-full flex-1 min-h-[38dvh] sm:min-h-[320px] lg:min-h-[380px] lg:h-[420px] border-2 border-dashed rounded-xl bg-white cursor-crosshair touch-none shadow-inner transition-all duration-300 border-slate-300"
            onpointerdown={onPointerDown}
            onpointermove={onPointerMove}
            onpointerup={onPointerUp}
            onpointercancel={onPointerUp}
            onpointerleave={onPointerUp}
        ></canvas>
    </div>

    <!-- Acciones desktop -->
    <div class="hidden sm:flex justify-between gap-3 shrink-0 pt-1">
        <div class="flex gap-2 w-full sm:w-auto">
            <Button variant="ghost" onclick={onCancel} class="w-full sm:w-auto">Cancelar</Button>
        </div>
        <div class="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onclick={clear} disabled={!hasSignature} class="w-full sm:w-auto">
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

    <!-- Acciones móvil: Confirmar prominente + limpiar; cancelar desde la X -->
    <div class="sm:hidden shrink-0 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))]">
        <div class="grid grid-cols-2 gap-2">
            <Button variant="outline" onclick={clear} disabled={!hasSignature} class="h-12">
                <Trash2 size={18} class="mr-2" />
                Limpiar
            </Button>
            <Button
                variant="primary"
                onclick={handleSave}
                disabled={!hasSignature}
                {loading}
                class="h-12 text-[15px]"
            >
                <Check size={18} class="mr-2" />
                Confirmar
            </Button>
        </div>
    </div>
</div>
