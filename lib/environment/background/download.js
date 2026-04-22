/* @flow */

import { apiToPromise } from '../utils/api';
import { isFirefox, isSafari } from '../utils/browserTarget';
import { addListener } from './messaging';

function hasDownloadsApi() {
	return Boolean(chrome.downloads && typeof chrome.downloads.download === 'function');
}

addListener('download', async ({ url, filename }, { tab } = {}) => {
	if (!hasDownloadsApi()) return false;

	try {
		// Safari follows the Chrome path here when the API exists; only Firefox needs the explicit incognito flag.
		await apiToPromise(chrome.downloads.download, chrome.downloads)({
			url,
			filename,
			...(isFirefox && tab ? { incognito: tab.incognito } : {}),
		});
	} catch (e) {
		if (isSafari) return false;
		throw e;
	}

	return true;
});
