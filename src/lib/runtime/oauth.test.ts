import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { extractTokenFromAppUrl, oauthLoginUrl } from './oauth';
import { SERVER_BASE_URL_STORAGE_KEY, persistServerBaseUrl } from './server-config';

const memory = new Map<string, string>();

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

describe('oauth helpers', () => {
	afterEach(() => {
		localStorage.removeItem(SERVER_BASE_URL_STORAGE_KEY);
		delete (window as Window & { Capacitor?: unknown }).Capacitor;
	});

	it('keeps relative OAuth URLs on the web', () => {
		expect(oauthLoginUrl('google')).toBe('/oauth/google/login');
	});

	it('appends the app redirect on native', () => {
		(window as Window & { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor = {
			isNativePlatform: () => true
		};
		persistServerBaseUrl('https://chat.example.com');
		expect(oauthLoginUrl('google')).toBe(
			'https://chat.example.com/oauth/google/login?app_redirect=openwebui%3A%2F%2Fauth'
		);
	});

	it('extracts tokens from app scheme URLs', () => {
		expect(extractTokenFromAppUrl('openwebui://auth#token=abc.def')).toBe('abc.def');
		expect(extractTokenFromAppUrl('openwebui://auth?token=abc.def')).toBe('abc.def');
		expect(extractTokenFromAppUrl('https://chat.example.com/auth?token=abc')).toBeNull();
	});
});
