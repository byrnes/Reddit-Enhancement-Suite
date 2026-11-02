/* @flow */

import { apiToPromise } from '../utils/api';
import { isSafari } from '../utils/browserTarget';
import { addListener } from './messaging';

addListener('permissions', handleMessage);

function hasPermissionsApi(method: string) {
	return Boolean(chrome.permissions && typeof chrome.permissions[method] === 'function');
}

function hasRequestedPermissions({ permissions, origins }: { permissions: any, origins: any, ... }) {
	return Boolean(permissions.length || origins.length);
}

export async function handleMessage({ operation, permissions = [], origins = [], dataCollection, promptFallback = true }: any): Promise<any> {
	if (process.env.BUILD_TARGET === 'firefox' && dataCollection) {
		switch (operation) {
			case 'contains':
				return apiToPromise(chrome.permissions.getAll, chrome.permissions)()
					.then(({ data_collection: granted = [] }) => dataCollection.every(permission => granted.includes(permission)));
			case 'request':
				return apiToPromise(chrome.permissions.request, chrome.permissions)({ data_collection: dataCollection })
					.catch(() => makePromptWindow({ dataCollection }));
			default:
				throw new Error(`Invalid permissions operation: ${operation}`);
		}
	}

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

async function makePromptWindow({ permissions, origins, dataCollection }: {
	permissions?: any,
	origins?: any,
	dataCollection?: any,
	...
}) {
	// Not location.origin: WebKit lowercases its host, but Safari's extension UUIDs are uppercase and case-sensitive.
	const url = new URL(chrome.runtime.getURL('prompt.html'));
	if (dataCollection) {
		url.searchParams.set('dataCollection', JSON.stringify(dataCollection));
	} else {
		// $FlowFixMe[incompatible-type] JSON.stringify(undefined) is coerced to 'undefined'
		url.searchParams.set('permissions', JSON.stringify(permissions));
		// $FlowFixMe[incompatible-type] JSON.stringify(undefined) is coerced to 'undefined'
		url.searchParams.set('origins', JSON.stringify(origins));
	}

	const width = 630;
	const height = 255;

	// Get the current window's dimensions and calculate center position
	const { width: screenWidth, height: screenHeight } = await chrome.windows.getCurrent() || { width: 1920, height: 1080 };
	const left = Math.floor(screenWidth / 2 - width / 2);
	const top = Math.floor(screenHeight / 2 - height / 2);

	const { tabs: [{ id }] } = await apiToPromise(chrome.windows.create, chrome.windows)({ url: url.href, type: 'popup', width, height, left, top });

	return new Promise(resolve => {
		function updateListener(tabId: number, updates: { url?: string, ... }) {
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

		function removeListener(tabId: number) {
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
