export const SERVER_BASE_URL_STORAGE_KEY = 'owui.serverBaseUrl';
export const APP_REDIRECT_URI = 'openwebui://auth';

const HTTP_SCHEMES = new Set(['http:', 'https:']);

type CapacitorBridge = {
	isNativePlatform?: () => boolean;
};

const getCapacitor = (): CapacitorBridge | undefined => {
	if (typeof window === 'undefined') {
		return undefined;
	}

	return (window as Window & { Capacitor?: CapacitorBridge }).Capacitor;
};

export const isNativeApp = (): boolean => {
	const capacitor = getCapacitor();
	return typeof capacitor?.isNativePlatform === 'function' && capacitor.isNativePlatform();
};

const readStorage = (key: string): string => {
	try {
		if (typeof localStorage === 'undefined') {
			return '';
		}
		return localStorage.getItem(key) ?? '';
	} catch {
		return '';
	}
};

const writeStorage = (key: string, value: string) => {
	if (typeof localStorage === 'undefined') {
		return;
	}
	localStorage.setItem(key, value);
};

const removeStorage = (key: string) => {
	if (typeof localStorage === 'undefined') {
		return;
	}
	localStorage.removeItem(key);
};

export const normalizeServerBaseUrl = (input: string): string | null => {
	const trimmed = input.trim();
	if (!trimmed) {
		return null;
	}

	let candidate = trimmed;
	if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
		candidate = `http://${candidate}`;
	}

	let parsed: URL;
	try {
		parsed = new URL(candidate);
	} catch {
		return null;
	}

	if (!HTTP_SCHEMES.has(parsed.protocol) || !parsed.hostname) {
		return null;
	}

	parsed.hash = '';
	const normalized = parsed.toString().replace(/\/+$/, '');
	return normalized;
};

export const getServerBaseUrl = (): string => {
	if (!isNativeApp()) {
		return '';
	}

	return normalizeServerBaseUrl(readStorage(SERVER_BASE_URL_STORAGE_KEY)) ?? '';
};

export const persistServerBaseUrl = (input: string): string => {
	const normalized = normalizeServerBaseUrl(input);
	if (!normalized) {
		throw new Error('invalid_url');
	}

	writeStorage(SERVER_BASE_URL_STORAGE_KEY, normalized);
	return normalized;
};

export const clearServerBaseUrl = () => {
	removeStorage(SERVER_BASE_URL_STORAGE_KEY);
};

export const needsServerSetup = (): boolean => isNativeApp() && !getServerBaseUrl();

export const isSetupPath = (pathname: string): boolean =>
	pathname === '/setup' || pathname.startsWith('/setup/');

export type ServerProbeError = 'invalid_url' | 'cors' | 'tls' | 'unreachable' | 'http_error';

export type ServerProbeResult =
	| { ok: true; name?: string; version?: string }
	| { ok: false; error: ServerProbeError };

export const classifyProbeError = (error: unknown): Extract<ServerProbeResult, { ok: false }> => {
	const message = error instanceof Error ? error.message : String(error ?? '');
	const lowered = message.toLowerCase();

	if (lowered.includes('ssl') || lowered.includes('tls') || lowered.includes('certificate')) {
		return { ok: false, error: 'tls' };
	}
	if (lowered.includes('cors') || lowered.includes('access-control')) {
		return { ok: false, error: 'cors' };
	}

	return { ok: false, error: 'unreachable' };
};

export const probeServer = async (input: string): Promise<ServerProbeResult> => {
	const base = normalizeServerBaseUrl(input);
	if (!base) {
		return { ok: false, error: 'invalid_url' };
	}

	try {
		const response = await fetch(`${base}/api/config`, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			return { ok: false, error: 'http_error' };
		}

		const data = await response.json().catch(() => ({}));
		return {
			ok: true,
			name: typeof data?.name === 'string' ? data.name : undefined,
			version: typeof data?.version === 'string' ? data.version : undefined
		};
	} catch (error) {
		return classifyProbeError(error);
	}
};
