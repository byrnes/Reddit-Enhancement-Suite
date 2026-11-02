/* @flow */

import { createMessageHandler } from '../utils/messaging.js';
import type { MessageHandler } from '../utils/messaging';
import { apiToPromise } from '../utils/api.js';

const _sendMessage = apiToPromise(chrome.tabs.sendMessage, chrome.tabs);

type MessageSenderContext = {
	tab: {
		id: number,
		index: number,
		incognito: boolean,
		cookieStoreId?: string,
		...
	},
	frameId?: number,
	...
};

const {
	_handleMessage,
	sendMessage,
	addListener,
}: MessageHandler<number, MessageSenderContext> = createMessageHandler<number, MessageSenderContext>((obj, tabId) => _sendMessage(tabId, obj));

chrome.runtime.onMessage.addListener((obj, sender, sendResponse) => _handleMessage(obj, sendResponse, sender));

export {
	sendMessage,
	addListener,
};
