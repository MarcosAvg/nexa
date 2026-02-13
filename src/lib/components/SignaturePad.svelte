<script lang="ts">
    import { onMount } from "svelte";
    import { Trash2, Check } from "lucide-svelte";
    import Button from "./Button.svelte";

    type Props = {
        onSave: (signatureBase64: string) => void;
        onCancel: () => void;
    };

    let { onSave, onCancel }: Props = $props();

    let canvas = $state<HTMLCanvasElement | null>(null);
    let ctx = $state<CanvasRenderingContext2D | null>(null);
    let isDrawing = false;
    let hasSignature = $state(false);

    onMount(() => {
        // Small delay to ensure modal layout is stable
        setTimeout(initCanvas, 50);
    });

    function initCanvas() {
        if (!canvas) return;
        ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 2.5;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
        }

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        // Logical size
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
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
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
        ctx.lineTo(x, y);
        ctx.stroke();
        hasSignature = true;
    }

    function clear() {
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasSignature = false;
    }

    function handleSave() {
        if (!canvas || !hasSignature) return;
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
            class="w-full h-48 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 cursor-crosshair touch-none"
            onmousedown={startDrawing}
            onmousemove={draw}
            onmouseup={stopDrawing}
            onmouseleave={stopDrawing}
            ontouchstart={startDrawing}
            ontouchmove={draw}
            ontouchend={stopDrawing}
        ></canvas>
    </div>

    <div class="flex justify-between gap-3">
        <Button variant="ghost" onclick={onCancel}>Cancelar</Button>
        <div class="flex gap-2">
            <Button variant="outline" onclick={clear} disabled={!hasSignature}>
                <Trash2 size={18} class="mr-2" />
                Limpiar
            </Button>
            <Button
                variant="primary"
                onclick={handleSave}
                disabled={!hasSignature}
            >
                <Check size={18} class="mr-2" />
                Confirmar Firma
            </Button>
        </div>
    </div>
</div>
