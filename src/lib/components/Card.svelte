<script lang="ts">
    import { type Snippet } from "svelte";

    type Props = {
        class?: string;
        children?: Snippet;
        [key: string]: any;
    };

    let { class: className = "", children, ...rest }: Props = $props();

    const baseStyles =
        "rounded-2xl border border-slate-200/50 bg-white/90 backdrop-blur-sm text-slate-950 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300/50";

    let computedClass = $derived(`${baseStyles} ${className}`);
</script>

<div class={computedClass} {...rest}>
    {@render children?.()}
</div>
