<script lang="ts">
    type Props = {
        label: string;
        checked?: boolean;
        onChange?: (checked: boolean) => void;
    };

    let { label, checked = false, onChange }: Props = $props();
</script>

<label class="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
    <span class="text-sm font-bold text-slate-700">{label}</span>
    <input
        type="checkbox"
        class="w-5 h-5 accent-blue-600"
        checked={checked}
        onchange={(e) => onChange?.((e.currentTarget as HTMLInputElement).checked)}
    />
</label>
