import { afterEach, describe, expect, it } from 'vitest';

import { models } from '$lib/stores';

import {
	LOCAL_USER_AVATAR,
	contrastRatio,
	hexToRgb,
	letterHueFamily,
	localAvatarFor,
	modelAvatarColors,
	modelAvatarDataUrl,
	modelIdInitial,
	modelNameInitial,
	modelShadeIndex,
	relativeLuminance,
	resolveLocalAvatar,
	watchModelAvatar
} from './avatars';

const setModels = (list: { id: string; name: string }[]) =>
	models.set(list as unknown as Parameters<typeof models.set>[0]);

const initialOf = (dataUrl: string | null | undefined) =>
	decodeURIComponent(dataUrl ?? '').match(/>([^<]*)<\/text>/)?.[1];

const fillOf = (dataUrl: string | null | undefined) =>
	decodeURIComponent(dataUrl ?? '').match(/<circle[^>]*fill="(#[0-9a-f]{6})"/)?.[1];

const lum = (hex: string) => relativeLuminance(hexToRgb(hex));

/** First probe id whose hashed shade differs from `other`'s. */
const idWithOtherShade = (other: string) => {
	for (let n = 0; ; n++) {
		const id = `probe-${n}`;
		if (modelShadeIndex(id) !== modelShadeIndex(other)) return id;
	}
};

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
		// Hue family follows the rendered letter.
		expect(modelAvatarDataUrl('x7f3k9q2', 'Claude')).toContain(
			encodeURIComponent(modelAvatarColors('C', 'x7f3k9q2').fill)
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

	it('derives a stable initial per model', () => {
		expect(modelIdInitial('openrouter/anthropic/claude-3')).toBe('C');
		expect(modelIdInitial('llama3.2:3b')).toBe('L');
		expect(modelNameInitial('通义千问')).toBe('通');
		expect(modelNameInitial('  (beta) GPT-4o')).toBe('B');
		expect(modelNameInitial('')).toBe('?');
	});

	it('escapes markup in the initial', () => {
		expect(decodeURIComponent(modelAvatarDataUrl('x', '<'))).not.toContain('><</text>');
	});

	it('keeps the hue family for the same letter across ids, case-insensitively', () => {
		const ids = ['id-1', 'zz-random-9', 'custom/cohere', 'gpt-4o', 'x'];
		const families = new Set(ids.map((id) => modelAvatarColors('C', id).family));
		expect(families).toEqual(new Set([letterHueFamily('C')]));
		expect(letterHueFamily('c')).toBe(letterHueFamily('C'));
		expect(letterHueFamily('g')).toBe(letterHueFamily('G'));
		expect(modelAvatarColors('g', 'gpt-4o')).toEqual(modelAvatarColors('G', 'gpt-4o'));
		// Han characters are keyed by code point.
		expect(letterHueFamily('通')).toBe('通'.codePointAt(0)! % 12);
		// Different letters land in different families.
		expect(new Set('ABCDEFGHIJKL'.split('').map(letterHueFamily)).size).toBe(12);
	});

	it('gives the same model the exact same color every time', () => {
		for (const id of ['gpt-4o', 'gemma3:27b', 'qwen-custom-01']) {
			expect(modelAvatarColors('G', id)).toEqual(modelAvatarColors('G', id));
			expect(modelAvatarDataUrl(id, 'Gemini')).toBe(modelAvatarDataUrl(id, 'Gemini'));
		}
	});

	it('lets different models with the same letter use different shades', () => {
		const other = idWithOtherShade('gpt-4o');
		const a = modelAvatarColors('G', 'gpt-4o');
		const b = modelAvatarColors('G', other);
		expect(a.family).toBe(b.family);
		expect(a.shade).not.toBe(b.shade);
		expect(a.fill).not.toBe(b.fill);
		expect(fillOf(modelAvatarDataUrl('gpt-4o', 'GPT-4o'))).not.toBe(
			fillOf(modelAvatarDataUrl(other, 'Gemini'))
		);
	});

	it('spreads loaded models with the same letter over distinct shades', () => {
		const list = [
			{ id: 'gpt-4o', name: 'GPT-4o' },
			{ id: 'gpt-5', name: 'GPT-5' },
			{ id: 'gemma3:27b', name: 'Gemma' },
			{ id: 'gemini-2.5-pro', name: 'Gemini' }
		];
		setModels(list);
		const fills = list.map(({ id }) => fillOf(modelAvatarDataUrl(id)));
		expect(new Set(fills).size).toBe(list.length);
		expect(new Set(list.map(({ id }) => modelShadeIndex(id, 'G'))).size).toBe(list.length);
		// Stable for the same list.
		setModels([...list].reverse());
		expect(list.map(({ id }) => fillOf(modelAvatarDataUrl(id)))).toEqual(fills);
	});

	it('keeps every shade visible on light and dark backgrounds with readable text', () => {
		const white = lum('#ffffff');
		const dark = lum('#171717');
		const shades = new Set<number>();
		for (let n = 0; n < 200; n++) shades.add(modelShadeIndex(`probe-${n}`));
		expect(shades.size).toBeGreaterThanOrEqual(3);
		for (const letter of 'ABCDEFGHIJKL') {
			for (let n = 0; n < 200; n++) {
				const { fill, text } = modelAvatarColors(letter, `probe-${n}`);
				const f = lum(fill);
				expect(contrastRatio(f, white)).toBeGreaterThanOrEqual(3);
				expect(contrastRatio(f, dark)).toBeGreaterThanOrEqual(3);
				expect(contrastRatio(f, lum(text))).toBeGreaterThanOrEqual(4.5);
				// Text picks whichever of black/white contrasts more.
				const best = contrastRatio(f, white) >= contrastRatio(f, 0) ? '#ffffff' : '#000000';
				expect(text).toBe(best);
			}
		}
	});

	it('keeps letter and hue family consistent between id fallback and display name', () => {
		const fallback = modelAvatarDataUrl('xq-model');
		expect(initialOf(fallback)).toBe('X');
		expect(fillOf(fallback)).toBe(modelAvatarColors('X', 'xq-model').fill);
		const named = modelAvatarDataUrl('xq-model', 'Mistral');
		expect(initialOf(named)).toBe('M');
		expect(fillOf(named)).toBe(modelAvatarColors('M', 'xq-model').fill);
		expect(modelAvatarColors('M', 'xq-model').family).toBe(letterHueFamily('M'));
	});
});
