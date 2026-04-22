/* @flow */

export function isPrivateBrowsing(): boolean {
	// Safari may expose this bit differently, so treat a missing signal as "not private" rather than crashing.
	return Boolean(chrome.extension && chrome.extension.inIncognitoContext);
}
