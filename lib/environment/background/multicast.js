/* @flow */

import { apiToPromise } from '../utils/api';
import { isFirefox } from '../utils/browserTarget';
import { addListener, sendMessage } from './messaging';

function getPrivateBrowsingState(sender) {
	if (typeof sender.tab?.incognito === 'boolean') {
		return {
			value: sender.tab.incognito,
			resolved: true,
			source: 'background.sender.tab.incognito',
		};
	}

	return {
		value: false,
		resolved: false,
		source: sender.tab ? 'background.sender.tab.incognito-unavailable' : 'background.sender.tab-missing',
	};
}

function getContextKey(tab) {
	if (!tab) return 'tab:missing';

	if (isFirefox) {
		return typeof tab.cookieStoreId === 'string' ?
			`cookieStoreId:${tab.cookieStoreId}` :
			`tab:${String(tab.id)}`;
	}

	// When incognito is unavailable, isolate to the concrete tab instead of risking private/normal fanout.
	return typeof tab.incognito === 'boolean' ?
		`incognito:${String(tab.incognito)}` :
		`tab:${String(tab.id)}`;
}

addListener('privateBrowsing', (_data, sender) => getPrivateBrowsingState(sender));

addListener('multicast', async ({ name, args, crossContext }, sender) => {
	if (!sender.tab) return [];

	const senderContextKey = getContextKey(sender.tab);

	const redditTabs = await apiToPromise(chrome.tabs.query, chrome.tabs)({ url: 'https://*.reddit.com/*', status: 'complete' });
	const nonSelfTabsInSameContext = redditTabs
		.filter(tab => (
			(sender.frameId || tab.id !== sender.tab.id) &&
			(crossContext || getContextKey(tab) === senderContextKey)
		));

	return Promise.all(nonSelfTabsInSameContext.map(({ id: tabId }) => sendMessage('multicast', { name, args }, tabId)));
});
