// Native app only: server-hosted avatars are replaced by bundled/local images so
// lists and chats render instantly without a network round-trip.

import { get } from 'svelte/store';

import { models } from '$lib/stores';

import { getServerBaseUrl } from './server-config';

// Bundled with the frontend build (static/user.png), served from the APK.
export const LOCAL_USER_AVATAR = '/user.png';

const MODEL_AVATAR_PATH = '/api/v1/models/model/profile/image';
const USER_AVATAR_PATTERN = /^\/api\/v1\/(?:users|channels\/webhooks)\/[^/]+\/profile\/image$/;

// Model avatar color: the rendered letter picks one of 12 hue families, the
// model id picks a shade inside that family. Every shade keeps >= 3:1 contrast
// against both the light (#fff) and dark (#171717) app backgrounds, and the
// text color (white or black) is whichever reads better on it (>= 4.5:1).
const HUE_FAMILIES = 12;
const SHADES = [
	{ luminance: 0.14, saturation: 85, hueShift: -10 }, // deep vivid
	{ luminance: 0.28, saturation: 40, hueShift: 12 }, // light muted
	{ luminance: 0.205, saturation: 95, hueShift: 0 }, // mid vivid
	{ luminance: 0.14, saturation: 35, hueShift: 12 }, // deep muted
	{ luminance: 0.28, saturation: 90, hueShift: -12 }, // light vivid
	{ luminance: 0.205, saturation: 50, hueShift: -6 } // mid soft
];

const hash = (value: string): number => {
	// FNV-1a, 32-bit.
	let h = 0x811c9dc5;
	for (let i = 0; i < value.length; i++) {
		h ^= value.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
};

type Rgb = [number, number, number];

const hslToRgb = (h: number, s: number, l: number): Rgb => {
	const sat = s / 100;
	const light = l / 100;
	const a = sat * Math.min(light, 1 - light);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
	};
	return [f(0), f(8), f(4)];
};

export const relativeLuminance = ([r, g, b]: Rgb): number => {
	const c = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
	return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};

