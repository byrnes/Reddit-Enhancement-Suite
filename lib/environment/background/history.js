/* @flow */

import { apiToPromise } from '../utils/api';
import { isSafari } from '../utils/browserTarget';
import { addListener } from './messaging';

function hasHistoryApi(method) {
	return Boolean(chrome.history && typeof chrome.history[method] === 'function');
}

addListener('addURLToHistory', async url => {
	if (!hasHistoryApi('addUrl')) return false;

	try {
		await apiToPromise(chrome.history.addUrl, chrome.history)({ url });
		return true;
	} catch (e) {
		if (isSafari) return false;
		throw e;
	}
});

addListener('isURLVisited', async url => {
	if (!hasHistoryApi('getVisits')) return false;

	try {
		const visits = await apiToPromise(chrome.history.getVisits, chrome.history)({ url });
		return visits.length > 0;
	} catch (e) {
		if (isSafari) return false;
		throw e;
	}
});
