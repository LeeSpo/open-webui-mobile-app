<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import { applyRuntimeBaseUrl, WEBUI_BASE_URL } from '$lib/constants';
	import {
		getServerBaseUrl,
		isNativeApp,
		persistServerBaseUrl,
		probeServer
	} from '$lib/runtime';

	const i18n = getContext('i18n');

	let serverUrl = '';
	let submitting = false;
	let probedName = '';
	let probedVersion = '';
	let loaded = false;
	let changing = false;

	const errorMessage = (error: string) => {
		switch (error) {
			case 'invalid_url':
				return $i18n.t('Enter a valid http(s) server address.');
			case 'cors':
				return $i18n.t(
					'The server blocked this origin. Add https://localhost to CORS_ALLOW_ORIGIN.'
				);
			case 'tls':
				return $i18n.t('The TLS certificate was rejected. Use a trusted certificate or HTTP on LAN.');
			case 'http_error':
				return $i18n.t('The server responded, but it does not look like Open WebUI.');
			default:
				return $i18n.t('Could not reach the server. Check the address and that the device is online.');
		}
	};

	const connect = async () => {
		if (submitting) {
			return;
		}

		submitting = true;
		probedName = '';
		probedVersion = '';

		try {
			const result = await probeServer(serverUrl);
			if (!result.ok) {
				toast.error(errorMessage(result.error));
				return;
			}

			const saved = persistServerBaseUrl(serverUrl);
			applyRuntimeBaseUrl(saved);
			probedName = result.name ?? '';
			probedVersion = result.version ?? '';

			if (changing) {
				localStorage.removeItem('token');
			}

			window.location.href = '/';
		} finally {
			submitting = false;
		}
	};

	onMount(() => {
		if (!isNativeApp()) {
			goto('/');
			return;
		}

		const current = getServerBaseUrl() || WEBUI_BASE_URL;
		if (current) {
			serverUrl = current;
			changing = true;
		}

		loaded = true;
	});
</script>

<svelte:head>
	<title>Open WebUI</title>
</svelte:head>

{#if loaded}
	<div class="relative h-screen max-h-[100dvh] w-full text-black dark:text-white">
		<div class="absolute inset-0 bg-white dark:bg-black"></div>
		<div class="relative z-10 flex min-h-screen w-full items-center justify-center px-8">
			<div class="w-full max-w-md pb-10 text-center">
				<img
					src="/static/favicon.png"
					alt="Open WebUI"
					class="mx-auto mb-6 size-20 rounded-full"
				/>

				<h1 class="text-2xl font-normal">
					{changing ? $i18n.t('Change server') : $i18n.t('Connect to Open WebUI')}
				</h1>
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
					{$i18n.t(
						'This app loads the Open WebUI interface locally. API, WebSocket, files, and models still use your existing server.'
					)}
				</p>

				<form
					class="mt-6 flex flex-col gap-3 text-left"
					on:submit={(e) => {
						e.preventDefault();
						connect();
					}}
				>
					<label class="text-xs text-gray-600 dark:text-gray-400" for="server-url">
						{$i18n.t('Server address')}
					</label>
					<input
						id="server-url"
						bind:value={serverUrl}
						type="url"
						inputmode="url"
						autocomplete="url"
						placeholder="https://open-webui.example.com"
						class="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm outline-hidden dark:border-gray-800 dark:bg-gray-950"
						disabled={submitting}
					/>

					{#if probedName}
						<p class="text-xs text-gray-500">
							{probedName}{probedVersion ? ` · ${probedVersion}` : ''}
						</p>
					{/if}

					<button
						class="mt-2 flex w-full items-center justify-center rounded-full bg-gray-900 py-2.5 text-sm text-white transition dark:bg-white dark:text-black"
						type="submit"
						disabled={submitting || !serverUrl.trim()}
					>
						{#if submitting}
							<Spinner className="size-4" />
						{:else}
							{$i18n.t('Connect')}
						{/if}
					</button>
				</form>

				{#if changing}
					<button
						class="mt-4 text-xs text-gray-500 underline"
						type="button"
						on:click={() => goto('/')}
					>
						{$i18n.t('Cancel')}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
