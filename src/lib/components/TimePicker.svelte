<script lang="ts">
    import { Clock } from "lucide-svelte";
    import Select from "./Select.svelte";

    type Props = {
        label: string;
        value: string;
        onchange?: (value: string) => void;
    };

    let { label, value = $bindable("09:00"), onchange }: Props = $props();

    let hours = $derived(value.split(":")[0] || "09");
    let minutes = $derived(value.split(":")[1] || "00");

    function updateTime(h: string, m: string) {
        value = `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
        onchange?.(value);
    }

    const hourOptions = Array.from({ length: 24 }, (_, i) =>
        i.toString().padStart(2, "0"),
    );
    const minuteOptions = ["00", "15", "30", "45"];
</script>

<div class="space-y-2">
    <span
        class="text-xs font-bold text-slate-500 uppercase tracking-widest block"
    >
        {label}
    </span>
    <div
        class="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200"
    >
        <Clock size={18} class="text-slate-400" />

        <div class="w-16">
            <Select
                value={hours}
                placeholder=""
                class="h-8"
                onchange={(e: any) =>
                    updateTime(e.currentTarget.value, minutes)}
            >
                {#each hourOptions as h}
                    <option value={h}>{h}</option>
                {/each}
            </Select>
        </div>

        <span class="text-lg font-bold text-slate-400">:</span>

        <div class="w-16">
            <Select
                value={minutes}
                placeholder=""
                class="h-8"
                onchange={(e: any) => updateTime(hours, e.currentTarget.value)}
            >
                {#each minuteOptions as m}
                    <option value={m}>{m}</option>
                {/each}
            </Select>
        </div>

        <span class="ml-2 text-sm font-medium text-slate-500">hrs</span>
    </div>
</div>
