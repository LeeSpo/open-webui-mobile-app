import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.openwebui.app',
	appName: 'Open WebUI',
	webDir: 'build',
	server: {
		androidScheme: 'https',
		cleartext: true
	},
	android: {
		allowMixedContent: true,
		webContentsDebuggingEnabled: true,
		adjustMarginsForEdgeToEdge: 'force'
	},
	plugins: {
		Keyboard: {
			resize: 'native',
			resizeOnFullScreen: true
		},
		StatusBar: {
			style: 'DARK',
			overlaysWebView: true
		}
	}
};

export default config;
