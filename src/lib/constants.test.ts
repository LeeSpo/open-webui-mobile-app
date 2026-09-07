import { afterEach, describe, expect, it } from 'vitest';

import {
	AUDIO_API_BASE_URL,
	OLLAMA_API_BASE_URL,
	OPENAI_API_BASE_URL,
	WEBUI_API_BASE_URL,
	WEBUI_BASE_URL,
	WEBUI_HOSTNAME,
	applyRuntimeBaseUrl
} from './constants';

describe('applyRuntimeBaseUrl', () => {
	afterEach(() => {
		applyRuntimeBaseUrl('');
	});

	it('keeps official same-origin URLs when empty', () => {
		applyRuntimeBaseUrl('');
		expect(WEBUI_BASE_URL).toBe('');
		expect(WEBUI_HOSTNAME).toBe('');
		expect(WEBUI_API_BASE_URL).toBe('/api/v1');
		expect(OLLAMA_API_BASE_URL).toBe('/ollama');
		expect(OPENAI_API_BASE_URL).toBe('/openai');
		expect(AUDIO_API_BASE_URL).toBe('/api/v1/audio');
	});

	it('updates live bindings used by existing API modules', () => {
		applyRuntimeBaseUrl('https://chat.example.com');
		expect(WEBUI_BASE_URL).toBe('https://chat.example.com');
		expect(WEBUI_HOSTNAME).toBe('chat.example.com');
		expect(WEBUI_API_BASE_URL).toBe('https://chat.example.com/api/v1');
		expect(OLLAMA_API_BASE_URL).toBe('https://chat.example.com/ollama');
	});
});
