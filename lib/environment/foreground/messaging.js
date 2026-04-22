/* @flow */

import { createMessageHandler } from '../utils/messaging.js';
import { apiToPromise } from '../utils/api.js';

// Safari background responses can legitimately take longer than an arbitrary watchdog.
const MESSAGE_TIMEOUT_MS = process.env.BUILD_TARGET === 'safari' ? null : 15000;
const safariDebug = (...args) => {
	if (process.env.BUILD_TARGET === 'safari') {
		console.info('[RES][messaging]', ...args);
	}
};

function sendMessageRaw(obj) {
	return apiToPromise(chrome.runtime.sendMessage, chrome.runtime)(obj);
}

export function withMessageTimeout(responsePromise, obj, timeoutMs = MESSAGE_TIMEOUT_MS, onTimeout = () => {
	safariDebug('Runtime message timed out', { type: obj.type });
}) {
	if (timeoutMs === null) {
		return responsePromise;
	}

	return new Promise((resolve, reject) => {
		let settled = false;
		const timeoutId = setTimeout(() => {
			if (settled) return;
			settled = true;
			const error = new Error(`Timed out waiting for runtime response: ${obj.type}`);
			onTimeout();
			reject(error);
		}, timeoutMs);

		const settle = callback => value => {
			if (settled) return;
			settled = true;
			clearTimeout(timeoutId);
			callback(value);
		};

		responsePromise.then(settle(resolve), settle(reject));
	});
}

const _sendMessage = obj => withMessageTimeout(sendMessageRaw(obj), obj);

const {
	_handleMessage,
	sendMessage,
	addListener,
} = createMessageHandler(obj => _sendMessage(obj));

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
	chrome.runtime.onMessage.addListener((obj, sender, sendResponse) => _handleMessage(obj, sendResponse));
}

export {
	sendMessage,
	addListener,
};
