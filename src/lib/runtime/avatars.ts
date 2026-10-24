// Native app only: server-hosted avatars are replaced by bundled/local images so
// lists and chats render instantly without a network round-trip.

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

export const modelAvatarInitial = (id: string): string => {
	// "openrouter/anthropic/claude-3" -> "C", "llama3.2:3b" -> "L".
	const name = id.split('/').filter(Boolean).pop() ?? id;
	const first = Array.from(name).find((c) => /[\p{L}\p{N}]/u.test(c));
	return (first ?? '?').toLocaleUpperCase();
};

export const modelAvatarColor = (id: string): string => PALETTE[hash(id) % PALETTE.length];

const modelAvatarCache = new Map<string, string>();

export const modelAvatarDataUrl = (id: string): string => {
	const cached = modelAvatarCache.get(id);
	if (cached) {
		return cached;
	}

	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
		`<circle cx="32" cy="32" r="32" fill="${modelAvatarColor(id)}"/>` +
		`<text x="32" y="32" dy="0.35em" text-anchor="middle" fill="#fff" ` +
		`font-family="system-ui,-apple-system,Roboto,sans-serif" font-size="30" font-weight="600">` +
		`${escapeXml(modelAvatarInitial(id))}</text></svg>`;
	const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	modelAvatarCache.set(id, url);
	return url;
};

/**
 * Returns a local replacement for a server-hosted avatar URL, or null when the
 * URL is not an avatar (chat attachments, files, etc. are left alone).
 * `url` is expected to be already rewritten onto `baseUrl` by the network gate.
 */
export const localAvatarFor = (url: string, baseUrl: string): string | null => {
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
		return modelAvatarDataUrl(parsed.searchParams.get('id') ?? '');
	}
	if (pathname === '/user.png' || USER_AVATAR_PATTERN.test(pathname)) {
		return LOCAL_USER_AVATAR;
	}
	return null;
};
