/* @flow */

import { apiToPromise } from '../utils/api';
import { isSafari } from '../utils/browserTarget';
import { addListener } from './messaging';

addListener('permissions', handleMessage);

function hasPermissionsApi(method) {
	return Boolean(chrome.permissions && typeof chrome.permissions[method] === 'function');
}

function hasRequestedPermissions({ permissions, origins }) {
	return Boolean(permissions.length || origins.length);
}

export async function handleMessage({ operation, permissions = [], origins = [], promptFallback = true }: *) {
	switch (operation) {
		case 'contains':
			if (!hasRequestedPermissions({ permissions, origins })) return true;
			if (!hasPermissionsApi('contains')) return false;
			try {
				return await apiToPromise(chrome.permissions.contains, chrome.permissions)({ permissions, origins });
			} catch (e) {
				if (isSafari) return false;
				throw e;
			}
		case 'request': {
			if (!hasRequestedPermissions({ permissions, origins })) return true;
			if (!hasPermissionsApi('request')) return false;

			try {
				const granted = await apiToPromise(chrome.permissions.request, chrome.permissions)({ permissions, origins });
				if (granted || !isSafari || !promptFallback) return granted;
			} catch {
				if (!promptFallback) return false;
				return makePromptWindow({ permissions, origins });
			}

			// Safari can resolve false without surfacing a request-time error, so fall back to the explicit prompt.
			if (!promptFallback) return false;
			return makePromptWindow({ permissions, origins });
		}
		default:
			throw new Error(`Invalid permissions operation: ${operation}`);
	}
}

async function makePromptWindow({ permissions, origins }) {
	const url = new URL('prompt.html', location.origin);
	url.searchParams.set('permissions', JSON.stringify(permissions));
	url.searchParams.set('origins', JSON.stringify(origins));

	const width = 630;
	const height = 255;

	// Get the current window's dimensions and calculate center position
	const { width: screenWidth, height: screenHeight } = await chrome.windows.getCurrent() || { width: 1920, height: 1080 };
	const left = Math.floor(screenWidth / 2 - width / 2);
	const top = Math.floor(screenHeight / 2 - height / 2);

	const { tabs: [{ id }] } = await apiToPromise(chrome.windows.create, chrome.windows)({ url: url.href, type: 'popup', width, height, left, top });

	return new Promise(resolve => {
		function updateListener(tabId, updates) {
			if (tabId !== id) return;

			const url = updates.url && new URL(updates.url);
			if (url && url.searchParams.has('result')) {
				stopListening();
				const result = url.searchParams.get('result');
				if (!result) return;
				resolve(JSON.parse(result));
				apiToPromise(chrome.tabs.remove, chrome.tabs)(id);
			}
		}

		function removeListener(tabId) {
			if (tabId !== id) return;
			stopListening();
			resolve(false);
		}

		function stopListening() {
			chrome.tabs.onUpdated.removeListener(updateListener);
			chrome.tabs.onRemoved.removeListener(removeListener);
		}

		chrome.tabs.onUpdated.addListener(updateListener);
		chrome.tabs.onRemoved.addListener(removeListener);
	});
}
