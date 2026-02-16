<script lang="ts">
    import { Hexagon } from "lucide-svelte";

    let { class: className = "", showText = true } = $props();
</script>

<div class="flex items-center gap-3 {className}">
    <div
        class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20 ring-1 ring-white/20"
    >
        <Hexagon size={20} strokeWidth={2.5} class="drop-shadow-sm" />
    </div>
    {#if showText}
        <span class="text-xl font-extrabold tracking-tighter text-white"
            >Nexa</span
        >
    {/if}
</div>
