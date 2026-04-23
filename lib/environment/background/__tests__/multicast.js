/* @flow */

import test from 'ava';

const multicastModuleUrl = new URL('../multicast.js', import.meta.url).href;

function createChromeMock() {
	return {
		runtime: {
			lastError: null,
			onMessage: {
				addListener() {},
			},
		},
		tabs: {
			sendMessage(_tabId, _message, callback) {
				callback({ data: undefined });
			},
			query(_query, callback) {
				callback([]);
			},
			get(_tabId, callback) {
				callback(null);
			},
			onRemoved: {
				addListener() {},
			},
		},
		windows: {
			get(_windowId, callback) {
				callback(null);
			},
			onRemoved: {
				addListener() {},
			},
		},
	};
}

function loadMulticastModule() {
	global.chrome = createChromeMock();

	return import(
		/* webpackChunkName: "background-multicast-test" */
		multicastModuleUrl
	);
}

let resolvePrivateBrowsingStateForTab;

test.before(async () => {
	({ resolvePrivateBrowsingStateForTab } = await loadMulticastModule());
});

test.after.always(() => {
	// $FlowIgnore[incompatible-use]
	delete global.chrome;
});

test('resolvePrivateBrowsingStateForTab falls back to window incognito state', async t => {
	const tabContextKeyByTabId = new Map();
	const windowContextKeyByWindowId = new Map();

	const state = await resolvePrivateBrowsingStateForTab(
		{ id: 11, windowId: 7 },
		{
			tabContextKeyByTabId,
			windowContextKeyByWindowId,
			getTabById: () => Promise.resolve({ id: 11, windowId: 7 }),
			getWindowById: () => Promise.resolve({ id: 7, incognito: true }),
		},
	);

	t.deepEqual(state, {
		value: true,
		resolved: true,
		source: 'background.window.incognito',
	});
	t.is(tabContextKeyByTabId.get(11), 'privateBrowsing:true');
	t.is(windowContextKeyByWindowId.get(7), 'privateBrowsing:true');
});

test('resolvePrivateBrowsingStateForTab reuses cached window state when sender tab omits incognito', async t => {
	const tabContextKeyByTabId = new Map();
	const windowContextKeyByWindowId = new Map([[7, 'privateBrowsing:true']]);

	const state = await resolvePrivateBrowsingStateForTab(
		{ id: 12, windowId: 7 },
		{
			tabContextKeyByTabId,
			windowContextKeyByWindowId,
			getTabById: () => {
				t.fail('cached window state should avoid tab lookups');
				return Promise.resolve(null);
			},
			getWindowById: () => {
				t.fail('cached window state should avoid window lookups');
				return Promise.resolve(null);
			},
		},
	);

	t.deepEqual(state, {
		value: true,
		resolved: true,
		source: 'background.privateBrowsingContextWindowCache',
	});
});
