<script lang="ts">
    import { userState } from "../stores";
    import { type Snippet } from "svelte";

    interface Props {
        /** Roles autorizados para ver este contenido. Si está vacío, se basa en 'requireEdit' o 'requireAdmin' */
        allowedRoles?: ("admin" | "operator" | "viewer")[];
        /** Requiere permisos de edición (Admin u Operador) */
        requireEdit?: boolean;
        /** Requiere permisos de administrador */
        requireAdmin?: boolean;
        /** Si es true, el contenido se muestra pero se deshabilita (vía slot props o envoltorio) */
        disabledOnly?: boolean;
        /** Mensaje alternativo si no se tiene permiso (opcional) */
        fallback?: Snippet;
        children: Snippet<[{ disabled: boolean }]>;
    }

    let {
        allowedRoles = [],
        requireEdit = false,
        requireAdmin = false,
        disabledOnly = false,
        fallback,
        children,
    }: Props = $props();

    const hasPermission = $derived.by(() => {
        if (!userState.profile) return false;

        if (requireAdmin) return userState.isAdmin;
        if (requireEdit) return userState.canEdit;
        if (allowedRoles.length > 0)
            return allowedRoles.includes(userState.profile.role);

        return true;
    });

    const isVisible = $derived(hasPermission || disabledOnly);
    const isDisabled = $derived(!hasPermission && disabledOnly);
</script>

{#if isVisible}
    {@render children({ disabled: isDisabled })}
{:else if fallback}
    {@render fallback()}
{/if}