export const contrastRatio = (a: number, b: number): number =>
	(Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const toHex = (rgb: Rgb): string =>
	'#' +
	rgb
		.map((v) =>
			Math.round(Math.min(1, Math.max(0, v)) * 255)
				.toString(16)
				.padStart(2, '0')
		)
		.join('');

export const hexToRgb = (hex: string): Rgb => [
	parseInt(hex.slice(1, 3), 16) / 255,
	parseInt(hex.slice(3, 5), 16) / 255,
	parseInt(hex.slice(5, 7), 16) / 255
];

/** HSL color with the given hue/saturation whose luminance matches `target`. */
const colorWithLuminance = (hue: number, saturation: number, target: number): string => {
	let lo = 0;
	let hi = 100;
	for (let i = 0; i < 24; i++) {
		const mid = (lo + hi) / 2;
		if (relativeLuminance(hslToRgb(hue, saturation, mid)) < target) {
			lo = mid;
		} else {
			hi = mid;
		}
	}
	return toHex(hslToRgb(hue, saturation, (lo + hi) / 2));
};

/** Hue family (0-11) of a rendered letter; Latin is case-insensitive, other scripts use the code point. */
export const letterHueFamily = (letter: string): number =>
	(letter.toUpperCase().codePointAt(0) ?? 0) % HUE_FAMILIES;

const hashShade = (id: string): number => hash(id) % SHADES.length;

// Per models-store snapshot: initial -> (model id -> shade).
const shadeTables = new WeakMap<object, Map<string, Map<string, number>>>();

/**
 * Shade index inside the hue family. Loaded models sharing the same initial get
 * distinct shades (ids sorted, each takes its hashed shade or the next free one),
 * so e.g. GPT-4o and GPT-5 never look identical. Unknown models use the plain hash.
 * Deterministic for a given model list; adding a model can only move models it collides with.
 */
export const modelShadeIndex = (id: string, initial?: string): number => {
	const list = get(models);
	if (!initial || !Array.isArray(list) || list.length === 0) {
		return hashShade(id);
	}

	let byInitial = shadeTables.get(list);
	if (!byInitial) {
		byInitial = new Map();
		shadeTables.set(list, byInitial);
	}

	let table = byInitial.get(initial);
	if (!table) {
		table = new Map();
		const peers = list
			.filter(
				(model) =>
					typeof model?.id === 'string' &&
					typeof model?.name === 'string' &&
					firstLetterOrDigit(model.name) &&
					modelNameInitial(model.name) === initial
			)
			.map((model) => model.id)
			.sort();
		const used = new Set<number>();
		for (const peer of new Set(peers)) {
			let shade = hashShade(peer);
			for (let i = 0; i < SHADES.length && used.has(shade); i++) {
				shade = (shade + 1) % SHADES.length;
			}
			if (used.size >= SHADES.length) {
				shade = hashShade(peer);
			}
			used.add(shade);
			table.set(peer, shade);
		}
		byInitial.set(initial, table);
	}

	return table.get(id) ?? hashShade(id);
};

export type ModelAvatarColors = { fill: string; text: string; family: number; shade: number };

export const modelAvatarColors = (letter: string, id: string): ModelAvatarColors => {
	const family = letterHueFamily(letter);
	const shade = modelShadeIndex(id, letter);
	const { luminance, saturation, hueShift } = SHADES[shade];
	const hue = (family * (360 / HUE_FAMILIES) + hueShift + 360) % 360;
	const fill = colorWithLuminance(hue, saturation, luminance);
	const fillLuminance = relativeLuminance(hexToRgb(fill));
	const text =
		contrastRatio(fillLuminance, 1) >= contrastRatio(fillLuminance, 0) ? '#ffffff' : '#000000';
	return { fill, text, family, shade };
};

const escapeXml = (value: string): string =>
	value.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

const firstLetterOrDigit = (value: string): string | undefined =>
	Array.from(value).find((c) => /[\p{L}\p{N}]/u.test(c));

// Display name: "GPT-4o" -> "G", "通义千问" -> "通".
export const modelNameInitial = (name: string): string =>
	// toUpperCase (not locale-aware) so the same name maps to the same letter everywhere.
	(firstLetterOrDigit(name) ?? '?').toUpperCase();

// Id fallback: "openrouter/anthropic/claude-3" -> "C", "llama3.2:3b" -> "L".
export const modelIdInitial = (id: string): string =>
	modelNameInitial(id.split('/').filter(Boolean).pop() ?? id);

/** Display name from the loaded `models` store, or undefined if not known yet. */
export const modelDisplayName = (id: string): string | undefined => {
	const name = get(models)?.find((model) => model?.id === id)?.name;
	return typeof name === 'string' && firstLetterOrDigit(name) ? name : undefined;
};

const modelAvatarCache = new Map<string, string>();

/** Letter avatar: initial from the display name (id fallback); hue from that letter, shade from the id. */
export const modelAvatarDataUrl = (id: string, name: string | undefined = modelDisplayName(id)) => {
	const initial = name ? modelNameInitial(name) : modelIdInitial(id);
	const key = `${initial}\u0000${modelShadeIndex(id, initial)}`;
	const cached = modelAvatarCache.get(key);
	if (cached) {
		return cached;
	}

	const { fill, text } = modelAvatarColors(initial, id);
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
		`<circle cx="32" cy="32" r="32" fill="${fill}"/>` +
		`<text x="32" y="32" dy="0.35em" text-anchor="middle" fill="${text}" ` +
		`font-family="system-ui,-apple-system,Roboto,sans-serif" font-size="30" font-weight="600">` +
		`${escapeXml(initial)}</text></svg>`;
	const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	modelAvatarCache.set(key, url);
	return url;
};

export type LocalAvatar = {
	src: string;
	/** Set when a model avatar fell back to the id because its name is not loaded yet. */
	pendingModelId?: string;
};

/**
 * Returns a local replacement for a server-hosted avatar URL, or null when the
 * URL is not an avatar (chat attachments, files, etc. are left alone).
 * `url` is expected to be already rewritten onto `baseUrl` by the network gate.
 */
export const resolveLocalAvatar = (url: string, baseUrl: string): LocalAvatar | null => {
	if (!baseUrl || !url.startsWith(baseUrl)) {
		return null;
	}

	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}

	const basePath = new URL(baseUrl).pathname.replace(/\/+$/, '');
	const pathname = parsed.pathname.slice(basePath.length) || '/';

	if (pathname === MODEL_AVATAR_PATH) {
		const id = parsed.searchParams.get('id') ?? '';
		const name = modelDisplayName(id);
		return {
			src: modelAvatarDataUrl(id, name),
			...(name === undefined && { pendingModelId: id })
		};
	}
	if (pathname === '/user.png' || USER_AVATAR_PATTERN.test(pathname)) {
		return { src: LOCAL_USER_AVATAR };
	}
	return null;
};

export const localAvatarFor = (url: string, baseUrl: string): string | null =>
	resolveLocalAvatar(url, baseUrl)?.src ?? null;

/** For markup that cannot go through the img gate (e.g. CSS background-image). */
export const avatarSrc = (url: string): string => localAvatarFor(url, getServerBaseUrl()) ?? url;

// Elements showing an id-fallback letter; upgraded to the display name once models load.
type PendingAvatar = { id: string; assign: (src: string) => void };
const pendingAvatars = new WeakMap<Element, PendingAvatar>();
const pendingRefs = new Set<WeakRef<Element>>();
let unsubscribeModels: (() => void) | null = null;

const refreshPendingAvatars = () => {
	for (const ref of pendingRefs) {
		const el = ref.deref();
		const pending = el ? pendingAvatars.get(el) : undefined;
		if (!el || !pending) {
			pendingRefs.delete(ref);
			continue;
		}
		const name = modelDisplayName(pending.id);
		if (name !== undefined) {
			pendingAvatars.delete(el);
			pendingRefs.delete(ref);
			pending.assign(modelAvatarDataUrl(pending.id, name));
		}
	}
	if (pendingRefs.size === 0 && unsubscribeModels) {
		const unsubscribe = unsubscribeModels;
		unsubscribeModels = null;
		unsubscribe();
	}
};

export const watchModelAvatar = (el: Element, id: string, assign: (src: string) => void) => {
	pendingAvatars.set(el, { id, assign });
	pendingRefs.add(new WeakRef(el));
	if (!unsubscribeModels) {
		// subscribe() calls back synchronously; that first call is a harmless no-op.
		unsubscribeModels = models.subscribe(() => queueMicrotask(refreshPendingAvatars));
	}
};

export const cancelModelAvatar = (el: Element) => {
	pendingAvatars.delete(el);
};
