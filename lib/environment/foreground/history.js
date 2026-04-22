/* @flow */

import { sendMessage } from './messaging';
import { getPrivateBrowsingState, resolvePrivateBrowsingState } from './privateBrowsing';

async function shouldIsolateHistory(): Promise<boolean> {
	let { value, resolved } = getPrivateBrowsingState();
	if (!resolved) {
		({ value, resolved } = await resolvePrivateBrowsingState());
	}
	return value || !resolved;
}

export async function addURLToHistory(url: string): Promise<void> {
	if (await shouldIsolateHistory()) return;

	await sendMessage('addURLToHistory', url);
}

export async function isURLVisited(url: string): Promise<boolean> {
	if (await shouldIsolateHistory()) return false;

	return sendMessage('isURLVisited', url);
}
