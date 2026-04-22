/* @flow */

import { apiToPromise } from '../utils/api';
import { isFirefox } from '../utils/browserTarget';
import { addListener, sendMessage } from './messaging';

const actionApi = isFirefox ? chrome.pageAction : chrome.action;
const safariDebug = (...args) => {
	if (process.env.BUILD_TARGET === 'safari') {
		console.info('[RES][pageAction]', ...args);
	}
};

async function resolveTabId(tab): Promise<?number> {
	if (tab && typeof tab.id === 'number') return tab.id;

	const activeTabs = await apiToPromise(chrome.tabs.query, chrome.tabs)({ active: true, currentWindow: true });
	safariDebug('Resolved active tab fallback', { inputTabId: tab && tab.id, resolvedTabId: activeTabs && activeTabs[0] && activeTabs[0].id });
	return activeTabs && activeTabs[0] && activeTabs[0].id;
}

// Safari follows the Chrome action API here, so only Firefox keeps the pageAction branch.
actionApi.onClicked.addListener(async tab => {
	const tabId = await resolveTabId(tab);
	safariDebug('Toolbar clicked', { inputTabId: tab && tab.id, resolvedTabId: tabId });
	if (typeof tabId !== 'number') return;
	sendMessage('pageActionClick', undefined, tabId);
});

addListener('pageAction', async ({ operation, state }, { tab }) => {
	const tabId = await resolveTabId(tab);
	safariDebug('Page action update', { operation, state, inputTabId: tab && tab.id, resolvedTabId: tabId });
	if (typeof tabId !== 'number') return;

	switch (operation) {
		case 'show':
			(isFirefox ? chrome.pageAction.show : chrome.action.enable)(tabId);
			actionApi.setIcon({
				tabId,
				path: {
					'19': state ? 'css-on-small.png' : 'css-off-small.png', // eslint-disable-line quote-props
					'38': state ? 'css-on.png' : 'css-off.png', // eslint-disable-line quote-props
				},
			});
			actionApi.setTitle({
				tabId,
				title: state ? 'Subreddit Style On' : 'Subreddit Style Off',
			});
			break;
		case 'hide':
			(isFirefox ? chrome.pageAction.hide : chrome.action.disable)(tabId);
			break;
		default:
			throw new Error(`Invalid action operation: ${operation}`);
	}
});
