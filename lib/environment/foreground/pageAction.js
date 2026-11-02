/* @flow */

import { frameThrottle } from '../../utils/async';
import { addListener, sendMessage } from './messaging';

const clickListeners = [];

export function onClick(callback: () => void) {
	clickListeners.push(callback);
}

addListener('pageActionClick', () => { for (const fn of clickListeners) fn(); });

// Don't update before page is visible, as Firefox (buggily?) ignores pageAction updates to hidden pages
const update = frameThrottle(value => sendMessage('pageAction', value));

let lastValue;

function send(value: any): Promise<unknown> {
	lastValue = value;
	return update(value);
}

export function show(state?: boolean = false): Promise<unknown> {
	return send({ operation: 'show', state });
}

export function hide(): Promise<unknown> {
	return send({ operation: 'hide' });
}

// Pages restored from the back-forward cache don't rerun init, but the action
// state may have been changed by the intervening page, so reassert it.
window.addEventListener('pageshow', ({ persisted }) => {
	if (persisted && lastValue) update(lastValue);
});
