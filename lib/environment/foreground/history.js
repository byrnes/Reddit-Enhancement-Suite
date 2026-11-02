/* @flow */

import { sendMessage } from './messaging';
import { getPrivateBrowsingState, resolvePrivateBrowsingState } from './privateBrowsing';

const FALLBACK_HISTORY_STORAGE_KEY = 'RESHistoryFallback';
const FALLBACK_HISTORY_MAX_ENTRIES = 500;

let fallbackHistoryMemory: string[] = [];

function getSessionStorage(): ?Storage {
	if (typeof sessionStorage === 'undefined') return;

	try {
		const length = sessionStorage.length;
		return typeof length === 'number' ? sessionStorage : undefined;
	} catch (e) {
		return undefined;
	}
}

function normalizeHistoryURL(url: string): string {
	try {
		return new URL(url, location.href).href;
	} catch (e) {
		return url;
	}
}

function readFallbackHistory(): string[] {
	const storage = getSessionStorage();
	if (!storage) return [...fallbackHistoryMemory];

	try {
		const raw = storage.getItem(FALLBACK_HISTORY_STORAGE_KEY);
		if (!raw) {
			fallbackHistoryMemory = [];
			return [];
		}

		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			fallbackHistoryMemory = [];
			return [];
		}

		fallbackHistoryMemory = parsed.filter(v => typeof v === 'string');
		return [...fallbackHistoryMemory];
	} catch (e) {
		return [...fallbackHistoryMemory];
	}
}

function writeFallbackHistory(urls: string[]): void {
	fallbackHistoryMemory = urls;

	const storage = getSessionStorage();
	if (!storage) return;

	try {
		storage.setItem(FALLBACK_HISTORY_STORAGE_KEY, JSON.stringify(urls));
	} catch (e) {
		return undefined;
	}
}

function rememberFallbackHistory(urls: string[]): void {
	const normalized = urls
		.filter(Boolean)
		.map(normalizeHistoryURL);
	if (!normalized.length) return;

	const history = new Set(readFallbackHistory());
	for (const url of normalized) {
		history.add(url);
	}

	writeFallbackHistory(Array.from(history).slice(-FALLBACK_HISTORY_MAX_ENTRIES));
}

function rememberCurrentPageVisit(): void {
	if (typeof location !== 'undefined' && typeof location.href === 'string') {
		rememberFallbackHistory([location.href]);
	}

	if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;

	const canonical = document.querySelector('link[rel="canonical"]');
	if (canonical && typeof canonical.href === 'string') {
		rememberFallbackHistory([canonical.href]);
	}
}

async function shouldUseFallbackHistory(): Promise<boolean> {
	const initialState = getPrivateBrowsingState();
	const { value, resolved } = initialState.resolved ?
		initialState :
		await resolvePrivateBrowsingState();

	return value || !resolved;
}

export async function addURLToHistory(url: string): Promise<void> {
	if (await shouldUseFallbackHistory()) {
		rememberFallbackHistory([url]);
		return;
	}

	await sendMessage('addURLToHistory', url);
}

export async function isURLVisited(url: string): Promise<boolean> {
	if (await shouldUseFallbackHistory()) {
		rememberCurrentPageVisit();
		return readFallbackHistory().includes(normalizeHistoryURL(url));
	}

	return sendMessage('isURLVisited', url);
}
