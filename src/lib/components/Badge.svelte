<script lang="ts">
    import { type Snippet } from "svelte";

    type Props = {
        variant?: "slate" | "amber" | "emerald" | "blue" | "rose" | "violet";
        class?: string;
        children?: Snippet;
        [key: string]: any;
    };

    let {
        variant = "slate",
        class: className = "",
        children,
        ...rest
    }: Props = $props();

    const baseStyles =
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider transition-all duration-300 select-none";

    const variants = {
        slate: "border-slate-500/10 bg-slate-500/5 text-slate-500",
        amber: "border-amber-500/20 bg-amber-500/10 text-amber-600",
        emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
        blue: "border-blue-500/20 bg-blue-500/10 text-blue-600",
        rose: "border-rose-500/20 bg-rose-500/10 text-rose-600",
        violet: "border-violet-500/20 bg-violet-500/10 text-violet-600",
    };

    let computedClass = $derived(
        `${baseStyles} ${variants[variant]} ${className}`,
    );
</script>

<span class={computedClass} {...rest}>
    {@render children?.()}
</span>
