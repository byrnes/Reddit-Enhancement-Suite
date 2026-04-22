/* @flow */

import test from 'ava';

import { detectAppType } from '../currentLocation.js';

function mockDocument({
	resOptions = false,
	xmlns = null,
	hasClassicHeader = false,
}: {|
	resOptions?: boolean,
	xmlns?: ?string,
	hasClassicHeader?: boolean,
|} = {}) {
	return {
		documentElement: {
			hasAttribute(name) {
				return name === 'res-options' ? resOptions : false;
			},
			getAttribute(name) {
				return name === 'xmlns' ? xmlns : null;
			},
		},
		querySelector(selector) {
			if (selector === '#header, #sr-header-area' && hasClassicHeader) {
				return {};
			}
			return null;
		},
	};
}

test('detectAppType identifies options pages first', t => {
	t.is(detectAppType(mockDocument({ resOptions: true }), 'old.reddit.com'), 'options');
});

test('detectAppType identifies old reddit via namespace', t => {
	t.is(detectAppType(mockDocument({ xmlns: 'http://www.w3.org/1999/xhtml' }), 'www.reddit.com'), 'r2');
});

test('detectAppType identifies old reddit via classic hostname when namespace is unavailable', t => {
	t.is(detectAppType(mockDocument(), 'old.reddit.com'), 'r2');
	t.is(detectAppType(mockDocument(), 'en.reddit.com'), 'r2');
	t.is(detectAppType(mockDocument(), 'np.reddit.com'), 'r2');
});

test('detectAppType identifies old reddit via classic DOM markers on www host', t => {
	t.is(detectAppType(mockDocument({ hasClassicHeader: true }), 'www.reddit.com'), 'r2');
});

test('detectAppType defaults to d2x when old reddit markers are absent', t => {
	t.is(detectAppType(mockDocument(), 'www.reddit.com'), 'd2x');
});
