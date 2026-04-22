/* @flow */

/* eslint-disable ava/use-test */
import anyTest from 'ava';
import type { TestInterface } from 'ava';
/* eslint-enable ava/use-test */

import { createMessageHandler } from '../messaging.js';
import { withMessageTimeout } from '../../foreground/messaging.js';

const test: TestInterface<{ _realConsoleError: * }> = (anyTest: any);

test.before(t => {
	t.context._realConsoleError = console.error;
	// $FlowIgnore
	console.error = () => {};
});

test.after(t => {
	// $FlowIgnore
	console.error = t.context._realConsoleError;
});

function createPair() {
	// Simulates foreground listener
	const { _handleMessage: _handleMessageB, ...a } = createMessageHandler((info, context) =>
		new Promise(resolve => { _handleMessageA(info, resolve, context); }),
	);

	// Simulates background listener
	const { _handleMessage: _handleMessageA, ...b } = createMessageHandler((info, context) => (
		new Promise(resolve => { _handleMessageB(info, resolve, context); })
	), true);

	return { a, b };
}

const delay = ms => new Promise(resolve => {
	setTimeout(resolve, ms);
});

test('adding duplicate listener', t => {
	const { a: { addListener } } = createPair();

	addListener('foobar', () => {});
	t.throws(() => addListener('foobar', () => {}), { message: /foobar/ });
});

test('backend handler', async t => {
	const { a: { sendMessage }, b: { addListener } } = createPair();
	addListener('addOne', x => x + 1);

	const response = sendMessage('addOne', 3);
	t.true(typeof response.then === 'function', 'response is a promise');
	t.is(await response, 4);
});

test('backend handler returning a promise', async t => {
	const { a: { sendMessage }, b: { addListener } } = createPair();
	addListener('addOne', x => Promise.resolve(x + 1));

	const response = sendMessage('addOne', 3);
	t.true(typeof response.then === 'function', 'response is a promise');
	t.is(await response, 4);
});

test('backend handler with context', async t => {
	const { a: { sendMessage }, b: { addListener } } = createPair();
	addListener('addOnePlusContext', (x, context) => x + 1 + (context: any).tab.id);

	t.is(await sendMessage('addOnePlusContext', 3, { tab: { id: 5 } }), 9);
});

test('erroring backend handler', async t => {
	const { a: { sendMessage }, b: { addListener } } = createPair();
	addListener('throwError', () => { throw new Error('foo'); });
	addListener('rejectPromise', () => Promise.reject(new Error('bar')));

	await t.throwsAsync(sendMessage('throwError'), { message: 'foo' });
	await t.throwsAsync(sendMessage('rejectPromise'), { message: 'bar' });
});

test('backend listener invalid type', async t => {
	const { a: { sendMessage } } = createPair();
	await t.throwsAsync(sendMessage('foobar'), { message: /foobar/ });
});

test('message timeout can be disabled for long-running responses', async t => {
	let timedOut = false;

	const response = withMessageTimeout(
		new Promise(resolve => {
			setTimeout(() => resolve('ok'), 20);
		}),
		{ type: 'slow' },
		null,
		() => { timedOut = true; },
	);

	t.is(await response, 'ok');
	t.false(timedOut);
});

test('message timeout is cleared after a successful response', async t => {
	let timedOut = false;

	const response = withMessageTimeout(
		new Promise(resolve => {
			setTimeout(() => resolve('ok'), 5);
		}),
		{ type: 'fast' },
		20,
		() => { timedOut = true; },
	);

	t.is(await response, 'ok');
	await delay(30);
	t.false(timedOut);
});

test('message timeout rejects when a response never arrives', async t => {
	let timeoutCalls = 0;

	await t.throwsAsync(
		withMessageTimeout(
			new Promise(() => {}),
			{ type: 'stuck' },
			10,
			() => { timeoutCalls += 1; },
		),
		{ message: 'Timed out waiting for runtime response: stuck' },
	);

	t.is(timeoutCalls, 1);
});
