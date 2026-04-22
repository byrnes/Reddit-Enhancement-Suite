/* @flow */

import { apiToPromise } from '../utils/api';
import { isFirefox } from '../utils/browserTarget';
import { addListener, sendMessage } from './messaging';

const privateBrowsingContextKeyByTabId = new Map();
const PRIVATE_BROWSING_STATE_TIMEOUT_MS = 2000;

function withTimeout(promise, timeoutMs, message) {
	return new Promise((resolve, reject) => {
		let settled = false;
		const timeoutId = setTimeout(() => {
			if (settled) return;
			settled = true;
			reject(new Error(message));
		}, timeoutMs);

		const settle = callback => value => {
			if (settled) return;
			settled = true;
			clearTimeout(timeoutId);
			callback(value);
		};

		promise.then(settle(resolve), settle(reject));
	});
}

function getPrivateBrowsingContextKey(state) {
	if (typeof state?.value !== 'boolean' || state.resolved === false) return;
	return `privateBrowsing:${String(state.value)}`;
}

function cachePrivateBrowsingContext(tabId, state) {
	const contextKey = getPrivateBrowsingContextKey(state);
	if (typeof tabId === 'number' && contextKey) {
		privateBrowsingContextKeyByTabId.set(tabId, contextKey);
	}
	return contextKey;
}

function getPrivateBrowsingState(sender) {
	if (typeof sender.tab?.incognito === 'boolean') {
		return {
			value: sender.tab.incognito,
			resolved: true,
			source: 'background.sender.tab.incognito',
		};
	}

	const cachedContextKey = privateBrowsingContextKeyByTabId.get(sender.tab?.id);
	if (cachedContextKey) {
		return {
			value: cachedContextKey === 'privateBrowsing:true',
			resolved: true,
			source: 'background.privateBrowsingContextCache',
		};
	}

	return {
		value: false,
		resolved: false,
		source: sender.tab ? 'background.sender.tab.incognito-unavailable' : 'background.sender.tab-missing',
	};
}

async function getContextKey(tab, fallbackState) {
	if (!tab) return 'tab:missing';

	if (isFirefox) {
		return typeof tab.cookieStoreId === 'string' ?
			`cookieStoreId:${tab.cookieStoreId}` :
			`tab:${String(tab.id)}`;
	}

	if (typeof tab.incognito === 'boolean') {
		return `incognito:${String(tab.incognito)}`;
	}

	const cachedContextKey = privateBrowsingContextKeyByTabId.get(tab.id);
	if (cachedContextKey) {
		return cachedContextKey;
	}

	const fallbackContextKey = cachePrivateBrowsingContext(tab.id, fallbackState);
	if (fallbackContextKey) {
		return fallbackContextKey;
	}

	if (typeof tab.id === 'number') {
		try {
			const state = await withTimeout(
				sendMessage('privateBrowsingState', undefined, tab.id),
				PRIVATE_BROWSING_STATE_TIMEOUT_MS,
				`Timed out waiting for private browsing state from tab ${String(tab.id)}`,
			);
			const contextKey = cachePrivateBrowsingContext(tab.id, state);
			if (contextKey) {
				return contextKey;
			}
		} catch (_error) {
			// Ignore missing or unresponsive tab context and fall back below.
		}
	}

	// Safari private browsing is window-based, so windowId is a safer fallback than tabId
	// when the tab-level incognito bit is unavailable.
	return typeof tab.windowId === 'number' ?
		`window:${String(tab.windowId)}` :
		`tab:${String(tab.id)}`;
}

addListener('privateBrowsing', (_data, sender) => getPrivateBrowsingState(sender));
addListener('privateBrowsingContext', (state, sender) => {
	cachePrivateBrowsingContext(sender.tab?.id, state);
	return true;
});

chrome.tabs.onRemoved.addListener(tabId => {
	privateBrowsingContextKeyByTabId.delete(tabId);
});

addListener('multicast', async ({ name, args, crossContext, privateBrowsingState }, sender) => {
	if (!sender.tab) return [];

	const redditTabs = await apiToPromise(chrome.tabs.query, chrome.tabs)({ url: 'https://*.reddit.com/*', status: 'complete' });
	const senderContextKey = crossContext ? null : await getContextKey(sender.tab, privateBrowsingState);
	const tabsWithContext = await Promise.all(redditTabs.map(async tab => ({
		tab,
		contextKey: crossContext ? null : await getContextKey(tab),
	})));
	const nonSelfTabsInSameContext = tabsWithContext
		.filter(({ tab, contextKey }) => (
			(sender.frameId || tab.id !== sender.tab.id) &&
			(crossContext || contextKey === senderContextKey)
		))
		.map(({ tab }) => tab);

	return Promise.all(nonSelfTabsInSameContext.map(({ id: tabId }) => sendMessage('multicast', { name, args }, tabId)));
});
