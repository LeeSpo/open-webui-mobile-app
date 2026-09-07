import { APP_REDIRECT_URI, getServerBaseUrl, isNativeApp } from './server-config';

export const oauthLoginUrl = (provider: string): string => {
	const base = getServerBaseUrl();
	const path = `/oauth/${encodeURIComponent(provider)}/login`;
	const url = `${base}${path}`;

	if (!isNativeApp()) {
		return url;
	}

	const separator = url.includes('?') ? '&' : '?';
	return `${url}${separator}app_redirect=${encodeURIComponent(APP_REDIRECT_URI)}`;
};

export const startOAuthLogin = async (provider: string) => {
	const url = oauthLoginUrl(provider);

	if (isNativeApp()) {
		const { Browser } = await import('@capacitor/browser');
		await Browser.open({ url });
		return;
	}

	window.location.href = url;
};

const appUrlQuery = (url: string): URLSearchParams => {
	const query = url.split('?')[1]?.split('#')[0] ?? '';
	const hash = url.split('#')[1] ?? '';
	return new URLSearchParams(query || (hash.includes('=') ? hash : ''));
};

export const extractTokenFromAppUrl = (url: string): string | null => {
	if (!url || !url.startsWith('openwebui:')) {
		return null;
	}

	const params = appUrlQuery(url);
	const fromParams = params.get('token');
	if (fromParams) {
		return fromParams;
	}

	const match = url.match(/[?#&]token=([^&]+)/);
	return match ? decodeURIComponent(match[1]) : null;
};

export const extractErrorFromAppUrl = (url: string): string | null => {
	if (!url || !url.startsWith('openwebui:')) {
		return null;
	}

	return appUrlQuery(url).get('error');
};

export const applyAppAuthToken = async (url: string): Promise<boolean> => {
	if (!url || !url.startsWith('openwebui:')) {
		return false;
	}

	try {
		const { Browser } = await import('@capacitor/browser');
		await Browser.close();
	} catch {
		// Custom Tab may already be closed.
	}

	const error = extractErrorFromAppUrl(url);
	if (error) {
		window.location.href = `/auth?error=${encodeURIComponent(error)}`;
		return true;
	}

	const token = extractTokenFromAppUrl(url);
	if (!token) {
		return false;
	}

	localStorage.token = token;
	window.location.href = '/auth';
	return true;
};
