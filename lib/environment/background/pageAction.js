/* @flow */

import { apiToPromise } from '../utils/api';
import { isFirefox, isSafari } from '../utils/browserTarget';
import { addListener, sendMessage } from './messaging';

const actionApi = isFirefox ? chrome.pageAction : chrome.action;
const offIcon = {
	'19': 'css-off-small.png', // eslint-disable-line quote-props
	'38': 'css-off.png', // eslint-disable-line quote-props
};
const onIcon = {
	'19': 'css-on-small.png', // eslint-disable-line quote-props
	'38': 'css-on.png', // eslint-disable-line quote-props
};
const safariDebug = (...args) => {
	if (process.env.BUILD_TARGET === 'safari') {
		console.info('[RES][pageAction]', ...args);
	}
};

function isHandledRedditUrl(url: ?string): boolean {
	if (!url) return false;

	try {
		const parsed = new URL(url);
		if (parsed.protocol !== 'https:') return false;
		if (!parsed.hostname.endsWith('.reddit.com')) return false;
		if ([
			'mod.reddit.com',
			'ads.reddit.com',
			'i.reddit.com',
			'm.reddit.com',
			'static.reddit.com',
			'thumbs.reddit.com',
			'blog.reddit.com',
			'code.reddit.com',
			'about.reddit.com',
			'sh.reddit.com',
		].includes(parsed.hostname)) return false;
		if (/\/(?:talk|chat)\//.test(parsed.pathname)) return false;
		if (/\.(?:compact|mobile|json|json-html)$/.test(parsed.pathname)) return false;
		return true;
	} catch (e) {
		return false;
	}
}

async function resolveTabId(tab): Promise<?number> {
	if (tab && typeof tab.id === 'number') return tab.id;

	const activeTabs = await apiToPromise(chrome.tabs.query, chrome.tabs)({ active: true, currentWindow: true });
	safariDebug('Resolved active tab fallback', { inputTabId: tab && tab.id, resolvedTabId: activeTabs && activeTabs[0] && activeTabs[0].id });
	return activeTabs && activeTabs[0] && activeTabs[0].id;
}

function showInactiveForUnsupportedSafariTab(tab) {
	if (!isSafari || !tab || typeof tab.id !== 'number' || isHandledRedditUrl(tab.url)) return;

	safariDebug('Disabling action for unsupported tab', { tabId: tab.id, url: tab.url });
	actionApi.disable(tab.id);
	actionApi.setIcon({ tabId: tab.id, path: offIcon });
	actionApi.setTitle({ tabId: tab.id, title: 'Reddit Enhancement Suite is inactive on this page' });
}

if (isSafari) {
	chrome.tabs.onActivated.addListener(({ tabId }) => {
		apiToPromise(chrome.tabs.get, chrome.tabs)(tabId)
			.then(showInactiveForUnsupportedSafariTab)
			.catch(error => { safariDebug('Could not refresh active tab action state', error); });
	});

	chrome.tabs.onUpdated.addListener((_tabId, updates, tab) => {
		if (updates.url) showInactiveForUnsupportedSafariTab(tab);
	});
}

// Safari follows the Chrome action API here, so only Firefox keeps the pageAction branch.
actionApi.onClicked.addListener(async tab => {
	if (isSafari && !isHandledRedditUrl(tab && tab.url)) {
		showInactiveForUnsupportedSafariTab(tab);
		return;
	}

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
				path: state ? onIcon : offIcon,
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
