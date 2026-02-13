<script lang="ts">
    import { type Snippet } from "svelte";
    import { Loader2 } from "lucide-svelte";

    type Props = {
        variant?:
            | "primary"
            | "secondary"
            | "success"
            | "ghost"
            | "outline"
            | "danger"
            | "amber"
            | "sky";
        size?: "default" | "sm" | "lg";
        class?: string;
        children?: Snippet;
        loading?: boolean;
        disabled?: boolean;
        [key: string]: any;
    };

    let {
        variant = "primary",
        size = "default",
        class: className = "",
        children,
        loading = false,
        disabled = false,
        ...rest
    }: Props = $props();

    const baseStyles =
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50 cursor-pointer shadow-sm border";

    const variants = {
        primary:
            "bg-slate-900 text-slate-50 border-slate-900 hover:bg-slate-900/90",
        secondary:
            "bg-white text-slate-900 border-slate-200 hover:bg-slate-100/80",
        success:
            "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-600/90",
        ghost: "border-transparent shadow-none hover:bg-slate-100 hover:text-slate-900",
        outline:
            "bg-transparent text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400",
        danger: "bg-rose-600 text-white border-rose-600 hover:bg-rose-700",
        amber: "bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-amber-200",
        sky: "bg-sky-500 text-white border-sky-500 hover:bg-sky-600 shadow-sky-200",
    };

    const sizes = {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
    };

    // Derived class using simple string concatenation for now as we don't have clsx/tailwind-merge yet
    // Ideally we would use those libraries if added.
    let computedClass = $derived(
        `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`,
    );
</script>

<button class={computedClass} disabled={disabled || loading} {...rest}>
    {#if loading}
        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
    {/if}
    {@render children?.()}
</button>
