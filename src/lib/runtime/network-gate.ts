import { getServerBaseUrl } from './server-config';

export const REMOTE_PATH_PREFIXES = ['/api', '/ollama', '/openai', '/oauth', '/ws', '/cache'];
export const REMOTE_EXACT_PATHS = ['/user.png'];

export const LOCAL_PATH_PREFIXES = [
	'/_app',
	'/assets',
	'/audio',
	'/pyodide',
	'/wasm',
	'/sql.js',
	'/static',
	'/manifest.json',
	'/favicon',
	'/opensearch.xml'
];

const ABSOLUTE_URL_PATTERN = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/;
const AUTH_MEDIA_PREFIXES = ['/api', '/cache'];

let installed = false;

const pathMatchesPrefix = (pathname: string, prefix: string): boolean => {
	if (prefix.includes('.')) {
		return pathname === prefix || pathname.startsWith(`${prefix}`);
	}

	if (prefix === '/favicon') {
		return (
			pathname === prefix || pathname.startsWith('/favicon.') || pathname.startsWith('/favicon-')
		);
	}

	return pathname === prefix || pathname.startsWith(`${prefix}/`);
};

const pathnameOf = (value: string): string => {
	const withoutOrigin = value.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]+/, '');
	const path = withoutOrigin.startsWith('/') ? withoutOrigin : `/${withoutOrigin}`;
	return path.split(/[?#]/, 1)[0] || '/';
};

const pathWithQueryOf = (value: string): string => {
	const withoutOrigin = value.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]+/, '');
	return withoutOrigin.startsWith('/') ? withoutOrigin : `/${withoutOrigin}`;
};

export const isLocalAssetPath = (pathname: string): boolean =>
	LOCAL_PATH_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix));

export const shouldRewritePath = (pathname: string): boolean => {
	if (isLocalAssetPath(pathname)) {
		return false;
	}

	if (REMOTE_EXACT_PATHS.includes(pathname)) {
		return true;
	}

	return REMOTE_PATH_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix));
};

export const shouldAuthFetchMedia = (url: string, baseUrl: string): boolean => {
	if (!baseUrl || !url.startsWith(baseUrl)) {
		return false;
	}

	const pathname = pathnameOf(url.slice(baseUrl.length) || '/');
	return AUTH_MEDIA_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix));
};

export const rewriteRelativeUrl = (
	input: string,
	baseUrl: string,
	origin: string = typeof window !== 'undefined' ? window.location.origin : ''
): string => {
	if (!baseUrl || !input) {
		return input;
	}

	if (input.startsWith('blob:') || input.startsWith('data:') || input.startsWith('javascript:')) {
		return input;
	}

	if (input.startsWith(baseUrl)) {
		const pathWithQuery = pathWithQueryOf(input.slice(baseUrl.length) || '/');
		// Frontend assets are in the APK. `{WEBUI_BASE_URL}/assets/...` would 404
		// on the remote server because the Python backend does not serve them.
		if (isLocalAssetPath(pathnameOf(pathWithQuery))) {
			return pathWithQuery;
		}
		return input;
	}

	let pathWithQuery = input;

	if (origin && input.startsWith(origin)) {
		pathWithQuery = input.slice(origin.length) || '/';
	} else if (ABSOLUTE_URL_PATTERN.test(input)) {
		return input;
	}

	if (!pathWithQuery.startsWith('/')) {
		pathWithQuery = `/${pathWithQuery}`;
	}

	const pathname = pathnameOf(pathWithQuery);
	if (!shouldRewritePath(pathname)) {
		return input;
	}

	return `${baseUrl}${pathWithQuery}`;
};

const resolveInputUrl = (input: RequestInfo | URL): string => {
	if (typeof input === 'string') {
		return input;
	}

	if (input instanceof URL) {
		return input.toString();
	}

	return input.url;
};

export const rewriteFetchInput = (
	input: RequestInfo | URL,
	baseUrl: string,
	origin?: string
): RequestInfo | URL => {
	const rewritten = rewriteRelativeUrl(resolveInputUrl(input), baseUrl, origin);
	if (rewritten === resolveInputUrl(input)) {
		return input;
	}

	if (typeof input === 'string' || input instanceof URL) {
		return rewritten;
	}

	return new Request(rewritten, input);
};

const readAuthToken = (): string => {
	try {
		if (typeof localStorage === 'undefined') {
			return '';
		}
		return (localStorage.token as string) || '';
	} catch {
		return '';
	}
};

