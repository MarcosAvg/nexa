<script lang="ts">
    import { Plus } from "lucide-svelte";

    type Props = {
        onclick: () => void;
        icon?: any;
        label?: string;
    };

    let { onclick, icon: Icon = Plus, label = "Crear nuevo" }: Props = $props();
</script>

<!-- FAB: visible only on mobile, positioned above BottomNav -->
<button
    type="button"
    class="fixed z-50 lg:hidden right-5 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl shadow-blue-500/30 hover:bg-blue-700 active:scale-90 transition-all duration-300 ring-4 ring-white/80"
    {onclick}
    aria-label={label}
    title={label}
>
    <Icon size={24} strokeWidth={2.5} />
</button>
