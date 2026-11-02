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
const safariDebug = (...args: Array<unknown>) => {
	if (process.env.BUILD_TARGET === 'safari' && process.env.NODE_ENV !== 'production') {
		console.info('[RES][pageAction]', ...args);
	}
};

// Safari reports an empty `tab.url` when it won't expose the URL to the extension
// (e.g. per-site access not granted, or transiently during navigation), so a missing
// or unparsable URL means "unknown" — never treat it as proof the tab is unsupported.
function classifyTabUrl(url: ?string): 'handled' | 'unhandled' | 'unknown' {
	if (typeof url !== 'string' || url === '') return 'unknown';

	try {
		const parsed = new URL(url);
		if (parsed.protocol !== 'https:') return 'unhandled';
		if (parsed.hostname !== 'reddit.com' && !parsed.hostname.endsWith('.reddit.com')) return 'unhandled';
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
		].includes(parsed.hostname)) return 'unhandled';
		if (/\/(?:talk|chat)\//.test(parsed.pathname)) return 'unhandled';
		if (/\.(?:compact|mobile|json|json-html)$/.test(parsed.pathname)) return 'unhandled';
		return 'handled';
	} catch (e) {
		return 'unknown';
	}
}

async function resolveTabId(tab: any): Promise<?number> {
	if (tab && typeof tab.id === 'number') return tab.id;

	const activeTabs = await apiToPromise(chrome.tabs.query, chrome.tabs)({ active: true, currentWindow: true });
	safariDebug('Resolved active tab fallback', { inputTabId: tab && tab.id, resolvedTabId: activeTabs && activeTabs[0] && activeTabs[0].id });
	return activeTabs && activeTabs[0] && activeTabs[0].id;
}

function showInactiveForUnsupportedSafariTab(tab: any) {
	// Only disable when the URL is positively unsupported; an unknown URL may
	// still be a reddit tab whose URL Safari is hiding from us.
	if (!isSafari || !tab || typeof tab.id !== 'number' || classifyTabUrl(tab.url) !== 'unhandled') return;

	safariDebug('Disabling action for unsupported tab', { tabId: tab.id, url: tab.url });
	actionApi.disable(tab.id);
	actionApi.setIcon({ tabId: tab.id, path: offIcon });
	actionApi.setTitle({ tabId: tab.id, title: 'Reddit Enhancement Suite is inactive on this page' });
}

function refreshSafariTabActionState(tabId: number, tab?: any) {
	const tabPromise = tab && typeof tab.url === 'string' ?
		Promise.resolve(tab) :
		apiToPromise(chrome.tabs.get, chrome.tabs)(tabId);

	tabPromise
		.then(showInactiveForUnsupportedSafariTab)
		.catch(error => { safariDebug('Could not refresh active tab action state', error); });
}

if (isSafari) {
	chrome.tabs.onActivated.addListener(({ tabId }) => {
		refreshSafariTabActionState(tabId);
	});

	chrome.tabs.onUpdated.addListener((tabId, updates, tab) => {
		if (updates.url || updates.status === 'complete') {
			refreshSafariTabActionState(tabId, tab);
		}
	});
}

// Safari follows the Chrome action API here, so only Firefox keeps the pageAction branch.
actionApi.onClicked.addListener(async tab => {
	if (isSafari && classifyTabUrl(tab && tab.url) === 'unhandled') {
		showInactiveForUnsupportedSafariTab(tab);
		return;
	}

	const tabId = await resolveTabId(tab);
	safariDebug('Toolbar clicked', { inputTabId: tab && tab.id, resolvedTabId: tabId });
	if (typeof tabId !== 'number') return;
	sendMessage('pageActionClick', undefined, tabId);
});

addListener('pageAction', ({ operation, state }, { tab }) => {
	// Apply state only to the sender's own tab — falling back to the active tab
	// would let a background tab's update grey out the foreground tab's button.
	const tabId = tab && typeof tab.id === 'number' ? tab.id : null;
	safariDebug('Page action update', { operation, state, tabId });
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
