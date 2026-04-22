/* @flow */

import { sendMessage } from './messaging';
import { getPrivateBrowsingState } from './privateBrowsing';

function shouldIsolateHistory(): boolean {
	const { value, resolved } = getPrivateBrowsingState();
	return value || !resolved;
}

export async function addURLToHistory(url: string): Promise<void> {
	if (shouldIsolateHistory()) return;

	await sendMessage('addURLToHistory', url);
}

export function isURLVisited(url: string): Promise<boolean> {
	if (shouldIsolateHistory()) return Promise.resolve(false);

	return sendMessage('isURLVisited', url);
}