export const attachServerAuth = (
	url: string,
	init: RequestInit | undefined,
	baseUrl: string,
	token: string
): RequestInit | undefined => {
	if (!token || !baseUrl || !url.startsWith(baseUrl)) {
		return init;
	}

	const headers = new Headers(init?.headers);
	if (!headers.has('Authorization') && !headers.has('authorization')) {
		headers.set('Authorization', `Bearer ${token}`);
	}

	return { ...(init ?? {}), headers };
};

const installMediaSrcGate = (originalFetch: typeof fetch) => {
	if (typeof HTMLImageElement === 'undefined') {
		return;
	}

	const mediaGeneration = new WeakMap<Element, number>();
	const mediaObjectUrls = new WeakMap<Element, string>();

	const revokeObjectUrl = (el: Element) => {
		const previous = mediaObjectUrls.get(el);
		if (previous) {
			URL.revokeObjectURL(previous);
			mediaObjectUrls.delete(el);
		}
	};

	const hydrateAuthenticatedMedia = async (
		el: HTMLImageElement | HTMLMediaElement,
		url: string,
		assign: (value: string) => void
	) => {
		const generation = (mediaGeneration.get(el) ?? 0) + 1;
		mediaGeneration.set(el, generation);

		try {
			const token = readAuthToken();
			const init = attachServerAuth(url, undefined, getServerBaseUrl(), token);
			const response = await originalFetch(url, init);
			if (mediaGeneration.get(el) !== generation) {
				return;
			}
			if (!response.ok) {
				assign(url);
				return;
			}

			const blob = await response.blob();
			if (mediaGeneration.get(el) !== generation) {
				return;
			}

			const objectUrl = URL.createObjectURL(blob);
			revokeObjectUrl(el);
			mediaObjectUrls.set(el, objectUrl);
			assign(objectUrl);
		} catch {
			if (mediaGeneration.get(el) === generation) {
				assign(url);
			}
		}
	};

	const applyMediaSrc = (
		el: HTMLImageElement | HTMLMediaElement,
		value: string,
		assign: (next: string) => void
	) => {
		const baseUrl = getServerBaseUrl();
		const rewritten = rewriteRelativeUrl(value, baseUrl, window.location.origin);
		if (shouldAuthFetchMedia(rewritten, baseUrl)) {
			void hydrateAuthenticatedMedia(el, rewritten, assign);
			return;
		}

		revokeObjectUrl(el);
		assign(rewritten);
	};

	const patchSrcAccessor = (
		prototype: typeof HTMLImageElement.prototype | typeof HTMLMediaElement.prototype
	) => {
		const descriptor = Object.getOwnPropertyDescriptor(prototype, 'src');
		if (!descriptor?.set || !descriptor.get) {
			return;
		}

		const originalGet = descriptor.get;
		const originalSet = descriptor.set;

		Object.defineProperty(prototype, 'src', {
			configurable: true,
			enumerable: descriptor.enumerable,
			get() {
				return originalGet.call(this);
			},
			set(value: string) {
				applyMediaSrc(this, String(value ?? ''), (next) => originalSet.call(this, next));
			}
		});
	};

	patchSrcAccessor(HTMLImageElement.prototype);
	if (typeof HTMLMediaElement !== 'undefined') {
		patchSrcAccessor(HTMLMediaElement.prototype);
	}

	const originalSetAttribute = Element.prototype.setAttribute;
	Element.prototype.setAttribute = function (name: string, value: string) {
		if (name === 'src' && (this instanceof HTMLImageElement || this instanceof HTMLMediaElement)) {
			applyMediaSrc(this, String(value ?? ''), (next) =>
				originalSetAttribute.call(this, name, next)
			);
			return;
		}

		return originalSetAttribute.call(this, name, value);
	};
};

export const installNetworkGate = () => {
	if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') {
		return;
	}

	installed = true;
	const originalFetch = window.fetch.bind(window);

	window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
		const baseUrl = getServerBaseUrl();
		const rewritten = rewriteFetchInput(input, baseUrl, window.location.origin);
		const url = resolveInputUrl(rewritten);
		return originalFetch(rewritten, attachServerAuth(url, init, baseUrl, readAuthToken()));
	};

	if (typeof window.EventSource === 'function') {
		const OriginalEventSource = window.EventSource;
		class GatedEventSource extends OriginalEventSource {
			constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
				super(
					rewriteRelativeUrl(String(url), getServerBaseUrl(), window.location.origin),
					eventSourceInitDict
				);
			}
		}

		window.EventSource = GatedEventSource;
	}

	installMediaSrcGate(originalFetch);
};
