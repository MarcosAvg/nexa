<script lang="ts">
    import { type Snippet, type ComponentType } from 'svelte';
    import { twMerge } from 'tailwind-merge';

    /**
     * IconButton — Botón de solo icono con objetivo táctil y accesibilidad.
     *
     * `label` es obligatorio y se aplica como `aria-label`; se recomienda
     * mantener `title` para el tooltip de escritorio.
     *
     * @example
     * <IconButton label="Copiar correo" icon={Copy} onclick={copy} />
     */
    type Tone = 'slate' | 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose';
    type Size = 'sm' | 'md';

    type Props = {
        /** Icono de lucide-svelte. */
        icon: ComponentType;
        /** Etiqueta accesible (aria-label). Obligatoria. */
        label: string;
        /** Tooltip nativo. @default label */
        title?: string;
        /** Color de acento al hover/focus. @default "slate" */
        tone?: Tone;
        /** Tamaño. `md` (44px) es táctil; `sm` (36px) para escritorio. @default "md" */
        size?: Size;
        /** Clases adicionales. */
        class?: string;
        /** Deshabilita el botón. */
        disabled?: boolean;
        /** Handler de click. */
        onclick?: (e: MouseEvent) => void;
        /** Atributos nativos de <button>. */
        [key: string]: any;
    };

    let {
        icon: Icon,
        label,
        title,
        tone = 'slate',
        size = 'md',
        class: className = '',
        disabled = false,
        onclick,
        ...rest
    }: Props = $props();

    const tones: Record<Tone, string> = {
        slate: 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200',
        blue: 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100',
        indigo: 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100',
        emerald: 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100',
        amber: 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 active:bg-amber-100',
        rose: 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100',
    };

    const sizes: Record<Size, string> = {
        md: 'h-11 w-11',
        sm: 'h-9 w-9',
    };

    const base =
        'inline-flex items-center justify-center rounded-control transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed';

    let computedClass = $derived(twMerge(base, tones[tone], sizes[size], className));
</script>

<button
    type="button"
    {disabled}
    aria-label={label}
    title={title ?? label}
    class={computedClass}
    {onclick}
    {...rest}
>
    <Icon size={16} strokeWidth={2.4} />
</button>
