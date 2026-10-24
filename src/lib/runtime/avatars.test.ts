import { describe, expect, it } from 'vitest';

import {
	LOCAL_USER_AVATAR,
	localAvatarFor,
	modelAvatarColor,
	modelAvatarDataUrl,
	modelAvatarInitial
} from './avatars';

const SERVER = 'https://chat.example.com';

describe('avatars', () => {
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
		expect(modelAvatarInitial('openrouter/anthropic/claude-3')).toBe('C');
		expect(modelAvatarInitial('llama3.2:3b')).toBe('L');
		expect(modelAvatarInitial('通义千问')).toBe('通');
		expect(modelAvatarInitial('')).toBe('?');
		expect(modelAvatarColor('gpt-4o')).toBe(modelAvatarColor('gpt-4o'));
		const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(modelAvatarColor));
		expect(colors.size).toBeGreaterThan(1);
	});

	it('escapes markup in the initial', () => {
		expect(decodeURIComponent(modelAvatarDataUrl('<'))).not.toContain('><</text>');
	});
});
