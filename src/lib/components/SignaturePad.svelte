<script lang="ts">
    import { onMount } from "svelte";
    import { Trash2, Check } from "lucide-svelte";
    import Button from "./Button.svelte";

    type Props = {
        onSave: (signatureBase64: string) => void;
        onCancel: () => void;
        loading?: boolean;
    };

    let { onSave, onCancel, loading = false }: Props = $props();

    let canvas = $state<HTMLCanvasElement | null>(null);
    let ctx = $state<CanvasRenderingContext2D | null>(null);
    let isDrawing = false;
    let hasSignature = $state(false);

    // Points tracking for smoothing
    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;
    let lastWidth = 2.5;

    // Constants for the "ink" feel
    const MIN_WIDTH = 1.2;
    const MAX_WIDTH = 3.5;
    const VELOCITY_FILTER_WEIGHT = 0.7; // Smoothes width transitions

    onMount(() => {
        setTimeout(initCanvas, 50);
    });

    function initCanvas() {
        if (!canvas) return;
        ctx = canvas.getContext("2d", { desynchronized: true }); // better latency
        if (ctx) {
            ctx.strokeStyle = "#000";
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
        }

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width || 600;
        const height = rect.height || 200;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx?.scale(dpr, dpr);
    }

    function getCoords(e: MouseEvent | TouchEvent) {
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        if (e instanceof MouseEvent) {
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        } else {
            const touch = e.touches[0];
            return {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top,
            };
        }
    }

    function startDrawing(e: MouseEvent | TouchEvent) {
        e.preventDefault();
        isDrawing = true;
        const { x, y } = getCoords(e);
        lastX = x;
        lastY = y;
        lastTime = Date.now();
        lastWidth = (MIN_WIDTH + MAX_WIDTH) / 2;

        ctx?.beginPath();
        ctx?.moveTo(x, y);
    }

    function stopDrawing() {
        if (isDrawing) {
            isDrawing = false;
            ctx?.closePath();
        }
    }

    function draw(e: MouseEvent | TouchEvent) {
        if (!isDrawing || !ctx) return;
        e.preventDefault();

        const { x, y } = getCoords(e);
        const now = Date.now();

        // Calculate velocity (pixels per ms)
        const dist = Math.sqrt(Math.pow(x - lastX, 2) + Math.pow(y - lastY, 2));
        const time = now - lastTime;
        const velocity = dist / (time || 1);

        // Calculate new width based on velocity (faster = thinner trazo)
        // Inverse relationship: more velocity -> smaller width
        let targetWidth = Math.max(MIN_WIDTH, MAX_WIDTH - velocity * 1.5);

        // Apply smoothing filter to width to avoid jittery transitions
        const newWidth =
            lastWidth * VELOCITY_FILTER_WEIGHT +
            targetWidth * (1 - VELOCITY_FILTER_WEIGHT);

        // Drawing with quadratic curves for smoothness
        const midX = (lastX + x) / 2;
        const midY = (lastY + y) / 2;

        ctx.beginPath();
        ctx.lineWidth = newWidth;
        ctx.moveTo(lastX, lastY);
        ctx.quadraticCurveTo(lastX, lastY, midX, midY); // Simple smooth connection
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(x, y); // Small straight segment to finish the current step
        ctx.stroke();

        lastX = x;
        lastY = y;
        lastTime = now;
        lastWidth = newWidth;
        hasSignature = true;
    }

    function clear() {
        if (!ctx || !canvas) return;
        // Correct clear for DPR
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const dpr = window.devicePixelRatio || 1;
        ctx.scale(dpr, dpr);
        hasSignature = false;
    }

    function handleSave() {
        if (!canvas || !hasSignature) return;
        // Capture at screen resolution
        const dataUrl = canvas.toDataURL("image/png");
        onSave(dataUrl);
    }
</script>

<div class="space-y-4 w-full">
    <div class="text-center">
        <p class="text-sm font-medium text-slate-600 mb-2">
            Firma aquí (usa tu mouse o dedo)
        </p>
        <canvas
            bind:this={canvas}
            class="w-full h-64 sm:h-48 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 cursor-crosshair touch-none shadow-inner"
            onmousedown={startDrawing}
            onmousemove={draw}
            onmouseup={stopDrawing}
            onmouseleave={stopDrawing}
            ontouchstart={startDrawing}
            ontouchmove={draw}
            ontouchend={stopDrawing}
        ></canvas>
    </div>

    <div class="flex flex-col-reverse sm:flex-row justify-between gap-3">
        <Button variant="ghost" onclick={onCancel} class="w-full sm:w-auto"
            >Cancelar</Button
        >
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
