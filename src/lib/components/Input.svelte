<script lang="ts">
    type Props = {
        value?: string;
        class?: string;
        [key: string]: any;
    };

    let {
        value = $bindable(),
        class: className = "",
        ...rest
    }: Props = $props();

    const baseStyles =
        "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200";

    let computedClass = $derived(`${baseStyles} ${className}`);
</script>

<input class={computedClass} bind:value {...rest} />
