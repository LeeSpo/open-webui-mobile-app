<script>
	import { goto } from '$app/navigation';
	import { isNativeApp } from '$lib/runtime';
	import { WEBUI_NAME, config } from '$lib/stores';
	import { onMount, getContext } from 'svelte';

	const i18n = getContext('i18n');

	let loaded = false;

	onMount(async () => {
		if ($config) {
			await goto('/');
		}

		loaded = true;
	});
</script>

{#if loaded}
	<div class="absolute w-full h-full flex z-50">
		<div class="absolute rounded-xl w-full h-full backdrop-blur-sm flex justify-center">
			<div class="m-auto pb-44 flex flex-col justify-center">
				<div class="max-w-md">
					<div class="text-center text-2xl font-normal z-50">
						{$i18n.t('{{webUIName}} Backend Required', { webUIName: $WEBUI_NAME })}
					</div>

					<div class=" mt-4 text-center text-sm w-full">
						{$i18n.t(
							"Oops! You're using an unsupported method (frontend only). Please serve the WebUI from the backend."
						)}

						<br class=" " />
						<br class=" " />
						<a
							class=" font-normal underline"
							href="https://github.com/open-webui/open-webui#how-to-install-"
							target="_blank">{$i18n.t('See readme.md for instructions')}</a
						>
						{$i18n.t('or')}
						<a class=" font-normal underline" href="https://discord.gg/5rJgQTnV4s" target="_blank"
							>{$i18n.t('join our Discord for help.')}</a
						>
					</div>

					<div class=" mt-6 mx-auto relative group w-fit flex flex-col items-center gap-3">
						<button
							class="relative z-20 flex px-5 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition font-normal text-sm text-black"
							on:click={() => {
								location.href = '/';
							}}
						>
							{$i18n.t('Check Again')}
						</button>
						{#if isNativeApp()}
							<button
								class="relative z-20 flex px-5 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition font-normal text-sm text-black"
								on:click={() => {
									goto('/setup');
								}}
							>
								{$i18n.t('Change server')}
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
