<script lang="ts">
    import { type Snippet } from "svelte";
    import { Loader2 } from "lucide-svelte";
    import { twMerge } from "tailwind-merge";

    /** Variante visual del botón. */
    type ButtonVariant =
        | "primary"
        | "secondary"
        | "success"
        | "ghost"
        | "outline"
        | "danger"
        | "amber"
        | "sky"
        | "soft-blue"
        | "soft-emerald"
        | "soft-slate";

    /** Tamaño predefinido del botón. */
    type ButtonSize = "default" | "sm" | "lg";

    /** Atributos nativos del elemento <button>. */
    type NativeButtonAttrs = {
        type?: "button" | "submit" | "reset";
        name?: string;
        value?: string;
        form?: string;
        formaction?: string;
        formmethod?: "get" | "post";
        formnovalidate?: boolean;
        formtarget?: string;
        autofocus?: boolean;
        tabindex?: number;
        title?: string;
        "aria-label"?: string;
        "aria-describedby"?: string;
        "aria-expanded"?: boolean;
        "aria-haspopup"?: boolean;
        "aria-controls"?: string;
        role?: string;
        id?: string;
        style?: string;
    };

    /**
     * Button — Botón con variantes, tamaños y estado de carga.
     *
     * @example
     * <Button variant="primary" size="sm" onclick={handleClick} loading={isSaving}>
     *     Guardar
     * </Button>
     */
    type Props = NativeButtonAttrs & {
        /** Variante visual del botón. @default "primary" */
        variant?: ButtonVariant;
        /** Tamaño del botón. @default "default" */
        size?: ButtonSize;
        /** Clases CSS adicionales (usa twMerge). */
        class?: string;
        /** Contenido interno. */
        children?: Snippet;
        /** Muestra spinner de carga y deshabilita el botón. */
        loading?: boolean;
        /** Deshabilita el botón. */
        disabled?: boolean;
        /** Handler de click. */
        onclick?: (e: MouseEvent) => void;
        onmouseenter?: (e: MouseEvent) => void;
        onmouseleave?: (e: MouseEvent) => void;
        onfocus?: (e: FocusEvent) => void;
        onblur?: (e: FocusEvent) => void;
        onkeydown?: (e: KeyboardEvent) => void;
    };

    let {
        variant = "primary" as ButtonVariant,
        size = "default" as ButtonSize,
        class: className = "",
        children,
        loading = false,
        disabled = false,
        onclick,
        onmouseenter,
        onmouseleave,
        onfocus,
        onblur,
        onkeydown,
        // Native attrs con defaults
        type = "button",
        name,
        value,
        form,
        formaction,
        formmethod,
        formnovalidate,
        formtarget,
        autofocus,
        tabindex,
        title,
        "aria-label": ariaLabel,
        "aria-describedby": ariaDescribedby,
        "aria-expanded": ariaExpanded,
        "aria-haspopup": ariaHaspopup,
        "aria-controls": ariaControls,
        role,
        id,
        style,
    }: Props = $props();

    const baseStyles =
        "inline-flex items-center justify-center rounded-2xl text-[13px] font-extrabold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer shadow-sm active:scale-[0.96] select-none tracking-tight";

    const variants: Record<ButtonVariant, string> = {
        primary:
            "bg-slate-900 text-white hover:bg-slate-950 shadow-md shadow-blue-500/5 border border-slate-700/50 hover:border-blue-500/50 active:shadow-blue-500/10",
        secondary:
            "bg-white text-slate-700 border border-slate-200/60 hover:bg-slate-50 hover:text-slate-900 backdrop-blur-sm shadow-sm hover:shadow-md",
        success:
            "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/10 border border-emerald-500/40",
        ghost: "text-slate-500 hover:bg-slate-100/60 hover:text-slate-900 shadow-none border-transparent",
        outline:
            "bg-transparent text-slate-700 border border-slate-300/60 hover:bg-slate-50/50 hover:border-slate-400 hover:text-slate-900",
        danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-500/10 border border-rose-500/40",
        amber: "bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-500/10 border border-amber-400/40",
        sky: "bg-sky-500 text-white hover:bg-sky-600 shadow-md shadow-sky-500/10 border border-sky-400/40",
        "soft-blue":
            "bg-blue-50/70 text-blue-700 border border-blue-100/60 hover:bg-blue-100 hover:text-blue-800 shadow-none",
        "soft-emerald":
            "bg-emerald-50/70 text-emerald-700 border border-emerald-100/60 hover:bg-emerald-100 hover:text-emerald-800 shadow-none",
        "soft-slate":
            "bg-slate-50/70 text-slate-600 border border-slate-100/60 hover:bg-slate-100 hover:text-slate-900 shadow-none",
    };

    const sizes: Record<ButtonSize, string> = {
        default: "h-11 px-6",
        sm: "h-9 px-4 text-xs",
        lg: "h-14 px-10 text-base",
    };

    let computedClass = $derived(
        twMerge(baseStyles, variants[variant], sizes[size], className),
    );

    function handleClick(e: MouseEvent) {
        if (!disabled && !loading) {
            onclick?.(e);
        }
    }
</script>

<!-- svelte-ignore a11y_autofocus -->
<button
    {type}
    {name}
    {value}
    {form}
    {formaction}
    {formmethod}
    {formnovalidate}
    {formtarget}
    {autofocus}
    {tabindex}
    {title}
    {id}
    {style}
    {role}
    aria-label={ariaLabel}
    aria-describedby={ariaDescribedby}
    aria-expanded={ariaExpanded}
    aria-haspopup={ariaHaspopup}
    aria-controls={ariaControls}
    class={computedClass}
    disabled={disabled || loading}
    onclick={handleClick}
    onmouseenter={onmouseenter}
    onmouseleave={onmouseleave}
    onfocus={onfocus}
    onblur={onblur}
    onkeydown={onkeydown}
>
    {#if loading}
        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
    {/if}
    {@render children?.()}
</button>
