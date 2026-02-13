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
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2";

    const variants = {
        slate: "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-200/80",
        amber: "border-transparent bg-amber-100 text-amber-900 hover:bg-amber-200/80",
        emerald:
            "border-transparent bg-emerald-100 text-emerald-900 hover:bg-emerald-200/80",
        blue: "border-transparent bg-blue-100 text-blue-900 hover:bg-blue-200/80",
        rose: "border-transparent bg-rose-100 text-rose-900 hover:bg-rose-200/80",
        violet: "border-transparent bg-violet-100 text-violet-900 hover:bg-violet-200/80",
    };

    let computedClass = $derived(
        `${baseStyles} ${variants[variant]} ${className}`,
    );
</script>

<span class={computedClass} {...rest}>
    {@render children?.()}
</span>
