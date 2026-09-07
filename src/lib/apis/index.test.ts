import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
		clear: () => memory.clear(),
		get token() {
			return memory.get('token') ?? '';
		},
		set token(value: string) {
			memory.set('token', value);
		}
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('getBackendConfig', () => {
	it('sends the Bearer token so authenticated feature flags are returned', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				features: { enable_web_search: true, enable_code_interpreter: true }
			})
		});
		vi.stubGlobal('fetch', fetchMock);

		const { getBackendConfig } = await import('./index');
		await getBackendConfig('session-token');

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [, init] = fetchMock.mock.calls[0];
		expect(init.headers.Authorization).toBe('Bearer session-token');
	});

	it('falls back to localStorage.token when no argument is passed', async () => {
		localStorage.token = 'stored-token';
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ features: {} })
		});
		vi.stubGlobal('fetch', fetchMock);

		const { getBackendConfig } = await import('./index');
		await getBackendConfig();

		const [, init] = fetchMock.mock.calls[0];
		expect(init.headers.Authorization).toBe('Bearer stored-token');
	});

	it('omits Authorization when the user is not signed in', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ features: { auth: true } })
		});
		vi.stubGlobal('fetch', fetchMock);

		const { getBackendConfig } = await import('./index');
		await getBackendConfig();

		const [, init] = fetchMock.mock.calls[0];
		expect(init.headers.Authorization).toBeUndefined();
	});
});
