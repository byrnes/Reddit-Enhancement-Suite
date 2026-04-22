/* @flow */

import { apiToPromise } from '../utils/api';
import { isFirefox } from '../utils/browserTarget';
import { addListener, sendMessage } from './messaging';

addListener('multicast', async ({ name, args, crossContext }, sender) => {
	// Safari follows Chrome's incognito-style grouping here; only Firefox needs cookieStoreId isolation.
	const CONTEXT_KEY = isFirefox ? 'cookieStoreId' : 'incognito';

	const redditTabs = await apiToPromise(chrome.tabs.query, chrome.tabs)({ url: 'https://*.reddit.com/*', status: 'complete' });
	const nonSelfTabsInSameContext = redditTabs
		.filter(tab => (
			(sender.frameId || tab.id !== sender.tab.id) &&
			(crossContext || tab[CONTEXT_KEY] === sender.tab[CONTEXT_KEY])
		));

	return Promise.all(nonSelfTabsInSameContext.map(({ id: tabId }) => sendMessage('multicast', { name, args }, tabId)));
});
