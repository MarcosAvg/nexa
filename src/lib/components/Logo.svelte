<script lang="ts">
    import { Hexagon } from "lucide-svelte";

    let { class: className = "", showText = true } = $props();
</script>

<div class="flex items-center gap-2 {className}">
    <div
        class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm ring-1 ring-slate-950/10"
    >
        <Hexagon size={18} strokeWidth={2.5} />
    </div>
    {#if showText}
        <span class="text-lg font-bold tracking-tight">Nexa</span>
    {/if}
</div>
