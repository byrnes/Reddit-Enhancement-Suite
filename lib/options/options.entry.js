/* @flow */

import './handleBlocking';
import * as Context from '../environment/foreground/context';
import * as Core from '../core/init';
import { allowedModules } from '../core/modules';
import * as SettingsConsole from './settingsConsole';

const safariDebug = (...args) => {
	if (process.env.BUILD_TARGET === 'safari') {
		console.info('[RES][options]', ...args);
	}
};

// The options page depends on the context object in order to generate correct links and perform requests against Reddit
Context.retrieveFromParent().then(async () => {
	safariDebug('Retrieved parent context', Context.data);
	allowedModules.push('nightMode', 'notifications');

	safariDebug('Initializing core');
	Core.init();

	safariDebug('Waiting for i18n');
	await Core.loadI18n;
	safariDebug('i18n loaded');

	safariDebug('Waiting for module options');
	await Core.loadOptions;
	safariDebug('module options loaded');

	safariDebug('Starting settings console UI');
	SettingsConsole.start();

	// Signal to settingsNavigation that it seems to be going well
	safariDebug('Settings console loaded successfully');
	window.parent.postMessage({ loadSuccess: true }, '*');
}).catch(e => {
	console.error(e);
	safariDebug('Settings console failed to load', e);
	const container = document.createElement('main');
	const title = document.createElement('h1');
	const message = document.createElement('p');
	const details = document.createElement('pre');
	const showDetails = process.env.NODE_ENV !== 'production';

	title.textContent = 'RES settings failed to load';
	message.textContent = e && e.message ?
		e.message :
		'An unknown error occurred while loading the RES settings console.';
	details.textContent = showDetails && e && e.stack ? e.stack : '';

	container.style.cssText = 'padding:24px;font:16px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;white-space:normal;';
	details.style.cssText = 'margin-top:16px;padding:12px;overflow:auto;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;white-space:pre-wrap;';

	container.append(title, message);
	if (showDetails) {
		container.append(details);
	}
	document.body.replaceChildren(container);
	window.parent.postMessage({ failedToLoad: true }, '*');
});
