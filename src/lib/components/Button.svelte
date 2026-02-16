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
            | "sky"
            | "soft-blue"
            | "soft-emerald"
            | "soft-slate";
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
        "inline-flex items-center justify-center rounded-2xl text-[13px] font-extrabold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer shadow-sm active:scale-[0.96] select-none tracking-tight";

    const variants = {
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

    const sizes = {
        default: "h-11 px-6",
        sm: "h-9 px-4 text-xs",
        lg: "h-14 px-10 text-base",
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
