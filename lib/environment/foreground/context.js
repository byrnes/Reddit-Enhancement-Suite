/* @flow */

import {
	loggedInUser,
	loggedInUserHash,
} from '../../utils/user.js';
import { contentStart } from '../../utils/pagePhases.js';
import { waitForEvent } from '../../utils/dom.js';
import {
	getPrivateBrowsingState,
	resolvePrivateBrowsingState,
	seedPrivateBrowsingState,
} from './privateBrowsing.js';

export const data: {|
	userHash: ?string,
	username: ?string,
	origin: string,
	pathname: string,
	privateBrowsing: boolean,
	privateBrowsingResolved: boolean,
	privateBrowsingSource: string,
|} = {
	userHash: null,
	username: null,
	origin: 'https://www.reddit.com',
	pathname: location.pathname,
	privateBrowsing: false,
	privateBrowsingResolved: false,
	privateBrowsingSource: 'fallback.unresolved',
};

function syncPrivateBrowsingContext() {
	const { value, resolved, source } = getPrivateBrowsingState();
	data.privateBrowsing = value;
	data.privateBrowsingResolved = resolved;
	data.privateBrowsingSource = source;
}

syncPrivateBrowsingContext();
resolvePrivateBrowsingState().then(syncPrivateBrowsingContext);

if (location.protocol.startsWith('http')) {
	data.origin = location.origin;

	contentStart.then(() => {
		data.username = loggedInUser();
		loggedInUserHash().then(hash => { data.userHash = hash; });
	});
}

export function retrieveFromParent() {
	if (window === window.parent) return Promise.resolve();

	return waitForEvent(window, 'message').then(({ data: { context } }: any) => {
		Object.assign(data, context);
		if (typeof context?.privateBrowsing === 'boolean') {
			seedPrivateBrowsingState({
				value: context.privateBrowsing,
				resolved: context.privateBrowsingResolved !== false,
				source: context.privateBrowsingSource || 'context.parent',
			});
		}
		syncPrivateBrowsingContext();
	});
}
