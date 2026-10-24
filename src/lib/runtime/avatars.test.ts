import { afterEach, describe, expect, it } from 'vitest';

import { models } from '$lib/stores';

import {
	LOCAL_USER_AVATAR,
	localAvatarFor,
	modelAvatarColor,
	modelAvatarDataUrl,
	modelIdInitial,
	modelNameInitial,
	resolveLocalAvatar,
	watchModelAvatar
} from './avatars';

const setModels = (list: { id: string; name: string }[]) =>
	models.set(list as unknown as Parameters<typeof models.set>[0]);

const initialOf = (dataUrl: string | null | undefined) =>
	decodeURIComponent(dataUrl ?? '').match(/>([^<]*)<\/text>/)?.[1];

afterEach(() => setModels([]));

const SERVER = 'https://chat.example.com';

describe('avatars', () => {
	it('uses the display name from the models store for the letter', () => {
		setModels([
			{ id: 'x7f3k9q2', name: 'Claude Sonnet' },
			{ id: 'qwen-custom-01', name: '通义千问' }
		]);
		const claude = resolveLocalAvatar(
			`${SERVER}/api/v1/models/model/profile/image?id=x7f3k9q2`,
			SERVER
		);
		expect(initialOf(claude?.src)).toBe('C');
		expect(claude?.pendingModelId).toBeUndefined();
		expect(
			initialOf(
				localAvatarFor(`${SERVER}/api/v1/models/model/profile/image?id=qwen-custom-01`, SERVER)
			)
		).toBe('通');
		// Color stays keyed on the id, independent of the name.
		expect(modelAvatarDataUrl('x7f3k9q2', 'Claude')).toContain(
			encodeURIComponent(modelAvatarColor('x7f3k9q2'))
		);
	});

	it('falls back to the id and upgrades once models load', async () => {
		const avatar = resolveLocalAvatar(
			`${SERVER}/api/v1/models/model/profile/image?id=x7f3k9q2`,
			SERVER
		);
		expect(initialOf(avatar?.src)).toBe('X');
		expect(avatar?.pendingModelId).toBe('x7f3k9q2');

		const el = {} as Element;
		let current = avatar?.src;
		watchModelAvatar(el, 'x7f3k9q2', (src) => {
			current = src;
		});
		setModels([{ id: 'x7f3k9q2', name: 'Gemini' }]);
		await Promise.resolve();
		expect(initialOf(current)).toBe('G');
	});

	it('maps model profile images to a local letter avatar', () => {
		const url = localAvatarFor(
			`${SERVER}/api/v1/models/model/profile/image?id=gpt-4o&lang=en-US`,
			SERVER
		);
		expect(url).toBe(modelAvatarDataUrl('gpt-4o'));
		expect(url?.startsWith('data:image/svg+xml')).toBe(true);
		expect(decodeURIComponent(url ?? '')).toContain('>G</text>');
	});

	it('maps user and webhook profile images to the bundled default', () => {
		for (const path of [
			'/api/v1/users/abc-123/profile/image',
			'/api/v1/channels/webhooks/w1/profile/image',
			'/user.png'
		]) {
			expect(localAvatarFor(`${SERVER}${path}`, SERVER)).toBe(LOCAL_USER_AVATAR);
		}
	});

	it('supports servers mounted under a sub-path', () => {
		const base = 'https://example.com/owui';
		expect(localAvatarFor(`${base}/api/v1/users/u/profile/image`, base)).toBe(LOCAL_USER_AVATAR);
	});

	it('leaves chat content and other URLs alone', () => {
		expect(localAvatarFor(`${SERVER}/api/v1/files/f1/content`, SERVER)).toBeNull();
		expect(localAvatarFor(`${SERVER}/cache/image/generations/x.png`, SERVER)).toBeNull();
		expect(localAvatarFor('https://www.gravatar.com/avatar/x', SERVER)).toBeNull();
		expect(localAvatarFor(`${SERVER}/api/v1/users/u/profile/image`, '')).toBeNull();
	});

	it('derives a stable initial and color per model', () => {
		expect(modelIdInitial('openrouter/anthropic/claude-3')).toBe('C');
		expect(modelIdInitial('llama3.2:3b')).toBe('L');
		expect(modelNameInitial('通义千问')).toBe('通');
		expect(modelNameInitial('  (beta) GPT-4o')).toBe('B');
		expect(modelNameInitial('')).toBe('?');
		expect(modelAvatarColor('gpt-4o')).toBe(modelAvatarColor('gpt-4o'));
		const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(modelAvatarColor));
		expect(colors.size).toBeGreaterThan(1);
	});

	it('escapes markup in the initial', () => {
		expect(decodeURIComponent(modelAvatarDataUrl('x', '<'))).not.toContain('><</text>');
	});
});
