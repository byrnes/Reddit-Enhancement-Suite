/* @flow */

import test from 'ava';

function createChromeMock() {
	let privateBrowsingRequests = 0;
	let privateBrowsingContextSyncs = 0;

	return {
		chrome: {
			extension: {},
			runtime: {
				lastError: null,
				onMessage: {
					addListener() {},
				},
				sendMessage(message, callback) {
					if (message.type === 'privateBrowsing') {
						privateBrowsingRequests += 1;
						callback({ data: { value: false, resolved: false, source: 'background.privateBrowsing' } });
						return;
					}

					if (message.type === 'privateBrowsingContext') {
						privateBrowsingContextSyncs += 1;
					}

					callback({ data: true });
				},
			},
		},
		getCounts() {
			return {
				privateBrowsingRequests,
				privateBrowsingContextSyncs,
			};
		},
	};
}

function loadPrivateBrowsingModule(chrome) {
	global.chrome = chrome;

	return import(
		/* webpackChunkName: "foreground-private-browsing-test" */
		new URL(`../privateBrowsing.js?test=${Math.random()}`, import.meta.url).href
	);
}

test.afterEach.always(() => {
	// $FlowIgnore[incompatible-use]
	delete global.chrome;
});

test('private-browsing resolution refreshes direct state and fails closed after unresolved attempts', async t => {
	const { chrome, getCounts } = createChromeMock();
	const {
		isPrivateBrowsing,
		resolvePrivateBrowsingState,
		shouldAssumePrivateBrowsing,
	} = await loadPrivateBrowsingModule(chrome);

	t.false(isPrivateBrowsing());
	t.false(shouldAssumePrivateBrowsing());

	const unresolvedState = await resolvePrivateBrowsingState();

	t.deepEqual(unresolvedState, {
		value: false,
		resolved: false,
		source: 'background.privateBrowsing',
	});
	t.false(isPrivateBrowsing());
	t.true(shouldAssumePrivateBrowsing());
	t.deepEqual(getCounts(), {
		privateBrowsingRequests: 1,
		privateBrowsingContextSyncs: 0,
	});

	chrome.runtime.inIncognitoContext = true;

	const resolvedState = await resolvePrivateBrowsingState();

	t.deepEqual(resolvedState, {
		value: true,
		resolved: true,
		source: 'chrome.runtime.inIncognitoContext',
	});
	t.deepEqual(getCounts(), {
		privateBrowsingRequests: 1,
		privateBrowsingContextSyncs: 1,
	});
});
