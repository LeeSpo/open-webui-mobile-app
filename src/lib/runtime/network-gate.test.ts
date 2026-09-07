import { describe, expect, it } from 'vitest';

import { rewriteRelativeUrl, shouldRewritePath } from './network-gate';

const ORIGIN = 'https://localhost';
const SERVER = 'https://chat.example.com';

describe('network-gate', () => {
	it('rewrites remote API paths and leaves local assets alone', () => {
		expect(rewriteRelativeUrl('/api/config', SERVER, ORIGIN)).toBe(`${SERVER}/api/config`);
		expect(rewriteRelativeUrl('/api/v1/files/abc/content', SERVER, ORIGIN)).toBe(
			`${SERVER}/api/v1/files/abc/content`
		);
		expect(rewriteRelativeUrl('/ollama/api/tags', SERVER, ORIGIN)).toBe(`${SERVER}/ollama/api/tags`);
		expect(rewriteRelativeUrl('/openai/v1/models', SERVER, ORIGIN)).toBe(
			`${SERVER}/openai/v1/models`
		);
		expect(rewriteRelativeUrl('/ws/socket.io/?EIO=4', SERVER, ORIGIN)).toBe(
			`${SERVER}/ws/socket.io/?EIO=4`
		);
		expect(rewriteRelativeUrl('/cache/tools/out.png', SERVER, ORIGIN)).toBe(
			`${SERVER}/cache/tools/out.png`
		);
		expect(rewriteRelativeUrl('/user.png', SERVER, ORIGIN)).toBe(`${SERVER}/user.png`);

		expect(rewriteRelativeUrl('/_app/immutable/entry.js', SERVER, ORIGIN)).toBe(
			'/_app/immutable/entry.js'
		);
		expect(rewriteRelativeUrl('/assets/fonts/Inter-Variable.ttf', SERVER, ORIGIN)).toBe(
			'/assets/fonts/Inter-Variable.ttf'
		);
		expect(rewriteRelativeUrl('/static/favicon.png', SERVER, ORIGIN)).toBe('/static/favicon.png');
		expect(rewriteRelativeUrl('/audio/greeting.mp3', SERVER, ORIGIN)).toBe('/audio/greeting.mp3');
		expect(rewriteRelativeUrl('/pyodide/pyodide.js', SERVER, ORIGIN)).toBe('/pyodide/pyodide.js');
	});

	it('rewrites same-origin remote URLs produced by the WebView', () => {
		expect(rewriteRelativeUrl(`${ORIGIN}/api/config`, SERVER, ORIGIN)).toBe(`${SERVER}/api/config`);
		expect(rewriteRelativeUrl(`${ORIGIN}/static/favicon.png`, SERVER, ORIGIN)).toBe(
			`${ORIGIN}/static/favicon.png`
		);
	});

	it('does not rewrite when no server is configured', () => {
		expect(rewriteRelativeUrl('/api/config', '', ORIGIN)).toBe('/api/config');
		expect(shouldRewritePath('/api/config')).toBe(true);
		expect(shouldRewritePath('/static/favicon.png')).toBe(false);
	});

	it('leaves unrelated absolute URLs untouched', () => {
		expect(rewriteRelativeUrl('https://www.gravatar.com/avatar/x', SERVER, ORIGIN)).toBe(
			'https://www.gravatar.com/avatar/x'
		);
		expect(rewriteRelativeUrl('blob:https://localhost/1', SERVER, ORIGIN)).toBe(
			'blob:https://localhost/1'
		);
	});
});
