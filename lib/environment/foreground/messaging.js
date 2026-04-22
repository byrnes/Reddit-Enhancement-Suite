/* @flow */

import { createMessageHandler } from '../utils/messaging';
import { apiToPromise } from '../utils/api';

const MESSAGE_TIMEOUT_MS = process.env.BUILD_TARGET === 'safari' ? 4000 : 15000;
const safariDebug = (...args) => {
	if (process.env.BUILD_TARGET === 'safari') {
		console.info('[RES][messaging]', ...args);
	}
};

const _sendMessageRaw = apiToPromise(chrome.runtime.sendMessage, chrome.runtime);
const _sendMessage = obj => Promise.race([
	_sendMessageRaw(obj),
	new Promise((_, reject) => {
		setTimeout(() => {
			const error = new Error(`Timed out waiting for runtime response: ${obj.type}`);
			safariDebug('Runtime message timed out', { type: obj.type });
			reject(error);
		}, MESSAGE_TIMEOUT_MS);
	}),
]);

const {
	_handleMessage,
	sendMessage,
	addListener,
} = createMessageHandler(obj => _sendMessage(obj));

chrome.runtime.onMessage.addListener((obj, sender, sendResponse) => _handleMessage(obj, sendResponse));

export {
	sendMessage,
	addListener,
};
