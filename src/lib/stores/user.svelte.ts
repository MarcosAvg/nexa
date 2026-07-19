import type { UserProfile } from "../types";

export class UserState {
    profile = $state<UserProfile | null>(null);

    isAdmin = $derived(this.profile?.role === 'admin');
    isOperator = $derived(this.profile?.role === 'operator');
    isViewer = $derived(this.profile?.role === 'viewer');

    // Niveles de permiso
    canEdit = $derived(this.profile?.role === 'admin' || this.profile?.role === 'operator');
    canDelete = $derived(this.profile?.role === 'admin');

    /** Objeto currentUser unificado para todas las vistas */
    currentUser = $derived.by(() => {
        if (!this.profile) return null;
        return {
            name: this.profile.full_name || "Usuario",
            email: this.profile.email,
            avatar: this.profile.avatar_url,
            role: this.profile.role,
        };
    });

    setProfile(profile: UserProfile | null) {
        this.profile = profile;
    }

    clear() {
        this.profile = null;
    }
}

export const userState = new UserState();
