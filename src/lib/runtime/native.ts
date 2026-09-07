import { applyAppAuthToken } from './oauth';
import { isNativeApp } from './server-config';

let installed = false;

export const installNativeShell = async () => {
	if (installed || !isNativeApp()) {
		return;
	}

	installed = true;

	const { App } = await import('@capacitor/app');

	App.addListener('backButton', ({ canGoBack }) => {
		if (canGoBack || window.history.length > 1) {
			window.history.back();
			return;
		}

		App.exitApp();
	});

	App.addListener('appUrlOpen', async ({ url }) => {
		await applyAppAuthToken(url);
	});

	try {
		const launch = await App.getLaunchUrl();
		if (launch?.url) {
			await applyAppAuthToken(launch.url);
		}
	} catch {
		// Launch URL is optional.
	}

	try {
		const { StatusBar } = await import('@capacitor/status-bar');
		await StatusBar.setOverlaysWebView({ overlay: true });
	} catch {
		// Status bar plugin is unavailable in some WebView debug hosts.
	}

	try {
		const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
		await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
	} catch {
		// Keyboard plugin is optional.
	}
};
