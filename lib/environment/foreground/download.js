/* @flow */

import { isSafari } from '../utils/browserTarget';
import { sendMessage } from './messaging';

function fallbackDownload(url: string, filename?: string) {
	const link = document.createElement('a');
	link.href = url;
	if (filename) link.download = filename;
	link.rel = 'noopener noreferrer';
	link.target = '_blank';
	link.style.display = 'none';

	const parent = document.body || document.documentElement;
	parent.appendChild(link);
	link.click();
	link.remove();
}

export function download(url: string, filename?: string) {
	const resolvedUrl = new URL(url, location.href).href;

	if (isSafari) {
		fallbackDownload(resolvedUrl, filename);
		return Promise.resolve(true);
	}

	// Firefox and Chrome <a download> is same-origin only
	return sendMessage('download', {
		url: resolvedUrl,
		filename,
	});
}
