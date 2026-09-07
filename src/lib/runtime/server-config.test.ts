import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	SERVER_BASE_URL_STORAGE_KEY,
	clearServerBaseUrl,
	getServerBaseUrl,
	isNativeApp,
	isSetupPath,
	needsServerSetup,
	normalizeServerBaseUrl,
	persistServerBaseUrl
} from './server-config';

const memory = new Map<string, string>();

const setNative = (native: boolean) => {
	vi.stubGlobal('window', globalThis);
	(globalThis as typeof globalThis & { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor =
		{
			isNativePlatform: () => native
		};
};

beforeEach(() => {
	memory.clear();
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => memory.get(key) ?? null,
		setItem: (key: string, value: string) => {
			memory.set(key, value);
		},
		removeItem: (key: string) => {
			memory.delete(key);
		},
		clear: () => memory.clear()
	});
	vi.stubGlobal('window', globalThis);
});

describe('server-config', () => {
	afterEach(() => {
		clearServerBaseUrl();
		delete (window as Window & { Capacitor?: unknown }).Capacitor;
		vi.unstubAllGlobals();
	});

	it('normalizes host:port to http and strips trailing slashes', () => {
		expect(normalizeServerBaseUrl('192.168.1.10:3000')).toBe('http://192.168.1.10:3000');
		expect(normalizeServerBaseUrl('https://chat.example.com/')).toBe('https://chat.example.com');
		expect(normalizeServerBaseUrl('https://chat.example.com/openwebui/')).toBe(
			'https://chat.example.com/openwebui'
		);
	});

	it('rejects non-http schemes', () => {
		expect(normalizeServerBaseUrl('file:///tmp')).toBeNull();
		expect(normalizeServerBaseUrl('javascript:alert(1)')).toBeNull();
		expect(normalizeServerBaseUrl('')).toBeNull();
	});

	it('ignores stored URLs unless running as a native app', () => {
		localStorage.setItem(SERVER_BASE_URL_STORAGE_KEY, 'https://chat.example.com');
		expect(isNativeApp()).toBe(false);
		expect(getServerBaseUrl()).toBe('');
		expect(needsServerSetup()).toBe(false);
	});

	it('returns the stored URL on native platforms', () => {
		setNative(true);
		persistServerBaseUrl('https://chat.example.com/');
		expect(getServerBaseUrl()).toBe('https://chat.example.com');
		expect(needsServerSetup()).toBe(false);
	});

	it('detects setup paths', () => {
		expect(isSetupPath('/setup')).toBe(true);
		expect(isSetupPath('/setup/')).toBe(true);
		expect(isSetupPath('/auth')).toBe(false);
	});
});
