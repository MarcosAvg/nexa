<script lang="ts">
    import { CreditCard, ArrowRight } from "lucide-svelte";
    import type { Snippet } from "svelte";

    type NavColor = "amber" | "orange" | "emerald";

    type Props = {
        /** Tipo de tarjeta (e.g. "P2000", "KONE") */
        type: string;
        /** Folio de la tarjeta */
        folio: string;
        /** Estado de advertencia (true=ámbar, false=verde) */
        warning: boolean;
        /** Color del botón de navegación. @default "amber" */
        navColor?: NavColor;
        /** Muestra el botón "Ir →" */
        showNav?: boolean;
        /** Callback al hacer clic en "Ir →" */
        onNavigate?: () => void;
        /** Contenido del área de estado (icono + mensaje) */
        status: Snippet;
    };

    let {
        type,
        folio,
        warning = false,
        navColor = "amber" as NavColor,
        showNav = false,
        onNavigate,
        status,
    }: Props = $props();

    const navStyles: Record<NavColor, string> = {
        amber: "text-amber-600 hover:text-amber-700 hover:bg-amber-100",
        orange: "text-orange-600 hover:text-orange-700 hover:bg-orange-100",
        emerald:
            "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100",
    };
</script>

<div
    class="flex items-center gap-3 rounded-xl border p-3 {warning
        ? 'border-amber-300 bg-amber-50'
        : 'border-emerald-200 bg-emerald-50/50'}"
>
    <div
        class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 {warning
            ? 'bg-amber-100 text-amber-600'
            : 'bg-emerald-100 text-emerald-600'}"
    >
        <CreditCard size={18} />
    </div>

    <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-0.5">
            <span
                class="text-[10px] font-black text-slate-900 bg-white/80 px-1.5 py-0.5 rounded tracking-wider shadow-sm"
            >
                {type}
            </span>
            <span class="text-sm font-bold text-slate-800 truncate">
                {folio}
            </span>
        </div>
        {@render status?.()}
    </div>

    {#if showNav}
        <button
            class="text-xs font-medium shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all {navStyles[navColor]}"
            onclick={onNavigate}
        >
            Ir
            <ArrowRight size={13} />
        </button>
    {/if}
</div>
