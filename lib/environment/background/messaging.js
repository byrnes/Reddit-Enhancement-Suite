/* @flow */

import { createMessageHandler } from '../utils/messaging.js';
import { apiToPromise } from '../utils/api.js';

const _sendMessage = apiToPromise(chrome.tabs.sendMessage, chrome.tabs);

const {
	_handleMessage,
	sendMessage,
	addListener,
} = createMessageHandler((obj, tabId) => _sendMessage(tabId, obj));

chrome.runtime.onMessage.addListener((obj, sender, sendResponse) => _handleMessage(obj, sendResponse, sender));

export {
	sendMessage,
	addListener,
};
