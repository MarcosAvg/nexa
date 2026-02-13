<script lang="ts">
    import { type Snippet } from "svelte";

    type Props = {
        class?: string;
        children?: Snippet;
        [key: string]: any;
    };

    let { class: className = "", children, ...rest }: Props = $props();

    const baseStyles =
        "rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm transition-shadow hover:shadow-md";

    let computedClass = $derived(`${baseStyles} ${className}`);
</script>

<div class={computedClass} {...rest}>
    {@render children?.()}
</div>
