<script lang="ts">
    import Badge from "./Badge.svelte";
    import Button from "./Button.svelte";
    import {
        FileSignature,
        Lock,
        Ban,
        RefreshCw,
        CheckCircle2,
        Printer,
        Wrench,
    } from "lucide-svelte";
    import PermissionGuard from "./PermissionGuard.svelte";
    import { uiState } from "../stores/ui.svelte";

    /**
     * CardItem — Item de tarjeta de acceso en el panel de detalles.
     *
     * Muestra tipo, folio, estado y botones de acción (Responsiva, Programar,
     * Imprimir, Bloquear, Reposición, Baja).
     *
     * @example
     * <CardItem type="KONE" folio="KNE-001" status="active" onBlock={handleBlock} />
     */
    type Props = {
        /** Tipo de tarjeta: P2000 (puertas) o KONE (elevadores). */
        type: "P2000" | "KONE";
        /** Folio único de la tarjeta. */
        folio: string;
        /** Estado de la tarjeta. @default "active" */
        status?: "active" | "blocked" | "inactive";
        /** Estado de responsiva: "signed" | "legacy" | null. */
        responsiva_status?: string;
        /** Estado de programación: "done" | "pending" | null. */
        programming_status?: string;
        /** Si es true, resalta la tarjeta con borde violeta (ej: desde tickets). */
        isHighlighted?: boolean;
        /** Callback para abrir modal de firma de responsiva. Solo activo si programming_status === "done". */
        onGenerateResponsiva?: () => void;
        /** Callback para bloquear/desbloquear tarjeta. */
        onBlock?: () => void;
        /** Callback para desvincular tarjeta (baja). */
        onUnassign?: () => void;
        /** Callback para abrir flujo de reposición. */
        onReplace?: () => void;
        /** Callback para marcar tarjeta como programada. */
        onProgram?: () => void;
        /** Callback para generar PDF/impresión. */
        onPrint?: () => void;
        /** Callback para cambiar estado directamente (Modo Dios). */
        onDirectStatusChange?: (field: "responsiva_status" | "programming_status", value: string | null) => void;
    };

    let {
        type,
        folio,
        status = "active",
        responsiva_status,
        programming_status,
        isHighlighted = false,
        onGenerateResponsiva,
        onBlock,
        onUnassign,
        onReplace,
        onProgram,
        onPrint,
        onDirectStatusChange,
    }: Props = $props();

    const RESPONSIVA_OPTIONS = [
        { value: null,      label: "Sin Firmar",  badge: "rose" },
        { value: "legacy",  label: "Legacy",      badge: "slate" },
        { value: "signed",  label: "Firmada",     badge: "emerald" },
    ] as const;

    const PROGRAM_OPTIONS = [
        { value: "pending", label: "Sin Programar", badge: "blue" },
        { value: "done",    label: "Programada",    badge: "emerald" },
    ] as const;
</script>

<div
    class="p-4 rounded-xl border bg-white shadow-sm space-y-4 transition-all duration-300 {isHighlighted
        ? 'border-violet-500 ring-2 ring-violet-500/20'
        : 'border-slate-200'}"
