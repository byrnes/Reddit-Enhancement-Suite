/* @flow */

import {
	loggedInUser,
	loggedInUserHash,
} from '../../utils/user';
import { contentStart } from '../../utils/pagePhases';
import { isRedditOrigin } from './messageOrigins.js';
import {
	getPrivateBrowsingState,
	resolvePrivateBrowsingState,
	seedPrivateBrowsingState,
} from './privateBrowsing.js';

export const data: {
	userHash: ?string,
	username: ?string,
	origin: string,
	pathname: string,
	privateBrowsing: boolean,
	privateBrowsingResolved: boolean,
	privateBrowsingSource: string,
} = {
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

let parentOrigin;

export function retrieveFromParent(): Promise<void> {
	if (window === window.parent) return Promise.resolve();

	return new Promise<void>(resolve => {
		window.addEventListener('message', function receiveContext(event: MessageEvent) {
			if (event.source !== window.parent || !isRedditOrigin(event.origin)) return;

			const message: any = event.data;
			const context = message && message.context;
			if (!context ||
				context.origin !== event.origin ||
				typeof context.pathname !== 'string' ||
				(context.username !== null && typeof context.username !== 'undefined' && typeof context.username !== 'string') ||
				(context.userHash !== null && typeof context.userHash !== 'undefined' && typeof context.userHash !== 'string')) return;

			window.removeEventListener('message', receiveContext);
			parentOrigin = event.origin;
			data.origin = context.origin;
			data.pathname = context.pathname;
			data.username = context.username;
			data.userHash = context.userHash;
			if (typeof context.privateBrowsing === 'boolean') {
				seedPrivateBrowsingState({
					value: context.privateBrowsing,
					resolved: context.privateBrowsingResolved !== false,
					source: context.privateBrowsingSource || 'context.parent',
				});
			}
			syncPrivateBrowsingContext();
			resolve();
		});
	});
}

export function getParentOrigin(): string {
	if (window === window.parent) return location.origin;
	if (parentOrigin) return parentOrigin;

	const ancestorOrigins = (location as any).ancestorOrigins;
	const discoveredOrigin = ancestorOrigins && ancestorOrigins[0] ||
		(document.referrer && new URL(document.referrer).origin);
	if (!isRedditOrigin(discoveredOrigin)) throw new Error('Could not determine parent origin.');

	return discoveredOrigin;
}

export function isMessageFromParent(event: MessageEvent): boolean {
	return event.source === window.parent && event.origin === getParentOrigin();
}

export function isMessageFromCurrentWindow(event: MessageEvent): boolean {
	return event.source === window && event.origin === location.origin;
}

export function postMessageToParent(message: any): void {
	window.parent.postMessage(message, getParentOrigin());
}
