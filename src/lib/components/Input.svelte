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
        "flex h-10 w-full rounded-xl border border-slate-200 bg-white/50 backdrop-blur-sm px-4 py-2 text-[14px] font-medium text-slate-700 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300";

    let computedClass = $derived(`${baseStyles} ${className}`);
</script>

<input class={computedClass} bind:value {...rest} />
