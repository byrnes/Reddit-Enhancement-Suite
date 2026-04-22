/* @flow */
import { apiToPromise } from '../utils/api';
import { isFirefox, isSafari } from '../utils/browserTarget';
import { addListener } from './messaging';

addListener('authFlow', ({ domain, clientId, scope, interactive }) => {
	const redirectUri = isFirefox ? chrome.identity.getRedirectURL() : 'https://redditenhancementsuite.com/oauth';
	const url = new URL(domain);
	url.searchParams.set('client_id', clientId);
	url.searchParams.set('scope', scope);
	url.searchParams.set('response_type', 'token');
	url.searchParams.set('redirect_uri', redirectUri);

	if (isFirefox) {
		// Firefox correctly supports chrome.identity.launchAuthFlow.
		return apiToPromise(chrome.identity.launchWebAuthFlow, chrome.identity)({ url: url.href, interactive });
	}

	// Safari can't rely on `identity`, and Apple's guidance favors an explicit interactive window for OAuth.
	if (isSafari && !interactive) {
		throw new Error('Safari requires interactive auth.');
	}

	// Safari follows the Chrome-style emulated flow here because `identity` is not the path we want to rely on.
	if (interactive) {
		return emulateAuthFlowInNewWindow(url.href, redirectUri);
	}
	return emulateAuthFlowInBackground(url.href);
});

async function emulateAuthFlowInNewWindow(url: string, redirectUri: string): Promise<string> {
	// Emulate interactive auth.
	// Open a popup window, then track its progress with chrome.tabs,
	// succeeding if it navigates to our redirect URL, and failing if it's
	// closed before then.
	const { tabs: [{ id }] } = await apiToPromise(chrome.windows.create, chrome.windows)({ url, type: 'popup' });

	return new Promise((resolve, reject) => {
		function updateListener(tabId, updates) {
			if (tabId !== id) return;

			if (updates.url && updates.url.startsWith(redirectUri)) {
				stopListening();
				resolve(updates.url);
				apiToPromise(chrome.tabs.remove, chrome.tabs)(id);
			}
		}

		function removeListener(tabId) {
			if (tabId !== id) return;
			stopListening();
			reject(new Error('User cancelled or denied access.'));
		}

		function stopListening() {
			chrome.tabs.onUpdated.removeListener(updateListener);
			chrome.tabs.onRemoved.removeListener(removeListener);
		}

		chrome.tabs.onUpdated.addListener(updateListener);
		chrome.tabs.onRemoved.addListener(removeListener);
	});
}

function emulateAuthFlowInBackground(url: string): Promise<string> {
	// Emulate noninteractive auth.
	// Fetch the auth page. If the user is preauthorized, we will 302
	// to the redirect URL. However, because the token is passed in the hash,
	// and fetch/XHR responses don't include the hash, we must use the
	// webRequest API to read the redirect URL.
	return new Promise((resolve, reject) => {
		function headersListener({ redirectUrl }) {
			stopListening();
			resolve(redirectUrl);
		}

		function stopListening() {
			chrome.webRequest.onBeforeRedirect.removeListener(headersListener);
		}

		chrome.webRequest.onBeforeRedirect.addListener(headersListener, { urls: [url] });

		fetch(url, { credentials: 'include' })
			.then(() => {
				stopListening();
				reject(new Error('User interaction is required.'));
			}, e => {
				stopListening();
				reject(new Error(`Authorization page could not be loaded: ${e.message}`));
				console.error(e);
			});
	});
}
