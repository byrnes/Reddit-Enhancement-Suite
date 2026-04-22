/* @flow */

import { isFirefox } from '../utils/browserTarget';
import { addListener } from './messaging';

addListener('openNewTabs', ({ urls, focusIndex }, { tab }) => {
	urls.forEach((url, i) => {
		chrome.tabs.create({
			url,
			active: i === focusIndex,
			index: tab.index + 1 + i,
			openerTabId: tab.id,
			// Safari follows the Chrome tab model here; only Firefox needs cookieStoreId to keep the right container.
			...(isFirefox ? { cookieStoreId: tab.cookieStoreId } : {}),
		});
	});
});
