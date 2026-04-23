/* @flow */

import { apiToPromise } from '../utils/api.js';
import { isFirefox } from '../utils/browserTarget.js';
import { addListener, sendMessage } from './messaging.js';

const privateBrowsingContextKeyByTabId = new Map();
const privateBrowsingContextKeyByWindowId = new Map();
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

export function getPrivateBrowsingContextKey(state) {
	if (typeof state?.value !== 'boolean' || state.resolved === false) return;
	return `privateBrowsing:${String(state.value)}`;
}

function getPrivateBrowsingStateFromContextKey(contextKey, source) {
	if (contextKey !== 'privateBrowsing:true' && contextKey !== 'privateBrowsing:false') return;

	return {
		value: contextKey === 'privateBrowsing:true',
		resolved: true,
		source,
	};
}

function getCachedPrivateBrowsingState(tab, {
	tabContextKeyByTabId = privateBrowsingContextKeyByTabId,
	windowContextKeyByWindowId = privateBrowsingContextKeyByWindowId,
} = {}) {
	const cachedTabContextKey = tabContextKeyByTabId.get(tab?.id);
	if (cachedTabContextKey) {
		return getPrivateBrowsingStateFromContextKey(cachedTabContextKey, 'background.privateBrowsingContextCache');
	}

	const cachedWindowContextKey = windowContextKeyByWindowId.get(tab?.windowId);
	if (cachedWindowContextKey) {
		return getPrivateBrowsingStateFromContextKey(cachedWindowContextKey, 'background.privateBrowsingContextWindowCache');
	}
}

function cachePrivateBrowsingContext(tab, state, {
	tabContextKeyByTabId = privateBrowsingContextKeyByTabId,
	windowContextKeyByWindowId = privateBrowsingContextKeyByWindowId,
} = {}) {
	const contextKey = getPrivateBrowsingContextKey(state);
	if (contextKey) {
		if (typeof tab?.id === 'number') {
			tabContextKeyByTabId.set(tab.id, contextKey);
		}

		if (typeof tab?.windowId === 'number') {
			windowContextKeyByWindowId.set(tab.windowId, contextKey);
		}
	}

	return contextKey;
}

function getTabById(tabId) {
	return apiToPromise(chrome.tabs.get, chrome.tabs)(tabId);
}

function getWindowById(windowId) {
	return apiToPromise(chrome.windows.get, chrome.windows)(windowId);
}

export async function resolvePrivateBrowsingStateForTab(tab, {
	tabContextKeyByTabId = privateBrowsingContextKeyByTabId,
	windowContextKeyByWindowId = privateBrowsingContextKeyByWindowId,
	getTabById: loadTabById = getTabById,
	getWindowById: loadWindowById = getWindowById,
} = {}) {
	if (!tab) {
		return {
			value: false,
			resolved: false,
			source: 'background.sender.tab-missing',
		};
	}

	if (typeof tab.incognito === 'boolean') {
		const state = {
			value: tab.incognito,
			resolved: true,
			source: 'background.sender.tab.incognito',
		};
		cachePrivateBrowsingContext(tab, state, { tabContextKeyByTabId, windowContextKeyByWindowId });
		return state;
	}

	const cachedState = getCachedPrivateBrowsingState(tab, { tabContextKeyByTabId, windowContextKeyByWindowId });
	if (cachedState) {
		return cachedState;
	}

	let freshTab = tab;

	if (typeof tab.id === 'number') {
		try {
			const fetchedTab = await loadTabById(tab.id);
			if (fetchedTab) {
				freshTab = { ...tab, ...fetchedTab };

				if (typeof freshTab.incognito === 'boolean') {
					const state = {
						value: freshTab.incognito,
						resolved: true,
						source: 'background.tabs.get.incognito',
					};
					cachePrivateBrowsingContext(freshTab, state, { tabContextKeyByTabId, windowContextKeyByWindowId });
					return state;
				}

				const cachedFreshState = getCachedPrivateBrowsingState(freshTab, { tabContextKeyByTabId, windowContextKeyByWindowId });
				if (cachedFreshState) {
					return cachedFreshState;
				}
			}
		} catch (_error) {
			// Ignore tab lookup failures and continue with the sender snapshot.
		}
	}

	if (typeof freshTab.windowId === 'number') {
		try {
			const window = await loadWindowById(freshTab.windowId);
			if (typeof window?.incognito === 'boolean') {
				const state = {
					value: window.incognito,
					resolved: true,
					source: 'background.window.incognito',
				};
				cachePrivateBrowsingContext(freshTab, state, { tabContextKeyByTabId, windowContextKeyByWindowId });
				return state;
			}
		} catch (_error) {
			// Ignore window lookup failures and fall back below.
		}
	}

	return {
		value: false,
		resolved: false,
		source: 'background.sender.tab.incognito-unavailable',
	};
}

function getPrivateBrowsingState(sender) {
	return resolvePrivateBrowsingStateForTab(sender.tab);
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

	const fallbackContextKey = cachePrivateBrowsingContext(tab, fallbackState);
	if (fallbackContextKey) {
		return fallbackContextKey;
	}

	const resolvedPrivateBrowsingState = await resolvePrivateBrowsingStateForTab(tab);
	const resolvedContextKey = getPrivateBrowsingContextKey(resolvedPrivateBrowsingState);
	if (resolvedContextKey) {
		return resolvedContextKey;
	}

	if (typeof tab.id === 'number') {
		try {
			const state = await withTimeout(
				sendMessage('privateBrowsingState', undefined, tab.id),
				PRIVATE_BROWSING_STATE_TIMEOUT_MS,
				`Timed out waiting for private browsing state from tab ${String(tab.id)}`,
			);
			const contextKey = cachePrivateBrowsingContext(tab, state);
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
	cachePrivateBrowsingContext(sender.tab, state);
	return true;
});

chrome.tabs.onRemoved.addListener(tabId => {
	privateBrowsingContextKeyByTabId.delete(tabId);
});

if (chrome.windows?.onRemoved) {
	chrome.windows.onRemoved.addListener(windowId => {
		privateBrowsingContextKeyByWindowId.delete(windowId);
	});
}

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
