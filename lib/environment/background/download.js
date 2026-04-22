/* @flow */

import { isFirefox } from '../utils/browserTarget';
import { addListener } from './messaging';

addListener('download', ({ url, filename }, { tab: { incognito } }) => {
	// Safari follows the Chrome path here; only Firefox needs the explicit incognito flag.
	chrome.downloads.download({ url, filename, ...(isFirefox ? { incognito } : {}) });
});
