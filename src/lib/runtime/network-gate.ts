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

let installed = false;

const pathMatchesPrefix = (pathname: string, prefix: string): boolean => {
	if (prefix.includes('.')) {
		return pathname === prefix || pathname.startsWith(`${prefix}`);
	}

	return pathname === prefix || pathname.startsWith(`${prefix}/`);
};

const pathnameOf = (value: string): string => {
	const withoutOrigin = value.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]+/, '');
	const path = withoutOrigin.startsWith('/') ? withoutOrigin : `/${withoutOrigin}`;
	return path.split(/[?#]/, 1)[0] || '/';
};

export const shouldRewritePath = (pathname: string): boolean => {
	if (LOCAL_PATH_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix))) {
		return false;
	}

	if (REMOTE_EXACT_PATHS.includes(pathname)) {
		return true;
	}

	return REMOTE_PATH_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix));
};

export const rewriteRelativeUrl = (
	input: string,
	baseUrl: string,
	origin: string = typeof window !== 'undefined' ? window.location.origin : ''
): string => {
	if (!baseUrl || !input) {
		return input;
	}

	if (input.startsWith(baseUrl)) {
		return input;
	}

	if (input.startsWith('blob:') || input.startsWith('data:') || input.startsWith('javascript:')) {
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

export const installNetworkGate = () => {
	if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') {
		return;
	}

	installed = true;
	const originalFetch = window.fetch.bind(window);

	window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
		const baseUrl = getServerBaseUrl();
		return originalFetch(rewriteFetchInput(input, baseUrl, window.location.origin), init);
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
};
