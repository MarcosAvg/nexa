import type { UserProfile } from "../types";

export class UserState {
    profile = $state<UserProfile | null>(null);

    setProfile(profile: UserProfile | null) {
        this.profile = profile;
    }

    clear() {
        this.profile = null;
    }
}

export const userState = new UserState();
