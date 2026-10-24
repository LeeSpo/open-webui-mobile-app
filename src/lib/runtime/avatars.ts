// Native app only: server-hosted avatars are replaced by bundled/local images so
// lists and chats render instantly without a network round-trip.

import { get } from 'svelte/store';

import { models } from '$lib/stores';

import { getServerBaseUrl } from './server-config';

// Bundled with the frontend build (static/user.png), served from the APK.
export const LOCAL_USER_AVATAR = '/user.png';

const MODEL_AVATAR_PATH = '/api/v1/models/model/profile/image';
const USER_AVATAR_PATTERN = /^\/api\/v1\/(?:users|channels\/webhooks)\/[^/]+\/profile\/image$/;

// Tailwind 600/700 shades: all keep white text readable (>= 4.5:1 contrast).
const PALETTE = [
	'#dc2626',
	'#c2410c',
	'#a16207',
	'#15803d',
	'#0f766e',
	'#0e7490',
	'#2563eb',
	'#4f46e5',
	'#7c3aed',
	'#c026d3',
	'#db2777',
	'#475569'
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

const escapeXml = (value: string): string =>
	value.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

const firstLetterOrDigit = (value: string): string | undefined =>
	Array.from(value).find((c) => /[\p{L}\p{N}]/u.test(c));

// Display name: "GPT-4o" -> "G", "通义千问" -> "通".
export const modelNameInitial = (name: string): string =>
	(firstLetterOrDigit(name) ?? '?').toLocaleUpperCase();

// Id fallback: "openrouter/anthropic/claude-3" -> "C", "llama3.2:3b" -> "L".
export const modelIdInitial = (id: string): string =>
	modelNameInitial(id.split('/').filter(Boolean).pop() ?? id);

export const modelAvatarColor = (id: string): string => PALETTE[hash(id) % PALETTE.length];

/** Display name from the loaded `models` store, or undefined if not known yet. */
export const modelDisplayName = (id: string): string | undefined => {
	const name = get(models)?.find((model) => model?.id === id)?.name;
	return typeof name === 'string' && firstLetterOrDigit(name) ? name : undefined;
};

const modelAvatarCache = new Map<string, string>();

/** Letter avatar: initial from the display name (id fallback), color keyed on the id. */
export const modelAvatarDataUrl = (id: string, name: string | undefined = modelDisplayName(id)) => {
	const initial = name ? modelNameInitial(name) : modelIdInitial(id);
	const key = `${id}\u0000${initial}`;
	const cached = modelAvatarCache.get(key);
	if (cached) {
		return cached;
	}

	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
		`<circle cx="32" cy="32" r="32" fill="${modelAvatarColor(id)}"/>` +
		`<text x="32" y="32" dy="0.35em" text-anchor="middle" fill="#fff" ` +
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
