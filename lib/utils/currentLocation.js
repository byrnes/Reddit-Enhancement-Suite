/* @flow */

import { once, partition } from 'lodash-es';
import { appPageTypes, regexes } from './location.js';
import type { AppType, PageType } from './location';

export function matchesPageLocation(includes: Array<PageType | AppType | RegExp>, excludes: Array<PageType | AppType | RegExp> = []): boolean {
	const [includeStrings, includeRegExps]: any = partition(includes, (x: string | RegExp): boolean => typeof x === 'string');
	const [excludeStrings, excludeRegExps]: any = partition(excludes, (x: string | RegExp): boolean => typeof x === 'string');

	return (
		!excludes.length ||
		!(isPageType(...excludeStrings) || isAppType(...excludeStrings) || matchesPageRegex(...excludeRegExps))
	) && (
		!includes.length ||
		(isPageType(...includeStrings) || isAppType(...includeStrings) || matchesPageRegex(...includeRegExps))
	);
}

const oldRedditHostnameRegex = /^(?:old|(?:[\w]+-)?np(?:-[\w]+)?|[a-z]{2}(?:-[a-z]{2})?)\.reddit\.com$/i;
const oldRedditOptOutCookieRegex = /(?:^|;\s*)redesign_optout=true(?:;|$)/i;
const logDetectedAppType = once((details: *) => {
	if (process.env.BUILD_TARGET === 'safari') {
		console.info('[RES][currentLocation] appType detection', details);
	}
});

export function detectAppType(
	doc: {|
		documentElement: {| hasAttribute: (name: string) => boolean, getAttribute: (name: string) => ?string |},
		querySelector: (selector: string) => mixed,
		cookie?: string,
	|} = (document: any),
	hostname: string = location.hostname,
): AppType {
	const hasOptionsAttr = doc.documentElement.hasAttribute('res-options');
	const hasXmlns = !!doc.documentElement.getAttribute('xmlns');
	const hasOldRedditHostname = oldRedditHostnameRegex.test(hostname);
	const hasOldRedditOptOutCookie =
		hostname === 'www.reddit.com' &&
		typeof doc.cookie === 'string' &&
		oldRedditOptOutCookieRegex.test(doc.cookie);
	const hasClassicHeader = !!doc.querySelector('#header, #sr-header-area');

	if (hasOptionsAttr) {
		logDetectedAppType({ hostname, hasOptionsAttr, hasXmlns, hasOldRedditHostname, hasOldRedditOptOutCookie, hasClassicHeader, appType: 'options' });
		return 'options';
	}

	// Old Reddit historically exposes the XHTML namespace, but Safari's DOM view
	// does not always preserve that attribute. Fall back to hostname, the old-Reddit
	// opt-out cookie on `www`, and classic page markers so the old-Reddit watcher
	// path still boots correctly even at document_start.
	if (
		hasXmlns ||
		hasOldRedditHostname ||
		hasOldRedditOptOutCookie ||
		hasClassicHeader
	) {
		logDetectedAppType({ hostname, hasOptionsAttr, hasXmlns, hasOldRedditHostname, hasOldRedditOptOutCookie, hasClassicHeader, appType: 'r2' });
		return 'r2';
	}

	logDetectedAppType({ hostname, hasOptionsAttr, hasXmlns, hasOldRedditHostname, hasOldRedditOptOutCookie, hasClassicHeader, appType: 'd2x' });
	return 'd2x';
}

export function appType(): AppType {
	return detectAppType();
}

export function isAppType(...types: AppType[]): boolean {
	const thisApp = appType();
	return types.some(type => type === thisApp);
}

export function pageType(): ?PageType {
	const spec = appPageTypes[appType()];
	return spec.pageTypes.find(pageType => regexes[pageType].test(location.pathname)) || spec.default;
}

export function matchesPageRegex(...regexps: RegExp[]): boolean {
	return regexps.some(regex => regex.test(location.pathname));
}

export const currentSubreddit = once((): string | void => {
	const match = location.pathname.match(regexes.subreddit);
	if (match) return match[1];
});

export function isCurrentSubreddit(...subreddits: string[]): boolean {
	const sub = (currentSubreddit() || '').toLowerCase();
	if (!sub) return false;
	return subreddits.some(v => v.toLowerCase() === sub);
}

export const currentMultireddit = once((): string | void => {
	const match = location.pathname.match(regexes.multireddit);
	if (match) return match[1];
});

export function isCurrentMultireddit(...multireddits: string[]): boolean {
	const multi = (currentMultireddit() || '').toLowerCase();
	if (!multi) return false;
	return multireddits.some(v => v.toLowerCase() === multi);
}

export const currentDomain = once((): string | void => {
	const match = location.pathname.match(regexes.domain);
	if (match) return match[1];
});

export const currentUserProfile = once((): string | void => {
	const match = location.pathname.match(regexes.profile);
	if (match) return match[1];
});

export function isPageType(...types: PageType[]): boolean {
	const thisPage = pageType();
	return types.some(type => type === thisPage);
}

export const inQuarantinedSubreddit = once(() => document.body.classList.contains('quarantine'));
