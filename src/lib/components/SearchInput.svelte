<script lang="ts">
    import Input from "./Input.svelte";
    import { Search } from "lucide-svelte";

    /**
     * SearchInput — Input de búsqueda con ícono de lupa integrado.
     *
     * @example
     * <SearchInput placeholder="Nombre..." bind:value={search} oninput={onSearch} />
     */
    type Props = {
        /** Valor del input (two-way bindable). */
        value: string;
        /** Texto placeholder. @default "Buscar..." */
        placeholder?: string;
        oninput?: (e: Event) => void;
        /** Clases CSS adicionales. */
        class?: string;
        /** ID para asociar con <label for>. */
        id?: string;
    };

    let {
        value = $bindable(),
        placeholder = "Buscar...",
        oninput,
        class: className = "",
        id,
    }: Props = $props();
</script>

<div class="relative">
    <Search
        size={14}
        class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
    />
    <Input
        {placeholder}
        {value}
        {oninput}
        {id}
        class="pl-9 {className}"
    />
</div>
