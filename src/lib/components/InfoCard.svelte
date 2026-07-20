<script lang="ts">
    import type { ComponentType } from "svelte";

    /**
     * InfoCard — Tarjeta informativa reutilizable para guías visuales.
     *
     * @example
     * <InfoCard variant="amber" title="Cambios solicitados" hint="Al hacer clic...">
     *     <div>contenido</div>
     * </InfoCard>
     *
     * <InfoCard variant="rose" icon={User} hint="Al hacer clic...">
     *     <div>contenido</div>
     * </InfoCard>
     */
    type Variant = "amber" | "rose" | "emerald" | "blue" | "slate" | "indigo" | "orange" | "warning";

    type Props = {
        /** Variante de color. @default "slate" */
        variant?: Variant;
        /** Título opcional (uppercase tracking-widest). */
        title?: string;
        /** Icono opcional (ComponentType de lucide-svelte). */
        icon?: ComponentType;
        /** Texto opcional de hint al pie. */
        hint?: string;
        /** Clases adicionales. */
        class?: string;
        /** Contenido principal. */
        children?: import("svelte").Snippet;
    };

    let {
        variant = "slate",
        title = "",
        icon: Icon,
        hint = "",
        class: className = "",
        children,
    }: Props = $props();

    const variantStyles: Record<Variant, {
        border: string;
        bg: string;
        headerText: string;
        hintText: string;
        iconBg: string;
        iconColor: string;
    }> = {
        amber: {
            border: "border-amber-200",
            bg: "bg-amber-50",
            headerText: "text-amber-700",
            hintText: "text-amber-600",
            iconBg: "bg-amber-100",
            iconColor: "text-amber-600",
        },
        rose: {
            border: "border-rose-200",
            bg: "bg-rose-50",
            headerText: "text-rose-700",
            hintText: "text-rose-600",
            iconBg: "bg-rose-100",
            iconColor: "text-rose-600",
        },
        emerald: {
            border: "border-emerald-200",
            bg: "bg-emerald-50",
            headerText: "text-emerald-700",
            hintText: "text-emerald-600",
            iconBg: "bg-emerald-100",
            iconColor: "text-emerald-600",
        },
        blue: {
            border: "border-blue-200",
            bg: "bg-blue-50",
            headerText: "text-blue-700",
            hintText: "text-blue-600",
            iconBg: "bg-blue-100",
            iconColor: "text-blue-600",
        },
        slate: {
            border: "border-slate-200",
            bg: "bg-slate-50",
            headerText: "text-slate-700",
            hintText: "text-slate-600",
            iconBg: "bg-slate-100",
            iconColor: "text-slate-600",
        },
        indigo: {
            border: "border-indigo-200",
            bg: "bg-indigo-50",
            headerText: "text-indigo-700",
            hintText: "text-indigo-600",
            iconBg: "bg-indigo-100",
            iconColor: "text-indigo-600",
        },
        orange: {
            border: "border-orange-200",
            bg: "bg-orange-50",
            headerText: "text-orange-700",
            hintText: "text-orange-600",
            iconBg: "bg-orange-100",
            iconColor: "text-orange-600",
        },
        warning: {
            border: "border-yellow-300",
            bg: "bg-yellow-50",
            headerText: "text-yellow-700",
            hintText: "text-yellow-600",
            iconBg: "bg-yellow-100",
            iconColor: "text-yellow-600",
        },
    };

    const style = $derived(variantStyles[variant]);
</script>

<div class="space-y-2 {className}">
    <div
        class="rounded-xl border {style.border} {style.bg} p-4 space-y-3"
    >
        {#if title || Icon}
            <div class="flex items-center gap-2">
                {#if Icon}
                    <div
                        class="w-8 h-8 rounded-full {style.iconBg} flex items-center justify-center {style.iconColor} shrink-0"
                    >
                        <Icon size={16} />
                    </div>
                {/if}
                {#if title}
                    <p
                        class="text-xs font-bold {style.headerText} uppercase tracking-widest"
                    >
                        {title}
                    </p>
                {/if}
            </div>
        {/if}

        {#if children}
            {@render children()}
        {/if}
    </div>

    {#if hint}
        <p class="text-[10px] {style.hintText}">
            {hint}
        </p>
    {/if}
</div>
