// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface Platform {}
	}

	interface Window {
		Capacitor?: {
			isNativePlatform?: () => boolean;
		};
		electronAPI?: {
			send: (payload: unknown) => Promise<unknown>;
			onEvent?: (handler: (event: unknown) => void) => void;
			load?: (target: string) => void;
		};
		applyTheme?: () => void;
	}
}

export {};
