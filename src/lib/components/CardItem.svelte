<script lang="ts">
    import Badge from "./Badge.svelte";
    import Button from "./Button.svelte";
    import { FileSignature, Lock, Ban, RefreshCw } from "lucide-svelte";

    type Props = {
        type: "P2000" | "KONE";
        folio: string;
        status?: "active" | "blocked";
        responsiva_status?: string;
        programming_status?: string;
        onGenerateResponsiva?: () => void;
        onBlock?: () => void;
        onUnassign?: () => void;
        onReplace?: () => void;
    };

    let {
        type,
        folio,
        status = "active",
        responsiva_status,
        programming_status,
        onGenerateResponsiva,
        onBlock,
        onUnassign,
        onReplace,
    }: Props = $props();
</script>

<div
    class="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4"
>
    <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-3 flex-wrap">
            <Badge variant={type === "KONE" ? "blue" : "amber"}>
                {type}
            </Badge>
            <span class="text-sm font-bold text-slate-800">{folio}</span>

            {#if responsiva_status !== "signed"}
                <Badge variant="rose" class="text-[8px] px-1 py-0 h-4"
                    >SIN RESPONSIVA</Badge
                >
            {/if}
            {#if programming_status !== "done"}
                <Badge variant="blue" class="text-[8px] px-1 py-0 h-4"
                    >SIN PROGRAMAR</Badge
                >
            {/if}
        </div>
        <Badge variant={status === "active" ? "emerald" : "rose"}>
            {status === "active" ? "Activa" : "Bloqueada"}
        </Badge>
    </div>

    <div
        class="flex items-center justify-between pt-3 border-t border-slate-100"
    >
        <!-- Responsiva: Distinct Emerald icon with label -->
        <button
            type="button"
            class="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200 group {programming_status ===
            'done'
                ? 'text-emerald-600 hover:bg-emerald-50'
                : 'text-slate-300 cursor-not-allowed grayscale bg-slate-50'}"
            onclick={programming_status === "done"
                ? onGenerateResponsiva
                : undefined}
            disabled={programming_status !== "done"}
            title={programming_status === "done"
                ? "Generar y firmar responsiva"
                : "Debe programar la tarjeta antes de generar la responsiva"}
        >
            <FileSignature
                size={16}
                class={programming_status === "done"
                    ? "group-hover:scale-110 transition-transform"
                    : ""}
            />
            <span class="text-[10px] font-bold uppercase tracking-wider"
                >Responsiva</span
            >
        </button>

        <div class="flex items-center gap-1">
            <!-- Bloquear: Amber -->
            <button
                type="button"
                class="p-2 rounded-full text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-all duration-200"
                onclick={onBlock}
                title={status === "active" ? "Bloquear" : "Desbloquear"}
            >
                <Lock size={16} />
            </button>

            <!-- Reposición: Indigo -->
            <button
                type="button"
                class="p-2 rounded-full text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all duration-200"
                onclick={onReplace}
                title="Reposición por extravío"
            >
                <RefreshCw size={16} />
            </button>

            <!-- Dar de baja: Rose -->
            <button
                type="button"
                class="p-2 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all duration-200"
                onclick={onUnassign}
                title="Dar de baja (Desvincular)"
            >
                <Ban size={16} />
            </button>
        </div>
    </div>
</div>