>
    <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-3 flex-wrap">
            <Badge variant={type === "KONE" ? "blue" : "amber"}>
                {type}
            </Badge>
            <span class="text-sm font-bold text-slate-800">{folio}</span>

            {#if responsiva_status === "legacy"}
                <Badge variant="slate" class="text-[8px] px-1 py-0 h-4"
                    >LEGACY</Badge
                >
            {:else if responsiva_status !== "signed"}
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
        <Badge
            variant={status === "active"
                ? "emerald"
                : status === "blocked"
                  ? "rose"
                  : "slate"}
        >
            {status === "active"
                ? "Activa"
                : status === "blocked"
                  ? "Bloqueada"
                  : "Baja"}
        </Badge>
    </div>

    <div
        class="flex items-center justify-between pt-3 border-t border-slate-100"
    >
        <PermissionGuard requireEdit disabledOnly>
            {#snippet children({ disabled: permissionDisabled })}
                <!-- Responsiva: icono Esmeralda distintivo con etiqueta -->
                <button
                    type="button"
                    class="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200 group {programming_status ===
                        'done' && !permissionDisabled
                        ? 'text-emerald-600 hover:bg-emerald-50'
                        : 'text-slate-300 cursor-not-allowed grayscale bg-slate-50'}"
                    onclick={programming_status === "done" &&
                    !permissionDisabled
                        ? onGenerateResponsiva
                        : undefined}
                    disabled={programming_status !== "done" ||
                        permissionDisabled}
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

                {#if programming_status !== "done"}
                    <!-- Programar: Azul -->
                    <button
                        type="button"
                        class="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200 group text-blue-600 hover:bg-blue-50 disabled:text-slate-300 disabled:bg-slate-50"
                        onclick={onProgram}
                        disabled={permissionDisabled}
                        title="Marcar tarjeta como programada físicamente"
                    >
                        <CheckCircle2
                            size={16}
                            class="group-hover:scale-110 transition-transform"
                        />
                        <span
                            class="text-[10px] font-bold uppercase tracking-wider"
                            >Programar</span
                        >
                    </button>
                {/if}

                <div class="flex items-center gap-1">
                    <!-- Imprimir: Pizarra -->
                    <button
                        type="button"
                        class="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200 disabled:opacity-50"
                        onclick={onPrint}
                        disabled={permissionDisabled}
                        title="Imprimir tarjeta"
                    >
                        <Printer size={16} />
                    </button>

                    <!-- Bloquear: Ámbar -->
                    <button
                        type="button"
                        class="p-2 rounded-full text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-all duration-200 disabled:opacity-50"
                        onclick={onBlock}
                        disabled={permissionDisabled}
                        title={status === "active" ? "Bloquear" : "Desbloquear"}
                    >
                        <Lock size={16} />
                    </button>

                    <!-- Reposición: Indigo -->
                    <button
                        type="button"
                        class="p-2 rounded-full text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all duration-200 disabled:opacity-50"
                        onclick={onReplace}
                        disabled={permissionDisabled}
                        title="Reposición por extravío"
                    >
                        <RefreshCw size={16} />
                    </button>

                    <!-- Dar de baja: Rosa -->
                    <button
                        type="button"
                        class="p-2 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all duration-200 disabled:opacity-50"
                        onclick={onUnassign}
                        disabled={permissionDisabled}
                        title="Dar de baja (Desvincular)"
                    >
                        <Ban size={16} />
                    </button>
                </div>
            {/snippet}
        </PermissionGuard>
    </div>

    <!-- Modo Dios: Editor de estado directo -->
    {#if uiState.isDirectEditMode && onDirectStatusChange}
        <div class="pt-3 border-t border-amber-200 bg-amber-50/60 -mx-4 -mb-4 px-4 pb-4 rounded-b-xl">
            <div class="flex items-center gap-1.5 mb-2.5">
                <Wrench size={11} class="text-amber-600 animate-pulse" />
                <span class="text-[9px] font-extrabold uppercase tracking-[0.2em] text-amber-600">Modo Dios — Edición Directa</span>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <!-- Estado de Responsiva -->
                <div class="space-y-1">
                    <p class="text-[9px] font-bold text-amber-700 uppercase tracking-wider">Responsiva</p>
                    <div class="flex flex-col gap-1">
                        {#each RESPONSIVA_OPTIONS as opt}
                            <button
                                type="button"
                                class="text-left px-2 py-1 rounded-lg text-[10px] font-bold transition-all border {(responsiva_status ?? null) === opt.value ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:text-amber-700'}"
                                onclick={() => onDirectStatusChange?.('responsiva_status', opt.value)}
                            >
                                {opt.label}
                            </button>
                        {/each}
                    </div>
                </div>
                <!-- Estado de Programación -->
                <div class="space-y-1">
                    <p class="text-[9px] font-bold text-amber-700 uppercase tracking-wider">Programación</p>
                    <div class="flex flex-col gap-1">
                        {#each PROGRAM_OPTIONS as opt}
                            <button
                                type="button"
                                class="text-left px-2 py-1 rounded-lg text-[10px] font-bold transition-all border {(programming_status ?? 'pending') === opt.value ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:text-amber-700'}"
                                onclick={() => onDirectStatusChange?.('programming_status', opt.value)}
                            >
                                {opt.label}
                            </button>
                        {/each}
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>
