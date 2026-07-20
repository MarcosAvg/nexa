<script lang="ts">
    import { twMerge } from "tailwind-merge";

    /** Atributos nativos del elemento <input>. */
    type NativeInputAttrs = {
        type?: "text" | "email" | "password" | "number" | "tel" | "url" | "search" | "date" | "time" | "datetime-local" | "file" | "hidden";
        name?: string;
        placeholder?: string;
        readonly?: boolean;
        required?: boolean;
        autocomplete?: string | null;
        autofocus?: boolean;
        maxlength?: number;
        minlength?: number;
        pattern?: string;
        step?: number | string;
        min?: number | string;
        max?: number | string;
        accept?: string;
        multiple?: boolean;
        disabled?: boolean;
        tabindex?: number;
        id?: string;
        title?: string;
        style?: string;
        "aria-label"?: string;
        "aria-describedby"?: string;
    };

    /**
     * Input — Campo de texto con todos los tipos nativos.
     *
     * @example
     * <Input bind:value={name} placeholder="Nombre" />
     * <Input type="date" bind:value={date} max={endDate || undefined} />
     */
    type Props = NativeInputAttrs & {
        /** Valor del input (two-way bindable). */
        value?: string;
        /** Clases CSS adicionales (usa twMerge). */
        class?: string;
        oninput?: (e: Event) => void;
        onchange?: (e: Event) => void;
        onfocus?: (e: FocusEvent) => void;
        onblur?: (e: FocusEvent) => void;
        onkeydown?: (e: KeyboardEvent) => void;
    };

    let {
        value = $bindable(),
        class: className = "",
        oninput,
        onchange,
        onfocus,
        onblur,
        onkeydown,
        type = "text",
        name,
        placeholder,
        readonly = false,
        required = false,
        autocomplete,
        autofocus = false,
        maxlength,
        minlength,
        pattern,
        step,
        min,
        max,
        accept,
        multiple = false,
        disabled = false,
        tabindex,
        id,
        title,
        style,
        "aria-label": ariaLabel,
        "aria-describedby": ariaDescribedby,
    }: Props = $props();

    const baseStyles =
        "flex h-10 w-full rounded-xl border border-slate-200 bg-white/50 backdrop-blur-sm px-4 py-2 text-[14px] font-medium text-slate-700 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300";

    let computedClass = $derived(twMerge(baseStyles, className));
</script>

<!-- svelte-ignore a11y_autofocus -->
<input
    {type}
    {name}
    {placeholder}
    {readonly}
    {required}
    autocomplete={autocomplete as any}
    {autofocus}
    {maxlength}
    {minlength}
    {pattern}
    {step}
    {min}
    {max}
    {accept}
    {multiple}
    {disabled}
    {tabindex}
    {id}
    {title}
    {style}
    class={computedClass}
    aria-label={ariaLabel}
    aria-describedby={ariaDescribedby}
    bind:value
    {oninput}
    {onchange}
    {onfocus}
    {onblur}
    {onkeydown}
/>
