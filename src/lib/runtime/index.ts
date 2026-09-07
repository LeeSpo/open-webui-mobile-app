import { applyRuntimeBaseUrl } from '$lib/constants';

import { installNativeShell } from './native';
import { installNetworkGate } from './network-gate';
import { getServerBaseUrl } from './server-config';

export {
	APP_REDIRECT_URI,
	SERVER_BASE_URL_STORAGE_KEY,
	clearServerBaseUrl,
	getServerBaseUrl,
	isNativeApp,
	isSetupPath,
	needsServerSetup,
	normalizeServerBaseUrl,
	persistServerBaseUrl,
	probeServer
} from './server-config';
export {
	installNetworkGate,
	isLocalAssetPath,
	rewriteRelativeUrl,
	shouldAuthFetchMedia,
	shouldRewritePath
} from './network-gate';
export { extractTokenFromAppUrl, oauthLoginUrl, startOAuthLogin } from './oauth';
export { installNativeShell } from './native';

export const bootstrapRuntime = async () => {
	applyRuntimeBaseUrl(getServerBaseUrl());
	installNetworkGate();
	await installNativeShell();
};
