import type { UserProfile } from "../types";

export class UserState {
    profile = $state<UserProfile | null>(null);

    isAdmin = $derived(this.profile?.role === 'admin');
    isOperator = $derived(this.profile?.role === 'operator');
    isViewer = $derived(this.profile?.role === 'viewer');

    // Permission levels
    canEdit = $derived(this.profile?.role === 'admin' || this.profile?.role === 'operator');
    canDelete = $derived(this.profile?.role === 'admin');

    setProfile(profile: UserProfile | null) {
        this.profile = profile;
    }

    clear() {
        this.profile = null;
    }
}

export const userState = new UserState();
