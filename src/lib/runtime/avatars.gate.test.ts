import { describe, expect, it, vi } from 'vitest';

import { LOCAL_USER_AVATAR, modelAvatarDataUrl } from './avatars';
import { installNetworkGate } from './network-gate';
import { SERVER_BASE_URL_STORAGE_KEY } from './server-config';

const SERVER = 'https://chat.example.com';

// Minimal DOM stand-ins: the gate patches the `src` accessor and setAttribute.
class FakeElement {
	attrs: Record<string, string> = {};
	setAttribute(name: string, value: string) {
		this.attrs[name] = value;
	}
}
class FakeImage extends FakeElement {
	_src = '';
	get src() {
		return this._src;
	}
	set src(value: string) {
		this._src = value;
	}
}

describe('network gate avatars', () => {
	it('serves avatars locally without fetching', async () => {
		const fetchMock = vi.fn(async () => new Response(new Blob(['x'])));
		vi.stubGlobal('window', globalThis);
		vi.stubGlobal('location', { origin: 'https://localhost' });
		vi.stubGlobal('fetch', fetchMock);
		vi.stubGlobal('Element', FakeElement);
		vi.stubGlobal('HTMLImageElement', FakeImage);
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => (key === SERVER_BASE_URL_STORAGE_KEY ? SERVER : null),
			token: 't'
		});
		(globalThis as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true };
		URL.createObjectURL = () => 'blob:https://localhost/1';
		URL.revokeObjectURL = () => {};

		installNetworkGate();

		const model = new FakeImage();
		model.src = `${SERVER}/api/v1/models/model/profile/image?id=gpt-4o&lang=en`;
		expect(model.src).toBe(modelAvatarDataUrl('gpt-4o'));

		const user = new FakeImage();
		user.setAttribute('src', `${SERVER}/api/v1/users/u1/profile/image`);
		expect(user.attrs.src).toBe(LOCAL_USER_AVATAR);

		expect(fetchMock).not.toHaveBeenCalled();

		// Chat content still goes through authenticated hydration.
		const file = new FakeImage();
		file.src = `${SERVER}/api/v1/files/f1/content`;
		await vi.waitFor(() => expect(file.src).toBe('blob:https://localhost/1'));
		expect(fetchMock).toHaveBeenCalledTimes(1);

		vi.unstubAllGlobals();
	});
});
