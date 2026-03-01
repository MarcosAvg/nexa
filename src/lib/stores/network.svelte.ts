const browser = typeof window !== 'undefined';

class NetworkState {
    isOnline = $state(true);

    constructor() {
        if (browser) {
            this.isOnline = navigator.onLine;

            const handleOnline = () => {
                this.isOnline = true;
            };

            const handleOffline = () => {
                this.isOnline = false;
            };

            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);
        }
    }
}

export const networkStore = new NetworkState();
